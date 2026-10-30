import { newTargets } from '../targets';
import { FOOD_BY_ID } from '@/data/foods';
import { seed } from '@/data/seed';
import type { Med, Meal, Profile } from '@/types';
import { rollover } from '../day';
import { addDays, daysBetween } from '../ids';
import { defaultSlot, totals } from '../meal';
import { weekly } from '../report';
import { fractions, messageFor, score, streakOf } from '../score';
import { sugarStatus } from '../sugar';
import { parseFoods } from '../voice';

const meta = { id: 'x', createdAt: 0, updatedAt: 0 };
const meal = (slot: Meal['slot']): Meal => ({ ...meta, slot, items: [], c: 0, p: 0 });
const med = (s: Med['s']): Med => ({ ...meta, n: 'M', t: 'morning', s, at: '08:30' });

function profile(over: Partial<Profile> = {}): Profile {
  return { id: 'me', name: '', av: '', role: 'me', why: '', streak: 0, days: [], meals: [], sugar: [], walkMin: 0, steps: 0, meds: [], alcohol: false, freq: {}, slotFreq: {}, lastMeal: {}, targets: newTargets(), sugarPlan: { every: 'daily', from: '2026-01-01' }, water: 0, stock: {}, checkups: {}, ...over };
}

describe('score', () => {
  it('is 0 for an empty day with medicines pending', () => {
    expect(score(profile({ meds: [med(null)] }))).toBe(0);
  });

  it('weights meals 30, walk 25, medicine 25, sugar 20', () => {
    const p = profile({
      meals: [meal('breakfast'), meal('lunch'), meal('dinner')],
      walkMin: 10,
      meds: [med('taken')],
      sugar: [{ ...meta, v: 120, ctx: 'fasting' }],
    });
    expect(score(p)).toBe(100);
  });

  it('ignores snacks and duplicate slots', () => {
    const p = profile({ meals: [meal('breakfast'), meal('breakfast'), meal('snack')], meds: [med(null)] });
    expect(fractions(p).meals).toBe(1);
    expect(score(p)).toBe(10);
  });

  it('gives partial credit for walk and medicine', () => {
    const p = profile({ walkMin: 5, meds: [med('taken'), med('skipped')] });
    expect(score(p)).toBe(Math.round(12.5 + 12.5));
  });

  it('counts no prescribed medicine as done', () => {
    expect(fractions(profile()).med).toBe(1);
  });

  it('adds today to the streak only at 60+', () => {
    const base = { streak: 4, meals: [meal('breakfast'), meal('lunch'), meal('dinner')], meds: [med('taken')] };
    expect(streakOf(profile(base))).toBe(4); // 55
    expect(streakOf(profile({ ...base, walkMin: 2 }))).toBe(5); // 60
  });

  it('picks the coaching message by score band', () => {
    expect([0, 10, 49, 50, 79, 80].map(messageFor)).toEqual(['msg0', 'msg1', 'msg1', 'msg2', 'msg2', 'msg3']);
  });
});

describe('sugarStatus', () => {
  it.each([
    [69, 'fasting', 'r', 'sLow'],
    [70, 'fasting', 'g', 'sG'],
    [130, 'fasting', 'g', 'sG'],
    [131, 'fasting', 'a', 'sA'],
    [180, 'after', 'g', 'sG'],
    [181, 'random', 'a', 'sA'],
    [250, 'after', 'a', 'sA'],
    [251, 'fasting', 'r', 'sHigh'],
  ] as const)('%i %s -> %s', (v, ctx, l, k) => {
    expect(sugarStatus(v, ctx)).toEqual({ l, k });
  });
});

describe('meal', () => {
  it('totals carbs and protein', () => {
    const t = totals({ roti: 2, dal: 1 });
    const roti = FOOD_BY_ID.roti;
    const dal = FOOD_BY_ID.dal;
    expect(t.c).toBe(Math.round(roti.c * 2 + dal.c));
    expect(t.p).toBe(Math.round(roti.p * 2 + dal.p));
    expect(t.g).toBe(roti.g * 2 + dal.g);
    expect(t.std).toBe(0);
  });


  it('defaults the slot by hour', () => {
    expect([8, 13, 17, 21].map(defaultSlot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
  });
});

describe('parseFoods', () => {
  it('parses the demo phrase', () => {
    expect(parseFoods('2 roti, 1 dal and 1 sabzi')).toEqual({ roti: 2, dal: 1, sabzi: 1 });
  });

  it('parses Hindi words and number words', () => {
    expect(parseFoods('दो रोटी और एक दाल')).toEqual({ roti: 2, dal: 1 });
    expect(parseFoods('teen idli aur chai')).toEqual({ idli: 3, chai: 1 });
  });

  it('handles plurals, glued digits and Devanagari digits', () => {
    expect(parseFoods('2rotis and 2 eggs')).toEqual({ roti: 2, egg: 2 });
    expect(parseFoods('२ रोटी')).toEqual({ roti: 2 });
  });

  it('prefers multi-word phrases', () => {
    expect(parseFoods('1 brown rice and 2 jowar roti')).toEqual({ brownrice: 1, jowar: 2 });
    expect(parseFoods('chai without sugar')).toEqual({ chains: 1 });
    expect(parseFoods('2 chicken tikka')).toEqual({ tikka: 2 });
    expect(parseFoods('फीकी चाय और दो अंडे')).toEqual({ chains: 1, egg: 2 });
  });

  it('caps quantity and ignores unknown words', () => {
    expect(parseFoods('20 roti')).toEqual({ roti: 9 });
    expect(parseFoods('nothing here')).toEqual({});
  });
});

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-18', '2026-10-20')).toBe(2);
  });
});

