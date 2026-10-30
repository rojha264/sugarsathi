import { basketOf, duplicateMeals, loggedMeal } from '../meal';
import type { Meal, MealSlot } from '@/types';

const at = (h: number, day = 26) => new Date(2026, 9, day, h).getTime();
const meal = (id: string, slot: MealSlot, createdAt: number, updatedAt = createdAt): Meal => ({ id, slot, createdAt, updatedAt, items: [{ id: 'roti', q: 2 }], c: 30, p: 6 });

describe('one breakfast / lunch / dinner a day', () => {
  const meals = [meal('a', 'lunch', at(12)), meal('b', 'lunch', at(13)), meal('c', 'lunch', at(12), at(14)), meal('s1', 'snack', at(16)), meal('s2', 'snack', at(17)), meal('y', 'lunch', at(12, 25))];

  it('finds the lunch already saved today, the latest edit winning', () => {
    expect(loggedMeal(meals, 'lunch', '2026-10-26')?.id).toBe('c');
    expect(loggedMeal(meals, 'lunch', '2026-10-25')?.id).toBe('y');
    expect(loggedMeal(meals, 'dinner', '2026-10-26')).toBeUndefined();
  });

  it('never treats snacks as already logged', () => {
    expect(loggedMeal(meals, 'snack', '2026-10-26')).toBeUndefined();
  });

  it('lists the extra lunches to remove and keeps snacks and other days', () => {
    expect(duplicateMeals(meals).sort()).toEqual(['a', 'b']);
    expect(duplicateMeals([meal('x', 'dinner', at(20))])).toEqual([]);
  });

  it('turns a saved meal back into a basket for editing', () => {
    expect(basketOf(meals[0])).toEqual({ roti: 2 });
  });
});
