import { hasAll, removeFromBasket } from '../meal';

describe('one-tap thali on the plate', () => {
  const north = { salad: 1, roti: 2, dal: 1 };

  it('is "on the plate" only when every portion is there', () => {
    expect(hasAll({ salad: 1, roti: 2, dal: 1, rice: 1 }, north)).toBe(true);
    expect(hasAll({ salad: 1, roti: 1, dal: 1 }, north)).toBe(false);
    expect(hasAll({}, north)).toBe(false);
  });

  it('removing takes its portions out and keeps extra food the user added', () => {
    expect(removeFromBasket({ salad: 1, roti: 3, dal: 1, rice: 1 }, north)).toEqual({ roti: 1, rice: 1 });
    expect(removeFromBasket({ roti: 1 }, north)).toEqual({});
  });
});
