/**
 * A patient's meal menu: the only foods the meal screen opens with for one meal.
 * The dietitian's own list wins; with none saved, the foods of the active diet plan are the default;
 * with neither, there is no menu and the whole food list shows. The server repeats this rule in
 * server/src/admin/picks.controller.ts so the admin panel previews the same thing.
 */
export type MenuSource = 'custom' | 'plan';
export type Menu = { source: MenuSource | null; foodIds: string[]; notes: Record<string, string> };

type Pick = { foodId: string; slots: readonly string[]; note: string };
type PlanItem = { slot: string; foodId: string };

export function menuFor(slot: string, picks: readonly Pick[], planItems: readonly PlanItem[] | null | undefined, ok: (foodId: string) => boolean): Menu {
  if (picks.length) {
    const mine = picks.filter((p) => (!p.slots.length || p.slots.includes(slot)) && ok(p.foodId));
    return { source: 'custom', foodIds: mine.map((p) => p.foodId), notes: Object.fromEntries(mine.filter((p) => p.note).map((p) => [p.foodId, p.note])) };
  }
  const ids = [...new Set((planItems ?? []).filter((i) => i.slot === slot && ok(i.foodId)).map((i) => i.foodId))];
  return ids.length ? { source: 'plan', foodIds: ids, notes: {} } : { source: null, foodIds: [], notes: {} };
}
