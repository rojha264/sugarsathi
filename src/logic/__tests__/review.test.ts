import { reviewDue } from '@/native/review';

// Hoisted above the import by Jest.
jest.mock('expo-store-review', () => ({}));
jest.mock('@/data/repo', () => ({ repo: { getItem: () => null, setItem: () => {} } }));

const day = (score: number) => ({ date: '2026-10-01', score, walkMin: 0, medTaken: 0, medTotal: 0, sugar: [] });

describe('store rating prompt', () => {
  it('asks once, only after a good week and never after a red reading', () => {
    const good = [65, 70, 80, 61, 90, 20, 30].map(day);
    expect(reviewDue({ days: good, sugar: [] }, false)).toBe(true);
    expect(reviewDue({ days: good, sugar: [] }, true)).toBe(false);
    expect(reviewDue({ days: good, sugar: [{ id: 'x', createdAt: 0, updatedAt: 0, v: 300, ctx: 'random' }] }, false)).toBe(false);
    expect(reviewDue({ days: [65, 70, 20, 30, 10, 90, 15].map(day), sugar: [] }, false)).toBe(false);
  });
});
