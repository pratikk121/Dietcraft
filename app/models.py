from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class IngredientBase(BaseModel):
    name: str
    quantity: float
    unit: str
    category: Optional[str] = "Pantry"
    notes: Optional[str] = None

class IngredientCreate(IngredientBase):
    pass

class IngredientOut(IngredientBase):
    id: int
    recipe_id: int

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "Dinner"
    prep_time: int = 15
    cook_time: int = 20
    servings: int = 2
    instructions: Optional[str] = None
    tags: Optional[str] = None

class RecipeCreate(RecipeBase):
    ingredients: List[IngredientCreate] = []

class RecipeUpdate(RecipeBase):
    ingredients: Optional[List[IngredientCreate]] = None

class RecipeOut(RecipeBase):
    id: int
    created_at: str
    ingredients: List[IngredientOut] = []

class MealPlanCreate(BaseModel):
    date: str  # YYYY-MM-DD
    meal_type: str  # breakfast, lunch, dinner, snack
    recipe_id: Optional[int] = None
    custom_title: Optional[str] = None
    servings: int = 2
    notes: Optional[str] = None

class MealPlanOut(BaseModel):
    id: int
    date: str
    meal_type: str
    recipe_id: Optional[int] = None
    recipe_title: Optional[str] = None
    recipe_category: Optional[str] = None
    custom_title: Optional[str] = None
    servings: int = 2
    notes: Optional[str] = None

class AutoPlanRequest(BaseModel):
    start_date: str
    end_date: str
    meals_per_day: List[str] = ["breakfast", "lunch", "dinner"]
    default_servings: int = 2
    overwrite_existing: bool = False

class ShoppingItemCreate(BaseModel):
    name: str
    quantity: float
    unit: str
    category: str = "Pantry"
    estimated_price: float = 0.0
    actual_price: Optional[float] = None
    is_custom: bool = True

class ShoppingItemUpdate(BaseModel):
    is_checked: Optional[bool] = None
    actual_price: Optional[float] = None
    quantity: Optional[float] = None
    estimated_price: Optional[float] = None

class ShoppingItemOut(BaseModel):
    id: int
    list_id: int
    name: str
    quantity: float
    unit: str
    category: str
    is_checked: bool
    estimated_price: float
    actual_price: Optional[float] = None
    is_custom: bool

class ShoppingListGenerateRequest(BaseModel):
    name: str
    start_date: str
    end_date: str
    include_existing_unbought: bool = False

class ShoppingListOut(BaseModel):
    id: int
    name: str
    start_date: str
    end_date: str
    created_at: str
    status: str
    total_items: int = 0
    checked_items: int = 0
    total_estimated: float = 0.0
    total_spent: float = 0.0
    items: List[ShoppingItemOut] = []

class PriceHistoryEntry(BaseModel):
    ingredient_name: str
    unit: str
    price: float
    date: str
    notes: Optional[str] = None
