import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { INITIAL_RECIPES } from '../lib/seed-data';

export default function Home() {
  const [activeView, setActiveView] = useState('recipes');
  const [recipes, setRecipes] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [shoppingLists, setShoppingLists] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [currency, setCurrency] = useState('$');
  const [activeShoppingListId, setActiveShoppingListId] = useState(null);

  // Filters & Search
  const [recipeCategory, setRecipeCategory] = useState('All');
  const [recipeSearch, setRecipeSearch] = useState('');

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modals
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState(null);
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [mealPlanModal, setMealPlanModal] = useState(null);
  const [autoPlanModal, setAutoPlanModal] = useState(false);
  const [generateShoppingModal, setGenerateShoppingModal] = useState(false);
  const [customItemModal, setCustomItemModal] = useState(false);
  const [mobileConnectModal, setMobileConnectModal] = useState(false);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [toast, setToast] = useState('');

  // Show Toast Helper
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // Load Initial Data
  useEffect(() => {
    loadData();

    // Listen for PWA Install Prompt
    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const loadData = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        // Fetch from Supabase
        const { data: recData } = await supabase.from('recipes').select('*, ingredients(*)');
        setRecipes(recData || []);

        const { data: planData } = await supabase.from('meal_plans').select('*, recipes(title, category)');
        if (planData) setMealPlans(planData);

        const { data: shopData } = await supabase.from('shopping_lists').select('*, shopping_items(*)');
        if (shopData) setShoppingLists(shopData);

        const { data: priceData } = await supabase.from('price_history').select('*').order('date', { ascending: false });
        if (priceData) setPriceHistory(priceData);

        const { data: setData } = await supabase.from('settings').select('*');
        if (setData) {
          const curr = setData.find(s => s.key === 'currency');
          if (curr) setCurrency(curr.value);
        }
      } else {
        // LocalStorage Fallback
        const localRec = localStorage.getItem('dietcraft_recipes');
        setRecipes(localRec ? JSON.parse(localRec) : []);

        const localPlans = localStorage.getItem('dietcraft_meal_plans');
        if (localPlans) setMealPlans(JSON.parse(localPlans));

        const localShop = localStorage.getItem('dietcraft_shopping_lists');
        if (localShop) setShoppingLists(JSON.parse(localShop));

        const localPrices = localStorage.getItem('dietcraft_price_history');
        if (localPrices) setPriceHistory(JSON.parse(localPrices));

        const localCurr = localStorage.getItem('dietcraft_currency');
        if (localCurr) setCurrency(localCurr);
      }
    } catch (err) {
      console.error('Failed to load data', err);
      setRecipes(INITIAL_RECIPES);
    }
  };

  // Trigger PWA Install
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') showToast('Installing DietCraft to your device! 🎉');
      setDeferredPrompt(null);
    } else {
      setMobileConnectModal(true);
    }
  };

  // Recipe Filtered List
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchCat = recipeCategory === 'All' || r.category === recipeCategory;
      const matchSearch = !recipeSearch || 
        r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(recipeSearch.toLowerCase())) ||
        (r.tags && r.tags.toLowerCase().includes(recipeSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [recipes, recipeCategory, recipeSearch]);

  // Calendar Helpers
  const monthData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startingDay = firstDay.getDay() - 1;
    if (startingDay === -1) startingDay = 6; // Monday = 0

    const daysInMonth = lastDay.getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month + 1)}-01`;
    const endStr = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

    return {
      year,
      month,
      monthName: monthNames[month],
      startingDay,
      daysInMonth,
      prevMonthDays,
      startStr,
      endStr
    };
  }, [calendarDate]);

  // Active Shopping List
  const activeList = useMemo(() => {
    return shoppingLists.find(l => l.id === activeShoppingListId) || null;
  }, [shoppingLists, activeShoppingListId]);

  // Save Recipe
  const handleSaveRecipe = async (recipeData) => {
    if (isSupabaseConfigured && supabase) {
      if (recipeData.id) {
        // Update existing recipe
        await supabase.from('recipes').update({
          title: recipeData.title,
          category: recipeData.category,
          servings: recipeData.servings,
          prep_time: recipeData.prep_time,
          cook_time: recipeData.cook_time,
          description: recipeData.description,
          instructions: recipeData.instructions,
          tags: recipeData.tags
        }).eq('id', recipeData.id);

        if (recipeData.ingredients) {
          await supabase.from('ingredients').delete().eq('recipe_id', recipeData.id);
          const ingRows = recipeData.ingredients.map(ing => ({
            recipe_id: recipeData.id,
            name: ing.name.trim(),
            quantity: parseFloat(ing.quantity) || 1,
            unit: ing.unit,
            category: ing.category || 'Pantry'
          }));
          await supabase.from('ingredients').insert(ingRows);
        }
      } else {
        // Insert new recipe
        const { data: inserted } = await supabase.from('recipes').insert([{
          title: recipeData.title,
          category: recipeData.category,
          servings: recipeData.servings,
          prep_time: recipeData.prep_time,
          cook_time: recipeData.cook_time,
          description: recipeData.description,
          instructions: recipeData.instructions,
          tags: recipeData.tags
        }]).select();

        if (inserted && inserted[0] && recipeData.ingredients && recipeData.ingredients.length > 0) {
          const ingRows = recipeData.ingredients.map(ing => ({
            recipe_id: inserted[0].id,
            name: ing.name.trim(),
            quantity: parseFloat(ing.quantity) || 1,
            unit: ing.unit,
            category: ing.category || 'Pantry'
          }));
          await supabase.from('ingredients').insert(ingRows);
        }
      }
      await loadData();
    } else {
      let updated;
      if (recipeData.id) {
        updated = recipes.map(r => r.id === recipeData.id ? recipeData : r);
      } else {
        const newRec = { ...recipeData, id: Date.now() };
        updated = [...recipes, newRec];
      }
      setRecipes(updated);
      localStorage.setItem('dietcraft_recipes', JSON.stringify(updated));
    }
    setIsEditingRecipe(false);
    showToast('Recipe saved successfully!');
  };

  // Delete Recipe
  const handleDeleteRecipe = async (id) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;
    const updated = recipes.filter(r => r.id !== id);
    setRecipes(updated);
    localStorage.setItem('dietcraft_recipes', JSON.stringify(updated));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('recipes').delete().eq('id', id);
    }
    setSelectedRecipeDetail(null);
    showToast('Recipe deleted');
  };

  // Save Meal Plan Slot
  const handleSaveMealPlan = async (planData) => {
    const existingIndex = mealPlans.findIndex(
      p => p.date === planData.date && p.meal_type === planData.meal_type
    );
    let updated;
    if (existingIndex >= 0) {
      updated = [...mealPlans];
      updated[existingIndex] = { ...updated[existingIndex], ...planData };
    } else {
      updated = [...mealPlans, { ...planData, id: Date.now() }];
    }
    setMealPlans(updated);
    localStorage.setItem('dietcraft_meal_plans', JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      await supabase.from('meal_plans').upsert([planData]);
    }
    setMealPlanModal(null);
    showToast('Meal saved to planner!');
  };

  // Delete Meal Plan Slot
  const handleDeleteMealPlan = async (date, meal_type) => {
    const updated = mealPlans.filter(p => !(p.date === date && p.meal_type === meal_type));
    setMealPlans(updated);
    localStorage.setItem('dietcraft_meal_plans', JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      await supabase.from('meal_plans').delete().match({ date, meal_type });
    }
    setMealPlanModal(null);
    showToast('Meal removed');
  };

  // Auto-Plan Month
  const handleAutoPlan = (startDate, endDate, mealsToPlan, defaultServings) => {
    if (recipes.length === 0) {
      showToast('Please add at least one recipe first!');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    let curr = new Date(start);
    let newPlans = [...mealPlans];

    while (curr <= end) {
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`;

      mealsToPlan.forEach(mealType => {
        // Remove existing
        newPlans = newPlans.filter(p => !(p.date === dateStr && p.meal_type === mealType));

        // Pick matching recipe
        const matching = recipes.filter(r => r.category.toLowerCase() === mealType.toLowerCase());
        const chosen = matching.length > 0
          ? matching[Math.floor(Math.random() * matching.length)]
          : recipes[Math.floor(Math.random() * recipes.length)];

        newPlans.push({
          id: Date.now() + Math.random(),
          date: dateStr,
          meal_type: mealType,
          recipe_id: chosen.id,
          recipe_title: chosen.title,
          servings: defaultServings
        });
      });

      curr.setDate(curr.getDate() + 1);
    }

    setMealPlans(newPlans);
    localStorage.setItem('dietcraft_meal_plans', JSON.stringify(newPlans));
    setAutoPlanModal(false);
    showToast('Month automatically planned with delicious meals!');
  };

  // Generate Monthly Shopping List
  const handleGenerateShoppingList = (name, startDate, endDate) => {
    const relevantPlans = mealPlans.filter(p => p.date >= startDate && p.date <= endDate && p.recipe_id);
    if (relevantPlans.length === 0) {
      showToast('No planned meals with recipes found in this date range.');
      return;
    }

    const aggregated = {};

    relevantPlans.forEach(plan => {
      const recipe = recipes.find(r => r.id === plan.recipe_id);
      if (!recipe || !recipe.ingredients) return;

      const scale = (plan.servings || 2) / (recipe.servings || 2);

      recipe.ingredients.forEach(ing => {
        const key = `${ing.name.toLowerCase().trim()}___${ing.unit.toLowerCase().trim()}`;
        const qty = parseFloat(ing.quantity) * scale;

        if (aggregated[key]) {
          aggregated[key].quantity += qty;
        } else {
          // Lookup price history estimate
          const lastPrice = priceHistory.find(
            ph => ph.ingredient_name.toLowerCase() === ing.name.toLowerCase()
          );
          aggregated[key] = {
            id: Date.now() + Math.random(),
            name: ing.name,
            quantity: qty,
            unit: ing.unit,
            category: ing.category || 'Pantry',
            is_checked: false,
            estimated_price: lastPrice ? lastPrice.price : 0,
            actual_price: null
          };
        }
      });
    });

    const items = Object.values(aggregated).map(item => ({
      ...item,
      quantity: Math.round(item.quantity * 100) / 100
    }));

    const totalEst = items.reduce((acc, i) => acc + (parseFloat(i.estimated_price) || 0), 0);

    const newList = {
      id: Date.now(),
      name,
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
      items,
      total_estimated: totalEst,
      total_spent: 0
    };

    const updated = [newList, ...shoppingLists];
    setShoppingLists(updated);
    localStorage.setItem('dietcraft_shopping_lists', JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      supabase.from('shopping_lists').insert([newList]);
    }

    setGenerateShoppingModal(false);
    setActiveShoppingListId(newList.id);
    setActiveView('shopping');
    showToast('Monthly grocery list generated!');
  };

  // Toggle Shopping Item Checked
  const toggleItemCheck = (itemId) => {
    if (!activeList) return;
    const updatedItems = activeList.items.map(i => {
      if (i.id === itemId) return { ...i, is_checked: !i.is_checked };
      return i;
    });

    const updatedList = { ...activeList, items: updatedItems };
    const updatedLists = shoppingLists.map(l => l.id === activeList.id ? updatedList : l);
    setShoppingLists(updatedLists);
    localStorage.setItem('dietcraft_shopping_lists', JSON.stringify(updatedLists));

    if (isSupabaseConfigured && supabase) {
      supabase.from('shopping_items').update({ is_checked: !activeList.items.find(i => i.id === itemId).is_checked }).eq('id', itemId);
    }
  };

  // Enter Item Actual Price (Price Learning Engine)
  const updateItemPrice = (itemId, priceStr) => {
    if (!activeList) return;
    const price = priceStr !== '' ? parseFloat(priceStr) : null;

    const targetItem = activeList.items.find(i => i.id === itemId);
    const updatedItems = activeList.items.map(i => {
      if (i.id === itemId) return { ...i, actual_price: price };
      return i;
    });

    const totalSpent = updatedItems.reduce((acc, i) => acc + (parseFloat(i.actual_price) || 0), 0);
    const updatedList = { ...activeList, items: updatedItems, total_spent: totalSpent };
    const updatedLists = shoppingLists.map(l => l.id === activeList.id ? updatedList : l);
    setShoppingLists(updatedLists);
    localStorage.setItem('dietcraft_shopping_lists', JSON.stringify(updatedLists));

    // Record into Price History for future budget estimates
    if (price && targetItem) {
      const newHistoryEntry = {
        id: Date.now(),
        ingredient_name: targetItem.name,
        unit: targetItem.unit,
        price,
        date: new Date().toISOString().split('T')[0]
      };
      const updatedHistory = [newHistoryEntry, ...priceHistory];
      setPriceHistory(updatedHistory);
      localStorage.setItem('dietcraft_price_history', JSON.stringify(updatedHistory));

      if (isSupabaseConfigured && supabase) {
        supabase.from('price_history').insert([newHistoryEntry]);
      }
    }
  };

  // Add Custom Item to Shopping List
  const handleAddCustomItem = (item) => {
    if (!activeList) return;
    const newItem = { ...item, id: Date.now(), is_checked: false, actual_price: null };
    const updatedItems = [...activeList.items, newItem];
    const updatedList = { ...activeList, items: updatedItems };
    const updatedLists = shoppingLists.map(l => l.id === activeList.id ? updatedList : l);
    setShoppingLists(updatedLists);
    localStorage.setItem('dietcraft_shopping_lists', JSON.stringify(updatedLists));
    setCustomItemModal(false);
    showToast('Item added to grocery list!');
  };

  // Delete Shopping List Item
  const handleDeleteShoppingItem = (itemId) => {
    if (!activeList) return;
    const updatedItems = activeList.items.filter(i => i.id !== itemId);
    const totalSpent = updatedItems.reduce((acc, i) => acc + (parseFloat(i.actual_price) || 0), 0);
    const updatedList = { ...activeList, items: updatedItems, total_spent: totalSpent };
    const updatedLists = shoppingLists.map(l => l.id === activeList.id ? updatedList : l);
    setShoppingLists(updatedLists);
    localStorage.setItem('dietcraft_shopping_lists', JSON.stringify(updatedLists));
    if (isSupabaseConfigured && supabase) {
      supabase.from('shopping_items').delete().eq('id', itemId);
    }
    showToast('Item removed from grocery list');
  };

  // Delete Shopping List
  const handleDeleteShoppingList = (id) => {
    if (!confirm('Delete this shopping list?')) return;
    const updated = shoppingLists.filter(l => l.id !== id);
    setShoppingLists(updated);
    localStorage.setItem('dietcraft_shopping_lists', JSON.stringify(updated));
    if (activeShoppingListId === id) setActiveShoppingListId(null);
    showToast('Shopping list deleted');
  };

  return (
    <>
      <Head>
        <title>DietCraft - Recipe Database, Meal Planner & Shopping Tracker</title>
      </Head>

      <div className="app-container">
        {/* Desktop Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <div>
              <div className="brand-title">DietCraft</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vercel & Supabase</div>
            </div>
            <span className="brand-badge" style={{ backgroundColor: isSupabaseConfigured ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: isSupabaseConfigured ? '#34d399' : '#fbbf24' }}>
              {isSupabaseConfigured ? 'Cloud Sync' : 'Local Mode'}
            </span>
          </div>

          <ul className="nav-menu">
            <li>
              <button 
                className={`nav-item ${activeView === 'recipes' ? 'active' : ''}`}
                onClick={() => { setActiveView('recipes'); setActiveShoppingListId(null); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
              >
                <span>📖 Recipes</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeView === 'planner' ? 'active' : ''}`}
                onClick={() => { setActiveView('planner'); setActiveShoppingListId(null); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
              >
                <span>📅 Meal Planner</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeView === 'shopping' ? 'active' : ''}`}
                onClick={() => { setActiveView('shopping'); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
              >
                <span>🛒 Shopping Lists</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
                onClick={() => { setActiveView('settings'); setActiveShoppingListId(null); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
              >
                <span>⚙️ Settings & Sync</span>
              </button>
            </li>
          </ul>

          <div className="sidebar-footer">
            <button className="mobile-connect-btn" onClick={() => setMobileConnectModal(true)}>
              <span>📱 Install App on Phone</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Mobile Header */}
          <header className="mobile-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="brand-icon" style={{ width: '32px', height: '32px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/></svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#34d399' }}>DietCraft</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={handleInstallClick}>
                📲 Install App
              </button>
            </div>
          </header>

          {/* VIEW 1: RECIPES */}
          {activeView === 'recipes' && (
            <section className="view-panel active">
              <div className="view-header">
                <div className="view-title-group">
                  <h1>Recipe Database</h1>
                  <p>Curate recipes with ingredients that automatically feed your monthly grocery lists.</p>
                </div>
                <div className="view-actions">
                  <button className="btn btn-primary" onClick={() => { setEditingRecipe(null); setIsEditingRecipe(true); }}>
                    + Create New Recipe
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="filter-bar">
                <div className="search-input-wrap">
                  <span>🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search recipes by name, ingredients, or tags..." 
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                </div>
                <div className="category-chips">
                  {['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(cat => (
                    <button 
                      key={cat} 
                      className={`chip ${recipeCategory === cat ? 'active' : ''}`}
                      onClick={() => setRecipeCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipe Grid */}
              <div className="recipes-grid">
                {filteredRecipes.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📖</div>
                    <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      No recipes yet
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '420px', margin: '0 auto 20px' }}>
                      Add your favorite dishes with ingredients. DietCraft will use them to automatically schedule your meals and build your monthly supermarket shopping lists!
                    </p>
                    <button className="btn btn-primary" onClick={() => { setEditingRecipe(null); setIsEditingRecipe(true); }}>
                      + Create Your First Recipe
                    </button>
                  </div>
                ) : (
                  filteredRecipes.map(r => (
                    <div key={r.id} className="recipe-card" onClick={() => setSelectedRecipeDetail(r)}>
                      <div className="recipe-card-header">
                        <span className={`recipe-category-badge badge-${r.category.toLowerCase()}`}>{r.category}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.servings} Servings</span>
                      </div>
                      <h3 className="recipe-title">{r.title}</h3>
                      <p className="recipe-desc">{r.description || 'No description provided.'}</p>
                      <div className="recipe-meta-row">
                        <span>⏱️ {(r.prep_time || 0) + (r.cook_time || 0)}m total</span>
                        <span>🥗 {r.ingredients ? r.ingredients.length : 0} ingredients</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* VIEW 2: MEAL PLANNER */}
          {activeView === 'planner' && (
            <section className="view-panel active">
              <div className="view-header">
                <div className="view-title-group">
                  <h1>Monthly Meal Planner</h1>
                  <p>Plan meals for each day. Scale servings and generate complete monthly grocery lists with 1 tap.</p>
                </div>
                <div className="view-actions">
                  <button className="btn btn-accent" onClick={() => setAutoPlanModal(true)}>⚡ Auto-Plan Month</button>
                  <button className="btn btn-primary" onClick={() => setGenerateShoppingModal(true)}>🛒 Generate Grocery List</button>
                </div>
              </div>

              <div className="planner-nav-bar">
                <div className="planner-controls">
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    const d = new Date(calendarDate);
                    d.setMonth(d.getMonth() - 1);
                    setCalendarDate(d);
                  }}>‹ Prev</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCalendarDate(new Date())}>Today</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    const d = new Date(calendarDate);
                    d.setMonth(d.getMonth() + 1);
                    setCalendarDate(d);
                  }}>Next ›</button>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {monthData.monthName} {monthData.year}
                </h2>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                  <span>🟡 Breakfast</span>
                  <span>🔵 Lunch</span>
                  <span>🟢 Dinner</span>
                </div>
              </div>

              {/* Month Grid */}
              <div className="month-view-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(wd => (
                  <div key={wd} className="weekday-header">{wd}</div>
                ))}

                {/* Filler days */}
                {Array.from({ length: monthData.startingDay }).map((_, i) => (
                  <div key={`fill-${i}`} className="day-cell other-month">
                    <span className="day-number">{monthData.prevMonthDays - monthData.startingDay + i + 1}</span>
                  </div>
                ))}

                {/* Days */}
                {Array.from({ length: monthData.daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const pad = (n) => String(n).padStart(2, '0');
                  const dateStr = `${monthData.year}-${pad(monthData.month + 1)}-${pad(day)}`;
                  const dayMeals = mealPlans.filter(p => p.date === dateStr);
                  const isToday = new Date().toDateString() === new Date(monthData.year, monthData.month, day).toDateString();
                  const cellDate = new Date(monthData.year, monthData.month, day);
                  const weekdayShort = cellDate.toLocaleDateString('en-US', { weekday: 'short' });

                  return (
                    <div key={dateStr} className={`day-cell ${isToday ? 'today' : ''}`}>
                      <div className="day-cell-top">
                        <div>
                          <span className="day-number">{day}</span>
                          <span className="day-weekday-label">· {weekdayShort}</span>
                        </div>
                        <button className="day-add-btn" title="Add meal" onClick={() => setMealPlanModal({ date: dateStr, meal_type: 'dinner', servings: 2 })}>+</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayMeals.map(m => {
                          const recipe = recipes.find(r => r.id === m.recipe_id);
                          const title = recipe ? recipe.title : (m.custom_title || 'Meal');
                          return (
                            <div 
                              key={m.id || `${m.date}-${m.meal_type}`}
                              className={`day-meal-pill meal-${m.meal_type}`}
                              onClick={() => setMealPlanModal(m)}
                            >
                              <span><strong>{m.meal_type.charAt(0).toUpperCase()}:</strong> {title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* VIEW 3: SHOPPING LISTS & SUPERMARKET MODE */}
          {activeView === 'shopping' && (
            <section className="view-panel active">
              {!activeList ? (
                <div>
                  <div className="view-header">
                    <div className="view-title-group">
                      <h1>Monthly Shopping Lists</h1>
                      <p>Aggregated groceries calculated from your meal plan, organized by supermarket aisles.</p>
                    </div>
                    <div className="view-actions">
                      <button className="btn btn-primary" onClick={() => setGenerateShoppingModal(true)}>+ Generate New Shopping List</button>
                    </div>
                  </div>

                  <div className="shopping-lists-grid">
                    {shoppingLists.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                        <p style={{ fontSize: '1.15rem', marginBottom: '12px' }}>No shopping lists yet.</p>
                        <button className="btn btn-primary" onClick={() => setGenerateShoppingModal(true)}>+ Generate Monthly Grocery List</button>
                      </div>
                    ) : (
                      shoppingLists.map(l => {
                        const total = l.items ? l.items.length : 0;
                        const checked = l.items ? l.items.filter(i => i.is_checked).length : 0;
                        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
                        return (
                          <div key={l.id} className="shopping-card" onClick={() => setActiveShoppingListId(l.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{l.name}</h3>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.start_date} to {l.end_date}</span>
                              </div>
                              <button 
                                className="btn btn-danger btn-sm btn-icon" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteShoppingList(l.id); }}
                              >
                                🗑️
                              </button>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                                <span>{checked} of {total} collected</span>
                                <span style={{ color: '#34d399', fontWeight: 600 }}>{pct}%</span>
                              </div>
                              <div className="progress-bar-wrap">
                                <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                              <span>Spent: <strong style={{ color: '#34d399' }}>{currency}{(l.total_spent || 0).toFixed(2)}</strong></span>
                              <span className="btn btn-secondary btn-sm">Open Supermarket Mode 🛒</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Active Supermarket Mode */
                <div>
                  <div className="active-shopping-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveShoppingListId(null)}>← Back</button>
                      <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{activeList.name}</h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supermarket Mode · Enter prices as you shop</span>
                      </div>
                    </div>
                    <div className="budget-stats">
                      <div className="stat-block">
                        <span className="stat-label">Spent</span>
                        <span className="stat-value">{currency}{(activeList.total_spent || 0).toFixed(2)}</span>
                      </div>
                      <div className="stat-block">
                        <span className="stat-label">Est. Budget</span>
                        <span className="stat-value" style={{ color: 'var(--text-secondary)' }}>{currency}{(activeList.total_estimated || 0).toFixed(2)}</span>
                      </div>
                      <div className="stat-block">
                        <span className="stat-label">Items</span>
                        <span className="stat-value" style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                          {activeList.items.filter(i => i.is_checked).length} / {activeList.items.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setCustomItemModal(true)}>+ Add Extra Item</button>
                  </div>

                  {/* Grouped by Aisle */}
                  {['Produce', 'Meat/Seafood', 'Dairy', 'Bakery', 'Pantry', 'Canned', 'Spices', 'Frozen', 'Other'].map(aisle => {
                    const aisleItems = activeList.items.filter(i => (i.category || 'Pantry') === aisle);
                    if (aisleItems.length === 0) return null;
                    const checkedCount = aisleItems.filter(i => i.is_checked).length;

                    return (
                      <div key={aisle} className="aisle-group">
                        <div className="aisle-header">
                          <span>🛒 {aisle}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                            {checkedCount}/{aisleItems.length} collected
                          </span>
                        </div>
                        <div className="shopping-items-list">
                          {aisleItems.map(item => (
                            <div key={item.id} className={`shopping-item-row ${item.is_checked ? 'checked' : ''}`}>
                              <div className="item-checkbox-wrap" onClick={() => toggleItemCheck(item.id)}>
                                <div className="custom-checkbox">{item.is_checked ? '✓' : ''}</div>
                                <div className="item-info">
                                  <span className="item-name">{item.name}</span>
                                  <span className="item-qty">
                                    {item.quantity} {item.unit} {item.estimated_price > 0 ? `· Est: ${currency}${parseFloat(item.estimated_price).toFixed(2)}` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Price Entry & Remove Item Action */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="price-input-wrap" title="Enter actual price paid" onClick={e => e.stopPropagation()}>
                                  <span className="price-currency">{currency}</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    inputMode="decimal"
                                    className="price-input"
                                    placeholder="0.00"
                                    defaultValue={item.actual_price !== null && item.actual_price !== undefined ? item.actual_price : ''}
                                    onBlur={(e) => updateItemPrice(item.id, e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                  />
                                </div>
                                <button 
                                  className="btn btn-sm btn-icon" 
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px', cursor: 'pointer' }} 
                                  title="Remove item" 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteShoppingItem(item.id); }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* VIEW 4: SETTINGS & SUPABASE CLOUD SYNC */}
          {activeView === 'settings' && (
            <section className="view-panel active">
              <div className="view-header">
                <div className="view-title-group">
                  <h1>Settings & Cloud Sync</h1>
                  <p>Connect Supabase PostgreSQL, customize currency, and inspect learned price history.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* Supabase Status Card */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                    ☁️ Supabase Cloud Database
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
                    {isSupabaseConfigured 
                      ? 'Connected to your Supabase project! Data syncs automatically across your phone and desktop.'
                      : 'Running in local offline mode. To sync across phone and PC on Vercel, connect your Supabase credentials in your Vercel project environment variables.'}
                  </p>
                  <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontFamily: 'monospace', color: '#34d399', marginBottom: '14px' }}>
                    Status: {isSupabaseConfigured ? '🟢 Connected (PostgreSQL)' : '🟡 Local Storage Active'}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setMobileConnectModal(true)}>
                    📲 How to Install as App on Android
                  </button>
                </div>

                {/* App Preferences */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>⚙️ Preferences</h3>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Currency Symbol</label>
                    <select 
                      className="form-control" 
                      value={currency} 
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        localStorage.setItem('dietcraft_currency', e.target.value);
                        showToast('Currency updated!');
                      }}
                    >
                      <option value="$">$ (USD / CAD / AUD)</option>
                      <option value="₹">₹ (INR - Rupee)</option>
                      <option value="€">€ (EUR - Euro)</option>
                      <option value="£">£ (GBP - Pound)</option>
                      <option value="¥">¥ (JPY / CNY)</option>
                    </select>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>Recipes in Database: <strong style={{ color: 'var(--text-primary)' }}>{recipes.length}</strong></div>
                    <div>Meals Planned: <strong style={{ color: 'var(--text-primary)' }}>{mealPlans.length}</strong></div>
                    <div>Shopping Lists: <strong style={{ color: 'var(--text-primary)' }}>{shoppingLists.length}</strong></div>
                  </div>
                </div>
              </div>

              {/* Price History Learning Table */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>📈 Ingredient Price History (Learned from Supermarkets)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
                  Every price you enter while shopping is saved here to automatically estimate your future monthly grocery budgets.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px' }}>Ingredient</th>
                        <th style={{ padding: '10px 14px' }}>Unit</th>
                        <th style={{ padding: '10px 14px' }}>Last Recorded Price</th>
                        <th style={{ padding: '10px 14px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No prices entered yet. Prices you enter in Supermarket Mode will be recorded here!</td></tr>
                      ) : (
                        priceHistory.map(ph => (
                          <tr key={ph.id || `${ph.ingredient_name}-${ph.date}`}>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600 }}>{ph.ingredient_name}</td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{ph.unit}</td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#34d399', fontWeight: 700 }}>{currency}{parseFloat(ph.price).toFixed(2)}</td>
                            <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{ph.date}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Bottom Mobile Navigation */}
          <nav className="bottom-nav">
            <button className={`bottom-nav-item ${activeView === 'recipes' ? 'active' : ''}`} onClick={() => setActiveView('recipes')}>
              <span>📖</span>
              <span>Recipes</span>
            </button>
            <button className={`bottom-nav-item ${activeView === 'planner' ? 'active' : ''}`} onClick={() => setActiveView('planner')}>
              <span>📅</span>
              <span>Planner</span>
            </button>
            <button className={`bottom-nav-item ${activeView === 'shopping' ? 'active' : ''}`} onClick={() => setActiveView('shopping')}>
              <span>🛒</span>
              <span>Shopping</span>
            </button>
            <button className={`bottom-nav-item ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView('settings')}>
              <span>⚙️</span>
              <span>Sync</span>
            </button>
          </nav>
        </main>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. Recipe Detail Modal */}
      {selectedRecipeDetail && (
        <div className="modal-backdrop active" onClick={() => setSelectedRecipeDetail(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedRecipeDetail.title}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelectedRecipeDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span className={`recipe-category-badge badge-${selectedRecipeDetail.category.toLowerCase()}`}>{selectedRecipeDetail.category}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>👥 {selectedRecipeDetail.servings} Servings</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>⏱️ Prep: {selectedRecipeDetail.prep_time}m | Cook: {selectedRecipeDetail.cook_time}m</span>
              </div>
              {selectedRecipeDetail.description && <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '16px' }}>{selectedRecipeDetail.description}</p>}

              <h4 style={{ color: '#34d399', marginBottom: '8px' }}>Ingredients</h4>
              <ul style={{ listStyle: 'none', marginBottom: '20px' }}>
                {selectedRecipeDetail.ingredients?.map((ing, idx) => (
                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>{ing.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({ing.category})</span></span>
                    <strong style={{ color: '#34d399' }}>{ing.quantity} {ing.unit}</strong>
                  </li>
                ))}
              </ul>

              <h4 style={{ color: '#34d399', marginBottom: '8px' }}>Instructions</h4>
              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6, background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                {selectedRecipeDetail.instructions || 'No instructions provided.'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={() => handleDeleteRecipe(selectedRecipeDetail.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => { setEditingRecipe(selectedRecipeDetail); setIsEditingRecipe(true); setSelectedRecipeDetail(null); }}>Edit Recipe</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Recipe Editor Modal */}
      {isEditingRecipe && (
        <RecipeEditorModal 
          recipe={editingRecipe} 
          onSave={handleSaveRecipe} 
          onClose={() => setIsEditingRecipe(false)} 
        />
      )}

      {/* 3. Meal Plan Slot Modal */}
      {mealPlanModal && (
        <div className="modal-backdrop active" onClick={() => setMealPlanModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Plan Meal ({mealPlanModal.date})</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setMealPlanModal(null)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const recipeId = fd.get('recipe_id');
              const customTitle = fd.get('custom_title');
              handleSaveMealPlan({
                date: mealPlanModal.date,
                meal_type: fd.get('meal_type'),
                recipe_id: recipeId ? parseInt(recipeId, 10) : null,
                custom_title: customTitle || null,
                servings: parseInt(fd.get('servings'), 10) || 2
              });
            }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Meal Slot</label>
                  <select name="meal_type" defaultValue={mealPlanModal.meal_type} className="form-control">
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Choose Recipe from Database</label>
                  <select name="recipe_id" defaultValue={mealPlanModal.recipe_id || ''} className="form-control">
                    <option value="">-- Choose Recipe --</option>
                    {recipes.map(r => (
                      <option key={r.id} value={r.id}>[{r.category}] {r.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Or Custom Meal / Dining Out / Leftovers</label>
                  <input type="text" name="custom_title" defaultValue={mealPlanModal.custom_title || ''} className="form-control" placeholder="e.g. Leftovers or Dining out" />
                </div>
                <div className="form-group">
                  <label className="form-label">Planned Servings (automatically scales groceries)</label>
                  <input type="number" name="servings" defaultValue={mealPlanModal.servings || 2} min="1" className="form-control" required />
                </div>
              </div>
              <div className="modal-footer">
                {mealPlanModal.id && (
                  <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => handleDeleteMealPlan(mealPlanModal.date, mealPlanModal.meal_type)}>Delete</button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setMealPlanModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save to Calendar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Auto-Plan Modal */}
      {autoPlanModal && (
        <div className="modal-backdrop active" onClick={() => setAutoPlanModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">⚡ Auto-Generate Monthly Meal Plan</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAutoPlanModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const meals = [];
              if (fd.get('breakfast')) meals.push('breakfast');
              if (fd.get('lunch')) meals.push('lunch');
              if (fd.get('dinner')) meals.push('dinner');
              handleAutoPlan(
                fd.get('start_date'),
                fd.get('end_date'),
                meals,
                parseInt(fd.get('servings'), 10) || 2
              );
            }}>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Picks recipes from your library to fill your schedule across the entire month!
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" name="start_date" defaultValue={monthData.startStr} className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" name="end_date" defaultValue={monthData.endStr} className="form-control" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Meals to Plan per Day</label>
                  <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" name="breakfast" defaultChecked /> Breakfast</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" name="lunch" defaultChecked /> Lunch</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" name="dinner" defaultChecked /> Dinner</label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Servings</label>
                  <input type="number" name="servings" defaultValue="2" min="1" className="form-control" required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAutoPlanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-accent">Generate Plan Now</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Generate Shopping List Modal */}
      {generateShoppingModal && (
        <div className="modal-backdrop active" onClick={() => setGenerateShoppingModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🛒 Generate Monthly Grocery List</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setGenerateShoppingModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              handleGenerateShoppingList(
                fd.get('name'),
                fd.get('start_date'),
                fd.get('end_date')
              );
            }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">List Name</label>
                  <input type="text" name="name" defaultValue={`${monthData.monthName} ${monthData.year} Grocery List`} className="form-control" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" name="start_date" defaultValue={monthData.startStr} className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" name="end_date" defaultValue={monthData.endStr} className="form-control" required />
                  </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Aggregates all ingredients across your planned meals, multiplies by servings, and categorizes by grocery aisles.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setGenerateShoppingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate List</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Custom Item Modal */}
      {customItemModal && (
        <div className="modal-backdrop active" onClick={() => setCustomItemModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Extra Grocery Item</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setCustomItemModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              handleAddCustomItem({
                name: fd.get('name'),
                quantity: parseFloat(fd.get('quantity')) || 1,
                unit: fd.get('unit') || 'pcs',
                category: fd.get('category'),
                estimated_price: parseFloat(fd.get('est_price')) || 0
              });
            }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Item Name *</label>
                  <input type="text" name="name" placeholder="e.g. Olive Oil, Coffee, Paper Towels" className="form-control" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input type="number" step="any" name="quantity" defaultValue="1" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input type="text" name="unit" defaultValue="pcs" className="form-control" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Aisle / Category</label>
                    <select name="category" defaultValue="Pantry" className="form-control">
                      <option value="Produce">Produce</option>
                      <option value="Meat/Seafood">Meat/Seafood</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Pantry">Pantry</option>
                      <option value="Canned">Canned</option>
                      <option value="Spices">Spices</option>
                      <option value="Frozen">Frozen</option>
                      <option value="Other">Other / Household</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Est. Price</label>
                    <input type="number" step="0.01" name="est_price" placeholder="0.00" className="form-control" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCustomItemModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Mobile Android Install Guide Modal */}
      {mobileConnectModal && (
        <div className="modal-backdrop active" onClick={() => setMobileConnectModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📱 Android PWA Installation</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setMobileConnectModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '14px' }}>
                When deployed to <strong>Vercel</strong>, your app runs on a trusted public HTTPS domain (e.g. <code>https://your-diet-app.vercel.app</code>).
              </p>
              <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <strong style={{ color: '#34d399' }}>✨ Native PWA Install on Android:</strong>
                <ol style={{ paddingLeft: '18px', marginTop: '8px', color: 'var(--text-secondary)' }}>
                  <li style={{ marginBottom: '6px' }}>Open your Vercel link in Chrome or Firefox on your phone.</li>
                  <li style={{ marginBottom: '6px' }}>Tap the <strong>"Install app"</strong> button or tap <strong>⋮ ➔ "Install app"</strong>.</li>
                  <li>DietCraft installs with its full high-resolution icon into your App Drawer and works offline!</li>
                </ol>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setMobileConnectModal(false)}>Got It</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className="toast">
            <span>✨</span>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}

// Subcomponent: Recipe Editor Modal
function RecipeEditorModal({ recipe, onSave, onClose }) {
  const [title, setTitle] = useState(recipe ? recipe.title : '');
  const [category, setCategory] = useState(recipe ? recipe.category : 'Dinner');
  const [servings, setServings] = useState(recipe ? recipe.servings : 2);
  const [prepTime, setPrepTime] = useState(recipe ? recipe.prep_time : 15);
  const [cookTime, setCookTime] = useState(recipe ? recipe.cook_time : 20);
  const [description, setDescription] = useState(recipe ? recipe.description : '');
  const [instructions, setInstructions] = useState(recipe ? recipe.instructions : '');
  const [tags, setTags] = useState(recipe ? recipe.tags : '');
  const [ingredients, setIngredients] = useState(
    recipe && recipe.ingredients ? recipe.ingredients : [
      { name: '', quantity: 1, unit: 'pcs', category: 'Produce' }
    ]
  );

  const addIngredientRow = () => {
    setIngredients([...ingredients, { name: '', quantity: 1, unit: 'pcs', category: 'Pantry' }]);
  };

  const updateIngredientRow = (idx, field, val) => {
    const copy = [...ingredients];
    copy[idx][field] = val;
    setIngredients(copy);
  };

  const removeIngredientRow = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: recipe ? recipe.id : null,
      title,
      category,
      servings: parseInt(servings, 10) || 2,
      prep_time: parseInt(prepTime, 10) || 0,
      cook_time: parseInt(cookTime, 10) || 0,
      description,
      instructions,
      tags,
      ingredients: ingredients.filter(i => i.name.trim() !== '')
    });
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{recipe ? 'Edit Recipe' : 'Create New Recipe'}</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Recipe Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="form-control" placeholder="e.g. Tuscan Garlic Chicken" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="form-control">
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                  <option value="Dessert">Dessert</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Servings</label>
                <input type="number" value={servings} onChange={e => setServings(e.target.value)} min="1" className="form-control" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prep Time (mins)</label>
                <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} min="0" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Cook Time (mins)</label>
                <input type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} min="0" className="form-control" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="form-control" placeholder="Short summary..." />
            </div>

            {/* Ingredients */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ color: '#34d399' }}>Ingredients</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredientRow}>+ Add Ingredient</button>
              </div>
              {ingredients.map((ing, idx) => (
                <div key={idx} className="ingredient-form-row">
                  <div className="ing-name-wrap">
                    <input type="text" placeholder="Ingredient name" value={ing.name} onChange={e => updateIngredientRow(idx, 'name', e.target.value)} className="form-control" required />
                  </div>
                  <div className="ing-details-wrap">
                    <input type="number" step="any" placeholder="Qty" value={ing.quantity} onChange={e => updateIngredientRow(idx, 'quantity', e.target.value)} className="form-control" required />
                    <select value={ing.unit} onChange={e => updateIngredientRow(idx, 'unit', e.target.value)} className="form-control">
                      {['g', 'kg', 'ml', 'l', 'pcs', 'slices', 'cups', 'tbsp', 'tsp', 'cloves', 'pack'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <select value={ing.category} onChange={e => updateIngredientRow(idx, 'category', e.target.value)} className="form-control">
                      {['Produce', 'Meat/Seafood', 'Dairy', 'Bakery', 'Pantry', 'Spices', 'Canned', 'Frozen', 'Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn btn-danger btn-sm btn-icon ing-del-btn" title="Remove" onClick={() => removeIngredientRow(idx)}>✕</button>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Cooking Instructions</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows="4" className="form-control" placeholder="Step 1..."></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Recipe</button>
          </div>
        </form>
      </div>
    </div>
  );
}
