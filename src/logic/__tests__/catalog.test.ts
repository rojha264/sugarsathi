import { allowed, FOOD_BY_ID, FOODS, matchesDiet, portionsFor, suggestDiet, SWAPS } from '@/data/foods';
import { seed } from '@/data/seed';
import { THALIS } from '@/data/thalis';
import { migrate } from '@/store/migrate';
import type { Basket } from '../meal';
import { drinkCoach, hasHypoMeds, type DrinkContext } from '../alcohol';
import { coach, type RecentSugar } from '../coach';
import { closeDay } from '../day';
import { parseFoods } from '../voice';

const ctx: DrinkContext = { drinksToday: 0, ateRecently: false, senior: false, notSafe: false, hypoMeds: false };
const ok: RecentSugar = { v: 130, ctx: 'random', minsAgo: 10 };
const tipIds = (b: Basket, c: Partial<DrinkContext> = {}, recent: RecentSugar | null = ok, diet: 'veg' | 'egg' | 'nonveg' = 'veg') =>
  drinkCoach({ basket: b, recent, diet, ctx: { ...ctx, ...c } }).tips.map((t) => t.id);

describe('catalog', () => {
  it('has about 120+ foods with unique ids and both names', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(120);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      expect(f.n.en).toBeTruthy();
      expect(f.n.hi).toBeTruthy();
      expect(f.kw.length).toBeGreaterThan(0);
    }
  });

  it('includes the regional dishes asked for', () => {
    for (const id of ['puri', 'aloogobhi', 'aloojhol', 'petha', 'kaddu', 'lauki', 'chicken', 'mutton']) expect(FOOD_BY_ID[id]).toBeDefined();
  });

  it('has swaps that point at real foods', () => {
    for (const [from, to] of Object.entries(SWAPS)) {
      expect(FOOD_BY_ID[from]).toBeDefined();
      expect(FOOD_BY_ID[to]).toBeDefined();
    }
  });

  it('gives sensible portion sizes', () => {
    expect(portionsFor(FOOD_BY_ID.chicken).map((p) => p.amount)).toEqual([2, 4, 6]);
    expect(portionsFor(FOOD_BY_ID.whisky).map((p) => p.amount)).toEqual([30, 60, 90]);
    expect(portionsFor(FOOD_BY_ID.beer).map((p) => p.amount)).toEqual([330, 500, 650]);
    expect(portionsFor(FOOD_BY_ID.dal).map((p) => p.mult)).toEqual([0.5, 1, 1.5, 2]);
  });

  it('keeps thalis consistent with their diet tag', () => {
    for (const th of THALIS) {
      for (const id of Object.keys(th.items)) {
        expect(FOOD_BY_ID[id]).toBeDefined();
        expect(allowed(FOOD_BY_ID[id], th.diet)).toBe(true);
      }
    }
  });
});

describe('voice with the bigger catalog', () => {
  it('does not carry a number across foods', () => {
    expect(parseFoods('2 puri aloo sabzi')).toEqual({ puri: 2, aloo: 1 });
  });

  it('understands pegs, mixers and pieces', () => {
    expect(parseFoods('do peg whisky soda ke saath')).toEqual({ whisky: 2, soda: 1 });
    expect(parseFoods('4 piece chicken')).toEqual({ chicken: 2 });
    expect(parseFoods('aadha katori rice')).toEqual({ rice: 0.5 });
  });

  it('tells pani puri from puri and chole bhature from chole', () => {
    expect(parseFoods('pani puri')).toEqual({ panipuri: 1 });
    expect(parseFoods('chole bhature')).toEqual({ cholebhature: 1 });
    expect(parseFoods('petha sabzi aur agra petha')).toEqual({ kaddu: 1, petha: 1 });
  });
});

describe('treats', () => {
  it('encourages instead of shaming and offers half', () => {
    const r = coach({ basket: { samosa: 2, chai: 1 }, recent: null, diet: 'veg' });
    expect(r.headline.key).toBe('cTreat');
    expect(r.tips.find((t) => t.id === 'half')?.action).toEqual({ type: 'portion', food: 'samosa', n: 1 });
  });
});

