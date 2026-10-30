import { rememberMeal, suggestFor, type Usual } from '../usual';

const empty: Usual = { freq: {}, slotFreq: {}, lastMeal: {} };
const all = () => true;

describe('usual foods', () => {
  it('remembers the last plate for each meal time', () => {
    const u = rememberMeal(empty, 'breakfast', { poha: 1, chai: 1 });
    const v = rememberMeal(u, 'dinner', { roti: 2, dal: 1 });
    expect(v.lastMeal.breakfast).toEqual({ poha: 1, chai: 1 });
    expect(v.lastMeal.dinner).toEqual({ roti: 2, dal: 1 });
    expect(v.freq).toEqual({ poha: 1, chai: 1, roti: 1, dal: 1 });
  });

  it('suggests this meal time first, then overall favourites', () => {
    let u = empty;
    for (let i = 0; i < 3; i++) u = rememberMeal(u, 'dinner', { roti: 2, dal: 1 });
    for (let i = 0; i < 2; i++) u = rememberMeal(u, 'breakfast', { poha: 1, chai: 1 });
    u = rememberMeal(u, 'breakfast', { idli: 3 });
    expect(suggestFor(u, 'breakfast', all).slice(0, 3)).toEqual(['poha', 'chai', 'idli']);
    expect(suggestFor(u, 'breakfast', all).slice(3)).toEqual(['roti', 'dal']);
    expect(suggestFor(u, 'dinner', all).slice(0, 2)).toEqual(['roti', 'dal']);
  });

  it('respects the screen filter and the limit', () => {
    const u = rememberMeal(empty, 'lunch', { chicken: 1, rice: 1, dal: 1 });
    expect(suggestFor(u, 'lunch', (id) => id !== 'chicken')).toEqual(expect.not.arrayContaining(['chicken']));
    expect(suggestFor(u, 'lunch', all, 2)).toHaveLength(2);
  });
});
