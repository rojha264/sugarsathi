/** Nutrients per 100 g (or 100 ml) of a raw ingredient. carb = available carbohydrate (fiber excluded). */
export type Per100 = { carb: number; protein: number; fat: number; fiber: number; alc?: number; sugar?: number; sodium?: number };
/** sugar = free sugars (g); sodium in mg. Both are 0 when the ingredients do not list them. */
export type Portion = { c: number; p: number; f: number; fat: number; kcal: number; sugar: number; sodium: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** kcal from macros: 4 carb + 4 protein + 9 fat + 2 fiber + 7 alcohol. */
export const kcalOf = (c: number, p: number, fat: number, fiber: number, alc = 0) => 4 * c + 4 * p + 9 * fat + 2 * fiber + 7 * alc;

/** Nutrition for one portion from raw ingredient weights (grams) and their per-100 g values. */
export function portionFrom(parts: { grams: number; per100: Per100 }[]): Portion {
  let c = 0;
  let p = 0;
  let f = 0;
  let fat = 0;
  let alc = 0;
  let sugar = 0;
  let sodium = 0;
  for (const { grams, per100 } of parts) {
    const k = grams / 100;
    c += per100.carb * k;
    p += per100.protein * k;
    f += per100.fiber * k;
    fat += per100.fat * k;
    alc += (per100.alc ?? 0) * k;
    sugar += (per100.sugar ?? 0) * k;
    sodium += (per100.sodium ?? 0) * k;
  }
  return { c: r1(c), p: r1(p), f: r1(f), fat: r1(fat), kcal: Math.round(kcalOf(c, p, fat, f, alc)), sugar: r1(sugar), sodium: Math.round(sodium) };
}
