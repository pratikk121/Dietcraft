from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json

from ..database import get_db_connection
from ..models import RecipeCreate, RecipeUpdate, RecipeOut, IngredientOut

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

@router.get("", response_model=List[RecipeOut])
def list_recipes(
    search: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM recipes WHERE 1=1"
    params = []

    if search:
        query += " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])
    
    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    if tag:
        query += " AND tags LIKE ?"
        params.append(f"%{tag}%")

    query += " ORDER BY title ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    recipes = []
    for row in rows:
        r_dict = dict(row)
        cursor.execute("SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY id ASC", (row["id"],))
        ing_rows = cursor.fetchall()
        r_dict["ingredients"] = [dict(i) for i in ing_rows]
        recipes.append(r_dict)

    conn.close()
    return recipes

@router.get("/categories")
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND category != '' ORDER BY category ASC")
    rows = cursor.fetchall()
    conn.close()
    cats = [r["category"] for r in rows]
    # Ensure default standards are present
    defaults = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]
    for d in defaults:
        if d not in cats:
            cats.append(d)
    return cats

@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Recipe not found")

    r_dict = dict(row)
    cursor.execute("SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY id ASC", (recipe_id,))
    ing_rows = cursor.fetchall()
    r_dict["ingredients"] = [dict(i) for i in ing_rows]
    conn.close()
    return r_dict

@router.post("", response_model=RecipeOut)
def create_recipe(recipe: RecipeCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO recipes (title, description, category, prep_time, cook_time, servings, instructions, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        recipe.title, recipe.description, recipe.category,
        recipe.prep_time, recipe.cook_time, recipe.servings,
        recipe.instructions, recipe.tags
    ))
    recipe_id = cursor.lastrowid

    for ing in recipe.ingredients:
        cursor.execute("""
            INSERT INTO ingredients (recipe_id, name, quantity, unit, category, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (recipe_id, ing.name.strip(), ing.quantity, ing.unit.strip(), ing.category or "Pantry", ing.notes))

    conn.commit()

    cursor.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
    new_r = dict(cursor.fetchone())
    cursor.execute("SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY id ASC", (recipe_id,))
    new_r["ingredients"] = [dict(i) for i in cursor.fetchall()]
    conn.close()
    return new_r

@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, recipe: RecipeUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Recipe not found")

    cursor.execute("""
        UPDATE recipes
        SET title = ?, description = ?, category = ?, prep_time = ?, cook_time = ?, servings = ?, instructions = ?, tags = ?
        WHERE id = ?
    """, (
        recipe.title, recipe.description, recipe.category,
        recipe.prep_time, recipe.cook_time, recipe.servings,
        recipe.instructions, recipe.tags, recipe_id
    ))

    if recipe.ingredients is not None:
        cursor.execute("DELETE FROM ingredients WHERE recipe_id = ?", (recipe_id,))
        for ing in recipe.ingredients:
            cursor.execute("""
                INSERT INTO ingredients (recipe_id, name, quantity, unit, category, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (recipe_id, ing.name.strip(), ing.quantity, ing.unit.strip(), ing.category or "Pantry", ing.notes))

    conn.commit()

    cursor.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
    updated_r = dict(cursor.fetchone())
    cursor.execute("SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY id ASC", (recipe_id,))
    updated_r["ingredients"] = [dict(i) for i in cursor.fetchall()]
    conn.close()
    return updated_r

@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Recipe not found")

    cursor.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
    conn.commit()
    conn.close()
    return {"message": "Recipe deleted successfully"}

@router.get("/export/all")
def export_recipes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM recipes ORDER BY id ASC")
    recipes = []
    for r in cursor.fetchall():
        r_dict = dict(r)
        cursor.execute("SELECT * FROM ingredients WHERE recipe_id = ?", (r["id"],))
        r_dict["ingredients"] = [dict(i) for i in cursor.fetchall()]
        recipes.append(r_dict)
    conn.close()
    return {"version": 1, "recipes": recipes}
