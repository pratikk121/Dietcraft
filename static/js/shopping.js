// DietCraft Shopping Lists & Supermarket Mode Controller
import { API } from './api.js';

let activeShoppingListId = null;
let activeShoppingListData = null;
let currencySymbol = '$';

export const Shopping = {
  async init() {
    this.bindEvents();
    await this.loadCurrency();
    await this.loadShoppingLists();
  },

  async loadCurrency() {
    try {
      const info = await API.getSystemInfo();
      if (info.settings && info.settings.currency) {
        currencySymbol = info.settings.currency;
      }
    } catch (e) {
      console.warn('Using default currency $', e);
    }
  },

  bindEvents() {
    document.getElementById('btn-new-shopping-list')?.addEventListener('click', () => {
      this.openGenerateModal();
    });

    document.getElementById('btn-back-to-lists')?.addEventListener('click', () => {
      this.closeActiveShoppingView();
    });

    document.getElementById('btn-add-shopping-custom-item')?.addEventListener('click', () => {
      this.openCustomItemModal();
    });

    const genForm = document.getElementById('generate-shopping-form');
    if (genForm) {
      genForm.addEventListener('submit', (e) => this.handleGenerateSubmit(e));
    }

    const customItemForm = document.getElementById('custom-item-form');
    if (customItemForm) {
      customItemForm.addEventListener('submit', (e) => this.handleCustomItemSubmit(e));
    }
  },

  async loadShoppingLists() {
    const container = document.getElementById('shopping-lists-overview');
    if (!container) return;

    container.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Loading shopping lists...</div>';

    try {
      const lists = await API.getShoppingLists();
      if (lists.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
            <p style="font-size: 1.15rem; margin-bottom: 12px;">No shopping lists created yet.</p>
            <p style="font-size: 0.9rem; margin-bottom: 20px; color: var(--text-muted);">Plan meals on the calendar, then generate your monthly grocery list with one tap!</p>
            <button class="btn btn-primary" onclick="window.DietCraft.Shopping.openGenerateModal()">+ Generate New Shopping List</button>
          </div>
        `;
        return;
      }

      container.innerHTML = lists.map(l => this.renderListOverviewCard(l)).join('');

      container.querySelectorAll('.shopping-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-delete-btn')) return;
          const id = card.dataset.id;
          this.openActiveShoppingView(id);
        });
      });
    } catch (err) {
      container.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Error: ${err.message}</div>`;
    }
  },

  renderListOverviewCard(list) {
    const pct = list.total_items > 0 ? Math.round((list.checked_items / list.total_items) * 100) : 0;
    return `
      <div class="shopping-card" data-id="${list.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">${this.escapeHtml(list.name)}</h3>
            <span style="font-size: 0.82rem; color: var(--text-muted);">Range: ${list.start_date} to ${list.end_date}</span>
          </div>
          <button class="btn btn-danger btn-sm btn-icon card-delete-btn" title="Delete list" onclick="window.DietCraft.Shopping.handleDeleteList(${list.id})">🗑️</button>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
            <span style="color: var(--text-secondary);">${list.checked_items} of ${list.total_items} items collected</span>
            <span style="color: #34d399; font-weight: 600;">${pct}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Spent: <strong style="color: #34d399;">${currencySymbol}${list.total_spent.toFixed(2)}</strong></span>
          <span class="btn btn-secondary btn-sm" style="font-size: 0.8rem; pointer-events: none;">Open Supermarket Mode 🛒</span>
        </div>
      </div>
    `;
  },

  openGenerateModal(prefillName = '', prefillStart = '', prefillEnd = '') {
    const modal = document.getElementById('generate-shopping-modal');
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');

    const defaultStart = prefillStart || `${year}-${pad(month + 1)}-01`;
    const defaultEnd = prefillEnd || `${year}-${pad(month + 1)}-${pad(lastDay)}`;
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const defaultName = prefillName || `${monthNames[month]} ${year} Monthly Shopping`;

    document.getElementById('gen-shopping-name').value = defaultName;
    document.getElementById('gen-shopping-start').value = defaultStart;
    document.getElementById('gen-shopping-end').value = defaultEnd;

    modal.classList.add('active');
  },

  async handleGenerateSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('gen-shopping-name').value.trim();
    const start_date = document.getElementById('gen-shopping-start').value;
    const end_date = document.getElementById('gen-shopping-end').value;

    try {
      const newList = await API.generateShoppingList({
        name,
        start_date,
        end_date
      });

      document.getElementById('generate-shopping-modal').classList.remove('active');
      window.DietCraft.showToast('Monthly shopping list generated!');
      await this.openActiveShoppingView(newList.id);
    } catch (err) {
      window.DietCraft.showToast('Generation error: ' + err.message);
    }
  },

  async openActiveShoppingView(listId) {
    activeShoppingListId = listId;

    document.getElementById('shopping-overview-section').style.display = 'none';
    const detailSection = document.getElementById('shopping-detail-section');
    detailSection.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    await this.renderActiveShoppingList();
  },

  closeActiveShoppingView() {
    activeShoppingListId = null;
    document.getElementById('shopping-detail-section').style.display = 'none';
    document.getElementById('shopping-overview-section').style.display = 'block';
    this.loadShoppingLists();
  },

  async renderActiveShoppingList() {
    if (!activeShoppingListId) return;

    try {
      const list = await API.getShoppingList(activeShoppingListId);
      activeShoppingListData = list;

      document.getElementById('active-list-title').textContent = list.name;
      document.getElementById('active-stat-total-items').textContent = `${list.checked_items} / ${list.total_items}`;
      document.getElementById('active-stat-spent').textContent = `${currencySymbol}${list.total_spent.toFixed(2)}`;
      document.getElementById('active-stat-estimated').textContent = `${currencySymbol}${list.total_estimated.toFixed(2)}`;

      const pct = list.total_items > 0 ? Math.round((list.checked_items / list.total_items) * 100) : 0;
      document.getElementById('active-list-progress-bar').style.width = `${pct}%`;

      // Group items by category (aisle)
      const aisles = {};
      list.items.forEach(item => {
        const cat = item.category || 'Pantry';
        aisles[cat] = aisles[cat] || [];
        aisles[cat].push(item);
      });

      const container = document.getElementById('shopping-aisles-container');
      if (list.items.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No items in this list yet. Tap "+ Add Extra Item" to add groceries!
          </div>
        `;
        return;
      }

      // Order of typical grocery aisles
      const aisleOrder = ['Produce', 'Meat/Seafood', 'Dairy', 'Bakery', 'Pantry', 'Canned', 'Spices', 'Frozen', 'Other'];
      const presentAisles = Object.keys(aisles).sort((a, b) => {
        let ia = aisleOrder.indexOf(a);
        let ib = aisleOrder.indexOf(b);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        return ia - ib;
      });

      let html = '';
      presentAisles.forEach(aisleName => {
        const items = aisles[aisleName];
        const aisleChecked = items.filter(i => i.is_checked).length;
        html += `
          <div class="aisle-group">
            <div class="aisle-header">
              <span>🛒 ${aisleName}</span>
              <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: normal; margin-left: auto;">
                ${aisleChecked}/${items.length} collected
              </span>
            </div>
            <div class="shopping-items-list">
              ${items.map(i => this.renderShoppingItemRow(i)).join('')}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      this.attachItemEventListeners();

    } catch (err) {
      window.DietCraft.showToast('Failed to load shopping list: ' + err.message);
    }
  },

  renderShoppingItemRow(item) {
    const isChecked = item.is_checked;
    const actualPriceVal = item.actual_price !== null && item.actual_price !== undefined ? item.actual_price : '';

    return `
      <div class="shopping-item-row ${isChecked ? 'checked' : ''}" data-id="${item.id}">
        <div class="item-checkbox-wrap" onclick="window.DietCraft.Shopping.toggleItemCheck(${item.id}, ${!isChecked})">
          <div class="custom-checkbox">${isChecked ? '✓' : ''}</div>
          <div class="item-info">
            <span class="item-name">${this.escapeHtml(item.name)}</span>
            <span class="item-qty">${item.quantity} ${item.unit} ${item.estimated_price > 0 ? `· Est: ${currencySymbol}${item.estimated_price.toFixed(2)}` : ''}</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="price-input-wrap" title="Enter actual price paid at checkout">
            <span class="price-currency">${currencySymbol}</span>
            <input type="number" step="0.01" inputmode="decimal" 
                   class="price-input" 
                   placeholder="0.00" 
                   value="${actualPriceVal}" 
                   data-id="${item.id}"
                   onclick="event.stopPropagation()">
          </div>
          <button class="btn btn-sm btn-icon" style="color: var(--text-muted); background: transparent;" title="Delete" onclick="window.DietCraft.Shopping.handleDeleteItem(${item.id})">✕</button>
        </div>
      </div>
    `;
  },

  attachItemEventListeners() {
    // Price input change/blur listeners
    document.querySelectorAll('.shopping-items-list .price-input').forEach(input => {
      const savePrice = async () => {
        const itemId = input.dataset.id;
        const rawVal = input.value.trim();
        const price = rawVal !== '' ? parseFloat(rawVal) : null;

        try {
          await API.updateShoppingItem(itemId, { actual_price: price });
          // Recalculate totals dynamically
          await this.recalculateTotals();
        } catch (err) {
          console.error('Failed to update price', err);
        }
      };

      input.addEventListener('change', savePrice);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });
    });
  },

  async toggleItemCheck(itemId, newChecked) {
    try {
      // Optimistic UI update
      const row = document.querySelector(`.shopping-item-row[data-id="${itemId}"]`);
      if (row) {
        if (newChecked) {
          row.classList.add('checked');
          row.querySelector('.custom-checkbox').textContent = '✓';
        } else {
          row.classList.remove('checked');
          row.querySelector('.custom-checkbox').textContent = '';
        }
      }

      await API.updateShoppingItem(itemId, { is_checked: newChecked });
      await this.recalculateTotals();
    } catch (err) {
      window.DietCraft.showToast('Error updating item check: ' + err.message);
      this.renderActiveShoppingList();
    }
  },

  async recalculateTotals() {
    if (!activeShoppingListId) return;
    try {
      const list = await API.getShoppingList(activeShoppingListId);
      document.getElementById('active-stat-total-items').textContent = `${list.checked_items} / ${list.total_items}`;
      document.getElementById('active-stat-spent').textContent = `${currencySymbol}${list.total_spent.toFixed(2)}`;
      document.getElementById('active-stat-estimated').textContent = `${currencySymbol}${list.total_estimated.toFixed(2)}`;
      const pct = list.total_items > 0 ? Math.round((list.checked_items / list.total_items) * 100) : 0;
      document.getElementById('active-list-progress-bar').style.width = `${pct}%`;
    } catch (e) {
      console.error(e);
    }
  },

  openCustomItemModal() {
    const modal = document.getElementById('custom-item-modal');
    document.getElementById('custom-item-form').reset();
    modal.classList.add('active');
  },

  async handleCustomItemSubmit(e) {
    e.preventDefault();
    if (!activeShoppingListId) return;

    const name = document.getElementById('custom-item-name').value.trim();
    const quantity = parseFloat(document.getElementById('custom-item-qty').value) || 1;
    const unit = document.getElementById('custom-item-unit').value.trim() || 'pcs';
    const category = document.getElementById('custom-item-category').value;
    const estVal = document.getElementById('custom-item-est-price').value.trim();
    const estimated_price = estVal !== '' ? parseFloat(estVal) : 0.0;

    try {
      await API.addCustomItem(activeShoppingListId, {
        name,
        quantity,
        unit,
        category,
        estimated_price
      });

      document.getElementById('custom-item-modal').classList.remove('active');
      window.DietCraft.showToast('Item added to shopping list!');
      await this.renderActiveShoppingList();
    } catch (err) {
      window.DietCraft.showToast('Failed to add item: ' + err.message);
    }
  },

  async handleDeleteItem(itemId) {
    try {
      await API.deleteShoppingItem(itemId);
      await this.renderActiveShoppingList();
    } catch (err) {
      window.DietCraft.showToast('Failed to delete item: ' + err.message);
    }
  },

  async handleDeleteList(listId) {
    if (!confirm('Are you sure you want to delete this shopping list?')) return;
    try {
      await API.deleteShoppingList(listId);
      window.DietCraft.showToast('Shopping list deleted');
      await this.loadShoppingLists();
    } catch (err) {
      window.DietCraft.showToast('Error deleting list: ' + err.message);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
