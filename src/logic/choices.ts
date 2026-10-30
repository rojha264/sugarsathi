import { allowed, FOOD_BY_ID } from '@/data/foods';
import type { Diet } from '@/types';
import type { Basket } from './meal';

const CHOICES = 3;

/** Foods from `ids` not yet on the plate and allowed for this diet. */
export const missing = (ids: string[], basket: Basket, diet: Diet) =>
  ids.filter((id) => !basket[id] && FOOD_BY_ID[id] && allowed(FOOD_BY_ID[id], diet));

export const firstMissing = (ids: string[], basket: Basket, diet: Diet) => missing(ids, basket, diet)[0];

/** Up to 3 one-tap "add" options, e.g. salad / sprouts / roasted chana. */
export const addChoices = (ids: string[], basket: Basket, diet: Diet) =>
  missing(ids, basket, diet)
    .slice(0, CHOICES)
    .map((food) => ({ type: 'add' as const, food }));
