from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..database import get_db_connection
from ..models import (
    ShoppingListGenerateRequest, ShoppingListOut, ShoppingItemCreate,
    ShoppingItemUpdate, ShoppingItemOut, PriceHistoryEntry
)

router = APIRouter(prefix="/api/shopping", tags=["shopping"])

def normalize_and_aggregate_ingredients(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Intelligently aggregates quantities of identical ingredient names and units.
    Converts g/kg and ml/l into standard base units before summing.
    """
    aggregated: Dict[str, Dict[str, Any]] = {}

    for item in items:
        raw_name = item["name"].strip()
        name_key = raw_name.lower()
        raw_unit = item["unit"].strip().lower()
        qty = float(item["quantity"])
        cat = item.get("category") or "Pantry"

        # Determine unit group and conversion
        base_unit = raw_unit
        base_qty = qty

        if raw_unit in ["kg", "kilogram", "kilograms"]:
            base_unit = "g"
            base_qty = qty * 1000.0
        elif raw_unit in ["g", "gram", "grams"]:
            base_unit = "g"
            base_qty = qty
        elif raw_unit in ["l", "liter", "liters", "litre", "litres"]:
            base_unit = "ml"
            base_qty = qty * 1000.0
        elif raw_unit in ["ml", "milliliter", "milliliters"]:
            base_unit = "ml"
            base_qty = qty

        key = f"{name_key}___{base_unit}"

        if key in aggregated:
            aggregated[key]["base_qty"] += base_qty
        else:
            aggregated[key] = {
                "name": raw_name,
                "base_qty": base_qty,
                "base_unit": base_unit,
                "category": cat
            }

    # Format back to human friendly units
    result = []
    for val in aggregated.values():
        display_unit = val["base_unit"]
        display_qty = val["base_qty"]

        if display_unit == "g" and display_qty >= 1000:
            display_qty = round(display_qty / 1000.0, 2)
            display_unit = "kg"
        elif display_unit == "g":
            display_qty = round(display_qty, 1)
        elif display_unit == "ml" and display_qty >= 1000:
            display_qty = round(display_qty / 1000.0, 2)
            display_unit = "l"
        elif display_unit == "ml":
            display_qty = round(display_qty, 1)
        else:
            display_qty = round(display_qty, 2)

        result.append({
            "name": val["name"],
            "quantity": display_qty,
            "unit": display_unit,
            "category": val["category"]
        })

    # Sort alphabetically by category, then name
    result.sort(key=lambda x: (x["category"], x["name"].lower()))
    return result

@router.get("", response_model=List[ShoppingListOut])
def list_shopping_lists():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT sl.*,
            COUNT(si.id) as total_items,
            SUM(CASE WHEN si.is_checked = 1 THEN 1 ELSE 0 END) as checked_items,
            COALESCE(SUM(si.estimated_price), 0.0) as total_estimated,
            COALESCE(SUM(CASE WHEN si.actual_price IS NOT NULL THEN si.actual_price ELSE 0.0 END), 0.0) as total_spent
        FROM shopping_lists sl
        LEFT JOIN shopping_items si ON sl.id = si.list_id
        GROUP BY sl.id
        ORDER BY sl.created_at DESC
    """)
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["total_items"] = d["total_items"] or 0
        d["checked_items"] = d["checked_items"] or 0
        d["total_estimated"] = round(d["total_estimated"] or 0.0, 2)
        d["total_spent"] = round(d["total_spent"] or 0.0, 2)
        d["items"] = []
        results.append(d)
    conn.close()
    return results

