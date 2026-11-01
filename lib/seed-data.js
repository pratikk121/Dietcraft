export const INITIAL_RECIPES = [
  {
    id: 1,
    title: "Avocado & Poached Egg Toast",
    description: "Crispy whole grain toast topped with mashed avocado, eggs, chili flakes, and microgreens.",
    category: "Breakfast",
    prep_time: 10,
    cook_time: 5,
    servings: 2,
    instructions: "1. Toast the whole grain sourdough slices.\n2. In a small bowl, mash ripe avocados with lemon juice, salt, and pepper.\n3. Poach eggs in simmering water with a splash of vinegar for 3-4 minutes.\n4. Spread avocado mash onto toast, top with poached eggs, and sprinkle red chili flakes.",
    tags: "high-protein, quick, vegetarian",
    ingredients: [
      { name: "Eggs", quantity: 4, unit: "pcs", category: "Dairy" },
      { name: "Ripe Avocado", quantity: 2, unit: "pcs", category: "Produce" },
      { name: "Whole Grain Sourdough", quantity: 4, unit: "slices", category: "Bakery" },
      { name: "Lemon Juice", quantity: 1, unit: "tbsp", category: "Produce" }
    ]
  },
  {
    id: 2,
    title: "Mediterranean Lemon Herb Chicken",
    description: "Juicy pan-seared or grilled chicken breasts marinated in olive oil, oregano, garlic, and fresh lemon.",
    category: "Dinner",
    prep_time: 15,
    cook_time: 20,
    servings: 4,
    instructions: "1. Mix olive oil, minced garlic, dried oregano, salt, pepper, and lemon juice in a bowl.\n2. Marinate chicken breast fillets for at least 15 minutes.\n3. Heat a skillet over medium-high heat with a dash of oil.\n4. Sear chicken for 6-8 minutes per side until golden.\n5. Serve hot with steamed rice or roasted greens.",
    tags: "high-protein, low-carb, gluten-free",
    ingredients: [
      { name: "Chicken Breast", quantity: 800, unit: "g", category: "Meat/Seafood" },
      { name: "Olive Oil", quantity: 3, unit: "tbsp", category: "Pantry" },
      { name: "Garlic", quantity: 4, unit: "cloves", category: "Produce" },
      { name: "Lemon", quantity: 2, unit: "pcs", category: "Produce" }
    ]
  },
  {
    id: 3,
    title: "Hearty Red Lentil & Vegetable Dal",
    description: "Comforting, nutrient-dense lentil stew spiced with turmeric, cumin, tomatoes, and coconut milk.",
    category: "Lunch",
    prep_time: 10,
    cook_time: 25,
    servings: 4,
    instructions: "1. Rinse red lentils thoroughly.\n2. Sauté diced onion and garlic in olive oil until fragrant.\n3. Add turmeric, cumin, and diced tomatoes; cook 3 mins.\n4. Add lentils and broth; simmer for 20 mins.\n5. Stir in spinach and coconut milk.",
    tags: "vegan, meal-prep, high-fiber",
    ingredients: [
      { name: "Red Lentils", quantity: 300, unit: "g", category: "Pantry" },
      { name: "Canned Diced Tomatoes", quantity: 400, unit: "g", category: "Canned" },
      { name: "Coconut Milk", quantity: 200, unit: "ml", category: "Canned" },
      { name: "Fresh Spinach", quantity: 150, unit: "g", category: "Produce" }
    ]
  },
  {
    id: 4,
    title: "Classic Garlic & Basil Tomato Pasta",
    description: "Al dente penne pasta tossed in a rich slow-simmered garlic tomato sauce with fresh basil.",
    category: "Dinner",
    prep_time: 10,
    cook_time: 15,
    servings: 3,
    instructions: "1. Cook penne pasta in salted water.\n2. Sauté sliced garlic in olive oil until golden.\n3. Pour in crushed tomatoes, season with salt and pepper, simmer 10 mins.\n4. Toss pasta with sauce and fresh basil.",
    tags: "vegetarian, quick, comfort-food",
    ingredients: [
      { name: "Penne Pasta", quantity: 350, unit: "g", category: "Pantry" },
      { name: "Canned Crushed Tomatoes", quantity: 400, unit: "g", category: "Canned" },
      { name: "Fresh Basil", quantity: 20, unit: "g", category: "Produce" }
    ]
  },
  {
    id: 5,
    title: "Greek Yogurt & Wild Berry Crunch Bowl",
    description: "Creamy high-protein Greek yogurt topped with mixed berries, chia seeds, and crunchy toasted oats.",
    category: "Breakfast",
    prep_time: 5,
    cook_time: 0,
    servings: 1,
    instructions: "1. Scoop Greek yogurt into a bowl.\n2. Layer fresh blueberries and raspberries on top.\n3. Drizzle with raw honey and sprinkle granola.",
    tags: "breakfast, quick, probiotic",
    ingredients: [
      { name: "Greek Yogurt", quantity: 200, unit: "g", category: "Dairy" },
      { name: "Mixed Berries", quantity: 100, unit: "g", category: "Produce" },
      { name: "Granola", quantity: 30, unit: "g", category: "Pantry" }
    ]
  }
];
