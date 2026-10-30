import { programDay } from '@shared/program';
import { allowed, FOODS, type Food } from '@/data/foods';
import type { Diet } from '@/types';

const IST_MS = 330 * 60_000;

/** A plan's start (an instant, IST midnight on the server) as the India calendar date. */
export const istYmd = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10);

/** Programme day (1–14) for today, or null when the plan is a weekday plan (no `day` items). */
export function planDayToday(plan: { startsOn: string; items: { day?: number | null }[] }, today: string): number | null {
  if (!plan.items.some((i) => i.day != null)) return null;
  return programDay(istYmd(plan.startsOn), today);
}

/** Items for a day: programme items by day number, otherwise by weekday (null = every day). */
export function itemsFor<T extends { day?: number | null; weekday?: number | null; weekdays?: number[] }>(items: T[], pday: number | null, weekday: number): T[] {
  return items.filter((i) => {
    if (pday !== null && i.day != null) return i.day === Math.min(Math.max(pday, 1), 14);
    if (i.weekdays) return !i.weekdays.length || i.weekdays.includes(weekday);
    return i.weekday == null || i.weekday === weekday;
  });
}

/** Up to 5 swaps for a planned food: same food group, food the person eats, carbs within ±10 g for the planned amount; low GI first. */
export function swapsFor(food: Food, qty: number, diet: Diet, catalog: Food[] = FOODS): Food[] {
  const target = food.c * qty;
  const gi = { low: 0, med: 1, high: 2 } as const;
  return catalog
    .filter((f) => f.id !== food.id && f.group === food.group && allowed(f, diet) && Math.abs(f.c * qty - target) <= 10)
    .sort((a, b) => gi[a.gi] - gi[b.gi] || Math.abs(a.c - food.c) - Math.abs(b.c - food.c))
    .slice(0, 5);
}
