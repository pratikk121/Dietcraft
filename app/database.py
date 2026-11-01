import sqlite3
import os
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "diet.db"

def get_db_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'Dinner',
        prep_time INTEGER DEFAULT 15,
        cook_time INTEGER DEFAULT 20,
        servings INTEGER DEFAULT 2,
        instructions TEXT,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Pantry',
        notes TEXT,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        recipe_id INTEGER,
        custom_title TEXT,
        servings INTEGER DEFAULT 2,
        notes TEXT,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
        UNIQUE(date, meal_type, recipe_id, custom_title)
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Pantry',
        is_checked INTEGER DEFAULT 0,
        estimated_price REAL DEFAULT 0.0,
        actual_price REAL,
        is_custom INTEGER DEFAULT 0,
        FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_name TEXT NOT NULL,
        unit TEXT NOT NULL,
        price REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)

    # Seed default settings if not exists
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', '$')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_servings', '2')")

    # Check if recipes exist; if empty, seed some delicious starter recipes
    cursor.execute("SELECT COUNT(*) as count FROM recipes")
    count = cursor.fetchone()["count"]
    if count == 0:
        seed_starter_recipes(cursor)

    conn.commit()
    conn.close()

def seed_starter_recipes(cursor: sqlite3.Cursor):
    starter_recipes = [
        {
            "title": "Avocado & Poached Egg Toast",
            "description": "Crispy whole grain toast topped with mashed avocado, eggs, chili flakes, and microgreens.",
            "category": "Breakfast",
            "prep_time": 10,
            "cook_time": 5,
            "servings": 2,
            "instructions": "1. Toast the whole grain sourdough slices.\n2. In a small bowl, mash ripe avocados with lemon juice, salt, and pepper.\n3. Poach eggs in simmering water with a splash of vinegar for 3-4 minutes.\n4. Spread avocado mash onto toast, top with poached eggs, and sprinkle red chili flakes.",
            "tags": "high-protein, quick, vegetarian",
            "ingredients": [
                ("Eggs", 4, "pcs", "Dairy", "Large free-range eggs"),
                ("Ripe Avocado", 2, "pcs", "Produce", "Hass avocados"),
                ("Whole Grain Sourdough Bread", 4, "slices", "Bakery", "Thick cut"),
                ("Lemon Juice", 1, "tbsp", "Produce", "Freshly squeezed"),
                ("Red Chili Flakes", 1, "tsp", "Spices", "Crushed")
            ]
        },
        {
            "title": "Mediterranean Lemon Herb Chicken",
            "description": "Juicy pan-seared or grilled chicken breasts marinated in olive oil, oregano, garlic, and fresh lemon.",
            "category": "Dinner",
            "prep_time": 15,
            "cook_time": 20,
            "servings": 4,
            "instructions": "1. Mix olive oil, minced garlic, dried oregano, salt, pepper, and lemon juice in a bowl.\n2. Marinate chicken breast fillets for at least 15 minutes.\n3. Heat a skillet over medium-high heat with a dash of oil.\n4. Sear chicken for 6-8 minutes per side until golden and internal temperature reaches 75°C (165°F).\n5. Serve hot with steamed rice or roasted vegetables.",
            "tags": "high-protein, low-carb, gluten-free",
            "ingredients": [
                ("Chicken Breast", 800, "g", "Meat/Seafood", "Boneless skinless"),
                ("Olive Oil", 3, "tbsp", "Pantry", "Extra virgin"),
                ("Garlic", 4, "cloves", "Produce", "Finely minced"),
                ("Dried Oregano", 1, "tbsp", "Spices", "Greek or Mediterranean"),
                ("Lemon", 2, "pcs", "Produce", "Juiced and zested")
            ]
        },
        {
            "title": "Hearty Red Lentil & Vegetable Dal",
            "description": "Comforting, nutrient-dense lentil stew spiced with turmeric, cumin, tomatoes, and coconut milk.",
            "category": "Lunch",
            "prep_time": 10,
            "cook_time": 25,
            "servings": 4,
            "instructions": "1. Rinse red lentils thoroughly until water runs clear.\n2. In a pot, sauté diced onion, minced ginger, and garlic in olive oil until fragrant.\n3. Add turmeric, cumin, garam masala, and diced tomatoes; cook for 3 minutes.\n4. Add lentils and vegetable broth; bring to a boil, then simmer covered for 18-20 minutes.\n5. Stir in coconut milk and spinach until wilted. Season with salt and cilantro.",
            "tags": "vegan, meal-prep, high-fiber",
            "ingredients": [
                ("Red Lentils", 300, "g", "Pantry", "Dry red split lentils"),
                ("Onion", 1, "pcs", "Produce", "Yellow or brown onion, diced"),
                ("Canned Diced Tomatoes", 400, "g", "Canned", "1 can"),
                ("Coconut Milk", 200, "ml", "Canned", "Full fat or light"),
                ("Vegetable Broth", 800, "ml", "Pantry", "Low sodium"),
                ("Fresh Spinach", 150, "g", "Produce", "Baby spinach"),
                ("Ground Turmeric", 1, "tsp", "Spices", "Ground"),
                ("Ground Cumin", 1, "tsp", "Spices", "Ground")
            ]
        },
        {
            "title": "Classic Garlic & Basil Tomato Pasta",
            "description": "Al dente penne pasta tossed in a rich slow-simmered garlic tomato sauce with fresh basil.",
            "category": "Dinner",
            "prep_time": 10,
            "cook_time": 15,
            "servings": 3,
            "instructions": "1. Boil salted water and cook penne pasta until al dente (about 10 mins).\n2. Heat olive oil in a skillet, gently sauté sliced garlic until lightly golden.\n3. Pour in crushed canned tomatoes, season with salt, black pepper, and simmer for 10 mins.\n4. Toss cooked pasta into the sauce with fresh basil leaves and freshly grated parmesan.",
            "tags": "vegetarian, quick, comfort-food",
            "ingredients": [
                ("Penne Pasta", 350, "g", "Pantry", "Durum wheat"),
                ("Canned Crushed Tomatoes", 400, "g", "Canned", "San Marzano style"),
                ("Garlic", 4, "cloves", "Produce", "Thinly sliced"),
                ("Olive Oil", 2, "tbsp", "Pantry", "Extra virgin"),
                ("Fresh Basil", 20, "g", "Produce", "Fresh leaves"),
                ("Parmesan Cheese", 50, "g", "Dairy", "Freshly grated")
            ]
        },
        {
            "title": "Greek Yogurt & Wild Berry Crunch Bowl",
            "description": "Creamy high-protein Greek yogurt topped with mixed berries, chia seeds, and crunchy toasted oats.",
            "category": "Breakfast",
            "prep_time": 5,
            "cook_time": 0,
            "servings": 1,
            "instructions": "1. Scoop Greek yogurt into a serving bowl.\n2. Layer fresh blueberries and raspberries on top.\n3. Drizzle with raw honey and sprinkle with chia seeds and granola.",
            "tags": "breakfast, quick, probiotic",
            "ingredients": [
                ("Greek Yogurt", 200, "g", "Dairy", "Plain unsweetened 5% or 0%"),
                ("Mixed Berries", 100, "g", "Produce", "Fresh blueberries and raspberries"),
                ("Chia Seeds", 1, "tbsp", "Pantry", "Whole black or white"),
                ("Granola", 30, "g", "Pantry", "Rolled oat granola"),
                ("Honey", 1, "tbsp", "Pantry", "Raw wildflower honey")
            ]
        }
    ]

    for recipe in starter_recipes:
        cursor.execute("""
            INSERT INTO recipes (title, description, category, prep_time, cook_time, servings, instructions, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            recipe["title"], recipe["description"], recipe["category"],
            recipe["prep_time"], recipe["cook_time"], recipe["servings"],
            recipe["instructions"], recipe["tags"]
        ))
        recipe_id = cursor.lastrowid
        for ing in recipe["ingredients"]:
            cursor.execute("""
                INSERT INTO ingredients (recipe_id, name, quantity, unit, category, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (recipe_id, ing[0], ing[1], ing[2], ing[3], ing[4]))
