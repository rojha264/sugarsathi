import { alertText, dueAlerts, eventAlert, localNow, waNumber, type CareState, type Snapshot } from '@shared/family';
import { careStatus, timeline, weekScores } from '../careView';
import { seed } from '@/data/seed';
import { dosesNow } from '../meds';
import { buildCareState, buildSnapshot } from '../snapshot';

const DAY = '2026-10-23';
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  day: DAY, updatedAt: 0, score: 0, meals: [], sugar: [], walkMin: 0, steps: 0, water: 0,
  doses: [{ name: 'Metformin', at: '08:30', s: null }, { name: 'Glimepiride', at: '08:30', s: null }, { name: 'Metformin', at: '21:00', s: null }],
  ...over,
});
const state: CareState = { name: 'Dadi', lang: 'hi', streak: 3, low: [{ name: 'Metformin', left: 6, days: 3 }], checkupsDue: ['a1c'], week: [] };
const at = (hhmm: string) => ({ day: DAY, hhmm });
const kinds = (a: { kind: string }[]) => a.map((x) => x.kind);

describe('scheduled alerts', () => {
  it('flags a dose not marked 2 hours after its time, grouped by time', () => {
    expect(dueAlerts(snap(), state, at('10:29'), new Set())).toEqual([]);
    const a = dueAlerts(snap(), state, at('10:31'), new Set());
    expect(a).toEqual([{ key: `med:${DAY}:08:30`, kind: 'missed_medicine', vars: { name: 'Dadi', med: 'Metformin, Glimepiride', time: '08:30' } }]);
  });

  it('sends each alert once', () => {
    const first = dueAlerts(snap(), state, at('10:31'), new Set());
    expect(dueAlerts(snap(), state, at('11:00'), new Set(first.map((x) => x.key)))).toEqual([]);
  });

  it('is quiet when the dose was taken', () => {
    const s = snap({ doses: [{ name: 'Metformin', at: '08:30', s: 'taken' }] });
    expect(dueAlerts(s, state, at('12:00'), new Set())).toEqual([]);
  });

  it('warns about no check-in at 1 PM, using yesterday’s snapshot as no activity', () => {
    expect(kinds(dueAlerts(null, state, at('13:00'), new Set()))).toEqual(['no_checkin']);
    expect(kinds(dueAlerts(snap({ day: '2026-10-22', walkMin: 30 }), state, at('13:05'), new Set()))).toEqual(['no_checkin']);
    expect(kinds(dueAlerts(snap({ water: 1 }), state, at('13:05'), new Set()))).toEqual(['missed_medicine']);
  });

  it('sends the digest after 9 PM with refill and checkup notes', () => {
    const s = snap({ score: 72, walkMin: 15, water: 6, sugar: [{ v: 140, ctx: 'fasting', at: 0 }], meals: [{ slot: 'lunch', at: 0, kind: 'meal', foods: [], c: 50 }], doses: [{ name: 'Metformin', at: '08:30', s: 'taken' }] });
    const [d] = dueAlerts(s, state, at('21:00'), new Set());
    expect(d.vars).toMatchObject({ score: '72', meals: '1', meds: '1/1', walk: '15', sugar: '140', water: '6', notes: '💊 Metformin 6 · 🩺 a1c' });
    expect(alertText(d, 'en').title).toBe("📋 Dadi's day: 72/100");
  });
});

describe('instant alerts', () => {
  it('alerts for very low or very high sugar only', () => {
    expect(eventAlert('sugar', { v: 160 }, 'Dadi', 'e1')).toBeNull();
    expect(eventAlert('sugar', { v: 55 }, 'Dadi', 'e1')).toMatchObject({ kind: 'sugar_alert', vars: { level: 'low', v: '55' } });
    const hi = eventAlert('sugar', { v: 320 }, 'Dadi', 'e2')!;
    expect(alertText(hi, 'hi').title).toBe('⚠️ Dadi की शुगर बहुत ज़्यादा: 320');
  });

  it('describes unwell symptoms and SOS', () => {
    const u = eventAlert('unwell', { what: 'low' }, 'Dadi', 'e3')!;
    expect(alertText(u, 'en').body).toContain('low sugar signs');
    expect(alertText(eventAlert('sos', {}, 'Dadi', 'e4')!, 'en').title).toBe('🚨 Dadi opened SOS');
  });
});

