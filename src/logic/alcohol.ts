import { allowed, FOOD_BY_ID, isDrinkOnly, SWAPS } from '@/data/foods';
import type { Diet } from '@/types';
import { addChoices } from './choices';
import type { Coaching, RecentSugar, Tip, TipAction } from './coach';
import { totals, type Basket } from './meal';
import { VERY_HIGH } from './sugar';

/** What the drink guide needs beyond the plate. Built by the meal screen. */
export type DrinkContext = {
  /** Standard drinks already logged today. */
  drinksToday: number;
  /** A real meal logged in the last 2 hours. */
  ateRecently: boolean;
  senior: boolean;
  /** Child or pregnancy: no portion guidance at all. */
  notSafe: boolean;
  /** On insulin or a sulfonylurea, so a late low is more likely. */
  hypoMeds: boolean;
};

/** Sample limits; the user's doctor may set lower. */
export const DRINK_LIMIT = 2;
export const DRINK_LIMIT_SENIOR = 1;
/** Below this, eat a proper meal before any drink. */
export const DRINK_MIN_SUGAR = 100;

const HYPO_MEDS = /glimepiride|gliclazide|glibenclamide|glipizide|amaryl|diamicron|insulin/i;
export const hasHypoMeds = (names: string[]) => names.some((n) => HYPO_MEDS.test(n));

/** Protein and fiber to eat with a drink, in order of preference. */
const CHAKNA: Record<Diet, string[]> = {
  veg: ['chana', 'peanuts', 'paneertikka', 'salad', 'sprouts'],
  egg: ['egg', 'chana', 'peanuts', 'paneertikka', 'salad'],
  nonveg: ['tikka', 'tandoori', 'egg', 'chana', 'peanuts'],
};
export const chaknaFor = (diet: Diet) => CHAKNA[diet];
const FRIED = ['namkeen', 'pakora', 'friedchicken', 'fishfry'];
/** Zero or near-zero sugar mixers. */
const SAFE_MIXERS = ['soda', 'water', 'dietcola', 'limesoda'];
const SPIRIT_UNIT = 'peg';

export function hasAlcohol(basket: Basket): boolean {
  return Object.keys(basket).some((id) => FOOD_BY_ID[id]?.group === 'alcohol' && basket[id] > 0);
}

/**
 * Safer-drinking guide. Low sugar is handled by coach() before it gets here.
 * Alcohol mostly risks a *late low* (often overnight),
 * while beer, breezers and sweet mixers spike sugar. Never dosing advice.
 */
