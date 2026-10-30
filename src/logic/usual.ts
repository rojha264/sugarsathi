import type { MealSlot, Profile } from '@/types';
import type { Basket } from './meal';

export type Usual = Pick<Profile, 'freq' | 'slotFreq' | 'lastMeal'>;

/** Counts a saved plate so the app can suggest it next time, overall and for this meal time. */
export function rememberMeal(u: Usual, slot: MealSlot, basket: Basket): Usual {
  const ids = Object.keys(basket).filter((id) => basket[id] > 0);
  const freq = { ...u.freq };
  const forSlot = { ...(u.slotFreq[slot] ?? {}) };
  for (const id of ids) {
    freq[id] = (freq[id] ?? 0) + 1;
    forSlot[id] = (forSlot[id] ?? 0) + 1;
  }
  const last: Basket = {};
  for (const id of ids) last[id] = basket[id];
  return { freq, slotFreq: { ...u.slotFreq, [slot]: forSlot }, lastMeal: { ...u.lastMeal, [slot]: last } };
}

/**
 * Foods to show first for a meal time: most picked at this meal time, then most
 * picked overall. `keep` filters out foods the screen should not offer (diet, alcohol).
 */
export function suggestFor(u: Usual, slot: MealSlot, keep: (id: string) => boolean, limit = 12): string[] {
  const forSlot = u.slotFreq[slot] ?? {};
  const score = (id: string) => (forSlot[id] ?? 0) * 1000 + (u.freq[id] ?? 0);
  return Object.keys({ ...u.freq, ...forSlot })
    .filter(keep)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}
