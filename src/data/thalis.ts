import type { Basket } from '@/logic/meal';
import type { Diet, MealSlot } from '@/types';

/** `slots`: meals it suits (shown first for those). Dietitians edit these in the admin panel; this list is the offline fallback. */
export type Thali = { id: string; e: string; n: { en: string; hi: string }; diet: Diet; items: Basket; slots: MealSlot[] };

/** One-tap regional plates. Quantities are standard portions. */
export const THALIS: Thali[] = [
  { id: 'north', e: '🍱', n: { en: 'North thali', hi: 'उत्तर भारतीय थाली' }, diet: 'veg', items: { salad: 1, roti: 2, dal: 1, sabzi: 1, rice: 1 }, slots: ['lunch', 'dinner'] },
  { id: 'south', e: '🍙', n: { en: 'Idli sambar', hi: 'इडली सांभर' }, diet: 'veg', items: { idli: 3, sambar: 1, chutney: 1 }, slots: ['breakfast', 'dinner'] },
  { id: 'gujarati', e: '🍛', n: { en: 'Gujarati thali', hi: 'गुजराती थाली' }, diet: 'veg', items: { roti: 2, dal: 1, sabzi: 1, kadhi: 1, rice: 1 }, slots: ['lunch', 'dinner'] },
  { id: 'maharashtrian', e: '🫓', n: { en: 'Bhakri plate', hi: 'भाकरी थाली' }, diet: 'veg', items: { bhakri: 2, chanadal: 1, sabzi: 1, salad: 1 }, slots: ['lunch', 'dinner'] },
  { id: 'punjabi', e: '🌽', n: { en: 'Makki-saag', hi: 'मक्की-साग' }, diet: 'veg', items: { makki: 2, palak: 1, chaas: 1 }, slots: ['lunch', 'dinner'] },
  { id: 'puriaaloo', e: '🟡', n: { en: 'Puri aloo', hi: 'पूरी आलू' }, diet: 'veg', items: { puri: 3, aloojhol: 1 }, slots: ['breakfast', 'lunch'] },
  { id: 'bengali', e: '🐟', n: { en: 'Fish thali', hi: 'मछली थाली' }, diet: 'nonveg', items: { rice: 1, dal: 1, fish: 1, sabzi: 1 }, slots: ['lunch', 'dinner'] },
  { id: 'chicken', e: '🍗', n: { en: 'Chicken thali', hi: 'चिकन थाली' }, diet: 'nonveg', items: { salad: 1, roti: 2, chicken: 1, rice: 1 }, slots: ['lunch', 'dinner'] },
];
