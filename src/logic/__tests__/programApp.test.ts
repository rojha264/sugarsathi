import { FOOD_BY_ID } from '@/data/foods';
import { istYmd, itemsFor, planDayToday, swapsFor } from '../program';

describe('programme day and swaps in the app', () => {
  it('reads the plan start as an India date and finds today\'s day', () => {
    expect(istYmd('2026-10-26T18:30:00.000Z')).toBe('2026-10-27'); // IST midnight
    expect(planDayToday({ startsOn: '2026-10-26T18:30:00.000Z', items: [{ day: 1 }] }, '2026-10-31')).toBe(5);
    expect(planDayToday({ startsOn: '2026-10-26T18:30:00.000Z', items: [{ day: null }] }, '2026-10-31')).toBeNull();
  });

  it('picks items by programme day, previewing day 1 before the start and day 14 after the end', () => {
    const items = [{ id: 'a', day: 1 }, { id: 'b', day: 2 }, { id: 'c', day: 14 }];
    expect(itemsFor(items, 2, 0).map((i) => i.id)).toEqual(['b']);
    expect(itemsFor(items, 0, 0).map((i) => i.id)).toEqual(['a']);
    expect(itemsFor(items, 20, 0).map((i) => i.id)).toEqual(['c']);
    expect(itemsFor([{ id: 'w', weekday: 3 }, { id: 'e', weekday: null }], null, 3).map((i) => i.id)).toEqual(['w', 'e']);
  });

  it('offers swaps from the same group with similar carbs that the person eats', () => {
    const roti = FOOD_BY_ID.roti;
    const s = swapsFor(roti, 2, 'veg');
    expect(s.length).toBeGreaterThan(0);
    for (const f of s) {
      expect(f.group).toBe(roti.group);
      expect(Math.abs(f.c * 2 - roti.c * 2)).toBeLessThanOrEqual(10);
      expect(f.diet).toBe('veg');
    }
    expect(swapsFor(FOOD_BY_ID.dal, 1, 'veg').some((f) => f.diet !== 'veg')).toBe(false);
  });
});
