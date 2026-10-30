import { FOOD_BY_ID } from '@/data/foods';
import { onceADay } from '@shared/meals';

import type { Meal, MealSlot } from '@/types';

import { localDate } from './ids';

export type Basket = Record<string, number>;
export const MAX_QTY = 9;


/** The breakfast / lunch / dinner already logged on `date` (YYYY-MM-DD), if any; the latest one wins. */
export function loggedMeal(meals: readonly Meal[], slot: MealSlot, date: string): Meal | undefined {
  if (!onceADay(slot)) return undefined;
  let found: Meal | undefined;
  for (const m of meals) if (m.slot === slot && localDate(new Date(m.createdAt)) === date && (!found || m.updatedAt >= found.updatedAt)) found = m;
  return found;
}

/** Ids of extra breakfasts / lunches / dinners on the same day (older apps allowed them); the latest saved one is kept. */
export function duplicateMeals(meals: readonly Meal[]): string[] {
  const keep = new Map<string, Meal>();
  for (const m of meals) {
    if (!onceADay(m.slot)) continue;
    const k = `${m.slot}:${localDate(new Date(m.createdAt))}`;
    const cur = keep.get(k);
    if (!cur || m.updatedAt >= cur.updatedAt) keep.set(k, m);
  }
  const kept = new Set([...keep.values()].map((m) => m.id));
  return meals.filter((m) => onceADay(m.slot) && !kept.has(m.id)).map((m) => m.id);
}

export const basketOf = (m: Meal): Basket => Object.fromEntries(m.items.map((i) => [i.id, i.q]));

/** Adds quantities to a basket, capping each food at MAX_QTY. */
export function addToBasket(b: Basket, add: Basket): Basket {
  const next = { ...b };
  for (const id in add) next[id] = Math.min((next[id] ?? 0) + add[id], MAX_QTY);
  return next;
}

/** True when the basket already holds at least every portion of `plate` (a one-tap thali). */
export function hasAll(b: Basket, plate: Basket): boolean {
  return Object.entries(plate).every(([id, q]) => (b[id] ?? 0) >= q);
}

/** Takes a thali's portions back out; foods that reach 0 leave the basket. */
export function removeFromBasket(b: Basket, remove: Basket): Basket {
  const next = { ...b };
  for (const id in remove) {
    const left = (next[id] ?? 0) - remove[id];
    if (left > 0) next[id] = left;
    else delete next[id];
  }
  return next;
}

/** Rough glycemic-load factor per GI band (sample values). */
const GI_FACTOR = { low: 0.4, med: 0.6, high: 0.8 } as const;

export type Totals = { c: number; p: number; fiber: number; fat: number; kcal: number; g: number; gl: number; std: number };

export function totals(items: Basket): Totals {
  let c = 0;
  let p = 0;
  let fiber = 0;
  let gl = 0;
  let std = 0;
  let fat = 0;
  let kcal = 0;
  let g = 0;
  for (const id in items) {
    const f = FOOD_BY_ID[id];
    if (!f) continue;
    const q = items[id];
    c += f.c * q;
    p += f.p * q;
    fiber += f.f * q;
    gl += f.c * q * GI_FACTOR[f.gi];
    std += (f.std ?? 0) * q;
    fat += f.fat * q;
    kcal += f.kcal * q;
    g += f.g * q;
  }
  return { c: Math.round(c), p: Math.round(p), fiber: Math.round(fiber), fat: Math.round(fat), kcal: Math.round(kcal), g: Math.round(g), gl: Math.round(gl), std };
}

export function defaultSlot(hour: number = new Date().getHours()): MealSlot {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'snack' : 'dinner';
}
