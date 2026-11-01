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
    const systemInstruction = 'You are a professional Michelin-trained chef and registered dietitian. Always respond with clean, valid JSON only without markdown code blocks, backticks, or preamble.';

    if (action === 'suggest_from_pantry') {
      const pantryItems = payload.pantry || payload.pantryItems || [];
      const preferences = payload.preferences || '';
      const itemsList = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

      prompt = `${systemInstruction}

Given these available ingredients in the user's pantry/fridge:
${itemsList || 'Basic kitchen essentials'}

User preferences/dietary notes:
${preferences || 'Healthy, practical, and balanced'}

Generate 3 creative, delicious recipes that maximize using the ingredients already in the pantry to minimize food waste.
For each recipe, specify:
- title: string
- description: short string
- category: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert"
- prep_time: number (minutes)
- cook_time: number (minutes)
- servings: number
- instructions: string (step by step)
- used_pantry_items: array of ingredient name strings from the pantry
- missing_items: array of strings (optional pantry staples or missing ingredients)

Respond ONLY with a JSON array of the 3 recipe objects:
[
  {
    "title": "...",
    "description": "...",
    "category": "Dinner",
    "prep_time": 10,
    "cook_time": 15,
    "servings": 2,
    "instructions": "Step 1...",
    "used_pantry_items": ["..."],
    "missing_items": ["..."]
  }
]`;
    } else if (action === 'parse_recipe') {
      const rawText = payload.text || payload.rawText || '';
      prompt = `${systemInstruction}

Extract and structure this raw recipe text into a clean DietCraft recipe JSON object:
"""
${rawText}
"""

Format strictly as:
{
  "title": string,
  "description": string,
  "category": "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert",
  "prep_time": number,
  "cook_time": number,
  "servings": number,
  "instructions": string,
  "tags": string,
  "ingredients": [
    { "name": string, "quantity": number, "unit": string, "category": "Produce"|"Meat/Seafood"|"Dairy"|"Bakery"|"Pantry"|"Spices"|"Canned"|"Frozen"|"Other" }
  ]
}`;
    } else if (action === 'smart_plan') {
      const { startDate, endDate, pantry = [], recipes = [], mealsToPlan = ['dinner'], dietaryNotes = '' } = payload;
      const recipeNames = recipes.map(r => `ID: ${r.id}, Title: ${r.title}, Category: ${r.category}`).join('\n');
      const pantryNames = pantry.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

      prompt = `${systemInstruction}

Given the user's recipe database:
${recipeNames || 'No existing recipes, suggest healthy everyday home-cooked dishes'}

Available pantry items:
${pantryNames || 'Standard kitchen ingredients'}

Plan meals between ${startDate} and ${endDate} for meal slots: ${mealsToPlan.join(', ')}.
Dietary notes/goals: "${dietaryNotes || 'Balanced nutrition'}".

Prioritize using pantry items before they expire.
Return a JSON array of meal assignments:
[
  {
    "date": "YYYY-MM-DD",
    "meal_type": "breakfast" | "lunch" | "dinner",
    "recipe_id": number or null (use matching ID if picked from recipe database, or null if suggested new),
    "meal_name": string,
    "reasoning": string
  }
]`;
    } else {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    // Dynamically discover which models are enabled for this API key
    let candidateText = null;
    let lastError = null;

    // 1. Try querying the user's available model list
    let availableModels = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${activeKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.models && Array.isArray(listData.models)) {
          availableModels = listData.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));
        }
      } else {
        const errJson = await listRes.json().catch(() => ({}));
        lastError = errJson.error?.message || `HTTP ${listRes.status}`;
      }
    } catch (e) {
      lastError = e.message;
    }

    // Default priority list if listModels is empty or restricted
    const priorityFallbacks = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro'
    ];

    // Combine discovered models with priority fallbacks
    const modelsToTry = [
      ...availableModels.filter(m => m.includes('flash') || m.includes('2.0') || m.includes('1.5')),
      ...availableModels,
      ...priorityFallbacks
    ];
    // Deduplicate
    const uniqueModels = [...new Set(modelsToTry)];

    for (const model of uniqueModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 3000
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
        error: `Gemini Error: ${lastError || 'Could not generate content with available models'}. Discovered models: [${availableModels.slice(0, 5).join(', ')}]` 
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
