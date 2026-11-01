-- ====================================================================
-- DietCraft - Supabase PostgreSQL Schema
-- Run this in your Supabase Project: SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Dinner',
    prep_time INT DEFAULT 15,
    cook_time INT DEFAULT 20,
    servings INT DEFAULT 2,
    instructions TEXT,
    tags TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Recipe Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Pantry',
    notes TEXT
);

-- 3. Monthly & Weekly Meal Plans Table
CREATE TABLE IF NOT EXISTS meal_plans (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE SET NULL,
    custom_title TEXT,
    servings INT DEFAULT 2,
    notes TEXT,
    CONSTRAINT unique_daily_slot UNIQUE(date, meal_type, recipe_id, custom_title)
);

-- 4. Shopping Lists Table
CREATE TABLE IF NOT EXISTS shopping_lists (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active'
);

-- 5. Shopping Items with Live Supermarket Price Tracking
CREATE TABLE IF NOT EXISTS shopping_items (
    id BIGSERIAL PRIMARY KEY,
    list_id BIGINT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Pantry',
    is_checked BOOLEAN DEFAULT FALSE,
    estimated_price NUMERIC DEFAULT 0.0,
    actual_price NUMERIC,
    is_custom BOOLEAN DEFAULT FALSE
);

-- 6. Ingredient Price History Table (Automatic Price Learning)
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    ingredient_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    price NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT
);

-- 7. App Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Default Settings
INSERT INTO settings (key, value) VALUES ('currency', '$') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('default_servings', '2') ON CONFLICT(key) DO NOTHING;

-- Enable Row Level Security (RLS) with full anon access for single-user setup
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon all on recipes" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on ingredients" ON ingredients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on meal_plans" ON meal_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on shopping_lists" ON shopping_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on shopping_items" ON shopping_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Seed Starter Recipes
INSERT INTO recipes (id, title, description, category, prep_time, cook_time, servings, instructions, tags)
VALUES 
(1, 'Avocado & Poached Egg Toast', 'Crispy whole grain toast topped with mashed avocado, eggs, and chili flakes.', 'Breakfast', 10, 5, 2, '1. Toast sourdough slices.\n2. Mash avocados with lemon juice and salt.\n3. Poach eggs in simmering water for 3-4 mins.\n4. Assemble toast and sprinkle chili flakes.', 'high-protein, quick, vegetarian'),
(2, 'Mediterranean Lemon Herb Chicken', 'Juicy grilled chicken breasts marinated in olive oil, oregano, garlic, and fresh lemon.', 'Dinner', 15, 20, 4, '1. Marinate chicken in olive oil, garlic, oregano, lemon juice.\n2. Sear in a skillet for 6-8 mins per side.\n3. Serve with steamed rice or roasted greens.', 'high-protein, low-carb, gluten-free'),
(3, 'Hearty Red Lentil & Vegetable Dal', 'Comforting, nutrient-dense lentil stew spiced with turmeric, cumin, tomatoes, and coconut milk.', 'Lunch', 10, 25, 4, '1. Sauté onion and garlic with spices.\n2. Add red lentils, diced tomatoes, broth; simmer 20 mins.\n3. Stir in spinach and coconut milk.', 'vegan, meal-prep, high-fiber'),
(4, 'Classic Garlic & Basil Tomato Pasta', 'Al dente penne pasta tossed in a rich slow-simmered garlic tomato sauce with fresh basil.', 'Dinner', 10, 15, 3, '1. Cook penne pasta in salted water.\n2. Sauté garlic in olive oil, add crushed tomatoes, simmer 10 mins.\n3. Toss pasta with sauce and fresh basil.', 'vegetarian, quick, comfort-food'),
(5, 'Greek Yogurt & Wild Berry Crunch Bowl', 'Creamy high-protein Greek yogurt topped with mixed berries, chia seeds, and crunchy granola.', 'Breakfast', 5, 0, 1, '1. Scoop Greek yogurt into a bowl.\n2. Top with fresh berries, chia seeds, and granola.\n3. Drizzle with honey.', 'breakfast, quick, probiotic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ingredients (recipe_id, name, quantity, unit, category)
VALUES
(1, 'Eggs', 4, 'pcs', 'Dairy'),
(1, 'Ripe Avocado', 2, 'pcs', 'Produce'),
(1, 'Whole Grain Sourdough', 4, 'slices', 'Bakery'),
(1, 'Lemon Juice', 1, 'tbsp', 'Produce'),
(2, 'Chicken Breast', 800, 'g', 'Meat/Seafood'),
(2, 'Olive Oil', 3, 'tbsp', 'Pantry'),
(2, 'Garlic', 4, 'cloves', 'Produce'),
(2, 'Lemon', 2, 'pcs', 'Produce'),
(3, 'Red Lentils', 300, 'g', 'Pantry'),
(3, 'Canned Diced Tomatoes', 400, 'g', 'Canned'),
(3, 'Coconut Milk', 200, 'ml', 'Canned'),
(3, 'Fresh Spinach', 150, 'g', 'Produce'),
(4, 'Penne Pasta', 350, 'g', 'Pantry'),
(4, 'Canned Crushed Tomatoes', 400, 'g', 'Canned'),
(4, 'Fresh Basil', 20, 'g', 'Produce'),
(5, 'Greek Yogurt', 200, 'g', 'Dairy'),
(5, 'Mixed Berries', 100, 'g', 'Produce'),
(5, 'Granola', 30, 'g', 'Pantry')
ON CONFLICT DO NOTHING;
