import { addDays, localDate, newId } from '@/logic/ids';
import { defaultMedTime } from '@/logic/meds';
import { newTargets } from '@/logic/targets';
import type { AppState, DayRecord, Med, MedTime, Profile } from '@/types';

/** Builds 6 past days from the prototype's demo numbers. */
function pastDays(today: string, scores: number[], sugar: number[], walkDays: number, medPct: number, medTotal: number): DayRecord[] {
  const n = scores.length;
  // Spread missed doses one per day so adherence lands near medPct.
  const missed = Math.min(Math.round((1 - medPct / 100) * n * medTotal), n);
  return scores.map((score, i) => ({
    date: addDays(today, i - n),
    score,
    walkMin: i >= n - walkDays ? 10 : 0,
    medTaken: medTotal - (i < missed ? 1 : 0),
    medTotal,
    sugar: sugar[i] !== undefined ? [sugar[i]] : [],
    drinks: 0,
    treats: 0,
  }));
}

const MORNING = '08:30';

function med(n: string, t: MedTime, s: Med['s'] = null): Med {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, n, t, s, at: defaultMedTime(t, MORNING) };
}

export function newProfile(id: string, name: string, av = '🙂', today: string = localDate()): Profile {
  return {
    id, name, av, role: 'fam', why: '', streak: 0, days: [], meals: [], sugar: [], walkMin: 0, steps: 0, meds: [], alcohol: false,
    freq: {}, slotFreq: {}, lastMeal: {}, targets: newTargets(), sugarPlan: { every: 'every3', from: today }, water: 0, stock: {}, checkups: {},
  };
}

/**
 * Sample people and history, only for demos and tests (EXPO_PUBLIC_DEMO=1). Real users start
 * empty: no fake streak, no made-up past days, no family members and no medicines they never take.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1' || process.env.NODE_ENV === 'test';

export function seed(today: string = localDate(), demo: boolean = DEMO): AppState {
  const base: AppState = {
    lang: 'en',
    mode: 'simple',
    onboarded: false,
    setup: { name: '', type: 'type2', age: 'adult', goal: 'g1', diet: 'veg', sugarEvery: 'every3', textSize: 'normal', caregiver: { name: '', phone: '' }, tw: '07:00', tm: MORNING, ts: '07:30', ta: '14:30' },
    cur: 'me',
    day: today,
    profiles: { me: { ...newProfile('me', '', '🧑', today), role: 'me' } },
  };
  if (!demo) return base;
  const now = Date.now();
  const me: Profile = {
    ...newProfile('me', '', '🧑'),
    role: 'me',
    streak: 5,
    days: pastDays(today, [62, 48, 75, 80, 55, 70], [148, 121, 165, 138, 127, 119], 4, 86, 2),
    meds: [med('Metformin', 'morning'), med('Metformin', 'night')],
  };
  const papa: Profile = {
    ...newProfile('papa', 'Papa', '👴'),
    streak: 12,
    days: pastDays(today, [70, 66, 82, 78, 90, 74], [162, 141, 170, 155, 149, 146], 6, 94, 1),
    meals: [{ id: newId(), createdAt: now, updatedAt: now, slot: 'breakfast', items: [{ id: 'idli', q: 2 }], c: 24, p: 4, kind: 'meal' }],
    sugar: [{ id: newId(), createdAt: now, updatedAt: now, v: 148, ctx: 'fasting' }],
    walkMin: 10,
    steps: 5100,
    meds: [med('Glimepiride', 'morning', 'taken')],
  };
  const maa: Profile = {
    ...newProfile('maa', 'Maa', '👵'),
    streak: 3,
    days: pastDays(today, [40, 52, 58, 44, 61, 57], [134, 140, 129, 133, 138, 131], 3, 71, 1),
    steps: 1800,
    meds: [med('Metformin', 'night')],
  };
  return { ...base, profiles: { me, papa, maa } };
}