describe('drinkCoach', () => {
  it('asks for food first on an empty stomach, filtered by diet', () => {
    const veg = drinkCoach({ basket: { whisky: 1 }, recent: ok, diet: 'veg', ctx });
    expect(veg.tips[0]).toMatchObject({ id: 'eat', action: { type: 'add', food: 'chana' } });
    const nonveg = drinkCoach({ basket: { whisky: 1 }, recent: ok, diet: 'nonveg', ctx });
    expect(nonveg.tips[0]).toMatchObject({ id: 'eat', action: { type: 'add', food: 'tikka' } });
  });

  it('never suggests meat or egg to vegetarians', () => {
    for (const b of [{ whisky: 1 }, { beer: 2 }, { rum: 1, cola: 1, friedchicken: 1 }] as Basket[]) {
      for (const t of drinkCoach({ basket: b, recent: ok, diet: 'veg', ctx }).tips) {
        const id = t.action.type === 'add' ? t.action.food : t.action.type === 'swap' ? t.action.to : null;
        if (id) expect(FOOD_BY_ID[id].diet).toBe('veg');
      }
    }
  });

  it('adds a mixer to a neat spirit and swaps sugary mixers', () => {
    expect(drinkCoach({ basket: { whisky: 1, chana: 1 }, recent: ok, diet: 'veg', ctx }).tips[0]).toMatchObject({ id: 'mixer', key: 'aMixer' });
    expect(drinkCoach({ basket: { rum: 1, cola: 1, chana: 1 }, recent: ok, diet: 'veg', ctx }).tips[0].action).toEqual({ type: 'swap', from: 'cola', to: 'dietcola' });
  });

  it('flags going over the limit and trims the drink', () => {
    const r = drinkCoach({ basket: { whisky: 3, soda: 1, chana: 1 }, recent: ok, diet: 'veg', ctx });
    expect(r.headline.key).toBe('caLimit');
    expect(r.tips.find((t) => t.id === 'limit')?.action).toEqual({ type: 'portion', food: 'whisky', n: 2 });
    const already = drinkCoach({ basket: { whisky: 1, soda: 1, chana: 1 }, recent: ok, diet: 'veg', ctx: { ...ctx, drinksToday: 2 } });
    expect(already.tips.find((t) => t.id === 'limit')?.action).toEqual({ type: 'swap', from: 'whisky', to: 'water' });
  });

  it('uses a lower limit for seniors', () => {
    expect(tipIds({ whisky: 2, soda: 1, chana: 1 }, { senior: true })).toContain('limit');
    expect(tipIds({ whisky: 2, soda: 1, chana: 1 })).not.toContain('limit');
  });

  it('warns about sugar in beer and offers lower-carb drinks', () => {
    const r = drinkCoach({ basket: { beer: 2, peanuts: 1 }, recent: ok, diet: 'veg', ctx });
    const sweet = r.tips.find((t) => t.id === 'sweet');
    expect(sweet?.action).toEqual({ type: 'portion', food: 'beer', n: 1 });
    expect(sweet?.choices?.slice(1)).toEqual([
      { type: 'swap', from: 'beer', to: 'whisky' },
      { type: 'swap', from: 'beer', to: 'vodka' },
      { type: 'swap', from: 'beer', to: 'wine' },
    ]);
  });

  it('offers several safe mixers instead of cola', () => {
    const r = drinkCoach({ basket: { rum: 1, cola: 1, chana: 1 }, recent: ok, diet: 'veg', ctx });
    expect(r.tips[0].choices?.map((a) => (a.type === 'swap' ? a.to : ''))).toEqual(['soda', 'water', 'dietcola', 'limesoda']);
  });

  it('adds the late-low warning for sulfonylureas and insulin', () => {
    expect(hasHypoMeds(['Metformin'])).toBe(false);
    expect(hasHypoMeds(['Glimepiride 1mg'])).toBe(true);
    expect(drinkCoach({ basket: { wine: 1, salad: 1 }, recent: ok, diet: 'veg', ctx: { ...ctx, hypoMeds: true } }).tips.map((t) => t.id)).toContain('meds');
  });

  it('always ends with the bedtime check', () => {
    for (const b of [{ whisky: 1 }, { beer: 3, cola: 1 }, { wine: 1, salad: 1 }] as Basket[]) {
      expect(tipIds(b).at(-1)).toBe('bedtime');
    }
  });

  it('says eat a meal first when sugar is under 100', () => {
    expect(tipIds({ whisky: 1 }, {}, { v: 85, ctx: 'random', minsAgo: 5 })[0]).toBe('lowish');
  });

  it('treats low sugar as an emergency and very high as skip', () => {
    expect(coach({ basket: { whisky: 1 }, recent: { v: 60, ctx: 'random', minsAgo: 5 }, diet: 'veg', drink: ctx }).tips.map((t) => t.id)).toEqual(['low']);
    const high = drinkCoach({ basket: { whisky: 1 }, recent: { v: 300, ctx: 'random', minsAgo: 5 }, diet: 'veg', ctx });
    expect(high.headline.key).toBe('caSkip');
    expect(high.tips[0].action).toEqual({ type: 'emergency' });
  });

  it('gives no portion guidance in pregnancy or to children', () => {
    const r = drinkCoach({ basket: { whisky: 1 }, recent: ok, diet: 'veg', ctx: { ...ctx, notSafe: true } });
    expect(r.headline.key).toBe('caNotSafe');
    expect(r.tips.map((t) => t.id)).toEqual(['notsafe']);
  });

  it('is what coach() uses when the plate has alcohol', () => {
    expect(coach({ basket: { whisky: 1 }, recent: ok, diet: 'veg', drink: ctx }).headline.key).toBe('caCareful');
  });
});

