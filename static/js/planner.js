// DietCraft Monthly & Weekly Meal Planner Controller
import { API } from './api.js';

let currentDate = new Date();
let currentView = 'month'; // 'month' or 'week'
let cachedRecipes = [];

export const Planner = {
  async init() {
    this.bindEvents();
    await this.refreshRecipesCache();
    await this.renderCalendar();
  },

  async refreshRecipesCache() {
    try {
      cachedRecipes = await API.getRecipes();
    } catch (e) {
      console.error(e);
    }
  },

  bindEvents() {
    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      this.renderCalendar();
    });

    document.getElementById('btn-next-month')?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      this.renderCalendar();
    });

    document.getElementById('btn-today-month')?.addEventListener('click', () => {
      currentDate = new Date();
      this.renderCalendar();
    });

    document.getElementById('btn-open-autoplan')?.addEventListener('click', () => {
      this.openAutoPlanModal();
    });

    document.getElementById('btn-planner-gen-shopping')?.addEventListener('click', () => {
      this.triggerMonthlyShoppingList();
    });

    const mealForm = document.getElementById('meal-plan-form');
    if (mealForm) {
      mealForm.addEventListener('submit', (e) => this.handleSaveMealPlan(e));
    }

    const autoPlanForm = document.getElementById('autoplan-form');
    if (autoPlanForm) {
      autoPlanForm.addEventListener('submit', (e) => this.handleAutoPlanSubmit(e));
    }
  },

  getMonthDateRange() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Start from first day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month + 1)}-01`;
    const endStr = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`;

    return { startStr, endStr, firstDay, lastDay, year, month };
  },

  async renderCalendar() {
    const titleEl = document.getElementById('calendar-month-title');
    const gridEl = document.getElementById('calendar-grid');
    if (!gridEl) return;

    const { startStr, endStr, firstDay, lastDay, year, month } = this.getMonthDateRange();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    if (titleEl) {
      titleEl.textContent = `${monthNames[month]} ${year}`;
    }

    gridEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">Loading meal calendar...</div>';

    try {
      // Fetch meal plans for the whole month
      const plans = await API.getMealPlans(startStr, endStr);

      // Group plans by date
      const plansByDate = {};
      plans.forEach(p => {
        plansByDate.setdefault = plansByDate.setdefault || {};
        if (!plansByDate[p.date]) plansByDate[p.date] = [];
        plansByDate[p.date].push(p);
      });

      // Calculate days in grid (Monday = 0)
      let startingDay = firstDay.getDay() - 1;
      if (startingDay === -1) startingDay = 6; // Sunday to end

      const daysInMonth = lastDay.getDate();
      const prevMonthLastDay = new Date(year, month, 0).getDate();

      let html = '';

      // Weekday headers
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      weekdays.forEach(wd => {
        html += `<div class="weekday-header">${wd}</div>`;
      });

      // Previous month filler days
      for (let i = startingDay - 1; i >= 0; i--) {
        const d = prevMonthLastDay - i;
        html += `<div class="day-cell other-month"><div class="day-number">${d}</div></div>`;
      }

      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
      const todayDate = today.getDate();

      // Current month days
      for (let day = 1; day <= daysInMonth; day++) {
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
        const isToday = isCurrentMonth && day === todayDate;
        const dayMeals = plansByDate[dateStr] || [];

        html += `
          <div class="day-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
            <div class="day-cell-top">
              <span class="day-number">${day}</span>
              <button class="day-add-btn" title="Add meal" onclick="window.DietCraft.Planner.openAddMealModal('${dateStr}')">+</button>
            </div>
            <div class="day-meals-container">
              ${dayMeals.map(m => this.renderMealPill(m)).join('')}
            </div>
          </div>
        `;
      }

      gridEl.innerHTML = html;

      // Attach click handlers on meal pills
      gridEl.querySelectorAll('.day-meal-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const mealId = pill.dataset.id;
          const planData = plans.find(p => p.id == mealId);
          if (planData) {
            Planner.openEditMealModal(planData);
          }
        });
      });

    } catch (err) {
      gridEl.innerHTML = `<div style="grid-column: 1 / -1; color: var(--accent-rose); padding: 20px;">Failed to load meal plans: ${err.message}</div>`;
    }
  },

  renderMealPill(meal) {
    const typeLabel = meal.meal_type.charAt(0).toUpperCase();
    const title = meal.recipe_title || meal.custom_title || 'Meal';
    return `
      <div class="day-meal-pill meal-${meal.meal_type}" data-id="${meal.id}" title="${meal.meal_type.toUpperCase()}: ${title} (${meal.servings} servings)">
        <span><strong>${typeLabel}:</strong> ${title}</span>
      </div>
    `;
  },

  openAddMealModal(dateStr, mealType = 'dinner') {
    const modal = document.getElementById('meal-plan-modal');
    document.getElementById('meal-plan-modal-title').textContent = `Plan Meal for ${dateStr}`;
    document.getElementById('plan-input-date').value = dateStr;
    document.getElementById('plan-input-type').value = mealType;
    document.getElementById('plan-input-servings').value = 2;
    document.getElementById('plan-input-custom').value = '';
    document.getElementById('plan-input-id').value = '';
    document.getElementById('btn-delete-meal-plan').style.display = 'none';

    this.populateRecipeSelect();
    modal.classList.add('active');
  },

  openEditMealModal(plan) {
    const modal = document.getElementById('meal-plan-modal');
    document.getElementById('meal-plan-modal-title').textContent = `Edit Meal (${plan.date})`;
    document.getElementById('plan-input-date').value = plan.date;
    document.getElementById('plan-input-type').value = plan.meal_type;
    document.getElementById('plan-input-servings').value = plan.servings || 2;
    document.getElementById('plan-input-custom').value = plan.custom_title || '';
    document.getElementById('plan-input-id').value = plan.id;
    document.getElementById('btn-delete-meal-plan').style.display = 'inline-flex';

    this.populateRecipeSelect(plan.recipe_id);
    modal.classList.add('active');
  },

  populateRecipeSelect(selectedId = null) {
    const select = document.getElementById('plan-input-recipe');
    select.innerHTML = '<option value="">-- Choose Recipe from Database --</option>';

    cachedRecipes.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `[${r.category}] ${r.title}`;
      if (selectedId && r.id == selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  },

  async handleSaveMealPlan(e) {
    e.preventDefault();
    const date = document.getElementById('plan-input-date').value;
    const meal_type = document.getElementById('plan-input-type').value;
    const recipe_id = document.getElementById('plan-input-recipe').value || null;
    const custom_title = document.getElementById('plan-input-custom').value.trim() || null;
    const servings = parseInt(document.getElementById('plan-input-servings').value, 10) || 2;

    if (!recipe_id && !custom_title) {
      window.DietCraft.showToast('Please select a recipe or enter a custom meal name');
      return;
    }

    try {
      await API.saveMealPlan({
        date,
        meal_type,
        recipe_id: recipe_id ? parseInt(recipe_id, 10) : null,
        custom_title,
        servings
      });

      document.getElementById('meal-plan-modal').classList.remove('active');
      window.DietCraft.showToast('Meal plan updated!');
      await this.renderCalendar();
    } catch (err) {
      window.DietCraft.showToast('Error saving meal plan: ' + err.message);
    }
  },

  async handleDeleteCurrentMeal() {
    const id = document.getElementById('plan-input-id').value;
    if (!id) return;

    try {
      await API.deleteMealPlan(id);
      document.getElementById('meal-plan-modal').classList.remove('active');
      window.DietCraft.showToast('Meal removed');
      await this.renderCalendar();
    } catch (err) {
      window.DietCraft.showToast('Failed to remove meal: ' + err.message);
    }
  },

  openAutoPlanModal() {
    const modal = document.getElementById('autoplan-modal');
    const { startStr, endStr } = this.getMonthDateRange();
    document.getElementById('autoplan-start').value = startStr;
    document.getElementById('autoplan-end').value = endStr;
    modal.classList.add('active');
  },

  async handleAutoPlanSubmit(e) {
    e.preventDefault();
    const start_date = document.getElementById('autoplan-start').value;
    const end_date = document.getElementById('autoplan-end').value;
    const overwrite_existing = document.getElementById('autoplan-overwrite').checked;
    const default_servings = parseInt(document.getElementById('autoplan-servings').value, 10) || 2;

    const meals_per_day = [];
    if (document.getElementById('autoplan-breakfast').checked) meals_per_day.push('breakfast');
    if (document.getElementById('autoplan-lunch').checked) meals_per_day.push('lunch');
    if (document.getElementById('autoplan-dinner').checked) meals_per_day.push('dinner');

    if (meals_per_day.length === 0) {
      window.DietCraft.showToast('Please check at least one meal type.');
      return;
    }

    try {
      const res = await API.autoPlan({
        start_date,
        end_date,
        meals_per_day,
        default_servings,
        overwrite_existing
      });

      document.getElementById('autoplan-modal').classList.remove('active');
      window.DietCraft.showToast(res.message);
      await this.renderCalendar();
    } catch (err) {
      window.DietCraft.showToast('Auto-plan error: ' + err.message);
    }
  },

  triggerMonthlyShoppingList() {
    const { startStr, endStr, month, year } = this.getMonthDateRange();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const defaultName = `${monthNames[month]} ${year} Grocery List`;

    window.DietCraft.switchView('shopping');
    window.DietCraft.Shopping.openGenerateModal(defaultName, startStr, endStr);
  }
};
