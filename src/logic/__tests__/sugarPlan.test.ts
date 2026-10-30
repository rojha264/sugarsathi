import type { Profile, SugarPlan } from '@/types';
import { score } from '../score';
import { checkKindFor, defaultSugarEvery, isSugarDay, nextSugarDay, sugarDayIndex, upcomingSugarDays } from '../sugarPlan';

const plan = (every: SugarPlan['every']): SugarPlan => ({ every, from: '2026-10-20' }); // a Tuesday

describe('sugar plan', () => {
  it('defaults by diabetes type', () => {
    expect(defaultSugarEvery('type1')).toBe('daily');
    expect(defaultSugarEvery('gdm')).toBe('daily');
    expect(defaultSugarEvery('type2')).toBe('every3');
    expect(defaultSugarEvery('pre')).toBe('fortnight');
  });

  it('spaces checks by the chosen interval', () => {
    expect(upcomingSugarDays(plan('every3'), '2026-10-20', 3)).toEqual(['2026-10-20', '2026-10-23', '2026-10-26']);
    expect(upcomingSugarDays(plan('weekly'), '2026-10-21', 2)).toEqual(['2026-10-27', '2026-11-03']);
    expect(upcomingSugarDays(plan('fortnight'), '2026-10-20', 2)).toEqual(['2026-10-20', '2026-11-03']);
    expect(upcomingSugarDays(plan('daily'), '2026-10-20', 2)).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('checks twice a week on Monday and Thursday', () => {
    expect(upcomingSugarDays(plan('twiceWeek'), '2026-10-20', 3)).toEqual(['2026-10-22', '2026-10-26', '2026-10-29']);
  });

  it('has nothing scheduled when off', () => {
    expect(isSugarDay(plan('off'), '2026-10-20')).toBe(false);
    expect(nextSugarDay(plan('off'), '2026-10-20')).toBeNull();
  });

  it('alternates fasting and after-meal checks', () => {
    const p = plan('every3');
    const kinds = upcomingSugarDays(p, '2026-10-20', 4).map((d) => checkKindFor(sugarDayIndex(p, d)));
    expect(kinds).toEqual(['fasting', 'after', 'fasting', 'after']);
  });
});

describe('score on non-testing days', () => {
  const meta = { id: 'x', createdAt: 0, updatedAt: 0 };
  const base = {
    meals: [{ ...meta, slot: 'breakfast' as const, items: [], c: 0, p: 0 }, { ...meta, slot: 'lunch' as const, items: [], c: 0, p: 0 }, { ...meta, slot: 'dinner' as const, items: [], c: 0, p: 0 }],
    walkMin: 10,
    meds: [],
    sugar: [],
  } as Pick<Profile, 'meals' | 'walkMin' | 'meds' | 'sugar'>;

  it('does not penalise skipping a test that was not due', () => {
    expect(score({ ...base, sugarPlan: plan('every3') }, '2026-10-21')).toBe(100);
  });

  it('still expects the test on a testing day', () => {
    expect(score({ ...base, sugarPlan: plan('every3') }, '2026-10-23')).toBe(80);
  });

  it('scales the rest up to 100 when not due', () => {
    const half = { ...base, walkMin: 0 }; // 30 + 25 of 80
    expect(score({ ...half, sugarPlan: plan('weekly') }, '2026-10-21')).toBe(Math.round((55 / 80) * 100));
  });
});

describe('upgrade', () => {
  it('gives existing users a sugar plan based on their diabetes type', () => {
    const { seed } = jest.requireActual('@/data/seed') as typeof import('@/data/seed');
    const { migrate } = jest.requireActual('@/store/migrate') as typeof import('@/store/migrate');
    const old = seed('2026-10-20') as unknown as { setup: Record<string, unknown>; profiles: Record<string, Record<string, unknown>> };
    old.setup.type = 'type1';
    delete old.setup.sugarEvery;
    for (const id in old.profiles) delete old.profiles[id].sugarPlan;
    const s = migrate(old, 6);
    expect(s.setup.sugarEvery).toBe('daily');
    expect(s.profiles.me.sugarPlan).toEqual({ every: 'daily', from: '2026-10-20' });
    expect(s.profiles.papa.sugarPlan.every).toBe('every3');
  });
});
