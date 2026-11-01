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

  // Pantry State
  const [pantry, setPantry] = useState([]);
  const [pantryCategory, setPantryCategory] = useState('All');
  const [pantrySearch, setPantrySearch] = useState('');
  const [pantryModal, setPantryModal] = useState(null); // null, 'add', or { ...itemToEdit }

  // AI Assistant State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [aiChefModal, setAiChefModal] = useState(false);
  const [aiChefServings, setAiChefServings] = useState(1);
  const [recipeDetailServings, setRecipeDetailServings] = useState(1);
  const [aiRecipeResults, setAiRecipeResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImportModal, setAiImportModal] = useState(false);
  const [aiImportServings, setAiImportServings] = useState(1);
  const [aiImportText, setAiImportText] = useState('');
  const [aiSmartPlanModal, setAiSmartPlanModal] = useState(false);
  const [aiDietaryNotes, setAiDietaryNotes] = useState('');

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

        const { data: pantryData, error: pantryErr } = await supabase.from('pantry').select('*').order('name', { ascending: true });
        if (pantryData && pantryData.length > 0) {
          setPantry(pantryData);
          localStorage.setItem('dietcraft_pantry', JSON.stringify(pantryData));
        } else {
          // Fallback to local storage so items are not wiped if offline or table was empty
          const localPantry = localStorage.getItem('dietcraft_pantry');
          if (localPantry) {
            const parsed = JSON.parse(localPantry);
            setPantry(parsed);
            // If local storage has items but Supabase was empty, auto-sync them up to Supabase
            if (parsed.length > 0 && !pantryErr) {
              const toSync = parsed.map(p => ({
                name: p.name.trim(),
                quantity: parseFloat(p.quantity) || 0,
                unit: p.unit.trim(),
                category: p.category || 'Pantry',
                expiry_date: p.expiry_date || null,
                notes: p.notes || ''
              }));
              supabase.from('pantry').upsert(toSync, { onConflict: 'name, unit' }).select().then(({ data: synced }) => {
                if (synced && synced.length > 0) {
                  setPantry(synced);
                  localStorage.setItem('dietcraft_pantry', JSON.stringify(synced));
                }
              }).catch(e => console.error('Pantry auto-sync error:', e));
            }
          }
        }

        // Auto-reflect all recipe ingredients into pantry (0 quantity if not yet stocked)
        const activePantry = (pantryData && pantryData.length > 0) ? pantryData : [];
        const missingRecipeIngredients = [];
        (recData || []).forEach(r => {
          (r.ingredients || []).forEach(ing => {
            const ingName = (ing.name || '').trim();
            const ingUnit = (ing.unit || 'pcs').trim();
            if (!ingName) return;
            const alreadyExists = activePantry.some(
              p => p.name.toLowerCase().trim() === ingName.toLowerCase() &&
                   p.unit.toLowerCase().trim() === ingUnit.toLowerCase()
            ) || missingRecipeIngredients.some(
              m => m.name.toLowerCase().trim() === ingName.toLowerCase() &&
                   m.unit.toLowerCase().trim() === ingUnit.toLowerCase()
            );
            if (!alreadyExists) {
              missingRecipeIngredients.push({
                name: ingName,
                quantity: 0,
                unit: ingUnit,
                category: ing.category || 'Pantry',
                expiry_date: null,
                notes: `From recipe: ${r.title}`
              });
            }
          });
        });

        if (missingRecipeIngredients.length > 0) {
          const combinedPantry = [...activePantry, ...missingRecipeIngredients.map(m => ({ ...m, id: Date.now() + Math.random() }))];
          setPantry(combinedPantry);
          localStorage.setItem('dietcraft_pantry', JSON.stringify(combinedPantry));
          supabase.from('pantry').upsert(missingRecipeIngredients, { onConflict: 'name, unit' }).select().then(({ data: added }) => {
            if (added && added.length > 0) {
              supabase.from('pantry').select('*').order('name', { ascending: true }).then(({ data: refreshed }) => {
                if (refreshed) {
                  setPantry(refreshed);
                  localStorage.setItem('dietcraft_pantry', JSON.stringify(refreshed));
                }
              });
            }
          }).catch(e => console.error('Pantry recipe sync error:', e));
        }

        const { data: setData } = await supabase.from('settings').select('*');
        if (setData) {
          const curr = setData.find(s => s.key === 'currency');
          if (curr) setCurrency(curr.value);
          const gemKey = setData.find(s => s.key === 'gemini_api_key');
          if (gemKey) setGeminiApiKey(gemKey.value);
        }
      } else {
        // LocalStorage Fallback
        const localRec = localStorage.getItem('dietcraft_recipes');
        const localRecParsed = localRec ? JSON.parse(localRec) : [];
        setRecipes(localRecParsed);

        const localPlans = localStorage.getItem('dietcraft_meal_plans');
        if (localPlans) setMealPlans(JSON.parse(localPlans));

        const localShop = localStorage.getItem('dietcraft_shopping_lists');
        if (localShop) setShoppingLists(JSON.parse(localShop));

        const localPrices = localStorage.getItem('dietcraft_price_history');
        if (localPrices) setPriceHistory(JSON.parse(localPrices));

        const localPantry = localStorage.getItem('dietcraft_pantry');
        let localPantryParsed = localPantry ? JSON.parse(localPantry) : [];

        // Auto-mirror local recipe ingredients into pantry
        const missingLocalIngs = [];
        localRecParsed.forEach(r => {
          (r.ingredients || []).forEach(ing => {
            const ingName = (ing.name || '').trim();
            const ingUnit = (ing.unit || 'pcs').trim();
            if (!ingName) return;
            const exists = localPantryParsed.some(
              p => p.name.toLowerCase().trim() === ingName.toLowerCase() &&
                   p.unit.toLowerCase().trim() === ingUnit.toLowerCase()
            ) || missingLocalIngs.some(
              m => m.name.toLowerCase().trim() === ingName.toLowerCase() &&
                   m.unit.toLowerCase().trim() === ingUnit.toLowerCase()
            );
            if (!exists) {
              missingLocalIngs.push({
                id: Date.now() + Math.random(),
                name: ingName,
                quantity: 0,
                unit: ingUnit,
                category: ing.category || 'Pantry',
                expiry_date: null,
                notes: `From recipe: ${r.title}`
              });
            }
          });
        });
        if (missingLocalIngs.length > 0) {
          localPantryParsed = [...localPantryParsed, ...missingLocalIngs];
          localStorage.setItem('dietcraft_pantry', JSON.stringify(localPantryParsed));
        }
        setPantry(localPantryParsed);

        const localCurr = localStorage.getItem('dietcraft_currency');
        if (localCurr) setCurrency(localCurr);

        const localGemKey = localStorage.getItem('dietcraft_gemini_key');
        if (localGemKey) setGeminiApiKey(localGemKey);
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
      const catList = (r.category || 'Dinner').toLowerCase().split(',').map(c => c.trim());
      const matchCat = recipeCategory === 'All' || catList.includes(recipeCategory.toLowerCase()) || r.category === recipeCategory;
      const matchSearch = !recipeSearch || 
        r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(recipeSearch.toLowerCase())) ||
        (r.tags && r.tags.toLowerCase().includes(recipeSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [recipes, recipeCategory, recipeSearch]);

  // Pantry Filtered List
  const filteredPantry = useMemo(() => {
    return pantry.filter(item => {
      const matchCat = pantryCategory === 'All' || item.category === pantryCategory;
      const matchSearch = !pantrySearch ||
        item.name.toLowerCase().includes(pantrySearch.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(pantrySearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [pantry, pantryCategory, pantrySearch]);

  // Upcoming Needs: Calculate ingredient usage planned for the next 14 days
  const upcomingNeeds = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    const twoWeeksStr = twoWeeksLater.toISOString().split('T')[0];

    const needs = {}; // key: lowercase_name -> { totalQty, unit, mealCount, meals: [] }

    mealPlans.forEach(plan => {
      if (plan.date >= todayStr && plan.date <= twoWeeksStr && plan.recipe_id) {
        const recipe = recipes.find(r => r.id === plan.recipe_id);
        if (!recipe || !recipe.ingredients) return;
        const scale = (plan.servings || 2) / (recipe.servings || 2);

        recipe.ingredients.forEach(ing => {
          const key = ing.name.toLowerCase().trim();
          const qty = (parseFloat(ing.quantity) || 0) * scale;
          if (!needs[key]) {
            needs[key] = {
              totalQty: 0,
              unit: ing.unit,
              mealCount: 0,
              meals: []
            };
          }
          needs[key].totalQty += qty;
          needs[key].mealCount += 1;
          if (!needs[key].meals.includes(recipe.title)) {
            needs[key].meals.push(recipe.title);
          }
        });
      }
    });

    return needs;
  }, [mealPlans, recipes]);

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

  // Auto-mirror recipe ingredients into Pantry with 0 quantity if not yet stocked
  const syncIngredientsToPantry = async (ingredientsList, sourceRecipeTitle) => {
    if (!ingredientsList || ingredientsList.length === 0) return;

    let updatedPantry = [...pantry];
    const itemsToAdd = [];

    ingredientsList.forEach(ing => {
      const name = (ing.name || '').trim();
      const unit = (ing.unit || 'pcs').trim();
      const category = ing.category || 'Pantry';
      if (!name) return;

      const exists = updatedPantry.some(
        p => p.name.toLowerCase().trim() === name.toLowerCase() &&
             p.unit.toLowerCase().trim() === unit.toLowerCase()
      );

      if (!exists) {
        const itemObj = {
          name,
          quantity: 0,
          unit,
          category,
          expiry_date: null,
          notes: sourceRecipeTitle ? `For: ${sourceRecipeTitle}` : 'From recipe'
        };
        updatedPantry.push({ ...itemObj, id: Date.now() + Math.random() });
        itemsToAdd.push(itemObj);
      }
    });

    if (itemsToAdd.length > 0) {
      setPantry(updatedPantry);
      localStorage.setItem('dietcraft_pantry', JSON.stringify(updatedPantry));

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('pantry').upsert(itemsToAdd, { onConflict: 'name, unit' });
          const { data: refreshed } = await supabase.from('pantry').select('*').order('name', { ascending: true });
          if (refreshed && refreshed.length > 0) {
            setPantry(refreshed);
            localStorage.setItem('dietcraft_pantry', JSON.stringify(refreshed));
          }
        } catch (e) {
          console.error('Failed to sync recipe ingredients to pantry in DB:', e);
        }
      }
    }
  };

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

    // Auto-reflect recipe ingredients in pantry with 0 quantity if not already stocked
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      await syncIngredientsToPantry(recipeData.ingredients, recipeData.title);
    }

    setIsEditingRecipe(false);
    showToast('Recipe saved & ingredients reflected in pantry!');
  };

  // Open Recipe Detail with Serving Scaler
  const handleOpenRecipeDetail = (recipe) => {
    setSelectedRecipeDetail(recipe);
    setRecipeDetailServings(recipe ? (recipe.servings || 1) : 1);
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
        const matching = recipes.filter(r => {
          const cats = (r.category || '').toLowerCase().split(',').map(c => c.trim());
          return cats.includes(mealType.toLowerCase());
        });
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

  // Pantry Handlers
  const handleSavePantryItem = async (itemData) => {
    try {
      const existingIdx = pantry.findIndex(p => 
        (itemData.id && p.id === itemData.id) ||
        (p.name.toLowerCase().trim() === itemData.name.toLowerCase().trim() && p.unit.toLowerCase().trim() === itemData.unit.toLowerCase().trim())
      );

      const name = itemData.name.trim();
      const unit = itemData.unit.trim();
      const quantity = Math.max(0, parseFloat(itemData.quantity) || 0);
      const category = itemData.category || 'Pantry';
      const expiry_date = itemData.expiry_date || null;
      const notes = itemData.notes || '';

      // Payload strictly conforming to Supabase pantry table schema
      const dbPayload = {
        name,
        quantity,
        unit,
        category,
        expiry_date,
        notes
      };

      let savedItem = { ...dbPayload, id: itemData.id || Date.now() };

      if (isSupabaseConfigured && supabase) {
        if (itemData.id && typeof itemData.id === 'number' && itemData.id < 1000000000000) {
          // Existing database row with Supabase bigserial id
          const { data: updatedRows, error: upErr } = await supabase
            .from('pantry')
            .update(dbPayload)
            .eq('id', itemData.id)
            .select();
          if (upErr) throw upErr;
          if (updatedRows && updatedRows[0]) savedItem = updatedRows[0];
        } else {
          // New row: upsert by unique constraint (name, unit)
          const { data: upsertedRows, error: upErr } = await supabase
            .from('pantry')
            .upsert([dbPayload], { onConflict: 'name, unit' })
            .select();
          if (upErr) throw upErr;
          if (upsertedRows && upsertedRows[0]) savedItem = upsertedRows[0];
        }
      }

      let updatedPantry;
      if (existingIdx >= 0) {
        updatedPantry = [...pantry];
        updatedPantry[existingIdx] = savedItem;
      } else {
        updatedPantry = [savedItem, ...pantry];
      }

      setPantry(updatedPantry);
      localStorage.setItem('dietcraft_pantry', JSON.stringify(updatedPantry));
      setPantryModal(null);
      showToast(existingIdx >= 0 ? 'Pantry item updated in cloud DB!' : 'Item added to pantry & cloud DB!');
    } catch (err) {
      console.error('Failed to save pantry item to Supabase', err);
      const fallbackItem = {
        id: itemData.id || Date.now(),
        name: itemData.name.trim(),
        quantity: Math.max(0, parseFloat(itemData.quantity) || 0),
        unit: itemData.unit.trim(),
        category: itemData.category || 'Pantry',
        expiry_date: itemData.expiry_date || null,
        notes: itemData.notes || ''
      };
      const updatedPantry = [fallbackItem, ...pantry.filter(p => p.id !== fallbackItem.id)];
      setPantry(updatedPantry);
      localStorage.setItem('dietcraft_pantry', JSON.stringify(updatedPantry));
      setPantryModal(null);
      showToast('Saved locally (' + (err.message || 'Cloud sync error') + ')');
    }
  };

  const handleQuickAdjustPantry = async (id, delta) => {
    const item = pantry.find(p => p.id === id);
    if (!item) return;
    const newQty = Math.max(0, Math.round(((parseFloat(item.quantity) || 0) + delta) * 100) / 100);
    const updated = pantry.map(p => p.id === id ? { ...p, quantity: newQty } : p);
    setPantry(updated);
    localStorage.setItem('dietcraft_pantry', JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      try {
        if (typeof id === 'number' && id < 1000000000000) {
          await supabase.from('pantry').update({ quantity: newQty }).eq('id', id);
        } else {
          await supabase.from('pantry').update({ quantity: newQty }).match({ name: item.name, unit: item.unit });
        }
      } catch (err) {
        console.error('Failed to update pantry quantity in Supabase', err);
      }
    }
  };

  const handleDeletePantryItem = async (id) => {
    const itemToDelete = pantry.find(p => p.id === id);
    const updated = pantry.filter(p => p.id !== id);
    setPantry(updated);
    localStorage.setItem('dietcraft_pantry', JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      try {
        if (typeof id === 'number' && id < 1000000000000) {
          await supabase.from('pantry').delete().eq('id', id);
        } else if (itemToDelete) {
          await supabase.from('pantry').delete().match({ name: itemToDelete.name, unit: itemToDelete.unit });
        }
      } catch (err) {
        console.error('Failed to delete pantry item from Supabase', err);
      }
    }
    showToast('Item removed from pantry & cloud DB');
  };

  // Restock Pantry from Checked Shopping List Items
  const handleRestockPantryFromShopping = async () => {
    if (!activeList) return;
    const checkedItems = (activeList.items || []).filter(i => i.is_checked);
    if (checkedItems.length === 0) {
      showToast('No checked items found to restock.');
      return;
    }

    let updatedPantry = [...pantry];
    const itemsToUpsert = [];

    checkedItems.forEach(ci => {
      const idx = updatedPantry.findIndex(p => 
        p.name.toLowerCase().trim() === ci.name.toLowerCase().trim() &&
        p.unit.toLowerCase().trim() === ci.unit.toLowerCase().trim()
      );

      const addQty = parseFloat(ci.quantity) || 1;
      if (idx >= 0) {
        const newQty = Math.round(((parseFloat(updatedPantry[idx].quantity) || 0) + addQty) * 100) / 100;
        updatedPantry[idx] = {
          ...updatedPantry[idx],
          quantity: newQty
        };
        itemsToUpsert.push({
          name: updatedPantry[idx].name,
          quantity: newQty,
          unit: updatedPantry[idx].unit,
          category: updatedPantry[idx].category || 'Pantry',
          expiry_date: updatedPantry[idx].expiry_date || null,
          notes: updatedPantry[idx].notes || 'Restocked from shopping'
        });
      } else {
        const newItem = {
          id: Date.now() + Math.random(),
          name: ci.name.trim(),
          quantity: addQty,
          unit: (ci.unit || 'pcs').trim(),
          category: ci.category || 'Pantry',
          expiry_date: null,
          notes: 'Restocked from shopping list'
        };
        updatedPantry.unshift(newItem);
        itemsToUpsert.push({
          name: newItem.name,
          quantity: newItem.quantity,
          unit: newItem.unit,
          category: newItem.category,
          expiry_date: null,
          notes: newItem.notes
        });
      }
    });

    setPantry(updatedPantry);
    localStorage.setItem('dietcraft_pantry', JSON.stringify(updatedPantry));

    if (isSupabaseConfigured && supabase && itemsToUpsert.length > 0) {
      try {
        const { data: syncedRows } = await supabase.from('pantry').upsert(itemsToUpsert, { onConflict: 'name, unit' }).select();
        if (syncedRows && syncedRows.length > 0) {
          const { data: allPantry } = await supabase.from('pantry').select('*').order('name', { ascending: true });
          if (allPantry) {
            setPantry(allPantry);
            localStorage.setItem('dietcraft_pantry', JSON.stringify(allPantry));
          }
        }
      } catch (err) {
        console.error('Failed to sync restocked items to Supabase', err);
      }
    }

    showToast(`Transferred ${checkedItems.length} purchased items to pantry & cloud DB! 📦`);
  };

  // Generate Monthly Shopping List (with Pantry deduction support)
  const handleGenerateShoppingList = (name, startDate, endDate, deductPantryStock = true) => {
    const relevantPlans = mealPlans.filter(p => p.date >= startDate && p.date <= endDate && p.recipe_id);
    if (relevantPlans.length === 0) {
      showToast('No planned meals with recipes found in this date range.');
      setGenerateShoppingModal(false);
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

    // If deductPantryStock is enabled, subtract what is currently in the pantry
    let rawItems = Object.values(aggregated);
    if (deductPantryStock && pantry.length > 0) {
      rawItems = rawItems.map(item => {
        const inPantry = pantry.find(p => 
          p.name.toLowerCase().trim() === item.name.toLowerCase().trim() &&
          p.unit.toLowerCase().trim() === item.unit.toLowerCase().trim()
        );
        if (inPantry && (parseFloat(inPantry.quantity) || 0) > 0) {
          const needed = Math.max(0, item.quantity - parseFloat(inPantry.quantity));
          return {
            ...item,
            quantity: Math.round(needed * 100) / 100,
            notes: `Reduced from ${Math.round(item.quantity * 100) / 100} (${inPantry.quantity} ${inPantry.unit} in pantry)`
          };
        }
        return item;
      }).filter(item => item.quantity > 0); // Only keep items that still need purchasing
    } else {
      rawItems = rawItems.map(item => ({
        ...item,
        quantity: Math.round(item.quantity * 100) / 100
      }));
    }

    if (rawItems.length === 0) {
      showToast('All needed ingredients are already fully stocked in your pantry! 🎉');
      setGenerateShoppingModal(false);
      return;
    }

    const totalEst = rawItems.reduce((acc, i) => acc + (parseFloat(i.estimated_price) || 0), 0);

    const newList = {
      id: Date.now(),
      name,
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
      items: rawItems,
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
    showToast(deductPantryStock ? 'Smart grocery list generated (pantry deducted)!' : 'Monthly grocery list generated!');
  };

  // AI Actions Call Helper
  const callAiEndpoint = async (action, payload) => {
    setAiLoading(true);
    try {
      const keyToSend = geminiApiKey || (typeof window !== 'undefined' ? localStorage.getItem('dietcraft_gemini_key') : null) || undefined;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload,
          userApiKey: keyToSend
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'AI request failed');
      }
      return data;
    } catch (err) {
      console.error('AI Error:', err);
      showToast(`AI Error: ${err.message}`);
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  // AI Action: Ask what to cook from pantry
  const handleAskAiChef = async (targetServings) => {
    const servings = (typeof targetServings === 'number' && targetServings > 0) ? targetServings : (aiChefServings || 1);
    setAiChefServings(servings);
    setAiChefModal(true);
    setAiRecipeResults(null);

    const availablePantry = pantry.filter(p => (parseFloat(p.quantity) || 0) > 0);
    const result = await callAiEndpoint('suggest_from_pantry', { 
      pantry: availablePantry,
      servings: servings,
      preferences: servings === 1 
        ? 'Cook for 1 person living a disciplined structured life, high protein, minimal cleanup, zero waste'
        : 'Cook 2 servings (dinner plus pack tomorrow lunch), high protein, minimal cleanup'
    });
    if (result && result.suggestions) {
      setAiRecipeResults(result.suggestions);
    }
  };

  // AI Action: Import raw recipe text
  const handleAiParseRecipe = async () => {
    if (!aiImportText.trim()) return;
    const result = await callAiEndpoint('parse_recipe', { text: aiImportText, servings: aiImportServings });
    if (result && result.recipe) {
      setEditingRecipe({
        ...result.recipe,
        id: null
      });
      setIsEditingRecipe(true);
      setAiImportModal(false);
      setAiImportText('');
      showToast(`Recipe adapted for ${aiImportServings} serving(s) by AI!`);
    }
  };

  // AI Action: Smart Meal Plan Generation
  const handleAiSmartPlan = async (startDate, endDate, mealsToPlan, targetCalories, dietaryNotes, targetServings = 1) => {
    const result = await callAiEndpoint('smart_plan', {
      startDate,
      endDate,
      pantry,
      recipes,
      mealsToPlan,
      targetCalories,
      dietaryNotes,
      servings: targetServings
    });

    if (result && result.plan) {
      // Merge suggested plans
      let newPlans = [...mealPlans];
      result.plan.forEach(item => {
        newPlans = newPlans.filter(p => !(p.date === item.date && p.meal_type.toLowerCase() === item.meal_type.toLowerCase()));
        newPlans.push({
          id: Date.now() + Math.random(),
          date: item.date,
          meal_type: item.meal_type.toLowerCase(),
          recipe_id: item.recipe_id || null,
          custom_title: item.recipe_id ? null : item.meal_name,
          servings: item.servings || targetServings || 1
        });
      });

      setMealPlans(newPlans);
      localStorage.setItem('dietcraft_meal_plans', JSON.stringify(newPlans));
      setAiSmartPlanModal(false);
      showToast('AI customized your meal plan using pantry items!');
    }
  };

  // Save Gemini Key in Settings
  const handleSaveGeminiKey = (key) => {
    setGeminiApiKey(key);
    localStorage.setItem('dietcraft_gemini_key', key);
    if (isSupabaseConfigured && supabase) {
      supabase.from('settings').upsert({ key: 'gemini_api_key', value: key }, { onConflict: 'key' });
    }
    showToast('Gemini API Key saved!');
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
                className={`nav-item ${activeView === 'pantry' ? 'active' : ''}`}
                onClick={() => { setActiveView('pantry'); setActiveShoppingListId(null); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
              >
                <span>📦 Pantry & Usage</span>
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
                <div className="view-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary ai-glow-btn" onClick={() => setAiImportModal(true)}>
                    ✨ AI Import Recipe
                  </button>
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
                    <div key={r.id} className="recipe-card" onClick={() => handleOpenRecipeDetail(r)}>
                      <div className="recipe-card-header">
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(r.category || 'Dinner').split(',').map(cat => (
                            <span key={cat.trim()} className={`recipe-category-badge badge-${cat.trim().toLowerCase()}`}>
                              {cat.trim()}
                            </span>
                          ))}
                        </div>
                        <span style={{ 
                          fontSize: '0.78rem', 
                          fontWeight: r.servings === 1 ? 600 : 400,
                          color: r.servings === 1 ? '#34d399' : 'var(--text-muted)',
                          background: r.servings === 1 ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                          padding: r.servings === 1 ? '2px 6px' : '0',
                          borderRadius: '4px'
                        }}>
                          {r.servings === 1 ? '👤 1 Serving' : `👥 ${r.servings || 1} Servings`}
                        </span>
                      </div>
                      <h3 className="recipe-title">{r.title}</h3>
                      <p className="recipe-desc">{r.description || 'No description provided.'}</p>
                      {r.tags && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {r.tags.split(',').slice(0, 3).map((t, idx) => (
                            <span key={idx} style={{ fontSize: '0.72rem', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
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
                <div className="view-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary ai-glow-btn" onClick={() => setAiSmartPlanModal(true)}>✨ AI Smart Plan</button>
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
                        <button className="day-add-btn" title="Add meal" onClick={() => setMealPlanModal({ date: dateStr, meal_type: 'dinner', servings: 1 })}>+</button>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={handleRestockPantryFromShopping}>
                      📥 Restock Pantry with Checked Items
                    </button>
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

          {/* VIEW: PANTRY & INVENTORY */}
          {activeView === 'pantry' && (
            <section className="view-panel active">
              <div className="view-header">
                <div className="view-title-group">
                  <h1>Pantry Inventory & Usage</h1>
                  <p>Track current stock, identify ingredients planned for upcoming meals, and get AI chef recipe ideas.</p>
                </div>
                <div className="view-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary ai-glow-btn" onClick={() => handleAskAiChef(1)}>
                    ✨ AI: What can I cook?
                  </button>
                  <button className="btn btn-primary" onClick={() => setPantryModal('add')}>
                    + Add Pantry Item
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="filter-bar">
                <div className="search-input-wrap">
                  <span>🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search pantry items..." 
                    value={pantrySearch}
                    onChange={(e) => setPantrySearch(e.target.value)}
                  />
                </div>
                <div className="category-chips">
                  {['All', 'Produce', 'Meat/Seafood', 'Dairy', 'Bakery', 'Pantry', 'Spices', 'Canned', 'Frozen', 'Other'].map(cat => (
                    <button 
                      key={cat} 
                      className={`chip ${pantryCategory === cat ? 'active' : ''}`}
                      onClick={() => setPantryCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Unique Items</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>{pantry.length}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Low Stock / Depleted</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                    {pantry.filter(p => (parseFloat(p.quantity) || 0) <= 0).length}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Planned Meal Demands (Next 14d)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {Object.keys(upcomingNeeds).length} ingredients
                  </div>
                </div>
              </div>

              {/* Pantry Cards Grid */}
              <div className="pantry-grid">
                {filteredPantry.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📦</div>
                    <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {pantrySearch ? 'No matching pantry items found' : 'Your pantry is currently empty'}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '420px', margin: '0 auto 20px' }}>
                      Add ingredients you have in your fridge or cupboard. DietCraft will deduct them when planning groceries and suggest dishes with AI!
                    </p>
                    <button className="btn btn-primary" onClick={() => setPantryModal('add')}>
                      + Add First Pantry Item
                    </button>
                  </div>
                ) : (
                  filteredPantry.map(item => {
                    const usage = upcomingNeeds[item.name.toLowerCase().trim()];
                    const qty = parseFloat(item.quantity) || 0;
                    const isLow = qty <= 0;
                    const willRunOut = usage && qty < usage.totalQty;

                    return (
                      <div key={item.id} className="pantry-card">
                        <div className="pantry-card-header">
                          <span className={`recipe-category-badge badge-${item.category.toLowerCase().replace('/', '-')}`}>
                            {item.category}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              className="btn btn-sm btn-icon" 
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
                              title="Edit item"
                              onClick={() => setPantryModal(item)}
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn btn-sm btn-icon" 
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
                              title="Delete item"
                              onClick={() => handleDeletePantryItem(item.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div className="pantry-card-title">{item.name}</div>
                        {item.notes && <div className="pantry-card-notes">{item.notes}</div>}

                        {/* Planned Usage Badge */}
                        {usage ? (
                          <div className="planned-use-badge">
                            <span>📅 Planned use: <strong>{Math.round(usage.totalQty * 100) / 100} {usage.unit}</strong> across {usage.mealCount} meals</span>
                            {willRunOut && (
                              <div style={{ color: '#ef4444', fontWeight: 600, marginTop: '2px', fontSize: '0.75rem' }}>
                                ⚠️ Need {Math.round((usage.totalQty - qty) * 100) / 100} more for planned meals
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
                            No upcoming meals scheduled with this item
                          </div>
                        )}

                        <div className="pantry-card-qty-row">
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Current Stock</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: isLow ? '#ef4444' : '#34d399' }}>
                              {qty} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.unit}</span>
                            </span>
                          </div>

                          <div className="pantry-qty-actions">
                            <button className="qty-btn" title="Decrease by 1" onClick={() => handleQuickAdjustPantry(item.id, -1)}>−</button>
                            <button className="qty-btn" title="Increase by 1" onClick={() => handleQuickAdjustPantry(item.id, 1)}>+</button>
                          </div>
                        </div>

                        {item.expiry_date && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
                            ⏳ Expires: {item.expiry_date}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
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
                    <div>Pantry Items: <strong style={{ color: 'var(--text-primary)' }}>{pantry.length}</strong></div>
                    <div>Meals Planned: <strong style={{ color: 'var(--text-primary)' }}>{mealPlans.length}</strong></div>
                    <div>Shopping Lists: <strong style={{ color: 'var(--text-primary)' }}>{shoppingLists.length}</strong></div>
                  </div>
                </div>

                {/* Gemini AI Configuration Card */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '8px' }}>
                    ✨ Google Gemini AI Assistant
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>
                    Powers pantry recipe suggestions, natural language recipe importing, and smart meal planning.
                  </p>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    handleSaveGeminiKey(fd.get('gemini_key'));
                  }}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">Gemini API Key</label>
                      <input 
                        type="password" 
                        name="gemini_key" 
                        defaultValue={geminiApiKey} 
                        className="form-control" 
                        placeholder="AIzaSy... (optional if GEMINI_API_KEY is set in Vercel)" 
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Status: <strong style={{ color: geminiApiKey ? '#34d399' : 'var(--text-secondary)' }}>{geminiApiKey ? 'Custom Key Configured' : 'Using Server Environment'}</strong>
                      </span>
                      <button type="submit" className="btn btn-secondary btn-sm">Save Key</button>
                    </div>
                  </form>
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
            <button className={`bottom-nav-item ${activeView === 'pantry' ? 'active' : ''}`} onClick={() => setActiveView('pantry')}>
              <span>📦</span>
              <span>Pantry</span>
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
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {(selectedRecipeDetail.category || 'Dinner').split(',').map(cat => (
                  <span key={cat.trim()} className={`recipe-category-badge badge-${cat.trim().toLowerCase()}`}>
                    {cat.trim()}
                  </span>
                ))}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>⏱️ Prep: {selectedRecipeDetail.prep_time}m | Cook: {selectedRecipeDetail.cook_time}m</span>
              </div>
              {selectedRecipeDetail.description && <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '14px' }}>{selectedRecipeDetail.description}</p>}

              {/* Dynamic Portion Scaler for Disciplined Living */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  <strong>Portions Scaler:</strong> Showing for <strong style={{ color: '#34d399' }}>{recipeDetailServings} Person{recipeDetailServings > 1 ? 's' : ''}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    type="button" 
                    className={`btn btn-sm ${recipeDetailServings === 1 ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                    onClick={() => setRecipeDetailServings(1)}
                  >
                    👤 1 Person (Single)
                  </button>
                  <button 
                    type="button" 
                    className={`btn btn-sm ${recipeDetailServings === 2 ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                    onClick={() => setRecipeDetailServings(2)}
                  >
                    🍱 2 People (Batch)
                  </button>
                  {(selectedRecipeDetail.servings || 1) !== 1 && (selectedRecipeDetail.servings || 1) !== 2 && (
                    <button 
                      type="button" 
                      className={`btn btn-sm ${recipeDetailServings === selectedRecipeDetail.servings ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                      onClick={() => setRecipeDetailServings(selectedRecipeDetail.servings)}
                    >
                      Orig ({selectedRecipeDetail.servings})
                    </button>
                  )}
                </div>
              </div>

              {selectedRecipeDetail.tags && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {selectedRecipeDetail.tags.split(',').map((tag, idx) => (
                    <span key={idx} style={{ fontSize: '0.75rem', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.25)', padding: '2px 8px', borderRadius: '12px' }}>
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              <h4 style={{ color: '#34d399', marginBottom: '8px' }}>
                Ingredients {recipeDetailServings === 1 ? '(Scaled for 1 Person)' : `(Scaled for ${recipeDetailServings} People)`}
              </h4>
              <ul style={{ listStyle: 'none', marginBottom: '20px' }}>
                {selectedRecipeDetail.ingredients?.map((ing, idx) => {
                  const origServings = selectedRecipeDetail.servings || 1;
                  const scaleFactor = recipeDetailServings / origServings;
                  const rawVal = (parseFloat(ing.quantity) || 1) * scaleFactor;
                  const displayQty = Math.round(rawVal * 100) / 100;
                  return (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span>{ing.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({ing.category})</span></span>
                      <strong style={{ color: '#34d399' }}>{displayQty} {ing.unit}</strong>
                    </li>
                  );
                })}
              </ul>

              <h4 style={{ color: '#34d399', marginBottom: '8px' }}>Cooking Instructions</h4>
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
                servings: parseInt(fd.get('servings'), 10) || 1
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
                  <input type="number" name="servings" defaultValue={mealPlanModal.servings || 1} min="1" className="form-control" required />
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
                parseInt(fd.get('servings'), 10) || 1
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
                  <input type="number" name="servings" defaultValue="1" min="1" className="form-control" required />
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
                  fd.get('end_date'),
                  fd.get('deduct_pantry') === 'on'
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
                  <div className="form-group" style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#34d399' }}>
                      <input type="checkbox" name="deduct_pantry" defaultChecked />
                      📦 Deduct ingredients already in my Pantry
                    </label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '22px' }}>
                      Avoids buying items you already have at home. Only remaining required quantities will be added to the grocery list.
                    </p>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px' }}>
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

      {/* 8. Pantry Item Modal (Add / Edit) */}
      {pantryModal && (
        <div className="modal-backdrop active" onClick={() => setPantryModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{pantryModal === 'add' ? 'Add Pantry Item' : 'Edit Pantry Item'}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setPantryModal(null)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              handleSavePantryItem({
                id: pantryModal === 'add' ? null : pantryModal.id,
                name: fd.get('name'),
                quantity: fd.get('quantity'),
                unit: fd.get('unit'),
                category: fd.get('category'),
                expiry_date: fd.get('expiry_date') || null,
                notes: fd.get('notes')
              });
            }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ingredient Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    defaultValue={pantryModal === 'add' ? '' : pantryModal.name} 
                    className="form-control" 
                    placeholder="e.g. Olive Oil, Rolled Oats, Eggs" 
                    required 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Current Stock Quantity</label>
                    <input 
                      type="number" 
                      step="any" 
                      name="quantity" 
                      defaultValue={pantryModal === 'add' ? '1' : pantryModal.quantity} 
                      className="form-control" 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input 
                      type="text" 
                      name="unit" 
                      defaultValue={pantryModal === 'add' ? 'pcs' : pantryModal.unit} 
                      className="form-control" 
                      placeholder="g, kg, ml, pcs, cups, pack" 
                      required 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select name="category" defaultValue={pantryModal === 'add' ? 'Pantry' : pantryModal.category} className="form-control">
                      <option value="Produce">Produce</option>
                      <option value="Meat/Seafood">Meat/Seafood</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Pantry">Pantry</option>
                      <option value="Canned">Canned</option>
                      <option value="Spices">Spices</option>
                      <option value="Frozen">Frozen</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date (Optional)</label>
                    <input 
                      type="date" 
                      name="expiry_date" 
                      defaultValue={pantryModal === 'add' ? '' : (pantryModal.expiry_date || '')} 
                      className="form-control" 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Brand, Location, Container)</label>
                  <input 
                    type="text" 
                    name="notes" 
                    defaultValue={pantryModal === 'add' ? '' : (pantryModal.notes || '')} 
                    className="form-control" 
                    placeholder="e.g. Top cupboard, unopened" 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPantryModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{pantryModal === 'add' ? 'Add to Pantry' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. AI Chef Modal: Suggest Dishes from Pantry */}
      {aiChefModal && (
        <div className="modal-backdrop active" onClick={() => setAiChefModal(false)}>
          <div className="modal-card" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✨ AI Chef · Single-Living Kitchen Intelligence</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAiChefModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Routine & Servings Mode Switcher */}
              <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>🎯 Structured Portion Target</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Calibrated specifically for your single-living routine & minimal cleanup.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${aiChefServings === 1 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      disabled={aiLoading}
                      onClick={() => {
                        setAiChefServings(1);
                        handleAskAiChef(1);
                      }}
                    >
                      👤 Cook for 1 (Single)
                    </button>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${aiChefServings === 2 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      disabled={aiLoading}
                      onClick={() => {
                        setAiChefServings(2);
                        handleAskAiChef(2);
                      }}
                    >
                      🍱 Cook 2 (Dinner + Lunch)
                    </button>
                  </div>
                </div>
              </div>

              {aiLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px', animation: 'spin 2s linear infinite' }}>🍲</div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    AI Chef is calibrating single-person recipes for {aiChefServings} serving(s)...
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Calculating nutrition, minimizing ingredient waste, and ensuring rapid preparation.
                  </p>
                </div>
              ) : aiRecipeResults ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Here are personalized meals scaled for <strong style={{ color: '#34d399' }}>{aiChefServings} serving{aiChefServings > 1 ? 's' : ''}</strong> using what is in your kitchen right now:
                  </p>
                  {aiRecipeResults.map((sug, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          <h4 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>{sug.title}</h4>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', marginRight: '6px' }}>
                            👤 {sug.servings || aiChefServings} Serving{(sug.servings || aiChefServings) > 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            ⏱️ {(sug.prep_time || 10) + (sug.cook_time || 15)}m total · {sug.category || 'Dinner'}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>{sug.description}</p>

                      {/* Nutritional Macros Breakdown */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          🔥 {sug.calories || 420} kcal
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          🥩 {sug.protein_g || 28}g Protein
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          🍞 {sug.carbs_g || 35}g Carbs
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          🥑 {sug.fat_g || 14}g Fat
                        </span>
                      </div>

                      {/* Structured Habit Tip */}
                      {sug.single_person_tip && (
                        <div style={{ background: 'rgba(52, 211, 153, 0.08)', borderLeft: '3px solid #34d399', padding: '8px 12px', borderRadius: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          <strong style={{ color: '#34d399' }}>💡 Disciplined Habit:</strong> {sug.single_person_tip}
                        </div>
                      )}
                      
                      {/* Scaled Ingredients */}
                      <div style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                          Exact Scaled Ingredients for {sug.servings || aiChefServings} Serving:
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {sug.ingredients && sug.ingredients.length > 0 ? (
                            sug.ingredients.map((ing, iIdx) => (
                              <span key={iIdx} style={{ background: 'var(--bg-card)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                {ing.quantity} {ing.unit} {ing.name}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{(sug.used_pantry_items || []).join(', ')}</span>
                          )}
                        </div>
                      </div>

                      {sug.missing_items && sug.missing_items.length > 0 && (
                        <div style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
                          <strong style={{ color: '#f59e0b' }}>Optional / Missing items:</strong>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>{sug.missing_items.join(', ')}</span>
                        </div>
                      )}

                      {/* Instructions Preview */}
                      {sug.instructions && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', maxHeight: '120px', overflowY: 'auto' }}>
                          {sug.instructions}
                        </div>
                      )}

                      <button 
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '4px' }}
                        onClick={() => {
                          const targetServ = sug.servings || aiChefServings || 1;
                          const macroTags = [
                            targetServ === 1 ? '1-Serving' : 'Batch-Cook',
                            sug.calories ? `${sug.calories} kcal` : '',
                            sug.protein_g ? `${sug.protein_g}g Protein` : ''
                          ].filter(Boolean).join(', ');

                          setEditingRecipe({
                            title: sug.title,
                            category: sug.category || 'Dinner',
                            servings: targetServ,
                            prep_time: sug.prep_time || 10,
                            cook_time: sug.cook_time || 15,
                            description: sug.description,
                            instructions: sug.instructions || 'Prepare ingredients and cook according to disciplined routine.',
                            tags: macroTags,
                            ingredients: sug.ingredients && sug.ingredients.length > 0 ? sug.ingredients : (sug.used_pantry_items || []).map(name => {
                              const found = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
                              return {
                                name,
                                quantity: found ? found.quantity : 1,
                                unit: found ? found.unit : 'pcs',
                                category: found ? found.category : 'Pantry'
                              };
                            })
                          });
                          setIsEditingRecipe(true);
                          setAiChefModal(false);
                        }}
                      >
                        + Save to My Recipes (Scaled for {sug.servings || aiChefServings})
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  <p>Click below to let Gemini analyze your current pantry inventory and generate recipe ideas.</p>
                  <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => handleAskAiChef(aiChefServings)}>
                    Generate Suggestions
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAiChefModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 10. AI Recipe Importer Modal */}
      {aiImportModal && (
        <div className="modal-backdrop active" onClick={() => setAiImportModal(false)}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✨ AI Recipe Importer</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAiImportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Paste any unstructured recipe from a website, social media, or note. Gemini will automatically extract instructions, calculate nutritional macros, and adapt all ingredients for your chosen portion size.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Adapt to:</span>
                <button 
                  type="button" 
                  className={`btn btn-sm ${aiImportServings === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '2px 10px', fontSize: '0.78rem' }}
                  onClick={() => setAiImportServings(1)}
                >
                  👤 1 Person (Single)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm ${aiImportServings === 2 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '2px 10px', fontSize: '0.78rem' }}
                  onClick={() => setAiImportServings(2)}
                >
                  🍱 2 People (Batch)
                </button>
              </div>

              <div className="form-group">
                <textarea 
                  rows="9"
                  className="form-control"
                  placeholder="Paste recipe text or ingredients here... (e.g. 'Creamy Garlic Chicken: 2 chicken breasts cut in cubes, 200ml heavy cream, 4 garlic cloves minced, 1 tbsp olive oil...')"
                  value={aiImportText}
                  onChange={(e) => setAiImportText(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAiImportModal(false)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={aiLoading || !aiImportText.trim()} 
                onClick={handleAiParseRecipe}
              >
                {aiLoading ? 'AI is Parsing...' : 'Parse & Import Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. AI Smart Plan Modal */}
      {aiSmartPlanModal && (
        <div className="modal-backdrop active" onClick={() => setAiSmartPlanModal(false)}>
          <div className="modal-card" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✨ AI Smart Meal Planner</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAiSmartPlanModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const meals = [];
              if (fd.get('breakfast')) meals.push('breakfast');
              if (fd.get('lunch')) meals.push('lunch');
              if (fd.get('dinner')) meals.push('dinner');
              handleAiSmartPlan(
                fd.get('start_date'),
                fd.get('end_date'),
                meals,
                fd.get('target_calories') ? parseInt(fd.get('target_calories'), 10) : null,
                aiDietaryNotes,
                parseInt(fd.get('servings'), 10) || 1
              );
            }}>
              <div className="modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Gemini analyzes your pantry stock and recipe collection to build an optimized meal calendar that uses up expiring ingredients first.
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
                  <label className="form-label">Portion Target</label>
                  <select name="servings" defaultValue="1" className="form-control">
                    <option value="1">👤 1 Person (Single-Serving Discipline)</option>
                    <option value="2">🍱 2 Servings (Cook Dinner + Pack Tomorrow's Lunch)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Meals to Plan</label>
                  <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" name="breakfast" defaultChecked /> Breakfast</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" name="lunch" defaultChecked /> Lunch</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" name="dinner" defaultChecked /> Dinner</label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Dietary Preferences or Restrictions</label>
                  <input 
                    type="text" 
                    value={aiDietaryNotes} 
                    onChange={e => setAiDietaryNotes(e.target.value)} 
                    className="form-control" 
                    placeholder="e.g. High protein, vegetarian lunches, use up tomatoes first" 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAiSmartPlanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={aiLoading}>
                  {aiLoading ? 'AI Generating Plan...' : 'Generate AI Plan'}
                </button>
              </div>
            </form>
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
  
  // Support multiple meal categories e.g. ["Lunch", "Dinner"]
  const initialCategories = useMemo(() => {
    if (!recipe || !recipe.category) return ['Dinner'];
    const parts = recipe.category.split(',').map(c => c.trim()).filter(Boolean);
    return parts.length > 0 ? parts : ['Dinner'];
  }, [recipe]);

  const [selectedCategories, setSelectedCategories] = useState(initialCategories);
  const [servings, setServings] = useState(recipe ? (recipe.servings || 1) : 1);
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
    const finalCategory = selectedCategories.length > 0 ? selectedCategories.join(', ') : 'Dinner';
    onSave({
      id: recipe ? recipe.id : null,
      title,
      category: finalCategory,
      servings: parseInt(servings, 10) || 1,
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
      <form className="modal-card" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{recipe ? 'Edit Recipe' : 'Create New Recipe'}</h3>
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Recipe Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="form-control" placeholder="e.g. Tuscan Garlic Chicken" required />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Meal Categories *</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select all that apply (e.g. Lunch &amp; Dinner)</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(cat => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '5px 14px', 
                        borderRadius: '20px', 
                        fontSize: '0.82rem',
                        border: isSelected ? '1px solid #34d399' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(52, 211, 153, 0.18)' : 'var(--bg-surface)',
                        color: isSelected ? '#34d399' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 600 : 400
                      }}
                      onClick={() => {
                        if (isSelected) {
                          if (selectedCategories.length > 1) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat));
                          }
                        } else {
                          setSelectedCategories([...selectedCategories, cat]);
                        }
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}{cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Servings</label>
              <input type="number" value={servings} onChange={e => setServings(e.target.value)} min="1" className="form-control" required />
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
  );
}
