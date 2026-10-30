/** Carbs / protein / fiber / kcal of plan items, by meal and for the day. */
export type FoodLite = { id: string; carbs: number; protein: number; fiber: number; kcal: number };
/** `day` 1–14 = 14-day programme item; otherwise `weekday` (null = every day). */
export type PlanItem = { slot: string; foodId: string; qty: number; weekday?: number | null; day?: number | null };
export type Totals = { carbs: number; protein: number; fiber: number; kcal: number };

const zero = (): Totals => ({ carbs: 0, protein: 0, fiber: 0, kcal: 0 });

export function totals(items: PlanItem[], foods: Map<string, FoodLite>, weekday: number | null = null, programDay: number | null = null) {
  const bySlot: Record<string, Totals> = {};
  const day = zero();
  for (const i of items) {
    // Programme plans: that day's items. Weekday plans: every-day items plus the chosen weekday's items.
    if (programDay != null ? i.day !== programDay : i.weekday != null && i.weekday !== weekday) continue;
    const f = foods.get(i.foodId);
    if (!f) continue;
    const s = (bySlot[i.slot] ??= zero());
    for (const k of ['carbs', 'protein', 'fiber', 'kcal'] as const) {
      s[k] += f[k] * i.qty;
      day[k] += f[k] * i.qty;
    }
  }
  const round = (t: Totals) => ({ carbs: Math.round(t.carbs), protein: Math.round(t.protein), fiber: Math.round(t.fiber), kcal: Math.round(t.kcal) });
  return { bySlot: Object.fromEntries(Object.entries(bySlot).map(([k, v]) => [k, round(v)])) as Record<string, Totals>, day: round(day) };
}
