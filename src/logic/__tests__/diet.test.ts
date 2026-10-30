import { eats, kindsFor } from '@shared/diet';
import { allowed, FOOD_BY_ID, FOODS } from '@/data/foods';
import { coach } from '../coach';

describe('food preference', () => {
  it('vegetarians eat veg only; eggetarians add eggs; non-veg eats all', () => {
    expect(kindsFor('veg')).toEqual(['veg']);
    expect(kindsFor('egg')).toEqual(['veg', 'egg']);
    expect(kindsFor('nonveg')).toEqual(['veg', 'egg', 'nonveg']);
    expect([eats('egg', 'nonveg'), eats('nonveg', 'egg'), eats('veg', 'egg')]).toEqual([false, true, false]);
  });

  it('a vegetarian sees no egg, chicken or fish dish', () => {
    const seen = FOODS.filter((f) => allowed(f, 'veg'));
    expect(seen.some((f) => f.diet !== 'veg')).toBe(false);
    expect(seen.map((f) => f.id)).toEqual(expect.arrayContaining(['dal', 'paneer', 'roti']));
    expect(allowed(FOOD_BY_ID.omelette, 'egg')).toBe(true);
    expect(allowed(FOOD_BY_ID.chicken, 'egg')).toBe(false);
  });

  it('coach tips never suggest food outside the preference', () => {
    for (const diet of ['veg', 'egg'] as const) {
      const { tips } = coach({ basket: { rice: 2 }, recent: null, diet });
      const suggested = (a: { type: string; food?: string; to?: string }) => (a.type === 'add' ? a.food : a.type === 'swap' ? a.to : undefined);
      const ids = tips.flatMap((t) => [t.action, ...(t.choices ?? [])].map(suggested)).filter((x): x is string => !!x && !!FOOD_BY_ID[x]);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(allowed(FOOD_BY_ID[id], diet)).toBe(true);
    }
  });
});
