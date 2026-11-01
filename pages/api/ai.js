// Next.js API Route: AI Diet, Pantry & Recipe Assistant
// Supports Google Gemini API (set GEMINI_API_KEY in Vercel or pass from client Settings)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, payload, apiKey } = req.body;
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    return res.status(400).json({
      error: 'Gemini API Key not found. Please provide an API key in Settings or set GEMINI_API_KEY in Vercel.'
    });
  }

  try {
    let prompt = '';
    let systemInstruction = 'You are a professional Michelin-trained chef and registered dietitian. Always respond with clean, valid JSON only without markdown code blocks, backticks, or preamble.';

    if (action === 'suggest_from_pantry') {
      const { pantryItems, preferences } = payload;
      const itemsList = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

      prompt = `
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
- tags: comma separated string
- ingredients: array of objects { name: string, quantity: number, unit: string, category: "Produce"|"Meat/Seafood"|"Dairy"|"Bakery"|"Pantry"|"Spices"|"Canned"|"Frozen"|"Other", alreadyInPantry: boolean }

Respond ONLY with a JSON array of the 3 recipe objects. Do not include markdown formatting or backticks.
`;
    } else if (action === 'parse_recipe') {
      const { rawText } = payload;
      prompt = `
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
}

Respond ONLY with the JSON object. Do not include markdown formatting or backticks.
`;
    } else if (action === 'smart_plan') {
      const { availableRecipes, pantryItems, daysCount, targetCalories, focus } = payload;
      const recipeNames = availableRecipes.map(r => `ID: ${r.id}, Title: ${r.title}, Category: ${r.category}`).join('\n');
      const pantryNames = pantryItems.map(p => p.name).join(', ');

      prompt = `
Given the user's recipe database:
${recipeNames || 'No recipes yet, suggest common meals'}

Available pantry items:
${pantryNames || 'Standard ingredients'}

Plan meals for ${daysCount || 7} days with focus: "${focus || 'Balanced nutrition'}".
Return a JSON array of meal assignments:
[
  {
    "day_offset": number (0 to ${daysCount - 1}),
    "meal_type": "breakfast" | "lunch" | "dinner",
    "recipe_id": number or null,
    "custom_title": string (if not from existing recipes),
    "reasoning": string
  }
]

Respond ONLY with the JSON array. Do not include markdown formatting or backticks.
`;
    } else {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    // Call Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 3000
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || response.statusText;
      return res.status(response.status).json({ error: `Gemini API Error: ${msg}` });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: 'No response content returned from Gemini' });
    }

    // Clean JSON response (strip markdown fences if present)
    let cleaned = candidateText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/```$/, '');

    const parsedJson = JSON.parse(cleaned.trim());
    return res.status(200).json({ result: parsedJson });

  } catch (err) {
    console.error('AI Handler Error:', err);
    return res.status(500).json({ error: err.message || 'Internal AI service error' });
  }
}
