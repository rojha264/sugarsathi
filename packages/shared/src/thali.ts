import { type Diet } from './diet';

/** One-tap plates the dietitian builds in the admin panel; the app shows them on the meal screen. */
export type ThaliItem = { foodId: string; qty: number };
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** The food fields that nutrition needs (server and admin rows both have them). */
export type NutritionFood = {
  carbs: number; protein: number; fiber: number; fat: number; kcal: number;
  gi: string; role: string; diet: string; servingG: number; active?: boolean;
};

export const MAX_THALI_ITEMS = 12;
export const MAX_QTY = 9;
/** Carbs for one main meal: up to 60 g is the usual guide (ICMR/ADA); above 80 g is a heavy meal. */
export const MEAL_CARBS = { good: 60, heavy: 80 } as const;
/** Same rough glycemic-load factors as the app's meal screen. */
const GI_FACTOR: Record<string, number> = { low: 0.4, med: 0.6, high: 0.8 };
const RANK: Record<Diet, number> = { veg: 0, egg: 1, nonveg: 2 };

/** A plate is as strict as its strictest food: one egg makes it eggetarian, one meat dish non-veg. */
export const strictestDiet = (diets: string[]): Diet =>
  diets.reduce<Diet>((acc, d) => (RANK[d as Diet] > RANK[acc] ? (d as Diet) : acc), 'veg');

export type ThaliNutrition = {
  carbs: number; protein: number; fiber: number; fat: number; kcal: number; gl: number;
  diet: Diet;
  /** Plate method shares by grams (½ veg, ¼ protein, ¼ grain is the target). */
  plate: { veg: number; protein: number; grain: number } | null;
  carbsLevel: 'good' | 'high' | 'heavy';
  /** Items whose food is unknown or hidden. */
  missing: string[];
};

export function thaliNutrition(items: ThaliItem[], food: (id: string) => NutritionFood | undefined): ThaliNutrition {
  const t = { carbs: 0, protein: 0, fiber: 0, fat: 0, kcal: 0, gl: 0 };
  const w = { veg: 0, protein: 0, grain: 0 };
  const diets: string[] = [];
  const missing: string[] = [];
  for (const i of items) {
    const f = food(i.foodId);
    if (!f || f.active === false) {
      missing.push(i.foodId);
      if (!f) continue;
    }
    t.carbs += f.carbs * i.qty;
    t.protein += f.protein * i.qty;
    t.fiber += f.fiber * i.qty;
    t.fat += f.fat * i.qty;
    t.kcal += f.kcal * i.qty;
    t.gl += f.carbs * i.qty * (GI_FACTOR[f.gi] ?? 0.6);
    if (f.role === 'veg' || f.role === 'protein' || f.role === 'grain') w[f.role] += f.servingG * i.qty;
    diets.push(f.diet);
  }
  const sum = w.veg + w.protein + w.grain;
  const r = (n: number) => Math.round(n);
  const carbs = r(t.carbs);
  return {
    carbs, protein: r(t.protein), fiber: r(t.fiber), fat: r(t.fat), kcal: r(t.kcal), gl: r(t.gl),
    diet: strictestDiet(diets),
    plate: sum ? { veg: w.veg / sum, protein: w.protein / sum, grain: w.grain / sum } : null,
    carbsLevel: carbs <= MEAL_CARBS.good ? 'good' : carbs <= MEAL_CARBS.heavy ? 'high' : 'heavy',
    missing,
  };
}

/** Checks a thali before saving; returns an error code or null. */
export function thaliProblem(t: { nameEn?: string; nameHi?: string; emoji?: string; items?: ThaliItem[] }, foodExists: (id: string) => boolean): string | null {
  if (!t.nameEn?.trim() || !t.nameHi?.trim()) return 'name_required';
  if (!t.emoji?.trim()) return 'emoji_required';
  const items = t.items ?? [];
  if (items.length < 2) return 'at_least_two_items';
  if (items.length > MAX_THALI_ITEMS) return 'too_many_items';
  const ids = new Set<string>();
  for (const i of items) {
    if (!foodExists(i.foodId)) return `unknown_food_${i.foodId}`;
    if (!(i.qty > 0 && i.qty <= MAX_QTY)) return `bad_qty_${i.foodId}`;
    if (ids.has(i.foodId)) return `duplicate_${i.foodId}`;
    ids.add(i.foodId);
  }
  return null;
}
