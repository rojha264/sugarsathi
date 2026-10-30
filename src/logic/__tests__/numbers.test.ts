import { a1cDue, bmiBand, lastSugar, weightStatus } from '../numbers';

describe('My numbers card', () => {
  const day = (date: string, sugar: number[]) => ({ date, score: 0, walkMin: 0, medTaken: 0, medTotal: 0, sugar, drinks: 0, treats: 0 });

  it('shows today\'s latest sugar, else the last day that had one', () => {
    const now = { id: 'x', createdAt: 0, updatedAt: 0, v: 142, ctx: 'fasting' as const };
    expect(lastSugar({ sugar: [now], days: [] }, '2026-10-26')).toEqual({ v: 142, ctx: 'fasting', day: 'today' });
    expect(lastSugar({ sugar: [], days: [day('2026-10-24', [150]), day('2026-10-25', [130, 168])] }, '2026-10-26')).toEqual({ v: 168, ctx: null, day: 'yesterday' });
    expect(lastSugar({ sugar: [], days: [day('2026-10-20', [150]), day('2026-10-25', [])] }, '2026-10-26')).toEqual({ v: 150, ctx: null, day: '2026-10-20' });
    expect(lastSugar({ sugar: [], days: [] }, '2026-10-26')).toBeNull();
  });

  it('flags HbA1c as due after 3 months', () => {
    expect(a1cDue('2026-09-01', '2026-10-26')).toBe(false);
    expect(a1cDue('2026-07-01', '2026-10-26')).toBe(true);
    expect(a1cDue(undefined, '2026-10-26')).toBe(true);
  });

  it('uses Asian Indian BMI cut-offs', () => {
    expect(bmiBand(18)).toBe('under');
    expect(bmiBand(22.9)).toBe('normal');
    expect(bmiBand(24)).toBe('over');
    expect(bmiBand(27.5)).toBe('obese');
  });
});


describe('weight for height', () => {
  it('gives the healthy range for the height, how far off, and a 5% first goal', () => {
    // 160 cm: 18.5–22.9 BMI → 47.4–58.6 kg
    expect(weightStatus(70.5, 160)).toEqual({ bmi: 27.5, band: 'obese', min: 47.4, max: 58.6, offBy: 11.9, goal: 67 });
    expect(weightStatus(55, 160)).toMatchObject({ band: 'normal', offBy: 0, goal: null });
    expect(weightStatus(44, 160)).toMatchObject({ band: 'under', offBy: -3.4, goal: null });
    // Close to the range: the goal never goes below the healthy maximum
    expect(weightStatus(60, 160)?.goal).toBe(59);
  });

  it('needs a height, skips children, and sets no weight-loss goal in pregnancy', () => {
    expect(weightStatus(70, null)).toBeNull();
    expect(weightStatus(50, 150, { age: 14 })).toBeNull();
    expect(weightStatus(75, 160, { pregnant: true })?.goal).toBeNull();
  });
});
