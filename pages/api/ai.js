// Next.js API Route: AI Diet, Pantry & Recipe Assistant
// Supports Google Gemini API (set GEMINI_API_KEY in Vercel or pass from client Settings)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, payload, apiKey, userApiKey } = req.body;
  const activeKey = apiKey || userApiKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    return res.status(400).json({
      error: 'Gemini API Key not found. Please provide an API key in Settings or set GEMINI_API_KEY in Vercel.'
    });
  }

  try {
    let prompt = '';
    const systemInstruction = 'You are a helpful culinary chef and dietitian. Create practical, delicious recipes and meal plans scaled precisely to the requested number of servings. Give standard, clean, appetizing dish titles (do not add words like "Disciplined", "Single-Living", or buzzwords to recipe titles). Respond strictly with valid JSON only without markdown code blocks, backticks, or preamble.';

    if (action === 'suggest_from_pantry') {
      const pantryItems = payload.pantry || payload.pantryItems || [];
      const preferences = payload.preferences || '';
      const targetServings = parseInt(payload.servings, 10) || 1;
      const itemsList = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

      prompt = `${systemInstruction}

Suggest 3 realistic, delicious recipes tailored for EXACTLY ${targetServings} SERVING(S).
Scale ingredient quantities appropriately for ${targetServings} serving(s).
Intelligently prioritize ingredients currently in the pantry.

Available ingredients in pantry/fridge:
${itemsList || 'Basic kitchen essentials (salt, pepper, oil, water)'}

User preferences/dietary notes:
${preferences || 'Healthy, balanced, easy to prepare'}

For each recipe, generate:
- title: string (Standard recipe name like "Tomato Dal", "Garlic Chicken", "Veggie Stir-Fry", NO cringe or preachy adjectives)
- description: string (Brief appetizing summary of the dish)
- category: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert"
- prep_time: number (minutes)
- cook_time: number (minutes)
- servings: ${targetServings}
- calories: number (estimated total kcal for this serving size)
- protein_g: number (grams of protein)
- carbs_g: number (grams of carbs)
- fat_g: number (grams of fat)
- single_person_tip: string (Practical cooking or ingredient storage tip, e.g. how to store unused produce or optimize cooking time)
- ingredients: array of objects scaled for ${targetServings} serving(s):
    [{ "name": string, "quantity": number, "unit": string, "category": "Produce"|"Meat/Seafood"|"Dairy"|"Bakery"|"Pantry"|"Spices"|"Canned"|"Frozen"|"Other" }]
- instructions: string (clear numbered steps)
- used_pantry_items: array of string names from the pantry
- missing_items: array of strings (optional staples or minor missing items)

Respond strictly with a JSON array:
[
  {
    "title": "One-Pan Egg Scramble",
    "description": "Quick and flavorful breakfast scramble made in one skillet.",
    "category": "Breakfast",
    "prep_time": 5,
    "cook_time": 7,
    "servings": ${targetServings},
    "calories": 350,
    "protein_g": 24,
    "carbs_g": 8,
    "fat_g": 20,
    "single_person_tip": "Wrap any leftover bell pepper in a clean paper towel in a sealed container to keep it crisp for several days.",
    "ingredients": [
      { "name": "Eggs", "quantity": 2, "unit": "pcs", "category": "Dairy" },
      { "name": "Bell Pepper", "quantity": 0.5, "unit": "pcs", "category": "Produce" }
    ],
    "instructions": "1. Chop bell pepper.\\n2. Whisk eggs.\\n3. Sauté bell pepper in skillet for 2 minutes, pour in eggs and scramble gently until cooked.",
    "used_pantry_items": ["Eggs"],
    "missing_items": ["Bell Pepper"]
  }
]`;
    } else if (action === 'parse_recipe') {
      const rawText = payload.text || payload.rawText || '';
      const targetServings = parseInt(payload.servings, 10) || 1;
      prompt = `${systemInstruction}

Extract, clean, and standardize this raw recipe text.
Scale all ingredient quantities to EXACTLY ${targetServings} SERVING(S).

Raw Recipe:
"""
${rawText}
"""

Format strictly as JSON:
{
  "title": string,
  "description": string,
  "category": "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert",
  "prep_time": number,
  "cook_time": number,
  "servings": ${targetServings},
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "instructions": string,
  "tags": string,
  "ingredients": [
    { "name": string, "quantity": number, "unit": string, "category": "Produce"|"Meat/Seafood"|"Dairy"|"Bakery"|"Pantry"|"Spices"|"Canned"|"Frozen"|"Other" }
  ]
}`;
    } else if (action === 'smart_plan') {
      const { startDate, endDate, pantry = [], recipes = [], mealsToPlan = ['dinner'], dietaryNotes = '', targetCalories = 2000, servings = 1 } = payload;
      const recipeNames = recipes.map(r => `ID: ${r.id}, Title: ${r.title}, Category: ${r.category}`).join('\n');
      const pantryNames = pantry.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

      prompt = `${systemInstruction}

Create a balanced meal plan for ${servings} serving(s) per meal.
Target roughly ~${targetCalories} kcal/day across the day.
Make smart use of pantry items and recipe library to minimize waste.

User's recipe library:
${recipeNames || 'Suggest balanced, everyday home-cooked recipes'}

Available pantry items:
${pantryNames || 'Standard kitchen ingredients'}

Schedule:
From ${startDate} to ${endDate} for meal slots: ${mealsToPlan.join(', ')}.
Dietary preferences: "${dietaryNotes || 'Healthy, balanced home cooking'}".

Return a JSON array of meal assignments:
[
  {
    "date": "YYYY-MM-DD",
    "meal_type": "breakfast" | "lunch" | "dinner",
    "recipe_id": number or null,
    "meal_name": string,
    "servings": ${servings},
    "reasoning": string,
    "chef_tip": string
  }
]`;
    } else {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    // Verified active models on Google Gemini API for your key:
    const models = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
    let candidateText = null;
    let lastError = null;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2500
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) break;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = errData.error?.message || response.statusText;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!candidateText) {
      return res.status(500).json({ 
        error: `Gemini Error: ${lastError || 'Could not generate content'}` 
      });
    }

    // Clean JSON response (strip markdown fences if present)
    let cleaned = candidateText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '').replace(/```$/i, '');

    const parsedJson = JSON.parse(cleaned.trim());

    // Normalize output structure for client
    if (action === 'suggest_from_pantry') {
      return res.status(200).json({
        suggestions: Array.isArray(parsedJson) ? parsedJson : (parsedJson.suggestions || parsedJson.recipes || [parsedJson])
      });
    } else if (action === 'parse_recipe') {
      return res.status(200).json({
        recipe: parsedJson.recipe || parsedJson
      });
    } else if (action === 'smart_plan') {
      return res.status(200).json({
        plan: Array.isArray(parsedJson) ? parsedJson : (parsedJson.plan || [parsedJson])
      });
    }

    return res.status(200).json({ result: parsedJson });

  } catch (err) {
    console.error('AI Handler Error:', err);
    return res.status(500).json({ error: err.message || 'Internal AI service error' });
  }
}