export function drinkCoach({ basket, recent, diet, ctx }: { basket: Basket; recent: RecentSugar | null; diet: Diet; ctx: DrinkContext }): Coaching {
  const ids = Object.keys(basket).filter((id) => FOOD_BY_ID[id] && basket[id] > 0);
  const t = totals(basket);
  const v = recent?.v;
  const alcohol = ids.filter((id) => FOOD_BY_ID[id].group === 'alcohol');
  const mixers = ids.filter((id) => FOOD_BY_ID[id].group === 'mixer');
  const food = ids.filter((id) => !isDrinkOnly(FOOD_BY_ID[id]));
  const total = ctx.drinksToday + t.std;
  const limit = ctx.senior ? DRINK_LIMIT_SENIOR : DRINK_LIMIT;

  if (ctx.notSafe) {
    return { risk: 'high', headline: { key: 'caNotSafe', vars: {} }, tips: [{ id: 'notsafe', icon: '🚫', key: 'aNotSafe', vars: {}, action: { type: 'info' } }] };
  }
  const tips: Tip[] = [];
  const chakna = CHAKNA[diet].find((id) => !basket[id] && allowed(FOOD_BY_ID[id], diet));

  if (recent && recent.v > VERY_HIGH) tips.push({ id: 'skip', icon: '🚨', key: 'aSkipHigh', vars: { v }, action: { type: 'emergency' } });
  else if (recent && recent.v < DRINK_MIN_SUGAR) tips.push({ id: 'lowish', icon: '🍽️', key: 'aLow', vars: { v }, action: chakna ? { type: 'add', food: chakna } : { type: 'info' } });

  // Never on an empty stomach.
  if (!food.length && !ctx.ateRecently && chakna) {
    tips.push({ id: 'eat', icon: '🍢', key: 'aEatFirst', vars: { food: chakna }, action: { type: 'add', food: chakna }, choices: addChoices(CHAKNA[diet], basket, diet) });
  }

  const fried = food.find((id) => FRIED.includes(id) && SWAPS[id] && allowed(FOOD_BY_ID[SWAPS[id]], diet));
  if (fried) tips.push({ id: 'fried', icon: '🔁', key: 'aFried', vars: { food: fried, to: SWAPS[fried] }, action: { type: 'swap', from: fried, to: SWAPS[fried] } });

  // Mixers: water or soda, never cola, juice or tonic.
  const badMixer = mixers.find((id) => FOOD_BY_ID[id].sweet);
  const spirit = alcohol.find((id) => FOOD_BY_ID[id].unit === SPIRIT_UNIT);
  if (badMixer) {
    const swaps: TipAction[] = SAFE_MIXERS.map((to) => ({ type: 'swap', from: badMixer, to }));
    tips.push({ id: 'mixer', icon: '🫧', key: 'aMixerSwap', vars: { food: badMixer, to: SWAPS[badMixer] }, action: { type: 'swap', from: badMixer, to: SWAPS[badMixer] }, choices: swaps });
  } else if (spirit && !mixers.length) {
    tips.push({ id: 'mixer', icon: '🫧', key: 'aMixer', vars: { food: 'soda' }, action: { type: 'add', food: 'soda' }, choices: addChoices(SAFE_MIXERS, basket, diet) });
  }

  // Over the limit: trim the drink, or switch to water if already there.
  if (total > limit && alcohol.length) {
    const top = alcohol.sort((a, b) => (FOOD_BY_ID[b].std ?? 0) * basket[b] - (FOOD_BY_ID[a].std ?? 0) * basket[a])[0];
    const keep = basket[top] - (total - limit) / (FOOD_BY_ID[top].std ?? 1);
    tips.push(
      keep >= 0.5
        ? { id: 'limit', icon: '✋', key: 'aLimit', vars: { n: limit }, action: { type: 'portion', food: top, n: Math.floor(keep * 2) / 2 } }
        : { id: 'limit', icon: '✋', key: 'aLimit', vars: { n: limit }, action: { type: 'swap', from: top, to: 'water' } },
    );
  }

  // Beer, breezers and cocktails carry sugar.
  // Spirits have almost no carbs; beer, breezers and cocktails do. Offer the lower-carb choice.
  const sweet = alcohol.find((id) => FOOD_BY_ID[id].sweet);
  if (sweet) {
    const choices: TipAction[] = [{ type: 'swap', from: sweet, to: 'whisky' }, { type: 'swap', from: sweet, to: 'vodka' }, { type: 'swap', from: sweet, to: 'wine' }];
    if (basket[sweet] > 1) choices.unshift({ type: 'portion', food: sweet, n: 1 });
    tips.push({ id: 'sweet', icon: '🍺', key: 'aSweet', vars: { food: sweet }, action: choices[0], choices });
  }

  if (ctx.hypoMeds) tips.push({ id: 'meds', icon: '💊', key: 'aMeds', vars: {}, action: { type: 'info' } });

  // Always: check before sleeping. Kept even when other tips are trimmed.
  const bedtime: Tip = { id: 'bedtime', icon: '🌙', key: 'aBedtime', vars: {}, action: { type: 'check' } };
  const water: Tip = { id: 'water', icon: '💧', key: 'aWater', vars: {}, action: { type: 'info' } };
  const picked = [...tips, water].slice(0, 3);

  const headline: Coaching['headline'] =
    recent && recent.v > VERY_HIGH
      ? { key: 'caSkip', vars: { v } }
      : total > limit
        ? { key: 'caLimit', vars: { n: total, c: t.c } }
        : { key: 'caCareful', vars: { n: total, c: t.c } };

  return { risk: total > limit || sweet || badMixer || (!food.length && !ctx.ateRecently) ? 'high' : 'med', headline, tips: [...picked, bedtime] };
}
