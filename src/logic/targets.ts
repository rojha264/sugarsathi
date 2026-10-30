import type { MainSlot, MealSlot, Profile, Targets } from '@/types';
import { totals, type Basket } from './meal';

/**
 * Sample base targets, to be set with the user's doctor or dietitian.
 * Per meal up to 60 g carbs (ADA carb-counting range 45–60 g); fiber 25–40 g/day
 * (ICMR-NIN); protein about 60 g/day for an adult.
 */
export const BASE = { meal: 60, protein: 60, fiber: 25 };
export const SNACK_MAX = 20;
export const MAIN_SLOTS: MainSlot[] = ['breakfast', 'lunch', 'dinner'];
/** The low end of a meal's range sits this far under its guide. */
const RANGE = 15;

export function newTargets(base = BASE, mode: Targets['mode'] = 'auto'): Targets {
  return {
    mode,
    base: { ...base },
    slot: { breakfast: base.meal, lunch: base.meal, dinner: base.meal },
    protein: base.protein,
    fiber: base.fiber,
    good: { breakfast: 0, lunch: 0, dinner: 0 },
    fastHist: [],
    fastHigh: false,
    log: [],
  };
}

export const DEFAULT_TARGETS = newTargets();

/** Carb range for a meal slot; snacks have a fixed small limit. */
export function mealGuide(t: Targets, slot: MealSlot): { min: number; max: number } {
  if (slot === 'snack') return { min: 0, max: SNACK_MAX };
  const max = t.slot[slot];
  return { min: Math.max(0, max - RANGE), max };
}

/** The most recent automatic change to a meal's guide, if any. */
export function lastChangeFor(t: Targets, slot: MainSlot) {
  for (let i = t.log.length - 1; i >= 0; i--) if (t.log[i].field === slot) return t.log[i];
  return undefined;
}

/** True when a meal's guide sits below the base set by the doctor or default. */
export const isLowered = (t: Targets, slot: MainSlot) => t.slot[slot] < t.base.meal;

/** Day carb ceiling: the three meal guides plus one snack. */
export const dayCarbMax = (t: Targets) => MAIN_SLOTS.reduce((a, s) => a + t.slot[s], 0) + SNACK_MAX;

/** Everything eaten today, as one basket. */
export function todayBasket(p: Pick<Profile, 'meals'>): Basket {
  const b: Basket = {};
  p.meals.forEach((m) => m.items.forEach((i) => (b[i.id] = (b[i.id] ?? 0) + i.q)));
  return b;
}

export function dayTotals(p: Pick<Profile, 'meals'>) {
  return totals(todayBasket(p));
}

export type Band = 'low' | 'ok' | 'high';

/** Where a meal's carbs sit against its guide. */
export function mealBand(carbs: number, t: Targets, slot: MealSlot): Band {
  return carbs > mealGuide(t, slot).max ? 'high' : carbs < 15 ? 'low' : 'ok';
}
