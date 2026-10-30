import { FOOD_BY_ID, FOODS } from '@/data/foods';
import { seed } from '@/data/seed';
import { INGREDIENTS } from '@/data/nutrition/ingredients';
import { kcalOf } from '@/data/nutrition/compute';
import { RECIPES } from '@/data/nutrition/recipes';
import { migrate } from '@/store/migrate';
import { plateCheck } from '../plate';
import { dayTotals, DEFAULT_TARGETS, mealBand } from '../targets';

const within = (v: number, ref: number, pct = 0.2) => Math.abs(v - ref) <= ref * pct;

describe('nutrition data', () => {
  it('has a recipe for every food and a source for every ingredient', () => {
    for (const f of FOODS) expect(RECIPES[f.id]).toBeDefined();
    for (const [id, ing] of Object.entries(INGREDIENTS)) {
      expect(ing.src.length).toBeGreaterThan(5);
      for (const k of ['carb', 'protein', 'fat', 'fiber'] as const) {
        expect(ing[k]).toBeGreaterThanOrEqual(0);
        expect(ing[k]).toBeLessThanOrEqual(100);
      }
      expect(ing.carb + ing.protein + ing.fat + ing.fiber).toBeLessThanOrEqual(101);
      void id;
    }
  });

  it('has no recipe for a food that does not exist', () => {
    for (const id of Object.keys(RECIPES)) expect(FOOD_BY_ID[id]).toBeDefined();
  });

  it('computes kcal consistent with macros', () => {
    for (const f of FOODS) {
      expect(f.kcal).toBeGreaterThanOrEqual(0);
      if (f.group !== 'alcohol') expect(Math.abs(f.kcal - kcalOf(f.c, f.p, f.fat, f.f))).toBeLessThanOrEqual(3);
    }
  });

  // Published per-portion references (IFCT-based Indian tables and USDA).
  it.each([
    ['roti', 'c', 18],  // 1 chapati ~40 g: 15–20 g carbs
    ['rice', 'c', 42],  // 1 katori cooked white rice 150 g (USDA 28 g/100 g)
    ['dal', 'p', 7],    // 1 katori toor dal: ~7 g protein
    ['idli', 'c', 8],   // 1 idli ~40 g: ~8 g carbs
    ['egg', 'p', 6.5],  // 1 boiled egg 50 g
    ['beer', 'c', 12],  // 330 ml regular beer
    ['cola', 'c', 21],  // 200 ml cola
    ['chicken', 'p', 18], // 1 katori chicken curry
  ] as const)('%s %s ≈ %d', (id, key, ref) => {
    expect(within(FOOD_BY_ID[id][key], ref)).toBe(true);
  });

  it('spirits have no carbs but carry calories', () => {
    expect(FOOD_BY_ID.whisky.c).toBe(0);
    expect(FOOD_BY_ID.whisky.kcal).toBeGreaterThan(50);
  });
});

describe('plateCheck', () => {
  it('passes a plate-method thali', () => {
    expect(plateCheck({ salad: 1, sabzi: 1, dal: 1, roti: 2 })?.key).toBe('plateGood');
  });
  it('flags a grain-heavy plate', () => {
    expect(plateCheck({ roti: 4, rice: 1 })?.key).toBe('plateLessGrain');
  });
  it('asks for veg with chicken and rice', () => {
    const r = plateCheck({ chicken: 1, rice: 1 });
    expect(r?.key).toBe('plateMoreVeg');
  });
  it('asks for protein with only veg and grain', () => {
    expect(plateCheck({ sabzi: 2, salad: 1, roti: 2 })?.key).toBe('plateAddProtein');
  });
  it('ignores drinks and sweets', () => {
    expect(plateCheck({ chai: 1, jalebi: 2 })).toBeNull();
  });
});

describe('targets', () => {
  it('bands a meal by carbs', () => {
    expect(mealBand(70, DEFAULT_TARGETS, 'lunch')).toBe('high');
    expect(mealBand(50, DEFAULT_TARGETS, 'lunch')).toBe('ok');
    expect(mealBand(25, DEFAULT_TARGETS, 'snack')).toBe('high');
  });
  it('adds up the day', () => {
    const meta = { id: 'x', createdAt: 0, updatedAt: 0 };
    const t = dayTotals({ meals: [{ ...meta, slot: 'lunch', items: [{ id: 'roti', q: 2 }, { id: 'dal', q: 1 }], c: 0, p: 0 }] });
    expect(t.p).toBe(Math.round(FOOD_BY_ID.roti.p * 2 + FOOD_BY_ID.dal.p));
    expect(t.fiber).toBeGreaterThan(0);
  });
  it('migrates v3 state to v4 with default targets', () => {
    const old = seed('2026-10-19') as unknown as { profiles: Record<string, Record<string, unknown>> };
    for (const id in old.profiles) delete old.profiles[id].targets;
    const s = migrate(old, 3);
    expect(Object.values(s.profiles).every((p) => p.targets?.slot.breakfast === 60 && p.targets.mode === 'auto')).toBe(true);
  });
});

describe('estimated HbA1c', () => {
  const { estimateA1c } = jest.requireActual('../report') as typeof import('../report');
  it('needs enough readings', () => {
    expect(estimateA1c([150, 160])).toBeNull();
  });
  it('uses the ADAG formula', () => {
    expect(estimateA1c(Array(10).fill(154))).toBe(7); // 154 mg/dL ≈ 7.0%
  });
});
