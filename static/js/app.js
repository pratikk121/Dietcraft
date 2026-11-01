// DietCraft Core Application
import { API } from './api.js';
import { Recipes } from './recipes.js';
import { Planner } from './planner.js';
import { Shopping } from './shopping.js';

let deferredInstallPrompt = null;

export const DietCraft = {
  Recipes,
  Planner,
  Shopping,

  async init() {
    window.DietCraft = this;

    this.bindNavigation();
    this.registerServiceWorker();
    this.bindInstallPrompt();
    this.bindModalCloseButtons();
    this.bindSettingsEvents();

    // Initialize modules
    await Recipes.init();
    await Planner.init();
    await Shopping.init();

    // Check system info
    this.loadSystemInfo();
  },

  bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      deferredInstallPrompt = e;
      console.log('beforeinstallprompt captured!');

      // Show in-app install buttons
      document.querySelectorAll('.btn-install-pwa').forEach(btn => {
        btn.style.display = 'inline-flex';
      });
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      document.querySelectorAll('.btn-install-pwa').forEach(btn => {
        btn.style.display = 'none';
      });
      this.showToast('DietCraft was installed on your device! 🎉');
    });

    document.querySelectorAll('.btn-install-pwa').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          console.log('Install prompt outcome:', outcome);
          if (outcome === 'accepted') {
            this.showToast('Installing DietCraft to your home screen...');
          }
          deferredInstallPrompt = null;
        } else {
          // If browser blocked it due to HTTP LAN restriction, open helper modal
          this.openMobileConnectModal();
        }
      });
    });
  },

  bindNavigation() {
    // Desktop sidebar
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    // Mobile bottom nav
    document.querySelectorAll('.bottom-nav .bottom-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    // Mobile connect button
    document.querySelectorAll('.btn-connect-mobile').forEach(btn => {
      btn.addEventListener('click', () => this.openMobileConnectModal());
    });
  },

  switchView(viewName) {
    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

    // Deactivate all nav items
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.remove('active'));

    // Activate selected view
    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // Activate corresponding nav items
    document.querySelectorAll(`[data-view="${viewName}"]`).forEach(n => n.classList.add('active'));

    // Trigger module refresh if needed
    if (viewName === 'recipes') Recipes.loadRecipes();
    if (viewName === 'planner') Planner.renderCalendar();
    if (viewName === 'shopping') Shopping.loadShoppingLists();
    if (viewName === 'settings') this.loadSettingsView();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  bindModalCloseButtons() {
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.classList.contains('modal-close')) {
          el.closest('.modal-backdrop').classList.remove('active');
        }
      });
    });
  },

  bindSettingsEvents() {
    document.getElementById('settings-currency-select')?.addEventListener('change', async (e) => {
      const currency = e.target.value;
      try {
        await API.updateSettings({ currency });
        this.showToast('Currency preference updated!');
        setTimeout(() => window.location.reload(), 500);
      } catch (err) {
        this.showToast('Failed to save settings: ' + err.message);
      }
    });
  },

  async loadSettingsView() {
    try {
      const info = await API.getSystemInfo();
      document.getElementById('settings-local-ip').textContent = info.local_ip;
      document.getElementById('settings-mobile-url').textContent = info.mobile_url;
      document.getElementById('settings-recipe-count').textContent = info.stats.recipes;
      document.getElementById('settings-meal-count').textContent = info.stats.meals_planned;
      document.getElementById('settings-list-count').textContent = info.stats.shopping_lists;

      if (info.settings && info.settings.currency) {
        const sel = document.getElementById('settings-currency-select');
        if (sel) sel.value = info.settings.currency;
      }

      // Load price history
      const history = await API.getPriceHistory();
      const histTable = document.getElementById('price-history-table-body');
      if (histTable) {
        if (history.length === 0) {
          histTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">No prices recorded yet. Prices you enter while shopping will appear here!</td></tr>';
        } else {
          histTable.innerHTML = history.map(h => `
            <tr>
              <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 600;">${h.ingredient_name}</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">${h.unit}</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #34d399; font-weight: 700;">${info.settings?.currency || '$'}${h.price.toFixed(2)}</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.85rem;">${h.date}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  async loadSystemInfo() {
    try {
      const info = await API.getSystemInfo();
      const badge = document.getElementById('server-status-badge');
      if (badge) badge.textContent = `${info.local_ip}:8000`;
    } catch (e) {
      console.warn('System info load error', e);
    }
  },

  async openMobileConnectModal() {
    const modal = document.getElementById('mobile-connect-modal');
    try {
      const info = await API.getSystemInfo();
      const mobileUrl = info.mobile_url;
      document.getElementById('mobile-connect-link').textContent = mobileUrl;
      document.getElementById('mobile-connect-link').href = mobileUrl;

      const qrImg = document.getElementById('mobile-qr-image');
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}&bgcolor=1e293b&color=34d399`;
      }

      const flagGuide = document.getElementById('flags-guide-ip');
      if (flagGuide) flagGuide.textContent = mobileUrl;

      modal.classList.add('active');
    } catch (err) {
      this.showToast('Could not load mobile URL: ' + err.message);
    }
  },

  showToast(message, duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('DietCraft ServiceWorker registered with scope:', reg.scope))
          .catch(err => console.log('ServiceWorker registration error:', err));
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  DietCraft.init();
});
