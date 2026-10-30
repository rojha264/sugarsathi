import { eats, type Diet } from './diet';

/**
 * The 14-day "Kickstart" programme: which ready-made plan a new patient gets, how big their
 * grain portions are, who must be reviewed by a dietitian first, and how results are measured.
 */
export const PROGRAM_DAYS = 14;
/** Templates are written for this many kcal; grain portions scale from it. */
export const TEMPLATE_KCAL = 1500;
export const KCAL_BANDS = [1200, 1500, 1800, 2100] as const;
/** Before = average of days 1–3, after = days 12–14 (fasting checks are asked on those days). */
export const BASELINE_DAYS = [1, 2, 3];
export const END_DAYS = [12, 13, 14];

export type Sex = 'male' | 'female' | 'other';
export type Region = 'north' | 'south' | 'east' | 'west' | 'northeast';
export type Meds = 'none' | 'tablets' | 'insulin';
export type Risk = 'standard' | 'hypo_safe';

export type Baseline = {
  type: string; sex?: Sex | null; age?: number | null; heightCm?: number | null; weightKg?: number | null;
  meds?: Meds | null; flags?: string[]; a1c?: number | null; sugar?: { v: number; ctx: string } | null;
};

/**
 * Daily energy: Mifflin–St Jeor × 1.3 (light activity), 500 kcal less when BMI ≥ 23 (the Asian
 * overweight cut-off), never below 1200 (women) / 1400 (men), rounded to the nearest plan band.
 */
export function dailyKcal(b: Pick<Baseline, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'flags'>): number {
  const w = b.weightKg ?? 65;
  const h = b.heightCm ?? 160;
  const a = b.age ?? 45;
  const sexTerm = b.sex === 'male' ? 5 : b.sex === 'female' ? -161 : -78;
  const tdee = (10 * w + 6.25 * h - 5 * a + sexTerm) * 1.3;
  const bmi = w / (h / 100) ** 2;
  // No calorie cut in pregnancy (those plans are dietitian-reviewed anyway).
  const target = bmi >= 23 && !b.flags?.includes('pregnant') ? tdee - 500 : tdee;
  const floor = b.sex === 'male' ? 1400 : b.sex === 'female' ? 1200 : 1300;
  const kcal = Math.max(target, floor);
  return KCAL_BANDS.reduce((best, band) => (Math.abs(band - kcal) < Math.abs(best - kcal) ? band : best), KCAL_BANDS[0]);
}

/** Multiplier for grain-role portions (roti, rice) only; vegetables and protein stay as written. Quarter steps. */
export const portionScale = (kcal: number) => Math.min(1.5, Math.max(0.5, Math.round((kcal / TEMPLATE_KCAL) * 4) / 4));

const PORTION_WORDS: Record<string, [string, string]> = {
  '0.5': ['half the usual amount', 'आम मात्रा का आधा'],
  '0.75': ['three-quarters of the usual amount', 'आम मात्रा का तीन-चौथाई'],
  '1': ['the usual amount', 'आम मात्रा'],
  '1.25': ['a quarter more than usual', 'आम से एक-चौथाई ज़्यादा'],
  '1.5': ['one and a half times the usual amount', 'आम से डेढ़ गुना'],
};
/** The portion line shown on the patient's plan, in plain words (no "×0.75") in English and Hindi. */
export function portionNote(kcal: number): { en: string; hi: string } {
  const [en, hi] = PORTION_WORDS[String(portionScale(kcal))] ?? PORTION_WORDS['1'];
  return { en: `Roti / rice: ${en} (about ${kcal} kcal a day).`, hi: `रोटी / चावल: ${hi} (दिन में लगभग ${kcal} kcal)।` };
}
/** Programme plans start with this, in both languages. */
export const PROGRAM_TITLE = { en: '🚀 14-day plan', hi: '🚀 14 दिन का प्लान' };

export type RiskReason = 'type1' | 'gdm' | 'child' | 'senior75' | 'insulin' | 'pregnant' | 'kidney' | 'a1c_high' | 'sugar_high' | 'sugar_low';