describe('rollover', () => {
  const fullDay = {
    meals: [meal('breakfast'), meal('lunch'), meal('dinner')],
    walkMin: 10,
    sugar: [{ ...meta, v: 120, ctx: 'fasting' as const }],
  };

  it('does nothing on the same day', () => {
    const s = seed('2026-10-19');
    expect(rollover(s, '2026-10-19')).toBe(s);
  });

  it('closes yesterday, extends the streak and resets today', () => {
    const s = seed('2026-10-18');
    s.profiles.me = { ...s.profiles.me, ...fullDay, meds: s.profiles.me.meds.map((m) => ({ ...m, s: 'taken' as const })) };
    const before = s.profiles.me.days.length;
    const r = rollover(s, '2026-10-19');
    const me = r.profiles.me;
    expect(r.day).toBe('2026-10-19');
    expect(me.days).toHaveLength(before + 1);
    expect(me.days.at(-1)).toMatchObject({ date: '2026-10-18', score: 100, walkMin: 10, medTaken: 2, medTotal: 2, sugar: [120] });
    expect(me.streak).toBe(6);
    expect(me.meals).toEqual([]);
    expect(me.sugar).toEqual([]);
    expect(me.walkMin).toBe(0);
    expect(me.meds.every((m) => m.s === null)).toBe(true);
  });

  it('uses the weekly grace day for one low day, then breaks the streak', () => {
    const r = rollover(seed('2026-10-20'), '2026-10-21'); // seed streak 5, empty (low) day
    expect(r.profiles.me.streak).toBe(5);
    expect(r.profiles.me.days.at(-1)).toMatchObject({ date: '2026-10-20', grace: true });
    const again = rollover(r, '2026-10-22'); // second low day, same week
    expect(again.profiles.me.streak).toBe(0);
  });

  it('gives a new grace day next week', () => {
    const r = rollover(seed('2026-10-20'), '2026-10-21');
    const s = { ...r, day: '2026-10-27', profiles: { ...r.profiles, me: { ...r.profiles.me, streak: 3 } } };
    expect(rollover(s, '2026-10-28').profiles.me.streak).toBe(3);
  });

  it('covers one fully missed day with the grace day', () => {
    const s = seed('2026-10-20');
    s.profiles.me = { ...s.profiles.me, meals: [meal('breakfast'), meal('lunch'), meal('dinner')], walkMin: 10, meds: [] };
    const r = rollover(s, '2026-10-22'); // good day, then one missed day
    expect(r.profiles.me.streak).toBe(6);
  });

  it('records water and resets it', () => {
    const s = seed('2026-10-20');
    s.profiles.me = { ...s.profiles.me, water: 6 };
    const r = rollover(s, '2026-10-21');
    expect(r.profiles.me.days.at(-1)?.water).toBe(6);
    expect(r.profiles.me.water).toBe(0);
  });

  it('keeps the most recent 30 days after a long gap', () => {
    const r = rollover(seed('2026-08-01'), '2026-09-15');
    const days = r.profiles.me.days;
    expect(days).toHaveLength(30);
    expect(days.at(-1)?.date).toBe('2026-09-14');
    expect(days[0].date).toBe('2026-08-16');
  });

  it('records missed days as zero and breaks the streak', () => {
    const s = seed('2026-10-15');
    s.profiles.me = { ...s.profiles.me, ...fullDay, meds: [] };
    const r = rollover(s, '2026-10-19');
    const dates = r.profiles.me.days.slice(-4).map((d) => [d.date, d.score]);
    expect(dates).toEqual([['2026-10-15', 100], ['2026-10-16', 0], ['2026-10-17', 0], ['2026-10-18', 0]]);
    expect(r.profiles.me.streak).toBe(0);
  });
});

describe('weekly', () => {
  it('summarises the last 7 days including today', () => {
    const s = seed('2026-10-19');
    const w = weekly(s.profiles.papa, '2026-10-19');
    expect(w.scores).toHaveLength(7);
    expect(w.readings).toEqual([162, 141, 170, 155, 149, 146, 148]);
    expect(w.inRange).toBe(100);
    expect(w.walkDays).toBe(7);
  });

  it('handles no readings', () => {
    const w = weekly(profile(), '2026-10-19');
    expect(w.avgSugar).toBeNull();
    expect(w.inRange).toBeNull();
    expect(w.medPct).toBeNull();
  });
});