describe('helpers', () => {
  it('reads the patient’s local clock', () => {
    expect(localNow(new Date(Date.UTC(2026, 9, 23, 18, 45)), 'Asia/Kolkata')).toEqual({ day: '2026-10-24', hhmm: '00:15' });
  });

  it('formats WhatsApp numbers', () => {
    expect(waNumber('098765 43210')).toBe('919876543210');
    expect(waNumber('+1 415 555 0100')).toBe('14155550100');
  });

  it('marks doses near now for one-tap medicine', () => {
    const meds = seed(DAY).profiles.me.meds; // 08:30 and 21:00
    expect(dosesNow(meds, '09:15')).toEqual([0]);
    expect(dosesNow(meds, '14:00')).toEqual([]);
    expect(dosesNow(meds, '20:00')).toEqual([1]);
  });
});

describe('snapshot', () => {
  it('names foods and sorts doses by time', () => {
    const p = seed(DAY).profiles.papa;
    const s = buildSnapshot(p, DAY, 5);
    expect(s.meals[0].foods[0]).toMatchObject({ en: expect.any(String), hi: expect.any(String), q: 2 });
    expect(s.doses).toEqual([{ name: 'Glimepiride', at: '08:30', s: 'taken' }]);
    expect(s.sugar[0].v).toBe(148);
    const c = buildCareState(p, 'Papa', 'en', DAY);
    expect(c.week).toHaveLength(6);
    expect(c.low).toEqual([]);
  });
});

describe('caregiver view', () => {
  const ms = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(2026, 9, 23, h, m);
    return d.getTime();
  };
  const min = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);
  const noState: CareState = { name: 'Dadi', lang: 'hi', streak: 0, low: [], checkupsDue: [], week: [] };

  it('is green when everything is fine', () => {
    const s = snap({ doses: [{ name: 'Metformin', at: '08:30', s: 'taken' }], sugar: [{ v: 120, ctx: 'fasting', at: ms('07:30') }] });
    expect(careStatus(s, noState, [], DAY, min('12:00'))).toEqual({ level: 'green', items: [] });
  });

  it('puts unwell and dangerous sugar first, then missed doses', () => {
    const s = snap({ sugar: [{ v: 320, ctx: 'random', at: ms('11:00') }] });
    const st = careStatus(s, state, [{ id: 'e', kind: 'unwell', data: {}, at: new Date(ms('11:30')).toISOString() }], DAY, min('11:45'));
    expect(st.level).toBe('red');
    expect(st.items.map((i) => i.key)).toEqual(['atUnwell', 'atSugarHigh', 'atDoseLate', 'atDoseLate', 'atRefill', 'atCheckup']);
  });

  it('is grey before 1 PM with no update, amber after', () => {
    expect(careStatus(null, noState, [], DAY, min('10:00')).level).toBe('grey');
    expect(careStatus(null, noState, [], DAY, min('13:00')).items[0].key).toBe('atNoUpdate');
  });

  it('orders the day by time', () => {
    const s = snap({
      doses: [{ name: 'Metformin', at: '08:30', s: 'taken' }, { name: 'Metformin', at: '21:00', s: null }],
      meals: [{ slot: 'lunch', at: ms('13:10'), kind: 'meal', foods: [], c: 50 }],
      sugar: [{ v: 150, ctx: 'fasting', at: ms('07:15') }],
    });
    const t = timeline(s, [], DAY, min('14:00'));
    expect(t.map((i) => `${i.time} ${i.type}`)).toEqual(['07:15 sugar', '08:30 dose', '13:10 meal', '21:00 dose']);
    expect(t[1]).toMatchObject({ view: 'taken' });
    expect(t[3]).toMatchObject({ view: 'due' });
  });

  it('adds today to the week chart', () => {
    const st = { ...noState, week: [{ date: '2026-10-22', score: 70, sugar: [], medTaken: 2, medTotal: 2, walkMin: 10 }] };
    expect(weekScores(snap({ score: 40 }), st, DAY)).toEqual([{ date: '2026-10-22', score: 70 }, { date: DAY, score: 40 }]);
  });
});
