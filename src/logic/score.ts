import type { Profile } from '@/types';
import { isSugarDay } from './sugarPlan';

/** `sugDue` is false on a day the user's plan says no test is needed. */
export type Fractions = { eat: number; walk: number; med: number; sug: number; sugDue: boolean; meals: number; taken: number; total: number };

/** Weights: meals 30, walk 25, medicine 25, sugar 20. */
export const WEIGHTS = { eat: 30, walk: 25, med: 25, sug: 20 } as const;
export const STREAK_MIN = 60;
export const WALK_GOAL_MIN = 10;

type Scored = Pick<Profile, 'meals' | 'walkMin' | 'meds' | 'sugar'> & Partial<Pick<Profile, 'sugarPlan'>>;

/** Without `day` (or a plan) every day counts as a testing day. */
export function fractions(p: Scored, day?: string): Fractions {
  const meals = new Set(p.meals.map((m) => m.slot).filter((s) => s !== 'snack')).size;
  const total = p.meds.length;
  const taken = p.meds.filter((m) => m.s === 'taken').length;
  const sugDue = !day || !p.sugarPlan || isSugarDay(p.sugarPlan, day);
  return {
    eat: meals / 3,
    walk: Math.min(p.walkMin / WALK_GOAL_MIN, 1),
    // No medicines prescribed counts as done, so those users can still reach 100.
    med: total ? taken / total : 1,
    // Not a testing day: nothing to do, so the task shows as done.
    sug: p.sugar.length || !sugDue ? 1 : 0,
    sugDue,
    meals,
    taken,
    total,
  };
}

export function score(p: Scored, day?: string): number {
  const f = fractions(p, day);
  const rest = f.eat * WEIGHTS.eat + f.walk * WEIGHTS.walk + f.med * WEIGHTS.med;
  // On a non-testing day (and no reading) the other tasks are scaled up to 100, so skipping is not penalised.
  if (!f.sugDue && !p.sugar.length) return Math.round((rest / (100 - WEIGHTS.sug)) * 100);
  return Math.round(rest + f.sug * WEIGHTS.sug);
}

export function streakOf(p: Profile, day?: string): number {
  return p.streak + (score(p, day) >= STREAK_MIN ? 1 : 0);
}

export type MessageKey = 'msg0' | 'msg1' | 'msg2' | 'msg3';
export function messageFor(sc: number): MessageKey {
  return sc === 0 ? 'msg0' : sc < 50 ? 'msg1' : sc < 80 ? 'msg2' : 'msg3';
}
