import type { Profile, SugarCtx } from '@/types';
import { addDays } from './ids';

/** Days after the last HbA1c test when the next one is due (every 3 months). */
export const A1C_EVERY_DAYS = 90;

export type LastSugar = { v: number; ctx: SugarCtx | null; day: 'today' | 'yesterday' | string };

/** Latest sugar reading: today's (with its context), otherwise the last day that had one. */
export function lastSugar(p: Pick<Profile, 'sugar' | 'days'>, today: string): LastSugar | null {
  const r = p.sugar.at(-1);
  if (r) return { v: r.v, ctx: r.ctx, day: 'today' };
  for (let i = p.days.length - 1; i >= 0; i--) {
    const d = p.days[i];
    const v = d.sugar.at(-1);
    if (v !== undefined) return { v, ctx: null, day: d.date === addDays(today, -1) ? 'yesterday' : d.date };
  }
  return null;
}

/** Whole days between two YYYY-MM-DD dates. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000);

/** True when the last HbA1c test is 3+ months old (or unknown but a value was entered long ago). */
export const a1cDue = (lastDone: string | undefined, today: string) => !lastDone || daysBetween(lastDone, today) >= A1C_EVERY_DAYS;

/** BMI band with the Asian Indian cut-offs (ICMR / WHO Asia-Pacific): 23 = overweight, 25 = obese. */
export function bmiBand(bmi: number): 'under' | 'normal' | 'over' | 'obese' {
  if (bmi < 18.5) return 'under';
  if (bmi < 23) return 'normal';
  if (bmi < 25) return 'over';
  return 'obese';
}

/** Healthy BMI for Indians (ICMR / WHO Asia-Pacific): 18.5–22.9. */
const HEALTHY_BMI = { min: 18.5, max: 22.9 } as const;
/** First goal for people above the healthy range: 5% of body weight, enough to lower sugar (ADA). */
const FIRST_GOAL_LOSS = 0.05;

export type WeightStatus = {
  bmi: number; band: ReturnType<typeof bmiBand>;
  /** Healthy weight for this height (kg). */
  min: number; max: number;
  /** kg above the range (positive), below it (negative), or 0 inside it. */
  offBy: number;
  /** A realistic first target when above the range; null otherwise (and never in pregnancy). */
  goal: number | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Weight only means something next to height: the healthy range for this height, how far off it is,
 * and a first goal. Null without a height, and for children (adult BMI does not apply under 18).
 */
export function weightStatus(weightKg: number, heightCm: number | undefined | null, opts: { age?: number | null; pregnant?: boolean } = {}): WeightStatus | null {
  if (!heightCm || (opts.age != null && opts.age < 18)) return null;
  const m2 = (heightCm / 100) ** 2;
  const min = r1(HEALTHY_BMI.min * m2);
  const max = r1(HEALTHY_BMI.max * m2);
  const bmi = r1(weightKg / m2);
  const offBy = weightKg > max ? r1(weightKg - max) : weightKg < min ? r1(weightKg - min) : 0;
  const goal = offBy > 0 && !opts.pregnant ? Math.round(Math.max(weightKg * (1 - FIRST_GOAL_LOSS), max)) : null;
  return { bmi, band: bmiBand(bmi), min, max, offBy, goal };
}
