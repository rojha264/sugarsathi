import { cheerFor, clock, creditMinutes } from '../walk';

describe('walk timer', () => {
  it('formats the clock', () => {
    expect(clock(600)).toBe('10:00');
    expect(clock(125)).toBe('2:05');
    expect(clock(0.4)).toBe('0:01');
    expect(clock(-3)).toBe('0:00');
  });

  it('cheers at each milestone', () => {
    expect(cheerFor(0, 20)).toBe('cheer0');
    expect(cheerFor(0.3, 14)).toBe('cheer25');
    expect(cheerFor(0.5, 10)).toBe('cheer50');
    expect(cheerFor(0.8, 4)).toBe('cheer75');
    expect(cheerFor(0.95, 0.5)).toBe('cheerLast');
  });

  it('says last minute even on a short walk', () => {
    expect(cheerFor(0.85, 0.75)).toBe('cheerLast');
  });

  it('credits whole minutes when stopped early', () => {
    expect(creditMinutes(0.6)).toBe(0);
    expect(creditMinutes(7.9)).toBe(7);
  });
});
