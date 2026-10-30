import type { DiabetesType, SugarEvery, SugarPlan } from '@/types';
import { addDays, daysBetween } from './ids';

export const SUGAR_EVERY: SugarEvery[] = ['daily', 'every3', 'twiceWeek', 'weekly', 'fortnight', 'off'];

/**
 * Sensible default by diabetes type. Type 1 and pregnancy usually test daily (often
 * several times); type 2 not on insulin tests a few times a week; pre-diabetes rarely.
 * The user (or their doctor) can change it.
 */
export function defaultSugarEvery(type: DiabetesType): SugarEvery {
  if (type === 'type1' || type === 'gdm') return 'daily';
  if (type === 'pre') return 'fortnight';
  return 'every3';
}

const STEP: Partial<Record<SugarEvery, number>> = { daily: 1, every3: 3, weekly: 7, fortnight: 14 };
/** Twice a week: Monday and Thursday (getDay: 0 = Sunday). */
const TWICE_WEEK_DAYS = [1, 4];

const weekday = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Whether `date` (YYYY-MM-DD) is a testing day under the plan. */
export function isSugarDay(plan: SugarPlan, date: string): boolean {
  if (plan.every === 'off') return false;
  if (plan.every === 'twiceWeek') return TWICE_WEEK_DAYS.includes(weekday(date));
  const gap = daysBetween(plan.from, date);
  return gap >= 0 && gap % STEP[plan.every]! === 0;
}

/** The next `n` testing days from `date` (inclusive), soonest first. */
export function upcomingSugarDays(plan: SugarPlan, date: string, n: number): string[] {
  if (plan.every === 'off') return [];
  const out: string[] = [];
  for (let i = 0; out.length < n && i < 400; i++) {
    const d = addDays(date, i);
    if (isSugarDay(plan, d)) out.push(d);
  }
  return out;
}

/** The next testing day on or after `date`, or null when reminders are off. */
export const nextSugarDay = (plan: SugarPlan, date: string): string | null => upcomingSugarDays(plan, date, 1)[0] ?? null;

/** Position of a testing day in the plan (0, 1, 2…), stable across reschedules. */
export function sugarDayIndex(plan: SugarPlan, date: string): number {
  const gap = daysBetween(plan.from, date);
  if (plan.every === 'twiceWeek') return Math.floor(gap / 7) * 2 + (weekday(date) === TWICE_WEEK_DAYS[1] ? 1 : 0);
  return Math.floor(gap / (STEP[plan.every] ?? 1));
}

/** Alternating test types build before/after pairs for smart targets: fasting, then 2 h after a meal. */
export const checkKindFor = (index: number): 'fasting' | 'after' => (index % 2 === 0 ? 'fasting' : 'after');
