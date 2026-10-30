import type { Adjustment, AdjustReason, MainSlot, Meal, Setup, SugarReading, Targets } from '@/types';
import { FASTING_MAX, LOW, OTHER_MAX as AFTER_MAX } from './sugar';
import { MAIN_SLOTS, SNACK_MAX } from './targets';

/**
 * Smart targets: the per-meal carb guide adapts to paired sugar readings
 * ("eat to your meter"). Based on ADA targets (before meal 80–130, 1–2 h after < 180)
 * and paired-testing practice (a rise over ~50 mg/dL means too many carbs for that meal).
 * Changes are small (5 g), bounded, logged, and never made for type 1, pregnancy,
 * doctor-locked targets, or after a recent low.
 */

const STEP = 5;
const MIN_PER_MEAL = 30;
const MIN_PER_MEAL_SENIOR = 40;
/** RSSDI / ICMR: at least 130 g carbs a day. */
const MIN_PER_DAY = 130;
const RISE_MAX = 50;
const GOOD_AFTER = 140;
const GOOD_RISE = 30;
const GOOD_PAIRS_TO_RELAX = 3;
const FIBER_MAX = 35;
const PROTEIN_BOOST = 10;
const PROTEIN_MAX = 75;
/** Extra protein while carbs are cut; never below the doctor's base. */
const boostedProtein = (base: number) => Math.max(base, Math.min(PROTEIN_MAX, base + PROTEIN_BOOST));
const LOW_PAUSE_MS = 3 * 24 * 3600 * 1000;
const LOG_KEEP = 10;
const MIN = 60 * 1000;

export type Pair = { slot: MainSlot; after: number; before?: number; rise?: number };

/** Cuts are paused for 3 days after any reading under 70. */
export const isLowPaused = (t: Pick<Targets, 'lastLowAt'>, now = Date.now()) => t.lastLowAt !== undefined && now - t.lastLowAt < LOW_PAUSE_MS;

/** The main meal a reading at `at` would count as "2 hours after": eaten 1–3 hours earlier. */
export const mealBeforeAfterReading = (meals: Meal[], at: number) =>
  [...meals].reverse().find((m) => m.slot !== 'snack' && m.kind !== 'drink' && at - m.createdAt >= 60 * MIN && at - m.createdAt <= 180 * MIN);

/** Links a 2-hours-after reading to the meal it followed, and to the reading taken just before that meal. */
export function pairFor(reading: SugarReading, meals: Meal[], readings: SugarReading[]): Pair | null {
  if (reading.ctx !== 'after') return null;
  const meal = mealBeforeAfterReading(meals, reading.createdAt);
  if (!meal) return null;
  const before = [...readings]
    .reverse()
    .find((r) => r.ctx !== 'after' && r.createdAt <= meal.createdAt && meal.createdAt - r.createdAt <= 60 * MIN);
  const slot = meal.slot as MainSlot;
  return before ? { slot, after: reading.v, before: before.v, rise: reading.v - before.v } : { slot, after: reading.v };
}

export type Adapted = { targets: Targets; changes: Adjustment[]; pair: Pair | null; paused: 'type' | 'doctor' | 'low' | null };

/** Whether this profile's targets may change automatically. */
export function autoAllowed(t: Targets, setup: Setup | null): 'type' | 'doctor' | null {
  if (setup && (setup.type === 'type1' || setup.type === 'gdm')) return 'type';
  return t.mode === 'doctor' ? 'doctor' : null;
}

/**
 * Updates targets after a new reading. `setup` is passed only for the main user
 * (family profiles have no type or age on file).
 */