@router.get("/{list_id}", response_model=ShoppingListOut)
def get_shopping_list(list_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM shopping_lists WHERE id = ?", (list_id,))
    list_row = cursor.fetchone()
    if not list_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Shopping list not found")

    cursor.execute("""
        SELECT * FROM shopping_items 
        WHERE list_id = ? 
        ORDER BY is_checked ASC, category ASC, name ASC
    """, (list_id,))
    item_rows = cursor.fetchall()

    items = [dict(i) for i in item_rows]
    total_items = len(items)
    checked_items = sum(1 for i in items if i["is_checked"])
    total_estimated = sum(i["estimated_price"] for i in items if i["estimated_price"])
    total_spent = sum(i["actual_price"] for i in items if i["actual_price"] is not None)

    res = dict(list_row)
    res["total_items"] = total_items
    res["checked_items"] = checked_items
    res["total_estimated"] = round(total_estimated, 2)
    res["total_spent"] = round(total_spent, 2)
    res["items"] = items

    conn.close()
    return res

@router.post("/generate", response_model=ShoppingListOut)
def generate_shopping_list(req: ShoppingListGenerateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find all meal plans between start and end date
    cursor.execute("""
        SELECT mp.*, r.servings as recipe_servings
        FROM meal_plans mp
        LEFT JOIN recipes r ON mp.recipe_id = r.id
        WHERE mp.date >= ? AND mp.date <= ? AND mp.recipe_id IS NOT NULL
    """, (req.start_date, req.end_date))
    meals = cursor.fetchall()

    if not meals:
        conn.close()
        raise HTTPException(status_code=400, detail="No planned meals with recipes found for the selected date range.")

    raw_ingredients = []
    for meal in meals:
        recipe_servings = meal["recipe_servings"] or 2
        plan_servings = meal["servings"] or recipe_servings
        scale = float(plan_servings) / float(recipe_servings)

        cursor.execute("SELECT * FROM ingredients WHERE recipe_id = ?", (meal["recipe_id"],))
        ings = cursor.fetchall()
        for ing in ings:
            raw_ingredients.append({
                "name": ing["name"],
                "quantity": ing["quantity"] * scale,
                "unit": ing["unit"],
                "category": ing["category"]
            })

    aggregated = normalize_and_aggregate_ingredients(raw_ingredients)

    # Insert shopping list
    cursor.execute("""
        INSERT INTO shopping_lists (name, start_date, end_date)
        VALUES (?, ?, ?)
    """, (req.name, req.start_date, req.end_date))
    list_id = cursor.lastrowid

    # Populate items with estimated price lookup from price_history
    for item in aggregated:
        cursor.execute("""
            SELECT price FROM price_history 
            WHERE LOWER(ingredient_name) = LOWER(?) AND LOWER(unit) = LOWER(?)
            ORDER BY date DESC LIMIT 1
        """, (item["name"], item["unit"]))
        ph = cursor.fetchone()
        estimated = round(ph["price"], 2) if ph else 0.0

        cursor.execute("""
            INSERT INTO shopping_items (list_id, name, quantity, unit, category, estimated_price, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        """, (list_id, item["name"], item["quantity"], item["unit"], item["category"], estimated))

    conn.commit()
    conn.close()
    return get_shopping_list(list_id)

@router.post("/{list_id}/items", response_model=ShoppingItemOut)
def add_custom_item(list_id: int, item: ShoppingItemCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM shopping_lists WHERE id = ?", (list_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Shopping list not found")

    cursor.execute("""
        INSERT INTO shopping_items (list_id, name, quantity, unit, category, estimated_price, actual_price, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    """, (list_id, item.name.strip(), item.quantity, item.unit.strip(), item.category, item.estimated_price, item.actual_price))
    item_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return row

@router.patch("/items/{item_id}", response_model=ShoppingItemOut)
def update_shopping_item(item_id: int, update: ShoppingItemUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,))
    current = cursor.fetchone()
    if not current:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    new_checked = update.is_checked if update.is_checked is not None else current["is_checked"]
    new_actual = update.actual_price if update.actual_price is not None else current["actual_price"]
    new_qty = update.quantity if update.quantity is not None else current["quantity"]
    new_est = update.estimated_price if update.estimated_price is not None else current["estimated_price"]

    cursor.execute("""
        UPDATE shopping_items
        SET is_checked = ?, actual_price = ?, quantity = ?, estimated_price = ?
        WHERE id = ?
    """, (1 if new_checked else 0, new_actual, new_qty, new_est, item_id))

    # If actual price was entered or updated, record to price_history
    if update.actual_price is not None and update.actual_price > 0:
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO price_history (ingredient_name, unit, price, date, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (current["name"], current["unit"], update.actual_price, today_str, "Recorded during shopping"))

    conn.commit()

    cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return row

@router.delete("/items/{item_id}")
def delete_shopping_item(item_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM shopping_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"message": "Shopping item deleted"}

@router.delete("/{list_id}")
def delete_shopping_list(list_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM shopping_lists WHERE id = ?", (list_id,))
    conn.commit()
    conn.close()
    return {"message": "Shopping list deleted"}

@router.get("/price-history/list")
def get_price_history(limit: int = 50):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM price_history 
        ORDER BY date DESC, id DESC 
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
