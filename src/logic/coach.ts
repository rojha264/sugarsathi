import { allowed, FOOD_BY_ID, isDrinkOnly, SWAPS } from '@/data/foods';
import type { Diet, SugarCtx } from '@/types';
import { drinkCoach, hasAlcohol, type DrinkContext } from './alcohol';
import { addChoices, firstMissing } from './choices';
import { totals, type Basket } from './meal';
import { LOW, sugarStatus, VERY_HIGH } from './sugar';

export type RecentSugar = { v: number; ctx: SugarCtx; minsAgo: number };
export type Risk = 'none' | 'low' | 'med' | 'high';

export type TipAction =
  | { type: 'add'; food: string }
  | { type: 'portion'; food: string; n: number }
  | { type: 'swap'; from: string; to: string }
  | { type: 'walk' }
  | { type: 'check' }
  | { type: 'info' }
  | { type: 'emergency' };

export type TipKey =
  | 'tLow' | 'tVeryHigh' | 'tFirst' | 'tFirstHigh' | 'tPortion' | 'tHalf' | 'tSwap' | 'tProtein' | 'tWalk'
  | 'aNotSafe' | 'aLow' | 'aSkipHigh' | 'aEatFirst' | 'aFried' | 'aMixer' | 'aMixerSwap' | 'aSweet' | 'aLimit' | 'aMeds' | 'aWater' | 'aBedtime';
export type HeadlineKey =
  | 'vNone' | 'cEmptyHigh' | 'cLowH' | 'cVeryHighH' | 'cHighPlate' | 'cHigh' | 'cMed' | 'cGood' | 'cTreat'
  | 'caNotSafe' | 'caSkip' | 'caLimit' | 'caCareful';

/** Food values in vars are food ids; the UI turns them into names. */
export type Vars = { food?: string; to?: string; n?: number; v?: number; c?: number };
/** `action` is the main button; `choices` (when set) are alternative one-tap options shown beside it. */
export type Tip = { id: string; icon: string; key: TipKey; vars: Vars; action: TipAction; choices?: TipAction[] };
export type Coaching = { risk: Risk; headline: { key: HeadlineKey; vars: Vars }; tips: Tip[] };

export const RECENT_MINS = 180;
/** Defaults match DEFAULT_TARGETS (45–60 g per meal). */
const HIGH_CARBS = 60;
const HIGH_CARBS_WHEN_SUGAR_HIGH = 45;
const MAX_TIPS = 4;

const STARTERS = ['salad', 'sprouts', 'chana', 'soup', 'chaas', 'cucumber', 'raita', 'methi'];
const PROTEINS: Record<Diet, string[]> = {
  veg: ['dal', 'paneer', 'curd', 'chole', 'soya'],
  egg: ['egg', 'dal', 'paneer', 'curd', 'omelette'],
  nonveg: ['chicken', 'egg', 'fish', 'dal', 'paneer'],
};



/** Largest-carb grain on the plate, the one worth cutting down. */
function mainGrain(basket: Basket): string | undefined {
  let best: string | undefined;
  let bestC = 0;
  for (const id in basket) {
    const f = FOOD_BY_ID[id];
    if (f?.group !== 'grain') continue;
    const c = f.c * basket[id];
    if (c > bestC) {
      best = id;
      bestC = c;
    }
  }
  return best;
}

/**
 * Plate coach: looks at what is on the plate and the latest sugar reading,
 * and returns up to 3 one-tap fixes. General guidance only, never dosing.
 */
const TREAT_GROUPS = ['treat', 'snack', 'sweet'];