export function adaptTargets(prev: Targets, opts: { setup: Setup | null; reading: SugarReading; meals: Meal[]; readings: SugarReading[]; now?: number }): Adapted {
  const { setup, reading, meals, readings } = opts;
  const now = opts.now ?? reading.createdAt;
  const t: Targets = { ...prev, slot: { ...prev.slot }, good: { ...prev.good }, fastHist: [...prev.fastHist], log: [...prev.log] };
  const changes: Adjustment[] = [];
  const pair = pairFor(reading, meals, readings.filter((r) => r.id !== reading.id));

  if (reading.ctx === 'fasting') t.fastHist = [...t.fastHist, reading.v].slice(-3);
  const justLow = reading.v < LOW;
  if (justLow) t.lastLowAt = now;

  const blocked = autoAllowed(t, setup);
  if (blocked) return { targets: t, changes, pair, paused: blocked };

  const floor = setup?.age === 'senior' ? MIN_PER_MEAL_SENIOR : MIN_PER_MEAL;
  const set = (field: Adjustment['field'], to: number, reason: AdjustReason, vars: Adjustment['vars'] = {}) => {
    const from = field === 'protein' ? t.protein : field === 'fiber' ? t.fiber : t.slot[field];
    if (from === to) return;
    if (field === 'protein') t.protein = to;
    else if (field === 'fiber') t.fiber = to;
    else t.slot[field] = to;
    changes.push({ at: now, field, from, to, reason, vars });
  };
  /** Lower a meal's guide by one step, keeping per-meal and daily floors. */
  const tighten = (slot: MainSlot, reason: AdjustReason, vars: Adjustment['vars']) => {
    const others = MAIN_SLOTS.filter((s) => s !== slot).reduce((a, s) => a + t.slot[s], 0);
    const to = Math.max(floor, t.slot[slot] - STEP, MIN_PER_DAY - SNACK_MAX - others);
    if (to < t.slot[slot]) set(slot, to, reason, vars);
  };
  const relax = (slot: MainSlot, reason: AdjustReason, vars: Adjustment['vars'] = {}) => set(slot, Math.min(t.base.meal, t.slot[slot] + STEP), reason, vars);

  const recentLow = isLowPaused(t, now);
  if (recentLow) {
    // A low means carbs may already be too tight for the medicine: ease off, don't cut.
    if (justLow) MAIN_SLOTS.forEach((s) => relax(s, 'rLowSeen', { after: reading.v }));
  } else {
    if (pair) {
      const bad = pair.after > AFTER_MAX || (pair.rise !== undefined && pair.rise > RISE_MAX);
      const good = pair.after <= GOOD_AFTER && (pair.rise === undefined || pair.rise <= GOOD_RISE);
      const vars = { after: pair.after, before: pair.before, rise: pair.rise };
      if (bad) {
        t.good[pair.slot] = 0;
        tighten(pair.slot, pair.after > AFTER_MAX ? 'rHighAfter' : 'rHighRise', vars);
      } else if (good) {
        t.good[pair.slot] += 1;
        if (t.good[pair.slot] >= GOOD_PAIRS_TO_RELAX && t.slot[pair.slot] < t.base.meal) {
          t.good[pair.slot] = 0;
          relax(pair.slot, 'rGoodPairs', vars);
        }
      } else t.good[pair.slot] = 0;
    }
    // High fasting sugar reflects dinner and the night: lighter dinner, more fiber.
    if (reading.ctx === 'fasting' && t.fastHist.length === 3) {
      const avg = Math.round(t.fastHist.reduce((a, b) => a + b, 0) / 3);
      if (avg > FASTING_MAX && !t.fastHigh) {
        t.fastHigh = true;
        tighten('dinner', 'rFastingHigh', { avg });
        set('fiber', Math.min(FIBER_MAX, t.base.fiber + STEP), 'rFastingHigh', { avg });
      } else if (avg <= FASTING_MAX && t.fastHigh) {
        t.fastHigh = false;
        set('fiber', t.base.fiber, 'rFastingOk', { avg });
      }
    }
  }

  // Fewer carbs: make up with protein so meals still fill you up.
  const cut = MAIN_SLOTS.some((s) => t.slot[s] < t.base.meal);
  set('protein', cut ? boostedProtein(t.base.protein) : t.base.protein, cut ? 'rCarbsCut' : 'rCarbsBack');

  t.log = [...t.log, ...changes].slice(-LOG_KEEP);
  return { targets: t, changes, pair, paused: recentLow ? 'low' : null };
}

/**
 * Applies doctor/manual base values. In doctor mode the current values follow the base exactly.
 * In auto mode each meal keeps its learned offset from the old base, and protein/fiber follow the
 * new base with any active adjustment re-applied.
 */
export function withBase(t: Targets, base: Targets['base'], mode: Targets['mode']): Targets {
  if (mode === 'doctor') {
    return { ...t, mode, base, slot: { breakfast: base.meal, lunch: base.meal, dinner: base.meal }, protein: base.protein, fiber: base.fiber };
  }
  const shift = base.meal - t.base.meal;
  const slot = { ...t.slot };
  for (const s of MAIN_SLOTS) slot[s] = Math.max(MIN_PER_MEAL, Math.min(base.meal, t.slot[s] + shift));
  const cut = MAIN_SLOTS.some((s) => slot[s] < base.meal);
  return {
    ...t,
    mode,
    base,
    slot,
    protein: cut ? boostedProtein(base.protein) : base.protein,
    fiber: t.fastHigh ? Math.min(FIBER_MAX, base.fiber + STEP) : base.fiber,
  };
}
