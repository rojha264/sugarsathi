import { seed } from '@/data/seed';
import { migrate } from '@/store/migrate';
import type { Meal, Setup, SugarCtx, SugarReading, Targets } from '@/types';
import { adaptTargets, pairFor, withBase } from '../smartTargets';
import { newTargets } from '../targets';

const H = 3600 * 1000;
const T0 = Date.UTC(2026, 9, 20, 2, 0); // 7:30 IST
const setup: Setup = { name: '', type: 'type2', age: 'adult', goal: 'g1', diet: 'veg', sugarEvery: 'every3', textSize: 'normal', caregiver: { name: '', phone: '' }, tw: '07:00', tm: '08:30', ts: '07:30', ta: '14:30' };

let n = 0;
const reading = (v: number, ctx: SugarCtx, at: number): SugarReading => ({ id: `r${n++}`, createdAt: at, updatedAt: at, v, ctx });
const meal = (slot: Meal['slot'], at: number): Meal => ({ id: `m${n++}`, createdAt: at, updatedAt: at, slot, items: [{ id: 'roti', q: 3 }], c: 58, p: 9, kind: 'meal' });

/** Logs readings in order through adaptTargets, like the app does. */
function run(t: Targets, steps: { r: SugarReading }[], meals: Meal[], s: Setup | null = setup) {
  const readings: SugarReading[] = [];
  let cur = t;
  const all = [];
  for (const { r } of steps) {
    const out = adaptTargets(cur, { setup: s, reading: r, meals, readings });
    readings.push(r);
    cur = out.targets;
    all.push(out);
  }
  return { t: cur, outs: all };
}

describe('pairFor', () => {
  it('pairs a 2-hours-after reading with the meal and the reading before it', () => {
    const before = reading(180, 'fasting', T0);
    const bf = meal('breakfast', T0 + 0.25 * H);
    const after = reading(220, 'after', T0 + 2.25 * H);
    expect(pairFor(after, [bf], [before])).toEqual({ slot: 'breakfast', after: 220, before: 180, rise: 40 });
  });

  it('ignores an after reading with no meal 1–3 h earlier', () => {
    expect(pairFor(reading(220, 'after', T0 + 5 * H), [meal('breakfast', T0)], [])).toBeNull();
    expect(pairFor(reading(220, 'after', T0 + 0.5 * H), [meal('breakfast', T0)], [])).toBeNull();
  });

  it('judges the after value alone when there is no before reading', () => {
    expect(pairFor(reading(150, 'after', T0 + 2 * H), [meal('lunch', T0)], [])).toEqual({ slot: 'lunch', after: 150 });
  });
});

