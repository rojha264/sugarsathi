import { kcalOf, portionFrom } from '@shared/nutrition';
import { INGREDIENTS, type IngredientId } from './ingredients';
import { RECIPES } from './recipes';

export { kcalOf };

export type PortionNutrition = {
  /** Served weight of one standard portion (g, or ml for drinks). */
  g: number;
  c: number;
  p: number;
  f: number;
  fat: number;
  kcal: number;
  /** Data sources behind the numbers. */
  src: string[];
};

/** Nutrition for one standard portion, summed from the recipe's raw ingredients. */
export function nutritionFor(foodId: string): PortionNutrition {
  const recipe = RECIPES[foodId];
  if (!recipe) throw new Error(`No recipe for food "${foodId}"`);
  const src = new Set<string>();
  const parts = (Object.entries(recipe.i) as [IngredientId, number][]).map(([id, grams]) => {
    const ing = INGREDIENTS[id];
    src.add(ing.src.split(' ')[0] === 'IFCT' ? 'IFCT 2017' : ing.src.startsWith('USDA') ? 'USDA FDC' : ing.src.split(',')[0]);
    return { grams, per100: ing };
  });
  return { g: recipe.g, ...portionFrom(parts), src: [...src] };
}
