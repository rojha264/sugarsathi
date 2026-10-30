import { matchScore, romanize, searchRank } from '@shared/search';

describe('search in Hindi or English', () => {
  it.each([
    ['roti', 'रोटी'], ['chawal', 'चावल'], ['chaval', 'चावल'], ['paneer', 'पनीर'], ['panir', 'Paneer'], ['idli', 'इडली'],
    ['sabzi', 'सब्ज़ी'], ['bhindi', 'भिंडी'], ['chai', 'चाय'], ['chole', 'छोले'], ['khichdi', 'खिचड़ी'], ['रोटी', 'Roti'], ['लौकी', 'Lauki'],
  ])('%s finds %s', (q, name) => expect(matchScore(q, [name])).toBeGreaterThan(0));

  it('does not mix up different foods', () => {
    expect(matchScore('roti', ['चावल'])).toBe(0);
    expect(matchScore('dal', ['Dosa'])).toBe(0);
  });

  it('spells Hindi out in Latin letters', () => {
    expect(romanize('चावल')).toBe('chaaval');
    expect(romanize('सब्ज़ी')).toBe('sabjee');
  });

  it('puts names that start with the query first', () => {
    const foods = [{ en: 'Dal makhani', hi: 'दाल मखनी' }, { en: 'Moong dal', hi: 'मूंग दाल' }, { en: 'Dalia', hi: 'दलिया' }];
    expect(searchRank(foods, 'dal', (f) => [f.en, f.hi]).map((f) => f.en)).toEqual(['Dal makhani', 'Dalia', 'Moong dal']);
    expect(searchRank(foods, 'मूंग', (f) => [f.en, f.hi]).map((f) => f.en)).toEqual(['Moong dal']);
  });
});