describe('adaptTargets', () => {
  it('handles the user example: fasting 180, after breakfast 220', () => {
    const t = { ...newTargets(), fastHist: [150, 160] };
    const bf = meal('breakfast', T0 + 0.25 * H);
    const { t: out, outs } = run(t, [{ r: reading(180, 'fasting', T0) }, { r: reading(220, 'after', T0 + 2.25 * H) }], [bf]);
    expect(out.slot.breakfast).toBe(55); // 220 > 180 after breakfast
    expect(out.slot.dinner).toBe(55); // fasting average 163 > 130
    expect(out.fiber).toBe(30);
    expect(out.protein).toBe(70); // carbs cut, protein up
    expect(out.slot.lunch).toBe(60);
    expect(outs[1].pair).toEqual({ slot: 'breakfast', after: 220, before: 180, rise: 40 });
    expect(out.log.map((a) => a.reason)).toEqual(['rFastingHigh', 'rFastingHigh', 'rCarbsCut', 'rHighAfter']);
  });

  it('tightens on a big rise even when the after value is under 180', () => {
    const { t } = run(newTargets(), [{ r: reading(100, 'random', T0) }, { r: reading(170, 'after', T0 + 2.2 * H) }], [meal('lunch', T0 + 0.2 * H)]);
    expect(t.slot.lunch).toBe(55);
    expect(t.log.find((a) => a.field === 'lunch')?.reason).toBe('rHighRise');
  });

  it('relaxes after 3 good pairs, never above base', () => {
    let t: Targets = { ...newTargets(), slot: { breakfast: 50, lunch: 60, dinner: 60 } };
    for (let d = 0; d < 3; d++) {
      const day = T0 + d * 24 * H;
      t = run(t, [{ r: reading(110, 'fasting', day) }, { r: reading(130, 'after', day + 2.2 * H) }], [meal('breakfast', day + 0.2 * H)]).t;
    }
    expect(t.slot.breakfast).toBe(55);
    const atBase = run({ ...newTargets(), good: { breakfast: 2, lunch: 0, dinner: 0 } }, [{ r: reading(120, 'after', T0 + 2 * H) }], [meal('breakfast', T0)]).t;
    expect(atBase.slot.breakfast).toBe(60);
  });

  it('never goes below 30 g a meal, 40 g for seniors, or 130 g a day', () => {
    let t = newTargets();
    for (let d = 0; d < 12; d++) {
      const day = T0 + d * 24 * H;
      t = run(t, [{ r: reading(250, 'after', day + 2 * H) }], [meal('breakfast', day)]).t;
    }
    expect(t.slot.breakfast).toBe(30);
    let s = newTargets();
    for (let d = 0; d < 12; d++) s = run(s, [{ r: reading(250, 'after', T0 + d * 24 * H + 2 * H) }], [meal('lunch', T0 + d * 24 * H)], { ...setup, age: 'senior' }).t;
    expect(s.slot.lunch).toBe(40);
    const low = { ...newTargets(), slot: { breakfast: 30, lunch: 30, dinner: 60 } };
    const after = run(low, [{ r: reading(250, 'after', T0 + 2 * H) }], [meal('dinner', T0)]).t;
    expect(after.slot.breakfast + after.slot.lunch + after.slot.dinner + 20).toBeGreaterThanOrEqual(130);
  });

  it('stops cutting and eases off after a low', () => {
    const t = { ...newTargets(), slot: { breakfast: 50, lunch: 50, dinner: 60 } };
    const r = run(t, [{ r: reading(62, 'random', T0) }, { r: reading(240, 'after', T0 + 26 * H) }], [meal('breakfast', T0 + 24 * H)]);
    expect(r.t.slot.breakfast).toBe(55);
    expect(r.t.slot.lunch).toBe(55);
    expect(r.outs[1].paused).toBe('low');
    expect(r.outs[1].changes.filter((a) => a.field === 'breakfast')).toEqual([]);
  });

  it('makes no automatic change for type 1, pregnancy or doctor-set targets', () => {
    const steps = [{ r: reading(250, 'after', T0 + 2 * H) }];
    for (const s of [{ ...setup, type: 'type1' as const }, { ...setup, type: 'gdm' as const }]) {
      expect(run(newTargets(), steps, [meal('breakfast', T0)], s).t.slot.breakfast).toBe(60);
    }
    expect(run(newTargets(newTargets().base, 'doctor'), steps, [meal('breakfast', T0)]).t.slot.breakfast).toBe(60);
  });

  it('restores fiber once fasting is back in range', () => {
    let t = { ...newTargets(), fastHist: [150, 150] };
    t = run(t, [{ r: reading(150, 'fasting', T0) }], []).t;
    expect(t.fiber).toBe(30);
    for (let d = 1; d <= 3; d++) t = run(t, [{ r: reading(110, 'fasting', T0 + d * 24 * H) }], []).t;
    expect(t.fiber).toBe(25);
  });

  it('auto mode follows a new base, keeping each learned meal offset', () => {
    const t = { ...newTargets(), slot: { breakfast: 50, lunch: 60, dinner: 60 } };
    const up = withBase(t, { meal: 70, protein: 80, fiber: 30 }, 'auto');
    expect(up.slot).toEqual({ breakfast: 60, lunch: 70, dinner: 70 });
    expect(up.protein).toBe(80); // boost is capped at 75 but never pulls a higher base down
    expect(withBase(t, { meal: 70, protein: 60, fiber: 25 }, 'auto').protein).toBe(70);
    expect(up.fiber).toBe(30);
  });

  it('doctor base sets everything; switching to auto keeps slots within base', () => {
    const d = withBase({ ...newTargets(), slot: { breakfast: 45, lunch: 60, dinner: 60 } }, { meal: 50, protein: 70, fiber: 30 }, 'doctor');
    expect(d.slot).toEqual({ breakfast: 50, lunch: 50, dinner: 50 });
    expect([d.protein, d.fiber]).toEqual([70, 30]);
    const a = withBase({ ...newTargets(), slot: { breakfast: 45, lunch: 60, dinner: 60 } }, { meal: 50, protein: 60, fiber: 25 }, 'auto');
    expect(a.slot).toEqual({ breakfast: 35, lunch: 50, dinner: 50 }); // breakfast keeps its -15 g offset
  });
});

it('migrates v4 targets to adaptive v5', () => {
  const old = seed('2026-10-20') as unknown as { profiles: Record<string, Record<string, unknown>> };
  for (const id in old.profiles) old.profiles[id].targets = { mealMin: 40, mealMax: 55, protein: 65, fiber: 30 };
  const s = migrate(old, 4);
  expect(s.profiles.me.targets).toMatchObject({ mode: 'auto', base: { meal: 55, protein: 65, fiber: 30 }, slot: { breakfast: 55 } });
});
