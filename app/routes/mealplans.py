from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import random

from ..database import get_db_connection
from ..models import MealPlanCreate, MealPlanOut, AutoPlanRequest

router = APIRouter(prefix="/api/mealplans", tags=["mealplans"])

@router.get("", response_model=List[MealPlanOut])
def get_meal_plans(start_date: str = Query(...), end_date: str = Query(...)):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT mp.*, r.title as recipe_title, r.category as recipe_category
        FROM meal_plans mp
        LEFT JOIN recipes r ON mp.recipe_id = r.id
        WHERE mp.date >= ? AND mp.date <= ?
        ORDER BY mp.date ASC, 
            CASE mp.meal_type
                WHEN 'breakfast' THEN 1
                WHEN 'lunch' THEN 2
                WHEN 'dinner' THEN 3
                WHEN 'snack' THEN 4
                ELSE 5
            END ASC
    """, (start_date, end_date))

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("", response_model=MealPlanOut)
def add_or_update_meal_plan(plan: MealPlanCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if a plan for that date & meal_type exists; if so, update or delete & insert
    cursor.execute("""
        SELECT id FROM meal_plans WHERE date = ? AND meal_type = ?
    """, (plan.date, plan.meal_type.lower()))
    existing = cursor.fetchone()

    if existing:
        cursor.execute("""
            UPDATE meal_plans
            SET recipe_id = ?, custom_title = ?, servings = ?, notes = ?
            WHERE id = ?
        """, (plan.recipe_id, plan.custom_title, plan.servings, plan.notes, existing["id"]))
        plan_id = existing["id"]
    else:
        cursor.execute("""
            INSERT INTO meal_plans (date, meal_type, recipe_id, custom_title, servings, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (plan.date, plan.meal_type.lower(), plan.recipe_id, plan.custom_title, plan.servings, plan.notes))
        plan_id = cursor.lastrowid

    conn.commit()

    cursor.execute("""
        SELECT mp.*, r.title as recipe_title, r.category as recipe_category
        FROM meal_plans mp
        LEFT JOIN recipes r ON mp.recipe_id = r.id
        WHERE mp.id = ?
    """, (plan_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return row

@router.delete("/{plan_id}")
def delete_meal_plan(plan_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM meal_plans WHERE id = ?", (plan_id,))
    conn.commit()
    conn.close()
    return {"message": "Meal plan entry removed"}

@router.post("/auto-plan")
def auto_generate_plan(req: AutoPlanRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch available recipes categorized
    cursor.execute("SELECT id, title, category, servings FROM recipes")
    recipes = [dict(r) for r in cursor.fetchall()]

    if not recipes:
        conn.close()
        raise HTTPException(status_code=400, detail="No recipes in database to plan from. Please add recipes first.")

    recipes_by_cat = {}
    for r in recipes:
        cat = r["category"].lower()
        recipes_by_cat.setdefault(cat, []).append(r)

    start = datetime.strptime(req.start_date, "%Y-%m-%d")
    end = datetime.strptime(req.end_date, "%Y-%m-%d")
    days = (end - start).days + 1

    created_count = 0
    curr = start
    while curr <= end:
        date_str = curr.strftime("%Y-%m-%d")

        for meal_type in req.meals_per_day:
            mt = meal_type.lower()
            if not req.overwrite_existing:
                cursor.execute("SELECT id FROM meal_plans WHERE date = ? AND meal_type = ?", (date_str, mt))
                if cursor.fetchone():
                    continue

            # Pick recipe matching meal category if available, otherwise random
            matched = recipes_by_cat.get(mt, [])
            if not matched:
                if mt == "breakfast":
                    matched = recipes_by_cat.get("breakfast", recipes)
                elif mt in ["lunch", "dinner"]:
                    matched = recipes_by_cat.get("dinner", []) + recipes_by_cat.get("lunch", [])
                if not matched:
                    matched = recipes

            chosen = random.choice(matched)

            cursor.execute("DELETE FROM meal_plans WHERE date = ? AND meal_type = ?", (date_str, mt))
            cursor.execute("""
                INSERT INTO meal_plans (date, meal_type, recipe_id, servings)
                VALUES (?, ?, ?, ?)
            """, (date_str, mt, chosen["id"], req.default_servings))
            created_count += 1

        curr += timedelta(days=1)

    conn.commit()
    conn.close()
    return {"message": f"Successfully planned {created_count} meals between {req.start_date} and {req.end_date}."}

@router.post("/copy-week")
def copy_week(source_start: str = Query(...), target_start: str = Query(...)):
    src_date = datetime.strptime(source_start, "%Y-%m-%d")
    src_end = src_date + timedelta(days=6)
    tgt_date = datetime.strptime(target_start, "%Y-%m-%d")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM meal_plans
        WHERE date >= ? AND date <= ?
    """, (src_date.strftime("%Y-%m-%d"), src_end.strftime("%Y-%m-%d")))
    rows = cursor.fetchall()

    copied_count = 0
    for r in rows:
        r_date = datetime.strptime(r["date"], "%Y-%m-%d")
        offset = (r_date - src_date).days
        new_date_str = (tgt_date + timedelta(days=offset)).strftime("%Y-%m-%d")

        cursor.execute("DELETE FROM meal_plans WHERE date = ? AND meal_type = ?", (new_date_str, r["meal_type"]))
        cursor.execute("""
            INSERT INTO meal_plans (date, meal_type, recipe_id, custom_title, servings, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (new_date_str, r["meal_type"], r["recipe_id"], r["custom_title"], r["servings"], r["notes"]))
        copied_count += 1

    conn.commit()
    conn.close()
    return {"message": f"Copied {copied_count} meals to week starting {target_start}"}
