import { describe, expect, it } from 'vitest';

import { totals } from './nutrition';

const foods = new Map([
  ['roti', { id: 'roti', carbs: 19, protein: 3.2, fiber: 3.4, kcal: 100 }],
  ['dal', { id: 'dal', carbs: 15, protein: 7, fiber: 4, kcal: 120 }],
]);

describe('plan totals', () => {
  it('adds every-day items and only the chosen weekday', () => {
    const items = [
      { slot: 'lunch', foodId: 'roti', qty: 2 },
      { slot: 'lunch', foodId: 'dal', qty: 1 },
      { slot: 'dinner', foodId: 'dal', qty: 1, weekday: 0 },
    ];
    expect(totals(items, foods, 1)).toEqual({ bySlot: { lunch: { carbs: 53, protein: 13, fiber: 11, kcal: 320 } }, day: { carbs: 53, protein: 13, fiber: 11, kcal: 320 } });
    expect(totals(items, foods, 0).day.carbs).toBe(68);
  });
  it('ignores unknown foods', () => {
    expect(totals([{ slot: 'lunch', foodId: 'nope', qty: 1 }], foods).day.kcal).toBe(0);
  });
});
