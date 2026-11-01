// DietCraft API Client

export const API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async patch(url, data) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  // Recipes
  getRecipes(category = '', search = '', tag = '') {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (tag) params.append('tag', tag);
    return this.get(`/api/recipes?${params.toString()}`);
  },

  getRecipe(id) {
    return this.get(`/api/recipes/${id}`);
  },

  createRecipe(data) {
    return this.post('/api/recipes', data);
  },

  updateRecipe(id, data) {
    return this.put(`/api/recipes/${id}`, data);
  },

  deleteRecipe(id) {
    return this.delete(`/api/recipes/${id}`);
  },

  getCategories() {
    return this.get('/api/recipes/categories');
  },

  // Meal Plans
  getMealPlans(startDate, endDate) {
    return this.get(`/api/mealplans?start_date=${startDate}&end_date=${endDate}`);
  },

  saveMealPlan(data) {
    return this.post('/api/mealplans', data);
  },

  deleteMealPlan(id) {
    return this.delete(`/api/mealplans/${id}`);
  },

  autoPlan(data) {
    return this.post('/api/mealplans/auto-plan', data);
  },

  copyWeek(sourceStart, targetStart) {
    return this.post(`/api/mealplans/copy-week?source_start=${sourceStart}&target_start=${targetStart}`);
  },

  // Shopping Lists
  getShoppingLists() {
    return this.get('/api/shopping');
  },

  getShoppingList(id) {
    return this.get(`/api/shopping/${id}`);
  },

  generateShoppingList(data) {
    return this.post('/api/shopping/generate', data);
  },

  updateShoppingItem(itemId, data) {
    return this.patch(`/api/shopping/items/${itemId}`, data);
  },

  addCustomItem(listId, data) {
    return this.post(`/api/shopping/${listId}/items`, data);
  },

  deleteShoppingItem(itemId) {
    return this.delete(`/api/shopping/items/${itemId}`);
  },

  deleteShoppingList(listId) {
    return this.delete(`/api/shopping/${listId}`);
  },

  getPriceHistory() {
    return this.get('/api/shopping/price-history/list');
  },

  // System & Settings
  getSystemInfo() {
    return this.get('/api/system/info');
  },

  updateSettings(data) {
    return this.post('/api/system/settings', data);
  }
};