export function coach({ basket, recent, diet, drink, mealMax = HIGH_CARBS, mealMin = HIGH_CARBS_WHEN_SUGAR_HIGH }: {
  basket: Basket; recent: RecentSugar | null; diet: Diet; drink?: DrinkContext; mealMax?: number; mealMin?: number;
}): Coaching {
  const v = recent?.v;
  // Low sugar comes before everything, food or drink: treat it first. Fiber would slow the sugar they need.
  if (recent && recent.v < LOW) {
    return {
      risk: 'high',
      headline: { key: 'cLowH', vars: { v } },
      tips: [{ id: 'low', icon: '🍬', key: 'tLow', vars: { v }, action: { type: 'emergency' } }],
    };
  }
  if (drink && hasAlcohol(basket)) return drinkCoach({ basket, recent, diet, ctx: drink });
  const ids = Object.keys(basket).filter((id) => FOOD_BY_ID[id] && basket[id] > 0 && !isDrinkOnly(FOOD_BY_ID[id]));
  const t = totals(basket);

  const veryHigh = !!recent && recent.v > VERY_HIGH;
  const sugarHigh = !!recent && sugarStatus(recent.v, recent.ctx).l !== 'g';
  const tips: Tip[] = [];
  if (veryHigh) tips.push({ id: 'veryhigh', icon: '🚨', key: 'tVeryHigh', vars: { v }, action: { type: 'emergency' } });

  const starter = firstMissing(STARTERS, basket, diet);
  const hasStarter = ids.some((id) => FOOD_BY_ID[id].group === 'starter');

  if (!ids.length) {
    if (sugarHigh && starter) tips.push({ id: 'first', icon: '🥗', key: 'tFirstHigh', vars: { food: starter }, action: { type: 'add', food: starter }, choices: addChoices(STARTERS, basket, diet) });
    return {
      risk: 'none',
      headline: veryHigh ? { key: 'cVeryHighH', vars: { v } } : sugarHigh ? { key: 'cEmptyHigh', vars: { v } } : { key: 'vNone', vars: {} },
      tips,
    };
  }

  // With sugar already high, aim for the low end of the per-meal range.
  const limit = sugarHigh ? mealMin : mealMax;
  const risk: Risk = t.c > mealMax || (sugarHigh && t.c >= mealMin) ? 'high' : t.c >= 30 && (!hasStarter || t.p < 10) ? 'med' : 'low';

  // 1. Eat fiber first.
  if (t.c >= 30 && !hasStarter && starter) {
    tips.push({ id: 'first', icon: '🥗', key: sugarHigh ? 'tFirstHigh' : 'tFirst', vars: { food: starter }, action: { type: 'add', food: starter }, choices: addChoices(STARTERS, basket, diet) });
  }

  // 2. Smaller portion of the main grain, enough to get under the limit.
  const grain = mainGrain(basket);
  if (grain && t.c > limit) {
    const f = FOOD_BY_ID[grain];
    const q = basket[grain];
    const n = Math.max(1, q - Math.ceil((t.c - limit) / f.c));
    if (n < q) tips.push({ id: 'portion', icon: '✋', key: 'tPortion', vars: { food: grain, n }, action: { type: 'portion', food: grain, n } });
  }

  // Treats: half the biggest one rather than skipping it.
  const treat = ids
    .filter((id) => TREAT_GROUPS.includes(FOOD_BY_ID[id].group) && FOOD_BY_ID[id].gi === 'high')
    .sort((a, b) => FOOD_BY_ID[b].c * basket[b] - FOOD_BY_ID[a].c * basket[a])[0];
  if (treat && risk !== 'low' && !tips.some((x) => x.id === 'portion')) {
    const n = basket[treat] > 1 ? Math.floor(basket[treat] / 2) : 0.5;
    tips.push({ id: 'half', icon: '✂️', key: 'tHalf', vars: { food: treat, n }, action: { type: 'portion', food: treat, n } });
  }

  // 3. Protein slows digestion. Big carb plates need protein even if they have some.
  const protein = firstMissing(PROTEINS[diet], basket, diet);
  if (((t.p < 10 && t.c >= 20) || (t.p * 4 < t.c && t.c > mealMax)) && protein) {
    tips.push({ id: 'protein', icon: '💪', key: 'tProtein', vars: { food: protein }, action: { type: 'add', food: protein }, choices: addChoices(PROTEINS[diet], basket, diet) });
  }

  // 4. Walk after eating.
  if (risk === 'med' || risk === 'high') tips.push({ id: 'walk', icon: '🚶', key: 'tWalk', vars: {}, action: { type: 'walk' } });

  // 5. Lower-spike swap.
  if (risk !== 'low') {
    const from = ids
      .filter((id) => SWAPS[id] && !basket[SWAPS[id]] && FOOD_BY_ID[SWAPS[id]] && allowed(FOOD_BY_ID[SWAPS[id]], diet))
      .sort((a, b) => FOOD_BY_ID[b].c * basket[b] - FOOD_BY_ID[a].c * basket[a])[0];
    if (from) tips.push({ id: 'swap', icon: '🔁', key: 'tSwap', vars: { food: from, to: SWAPS[from] }, action: { type: 'swap', from, to: SWAPS[from] } });
  }

  return { risk, headline: plateHeadline({ v, c: Math.round(t.c), veryHigh, sugarHigh, treat: !!treat, risk }), tips: tips.slice(0, MAX_TIPS) };
}

/** Headline for a plate, most urgent first. */
function plateHeadline(h: { v?: number; c: number; veryHigh: boolean; sugarHigh: boolean; treat: boolean; risk: Risk }): Coaching['headline'] {
  const { v, c } = h;
  if (h.veryHigh) return { key: 'cVeryHighH', vars: { v } };
  if (h.sugarHigh && h.risk !== 'low') return { key: 'cHighPlate', vars: { v, c } };
  if (h.treat) return { key: 'cTreat', vars: { c } };
  if (h.risk === 'high') return { key: 'cHigh', vars: { c } };
  if (h.risk === 'med') return { key: 'cMed', vars: { c } };
  return { key: 'cGood', vars: { c } };
}

/** Applies a tip's plate change. Walk and emergency are handled by the screen. */
export function applyTip(basket: Basket, action: TipAction): Basket {
  const next = { ...basket };
  if (action.type === 'add') next[action.food] = (next[action.food] ?? 0) + 1;
  else if (action.type === 'portion') next[action.food] = action.n;
  else if (action.type === 'swap') {
    const q = next[action.from] ?? 1;
    delete next[action.from];
    next[action.to] = (next[action.to] ?? 0) + q;
  }
  return next;
}

/** Latest reading of today within the last 3 hours. */
export function recentSugar(readings: { v: number; ctx: SugarCtx; createdAt: number }[], now = Date.now()): RecentSugar | null {
  const last = readings.at(-1);
  if (!last) return null;
  const minsAgo = Math.max(0, Math.round((now - last.createdAt) / 60000));
  return minsAgo <= RECENT_MINS ? { v: last.v, ctx: last.ctx, minsAgo } : null;
}
