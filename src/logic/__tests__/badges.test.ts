import { badges, badgeStats, nextBadge } from '../badges';

const day = (sugar: number[], walkMin: number) => ({ date: '2026-10-01', score: 0, walkMin, medTaken: 0, medTotal: 0, sugar });

describe('badges', () => {
  it('counts readings and walk days across history and today', () => {
    const s = badgeStats({ days: [day([120, 140], 15), day([], 5), day([100], 20)], sugar: [{ id: 'a', createdAt: 0, updatedAt: 0, v: 110, ctx: 'fasting' }], walkMin: 12 }, 3, 0);
    expect(s).toEqual({ readings: 4, walkDays: 3, streak: 3, savedReels: 0 });
  });

  it('earns small wins early and always has a next badge', () => {
    const list = badges({ readings: 1, walkDays: 2, streak: 3, savedReels: 0 });
    expect(list.filter((b) => b.earned).map((b) => b.id)).toEqual(['starter', 'firstCheck']);
    expect(nextBadge(list)).toMatchObject({ id: 'learner', left: 1 });
    const pro = badges({ readings: 50, walkDays: 40, streak: 100, savedReels: 3 });
    expect(pro.every((b) => b.earned)).toBe(true);
    expect(nextBadge(pro)).toBeNull();
  });
});