/** Why a dietitian must look at the plan before it starts. Empty = the plan can start on its own. */
export function riskReasons(b: Baseline): RiskReason[] {
  const out: RiskReason[] = [];
  if (b.type === 'type1') out.push('type1');
  if (b.type === 'gdm') out.push('gdm');
  if (b.age != null && b.age < 18) out.push('child');
  if (b.age != null && b.age >= 75) out.push('senior75');
  if (b.meds === 'insulin') out.push('insulin');
  if (b.flags?.includes('pregnant')) out.push('pregnant');
  if (b.flags?.includes('kidney')) out.push('kidney');
  if (b.a1c != null && b.a1c >= 10) out.push('a1c_high');
  if (b.sugar && b.sugar.v >= 250) out.push('sugar_high');
  if (b.sugar && b.sugar.v < 70) out.push('sugar_low');
  return out;
}

/** Tablets can cause lows (some do): use the plan that keeps carbs steady at every meal. */
export const riskFor = (b: Pick<Baseline, 'meds'>): Risk => (b.meds === 'tablets' || b.meds === 'insulin' ? 'hypo_safe' : 'standard');

const NEAR: Record<Region, Region[]> = { north: ['west', 'east'], south: ['west', 'east'], east: ['northeast', 'north'], west: ['north', 'south'], northeast: ['east', 'north'] };

export type TemplateLite = { id: string; diet: string; region: string; risk: string; active: boolean };

/**
 * Best ready-made plan: same diet (or a stricter one the person still eats), then same region,
 * then a neighbouring cuisine, then the matching risk version. Null when nothing fits the diet.
 */
export function pickTemplate<T extends TemplateLite>(templates: T[], want: { diet: Diet; region?: Region | null; risk: Risk }): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const t of templates) {
    if (!t.active || !eats(want.diet, t.diet as Diet)) continue;
    let score = t.diet === want.diet ? 8 : 4;
    if (want.region && t.region === want.region) score += 4;
    else if (want.region && NEAR[want.region]?.includes(t.region as Region)) score += 2;
    if (t.risk === want.risk) score += 1;
    if (score > bestScore) (best = t), (bestScore = score);
  }
  return best;
}

/** Programme day for a calendar date (YYYY-MM-DD): day 1 is the start date; ≤ 0 before it starts. */
export function programDay(startsOn: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`);
  return Math.floor(ms / 86400_000) + 1;
}

export type DayReading = { day: number; v: number; ctx: string };
export type Results = {
  fastingBefore: number | null; fastingAfter: number | null; afterMealBefore: number | null; afterMealAfter: number | null;
  inRangeBefore: number | null; inRangeAfter: number | null; weightBefore: number | null; weightAfter: number | null;
  daysFollowed: number; improved: boolean;
};

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const inRange = (xs: number[]) => (xs.length ? Math.round((xs.filter((v) => v >= 70 && v <= 180).length / xs.length) * 100) : null);

/**
 * Before (days 1–3) vs after (days 12–14). "Improved" = fasting down ≥ 10 mg/dL, or after-meal down
 * ≥ 15, or time in range up ≥ 10 points, or weight down ≥ 1 kg — with no new lows.
 */
export function results(readings: DayReading[], weights: { day: number; kg: number }[], followedDays: number): Results {
  const pick = (days: number[], ctx?: string) => readings.filter((r) => days.includes(r.day) && (!ctx || r.ctx === ctx)).map((r) => r.v);
  const before = pick(BASELINE_DAYS);
  const after = pick(END_DAYS);
  const w = [...weights].sort((a, b) => a.day - b.day);
  const r: Results = {
    fastingBefore: avg(pick(BASELINE_DAYS, 'fasting')), fastingAfter: avg(pick(END_DAYS, 'fasting')),
    afterMealBefore: avg(pick(BASELINE_DAYS, 'after')), afterMealAfter: avg(pick(END_DAYS, 'after')),
    inRangeBefore: inRange(before), inRangeAfter: inRange(after),
    weightBefore: w[0]?.kg ?? null, weightAfter: w.length > 1 ? w[w.length - 1].kg : null,
    daysFollowed: followedDays, improved: false,
  };
  const newLow = after.some((v) => v < 70) && !before.some((v) => v < 70);
  const down = (a: number | null, b: number | null, by: number) => a !== null && b !== null && a - b >= by;
  r.improved =
    !newLow &&
    (down(r.fastingBefore, r.fastingAfter, 10) || down(r.afterMealBefore, r.afterMealAfter, 15) || down(r.inRangeAfter, r.inRangeBefore, 10) || down(r.weightBefore, r.weightAfter, 1));
  return r;
}
