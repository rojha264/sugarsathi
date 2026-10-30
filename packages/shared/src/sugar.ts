/** Sugar thresholds and status, shared by the app, API and admin panel. */
/** When the reading was taken. */
export type SugarCtx = 'fasting' | 'after' | 'random';

export type SugarLevel = 'g' | 'a' | 'r';
export type SugarKey = 'sG' | 'sA' | 'sLow' | 'sVeryLow' | 'sHigh';
export type SugarStatus = { l: SugarLevel; k: SugarKey };

/** Example thresholds only; real targets come from the user's doctor. */
export const LOW = 70;
/** Below this the person may not be able to help themselves (level 2 hypoglycaemia). */
export const VERY_LOW = 54;
export const VERY_HIGH = 250;
export const FASTING_MAX = 130;
export const OTHER_MAX = 180;
/** Diabetes in pregnancy (GDM): tighter targets used in India (DIPSI): fasting ≤ 95, 2 hours after a meal ≤ 120. */
export const GDM_FASTING_MAX = 95;
export const GDM_AFTER_MAX = 120;

/** Who the reading belongs to: pregnancy changes the targets. */
export type SugarOpts = { type?: string | null };

/** Upper limit of the green band for this kind of reading and person. */
export function sugarLimit(ctx: SugarCtx, opts?: SugarOpts): number {
  if (opts?.type === 'gdm') return ctx === 'fasting' ? GDM_FASTING_MAX : GDM_AFTER_MAX;
  return ctx === 'fasting' ? FASTING_MAX : OTHER_MAX;
}
/** Readable range of home glucose meters; anything outside is almost surely a typo. */
export const METER_MIN = 20;
export const METER_MAX = 600;

export function sugarStatus(v: number, ctx: SugarCtx, opts?: SugarOpts): SugarStatus {
  if (v < VERY_LOW) return { l: 'r', k: 'sVeryLow' };
  if (v < LOW) return { l: 'r', k: 'sLow' };
  if (v > VERY_HIGH) return { l: 'r', k: 'sHigh' };
  return v <= sugarLimit(ctx, opts) ? { l: 'g', k: 'sG' } : { l: 'a', k: 'sA' };
}

/** True for readings that need help now (very low): show the emergency steps straight away. */
export const isUrgentLow = (v: number) => v < VERY_LOW;
