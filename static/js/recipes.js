// DietCraft Recipes Controller
import { API } from './api.js';

let currentCategory = 'All';
let currentSearch = '';
let editingRecipeId = null;

export const Recipes = {
  async init() {
    this.bindEvents();
    await this.loadCategories();
    await this.loadRecipes();
  },

  bindEvents() {
    const searchInput = document.getElementById('recipe-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim();
        this.loadRecipes();
      });
    }

    const newBtn = document.getElementById('btn-new-recipe');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.openRecipeModal());
    }

    const addIngBtn = document.getElementById('btn-add-ingredient');
    if (addIngBtn) {
      addIngBtn.addEventListener('click', () => this.addIngredientRow());
    }

    const form = document.getElementById('recipe-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveRecipe(e));
    }
  },

  async loadCategories() {
    try {
      const categories = await API.getCategories();
      const container = document.getElementById('recipe-category-chips');
      if (!container) return;

      container.innerHTML = `
        <button class="chip active" data-cat="All">All Recipes</button>
        ${categories.map(c => `<button class="chip" data-cat="${c}">${c}</button>`).join('')}
      `;

      container.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentCategory = btn.dataset.cat;
          this.loadRecipes();
        });
      });
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  },

  async loadRecipes() {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    grid.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Loading recipes...</div>';

    try {
      const recipes = await API.getRecipes(currentCategory, currentSearch);
      if (recipes.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
            <p style="font-size: 1.1rem; margin-bottom: 12px;">No recipes found in this category.</p>
            <button class="btn btn-primary" onclick="document.getElementById('btn-new-recipe').click()">+ Create Your First Recipe</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = recipes.map(r => this.renderRecipeCard(r)).join('');

      // Attach card click handlers
      grid.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-action-btn')) return;
          const id = card.dataset.id;
          this.viewRecipeDetails(id);
        });
      });
    } catch (err) {
      grid.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Error loading recipes: ${err.message}</div>`;
    }
  },

  renderRecipeCard(r) {
    const badgeClass = `badge-${r.category.toLowerCase()}`;
    const totalTime = (r.prep_time || 0) + (r.cook_time || 0);
    const ingCount = r.ingredients ? r.ingredients.length : 0;

    return `
      <div class="recipe-card" data-id="${r.id}">
        <div class="recipe-card-header">
          <span class="recipe-category-badge ${badgeClass}">${r.category}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${r.servings} Servings</span>
        </div>
        <h3 class="recipe-title">${this.escapeHtml(r.title)}</h3>
        <p class="recipe-desc">${this.escapeHtml(r.description || 'No description provided.')}</p>
        
        <div class="recipe-meta-row">
          <span class="recipe-meta-item">⏱️ ${totalTime}m total</span>
          <span class="recipe-meta-item">🥗 ${ingCount} ingredients</span>
        </div>

        <div class="recipe-card-footer">
          <span style="font-size: 0.75rem; color: var(--primary); font-weight: 600;">Tap to view recipe</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm card-action-btn" onclick="window.DietCraft.Recipes.openRecipeModal(${r.id})">Edit</button>
          </div>
        </div>
      </div>
    `;
  },

  async viewRecipeDetails(id) {
    try {
      const recipe = await API.getRecipe(id);
      const modal = document.getElementById('recipe-detail-modal');
      const body = document.getElementById('recipe-detail-body');
      const title = document.getElementById('recipe-detail-title');

      title.textContent = recipe.title;

      const ingredientsList = recipe.ingredients.map(i => `
        <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <span><strong>${i.name}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${i.category})</span></span>
          <span style="color: #34d399; font-weight: 600;">${i.quantity} ${i.unit}</span>
        </li>
      `).join('');

      body.innerHTML = `
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <span class="recipe-category-badge badge-${recipe.category.toLowerCase()}">${recipe.category}</span>
          <span style="color: var(--text-secondary); font-size: 0.9rem;">👥 ${recipe.servings} Servings</span>
          <span style="color: var(--text-secondary); font-size: 0.9rem;">⏱️ Prep: ${recipe.prep_time}m | Cook: ${recipe.cook_time}m</span>
        </div>

        ${recipe.description ? `<p style="color: var(--text-secondary); margin-bottom: 20px; font-style: italic;">${this.escapeHtml(recipe.description)}</p>` : ''}

        <h4 style="margin-bottom: 10px; color: #34d399;">Ingredients</h4>
        <ul style="list-style: none; margin-bottom: 24px;">
          ${ingredientsList || '<li style="color: var(--text-muted);">No ingredients listed.</li>'}
        </ul>

        <h4 style="margin-bottom: 10px; color: #34d399;">Instructions</h4>
        <div style="white-space: pre-line; line-height: 1.6; color: var(--text-primary); margin-bottom: 24px; background: var(--bg-card); padding: 16px; border-radius: var(--radius-md);">
          ${this.escapeHtml(recipe.instructions || 'No instructions provided.')}
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="window.DietCraft.Recipes.openRecipeModal(${recipe.id})">Edit Recipe</button>
          <button class="btn btn-danger" onclick="window.DietCraft.Recipes.handleDelete(${recipe.id})">Delete</button>
        </div>
      `;

      modal.classList.add('active');
    } catch (err) {
      window.DietCraft.showToast('Error opening recipe: ' + err.message);
    }
  },

  async openRecipeModal(recipeId = null) {
    editingRecipeId = recipeId;
    const modal = document.getElementById('recipe-editor-modal');
    const title = document.getElementById('recipe-editor-title');
    const ingredientsContainer = document.getElementById('recipe-ingredients-rows');

    // Reset details modal if open
    document.getElementById('recipe-detail-modal')?.classList.remove('active');

    ingredientsContainer.innerHTML = '';

    if (recipeId) {
      title.textContent = 'Edit Recipe';
      try {
        const recipe = await API.getRecipe(recipeId);
        document.getElementById('recipe-input-title').value = recipe.title;
        document.getElementById('recipe-input-category').value = recipe.category;
        document.getElementById('recipe-input-servings').value = recipe.servings;
        document.getElementById('recipe-input-preptime').value = recipe.prep_time;
        document.getElementById('recipe-input-cooktime').value = recipe.cook_time;
        document.getElementById('recipe-input-desc').value = recipe.description || '';
        document.getElementById('recipe-input-instructions').value = recipe.instructions || '';
        document.getElementById('recipe-input-tags').value = recipe.tags || '';

        if (recipe.ingredients && recipe.ingredients.length > 0) {
          recipe.ingredients.forEach(i => this.addIngredientRow(i));
        } else {
          this.addIngredientRow();
        }
      } catch (err) {
        window.DietCraft.showToast('Error loading recipe for edit: ' + err.message);
        return;
      }
    } else {
      title.textContent = 'Create New Recipe';
      document.getElementById('recipe-form').reset();
      document.getElementById('recipe-input-servings').value = 2;
      document.getElementById('recipe-input-preptime').value = 15;
      document.getElementById('recipe-input-cooktime').value = 20;
      this.addIngredientRow();
      this.addIngredientRow();
    }

    modal.classList.add('active');
  },

  addIngredientRow(data = null) {
    const container = document.getElementById('recipe-ingredients-rows');
    const row = document.createElement('div');
    row.className = 'ingredient-edit-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr auto; gap: 8px; margin-bottom: 8px; align-items: center;';

    row.innerHTML = `
      <input type="text" class="form-control ing-name" placeholder="Item (e.g. Chicken breast)" value="${data ? this.escapeHtml(data.name) : ''}" required>
      <input type="number" step="any" class="form-control ing-qty" placeholder="Qty" value="${data ? data.quantity : ''}" required>
      <select class="form-control ing-unit">
        ${['g', 'kg', 'ml', 'l', 'pcs', 'slices', 'cups', 'tbsp', 'tsp', 'cloves', 'pack'].map(u => 
          `<option value="${u}" ${data && data.unit.toLowerCase() === u ? 'selected' : ''}>${u}</option>`
        ).join('')}
      </select>
      <select class="form-control ing-cat">
        ${['Produce', 'Meat/Seafood', 'Dairy', 'Bakery', 'Pantry', 'Spices', 'Canned', 'Frozen', 'Other'].map(c => 
          `<option value="${c}" ${data && data.category === c ? 'selected' : ''}>${c}</option>`
        ).join('')}
      </select>
      <button type="button" class="btn btn-danger btn-sm btn-icon" title="Remove" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(row);
  },

  async handleSaveRecipe(e) {
    e.preventDefault();

    const title = document.getElementById('recipe-input-title').value.trim();
    const category = document.getElementById('recipe-input-category').value;
    const servings = parseInt(document.getElementById('recipe-input-servings').value, 10) || 2;
    const prep_time = parseInt(document.getElementById('recipe-input-preptime').value, 10) || 0;
    const cook_time = parseInt(document.getElementById('recipe-input-cooktime').value, 10) || 0;
    const description = document.getElementById('recipe-input-desc').value.trim();
    const instructions = document.getElementById('recipe-input-instructions').value.trim();
    const tags = document.getElementById('recipe-input-tags').value.trim();

    const ingredientRows = document.querySelectorAll('#recipe-ingredients-rows .ingredient-edit-row');
    const ingredients = [];

    ingredientRows.forEach(row => {
      const name = row.querySelector('.ing-name').value.trim();
      const quantity = parseFloat(row.querySelector('.ing-qty').value);
      const unit = row.querySelector('.ing-unit').value;
      const ingCat = row.querySelector('.ing-cat').value;

      if (name && !isNaN(quantity) && quantity > 0) {
        ingredients.push({ name, quantity, unit, category: ingCat });
      }
    });

    const payload = {
      title,
      category,
      servings,
      prep_time,
      cook_time,
      description,
      instructions,
      tags,
      ingredients
    };

    try {
      if (editingRecipeId) {
        await API.updateRecipe(editingRecipeId, payload);
        window.DietCraft.showToast('Recipe updated successfully!');
      } else {
        await API.createRecipe(payload);
        window.DietCraft.showToast('Recipe created successfully!');
      }

      document.getElementById('recipe-editor-modal').classList.remove('active');
      await this.loadRecipes();
      await this.loadCategories();
    } catch (err) {
      window.DietCraft.showToast('Failed to save recipe: ' + err.message);
    }
  },

  async handleDelete(recipeId) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await API.deleteRecipe(recipeId);
      window.DietCraft.showToast('Recipe deleted');
      document.getElementById('recipe-detail-modal').classList.remove('active');
      await this.loadRecipes();
    } catch (err) {
      window.DietCraft.showToast('Failed to delete recipe: ' + err.message);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
