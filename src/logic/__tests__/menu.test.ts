import { menuFor } from '../menu';

const all = () => true;
const plan = [
  { slot: 'breakfast', foodId: 'poha' },
  { slot: 'breakfast', foodId: 'poha' },
  { slot: 'lunch', foodId: 'roti' },
  { slot: 'lunch', foodId: 'dal' },
];

describe('meal menu', () => {
  it('uses the dietitian list when there is one', () => {
    const m = menuFor('breakfast', [{ foodId: 'oats', slots: ['breakfast'], note: 'Fiber' }], plan, all);
    expect(m).toEqual({ source: 'custom', foodIds: ['oats'], notes: { oats: 'Fiber' } });
  });

  it('a custom list replaces the plan for every meal, even meals it leaves empty', () => {
    const m = menuFor('lunch', [{ foodId: 'oats', slots: ['breakfast'], note: '' }], plan, all);
    expect(m.source).toBe('custom');
    expect(m.foodIds).toEqual([]);
  });

  it('a food with no meals chosen is on every meal', () => {
    expect(menuFor('dinner', [{ foodId: 'salad', slots: [], note: '' }], null, all).foodIds).toEqual(['salad']);
  });

  it('falls back to the diet plan foods for that meal, once each', () => {
    expect(menuFor('breakfast', [], plan, all)).toEqual({ source: 'plan', foodIds: ['poha'], notes: {} });
    expect(menuFor('lunch', [], plan, all).foodIds).toEqual(['roti', 'dal']);
  });

  it('has no menu without a list or a plan, or when the plan has nothing for this meal', () => {
    expect(menuFor('lunch', [], null, all).source).toBeNull();
    expect(menuFor('snack', [], plan, all).source).toBeNull();
  });

  it('leaves out foods the person cannot have', () => {
    const ok = (id: string) => id !== 'dal';
    expect(menuFor('lunch', [], plan, ok).foodIds).toEqual(['roti']);
    expect(menuFor('lunch', [{ foodId: 'dal', slots: [], note: 'x' }], plan, ok)).toEqual({ source: 'custom', foodIds: [], notes: {} });
  });
});
