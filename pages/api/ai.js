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
    const systemInstruction = 'You are a professional Michelin-trained chef and registered dietitian specializing in healthy, structured, single-person nutrition and disciplined lifestyle planning. Always respond with clean, valid JSON only without markdown code blocks, backticks, or preamble.';

    if (action === 'suggest_from_pantry') {
      const pantryItems = payload.pantry || payload.pantryItems || [];
      const preferences = payload.preferences || '';
      const targetServings = parseInt(payload.servings, 10) || 1;
      const itemsList = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

      prompt = `${systemInstruction}

CONTEXT & GOAL:
The user is living an intentional, structured, disciplined single life.
Create 3 high-quality, practical meals tailored for EXACTLY ${targetServings} SERVING(S).
Portions and quantities MUST be realistically scaled for ${targetServings} person (e.g. 1 egg, 70g dry rice, 150g chicken, 1/2 onion).
Avoid food waste by intelligently using items currently in the pantry.

Available ingredients in pantry/fridge:
${itemsList || 'Basic kitchen essentials (salt, pepper, oil, water)'}

User preferences/dietary notes:
${preferences || 'Healthy, high-protein, minimal cleanup, disciplined lifestyle'}

For each recipe, generate:
- title: string
- description: string (highlight why it fits a structured routine)
- category: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert"
- prep_time: number (minutes)
- cook_time: number (minutes)
- servings: ${targetServings}
- calories: number (estimated total kcal for this single serving)
- protein_g: number (grams of protein)
- carbs_g: number (grams of carbs)
- fat_g: number (grams of fat)
- single_person_tip: string (e.g., how to store leftover half-can/produce, or one-skillet quick cleanup technique)
- ingredients: array of objects scaled for ${targetServings} serving(s):
    [{ "name": string, "quantity": number, "unit": string, "category": "Produce"|"Meat/Seafood"|"Dairy"|"Bakery"|"Pantry"|"Spices"|"Canned"|"Frozen"|"Other" }]
- instructions: string (clear numbered steps)
- used_pantry_items: array of string names from the pantry
- missing_items: array of strings (optional staples or minor missing items)

Respond strictly with a JSON array:
[
  {
    "title": "One-Pan Protein Scramble",
    "description": "Quick 12-minute balanced breakfast scaled for 1 person.",
    "category": "Breakfast",
    "prep_time": 5,
    "cook_time": 7,
    "servings": ${targetServings},
    "calories": 380,
    "protein_g": 28,
    "carbs_g": 12,
    "fat_g": 24,
    "single_person_tip": "Wrap remaining bell pepper half in paper towel in a sealed glass container to stay crisp for 5 days.",
    "ingredients": [
      { "name": "Eggs", "quantity": 2, "unit": "pcs", "category": "Dairy" },
      { "name": "Bell Pepper", "quantity": 0.5, "unit": "pcs", "category": "Produce" }
    ],
    "instructions": "1. Chop bell pepper.\\n2. Whisk eggs.\\n3. Sauté in skillet until fluffy.",
    "used_pantry_items": ["Eggs"],
    "missing_items": ["Bell Pepper"]
  }
]`;
    } else if (action === 'parse_recipe') {
      const rawText = payload.text || payload.rawText || '';
      const targetServings = parseInt(payload.servings, 10) || 1;
      prompt = `${systemInstruction}

Extract, clean, and adapt this raw recipe text for a single individual living a structured life.
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

CONTEXT:
Single person living a structured, disciplined life.
Goal: Efficient routine, high nutrition adherence (~${targetCalories} kcal/day target), zero food waste, smart batching (e.g. deliberate dinner leftovers packed for next day's lunch).

User's recipe library:
${recipeNames || 'Suggest balanced, clean single-person recipes'}

Available pantry items:
${pantryNames || 'Standard kitchen ingredients'}

Schedule:
From ${startDate} to ${endDate} for meal slots: ${mealsToPlan.join(', ')}.
Dietary notes/goals: "${dietaryNotes || 'High-energy, structured single-person nutrition'}".

Return a JSON array of meal assignments:
[
  {
    "date": "YYYY-MM-DD",
    "meal_type": "breakfast" | "lunch" | "dinner",
    "recipe_id": number or null,
    "meal_name": string,
    "servings": ${servings},
    "reasoning": string,
    "discipline_tip": string
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