describe('records', () => {
  it('counts drinks and treats when a day closes', () => {
    const s = seed('2026-10-19');
    const meta = { id: 'x', createdAt: 0, updatedAt: 0 };
    const p = {
      ...s.profiles.me,
      meals: [
        { ...meta, slot: 'snack' as const, kind: 'drink' as const, items: [{ id: 'whisky', q: 2 }, { id: 'soda', q: 1 }], c: 0, p: 0 },
        { ...meta, slot: 'dinner' as const, kind: 'treat' as const, items: [{ id: 'pizza', q: 1 }], c: 50, p: 12 },
      ],
    };
    expect(closeDay(p, '2026-10-19')).toMatchObject({ drinks: 2, treats: 1 });
  });

  it('migrates v2 state to v3', () => {
    const old = seed('2026-10-19') as unknown as { profiles: Record<string, Record<string, unknown>> };
    for (const id in old.profiles) {
      delete old.profiles[id].alcohol;
      delete old.profiles[id].freq;
    }
    const s = migrate(old, 2);
    expect(Object.values(s.profiles).every((p) => p.alcohol === false && typeof p.freq === 'object')).toBe(true);
  });
});

describe('diet filter', () => {
  const ids = (filter: 'all' | 'veg' | 'egg' | 'nonveg', profile: 'veg' | 'egg' | 'nonveg') =>
    FOODS.filter((f) => matchesDiet(f, filter, profile)).map((f) => f.id);

  it('shows exactly egg dishes for Egg', () => {
    const egg = ids('egg', 'veg');
    expect(egg).toEqual(expect.arrayContaining(['egg', 'omelette', 'bhurji', 'eggcurry']));
    expect(egg.every((id) => FOOD_BY_ID[id].diet === 'egg')).toBe(true);
  });

  it('shows exactly meat and fish for Non-veg, including the new dishes', () => {
    const nv = ids('nonveg', 'veg');
    expect(nv).toEqual(expect.arrayContaining(['chicken', 'tandoori', 'tikka', 'malaitikka', 'roastchicken', 'chickenkebab', 'muttonkebab', 'chillichicken', 'mutton', 'fish', 'fishfry']));
    expect(nv).not.toContain('roti');
    expect(nv).not.toContain('egg');
  });

  it('shows only vegetarian food for Veg', () => {
    expect(ids('veg', 'nonveg').every((id) => FOOD_BY_ID[id].diet === 'veg')).toBe(true);
  });

  it('All shows what the person eats', () => {
    expect(ids('all', 'veg')).not.toContain('chicken');
    expect(ids('all', 'nonveg')).toEqual(expect.arrayContaining(['roti', 'egg', 'chicken']));
  });

  it('suggests non-veg protein while browsing non-veg', () => {
    expect(suggestDiet('nonveg', 'veg')).toBe('nonveg');
    expect(suggestDiet('veg', 'nonveg')).toBe('nonveg');
    expect(suggestDiet('all', 'egg')).toBe('egg');
  });
});
