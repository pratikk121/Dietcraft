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

-- 8. Pantry Inventory Table ("What we currently have")
CREATE TABLE IF NOT EXISTS pantry (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'pcs',
    category TEXT NOT NULL DEFAULT 'Pantry',
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_pantry_item UNIQUE(name, unit)
);

ALTER TABLE pantry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on pantry" ON pantry FOR ALL USING (true) WITH CHECK (true);
