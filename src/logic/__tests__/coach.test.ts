import { FOOD_BY_ID } from '@/data/foods';
import { applyTip, coach, recentSugar, type RecentSugar } from '../coach';
import { totals, type Basket } from '../meal';

const fasting180: RecentSugar = { v: 180, ctx: 'fasting', minsAgo: 20 };

describe('coach', () => {
  it('flags 4 roti + sabzi when fasting sugar is 180', () => {
    const r = coach({ basket: { roti: 4, sabzi: 1 }, recent: fasting180, diet: 'veg' });
    expect(r.risk).toBe('high');
    expect(r.headline).toEqual({ key: 'cHighPlate', vars: { v: 180, c: totals({ roti: 4, sabzi: 1 }).c } });
    expect(r.tips.map((t) => t.id)).toEqual(['first', 'portion', 'protein', 'walk']);
    expect(r.tips[0].choices?.map((a) => (a.type === 'add' ? a.food : ''))).toEqual(['salad', 'sprouts', 'chana']);
    expect(r.tips[0]).toMatchObject({ key: 'tFirstHigh', action: { type: 'add', food: 'salad' } });
    expect(r.tips[1].action).toMatchObject({ type: 'portion', food: 'roti' });
  });

  it('brings carbs under the limit after applying the portion tip', () => {
    const r = coach({ basket: { roti: 4, sabzi: 1 }, recent: fasting180, diet: 'veg' });
    const next = applyTip({ roti: 4, sabzi: 1 }, r.tips[1].action);
    expect(next.roti).toBeLessThan(4);
    expect(next.roti).toBeGreaterThanOrEqual(1);
    expect(totals(next).c).toBeLessThanOrEqual(45);
  });

  it('never suggests egg or meat to vegetarians', () => {
    const baskets: Basket[] = [{ rice: 2 }, { roti: 3 }, { poha: 1 }, { dosa: 2, chai: 1 }];
    for (const basket of baskets) {
      const r = coach({ basket, recent: fasting180, diet: 'veg' });
      for (const t of r.tips) {
        const id = t.action.type === 'add' ? t.action.food : t.action.type === 'swap' ? t.action.to : null;
        if (id) expect(FOOD_BY_ID[id].diet).toBe('veg');
      }
    }
  });

  it('suggests egg protein to egg eaters', () => {
    const r = coach({ basket: { rice: 1 }, recent: null, diet: 'egg' });
    expect(r.tips.find((t) => t.id === 'protein')?.action).toEqual({ type: 'add', food: 'egg' });
  });

  it('gives only the low-sugar safety tip below 70', () => {
    const r = coach({ basket: { roti: 2 }, recent: { v: 60, ctx: 'random', minsAgo: 5 }, diet: 'veg' });
    expect(r.headline.key).toBe('cLowH');
    expect(r.tips).toHaveLength(1);
    expect(r.tips[0]).toMatchObject({ key: 'tLow', action: { type: 'emergency' } });
  });

  it('puts the emergency tip first above 250', () => {
    const r = coach({ basket: { rice: 2 }, recent: { v: 300, ctx: 'after', minsAgo: 5 }, diet: 'veg' });
    expect(r.headline.key).toBe('cVeryHighH');
    expect(r.tips[0].action).toEqual({ type: 'emergency' });
    expect(r.tips).toHaveLength(4);
  });

  it('offers fiber and protein options for 4 roti + rice', () => {
    const r = coach({ basket: { roti: 4, rice: 1 }, recent: null, diet: 'veg' });
    const ids = r.tips.map((t) => t.id);
    expect(ids).toContain('first');
    expect(ids).toContain('protein');
    expect(r.tips.find((t) => t.id === 'protein')?.choices).toHaveLength(3);
    const nonveg = coach({ basket: { roti: 4, rice: 1 }, recent: null, diet: 'nonveg' });
    expect(nonveg.tips.find((t) => t.id === 'protein')?.action).toEqual({ type: 'add', food: 'chicken' });
  });

  it('offers a swap for rice', () => {
    const r = coach({ basket: { rice: 2, salad: 1, dal: 1 }, recent: null, diet: 'veg' });
    expect(r.tips.find((t) => t.id === 'swap')?.action).toEqual({ type: 'swap', from: 'rice', to: 'brownrice' });
    expect(applyTip({ rice: 2, salad: 1 }, { type: 'swap', from: 'rice', to: 'brownrice' })).toEqual({ brownrice: 2, salad: 1 });
  });

  it('praises a balanced plate without tips', () => {
    const r = coach({ basket: { salad: 1, roti: 1, dal: 1, sabzi: 1 }, recent: { v: 110, ctx: 'fasting', minsAgo: 10 }, diet: 'veg' });
    expect(r.risk).toBe('low');
    expect(r.headline.key).toBe('cGood');
    expect(r.tips).toEqual([]);
  });

  it('nudges eat-first on an empty plate when sugar is high', () => {
    const r = coach({ basket: {}, recent: fasting180, diet: 'veg' });
    expect(r.headline.key).toBe('cEmptyHigh');
    expect(r.tips[0].id).toBe('first');
    expect(coach({ basket: {}, recent: null, diet: 'veg' })).toEqual({ risk: 'none', headline: { key: 'vNone', vars: {} }, tips: [] });
  });
});

describe('recentSugar', () => {
  const now = 1_000_000_000;
  it('uses the last reading within 3 hours', () => {
    expect(recentSugar([{ v: 150, ctx: 'fasting', createdAt: now - 30 * 60000 }], now)).toEqual({ v: 150, ctx: 'fasting', minsAgo: 30 });
    expect(recentSugar([{ v: 150, ctx: 'fasting', createdAt: now - 200 * 60000 }], now)).toBeNull();
    expect(recentSugar([], now)).toBeNull();
  });
});
