import { CHECKIN_BY, MISSED_AFTER_MIN, type CareState, type SnapDose, type Snapshot } from '@shared/family';
import type { TextKey } from '@/i18n/strings';
import { localDate } from './ids';
import { sugarStatus, type SugarLevel } from './sugar';

export type CareEvent = { id: string; kind: string; data: Record<string, unknown>; at: string };
export type CareLevel = 'red' | 'amber' | 'green' | 'grey';
export type Attention = { level: 'red' | 'amber'; icon: string; key: TextKey; vars: Record<string, string | number> };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export type DoseView = 'taken' | 'skipped' | 'late' | 'due';
export const doseView = (d: SnapDose, nowMin: number): DoseView =>
  d.s === 'taken' ? 'taken' : d.s === 'skipped' ? 'skipped' : nowMin >= toMin(d.at) + MISSED_AFTER_MIN ? 'late' : 'due';

/** Today's snapshot, or null when the latest one is from an earlier day. */
export const todayOf = (snap: Snapshot | null, today: string) => (snap && snap.day === today ? snap : null);

/**
 * One-line verdict for a caregiver plus what needs attention, most urgent first:
 * red = act now (unwell, SOS, dangerous sugar); amber = check in (missed dose, high sugar, no update, refill, checkup).
 */
export function careStatus(snap: Snapshot | null, state: CareState | null, events: CareEvent[], today: string, nowMin: number): { level: CareLevel; items: Attention[] } {
  const items: Attention[] = [];
  const day = todayOf(snap, today);
  for (const e of events) {
    const at = Date.parse(e.at);
    if (localDate(new Date(at)) !== today) continue;
    if (e.kind === 'sos') items.push({ level: 'red', icon: '🚨', key: 'atSos', vars: { t: clock(at) } });
    else if (e.kind === 'unwell') items.push({ level: 'red', icon: '😟', key: 'atUnwell', vars: { t: clock(at) } });
  }
  for (const r of day?.sugar ?? []) {
    const s = sugarStatus(r.v, r.ctx);
    if (s.l === 'r') items.push({ level: 'red', icon: '🩸', key: r.v < 70 ? 'atSugarLow' : 'atSugarHigh', vars: { v: r.v, t: clock(r.at) } });
    else if (s.l === 'a') items.push({ level: 'amber', icon: '🩸', key: 'atSugarHigh', vars: { v: r.v, t: clock(r.at) } });
  }
  for (const d of day?.doses ?? []) {
    const v = doseView(d, nowMin);
    if (v === 'late') items.push({ level: 'amber', icon: '💊', key: 'atDoseLate', vars: { name: d.name, t: d.at } });
    if (v === 'skipped') items.push({ level: 'amber', icon: '💊', key: 'atDoseSkipped', vars: { name: d.name, t: d.at } });
  }
  if (!day && nowMin >= toMin(CHECKIN_BY)) items.push({ level: 'amber', icon: '👋', key: 'atNoUpdate', vars: {} });
  for (const l of state?.low ?? []) items.push({ level: 'amber', icon: '🛒', key: 'atRefill', vars: { name: l.name, d: l.days } });
  if (state?.checkupsDue.length) items.push({ level: 'amber', icon: '🩺', key: 'atCheckup', vars: { n: state.checkupsDue.length } });

  items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'red' ? -1 : 1));
  const level: CareLevel = items.some((i) => i.level === 'red') ? 'red' : items.length ? 'amber' : day ? 'green' : 'grey';
  return { level, items };
}

export type TimelineItem =
  | { type: 'dose'; min: number; time: string; name: string; view: DoseView }
  | { type: 'meal'; min: number; time: string; slot: Snapshot['meals'][number]['slot']; kind: Snapshot['meals'][number]['kind']; foods: Snapshot['meals'][number]['foods']; c: number }
  | { type: 'sugar'; min: number; time: string; v: number; ctx: Snapshot['sugar'][number]['ctx']; level: SugarLevel }
  | { type: 'event'; min: number; time: string; kind: string; v?: number };

/** The day in time order: doses at their set time, meals and readings when logged, alerts when sent. */
export function timeline(snap: Snapshot | null, events: CareEvent[], today: string, nowMin: number): TimelineItem[] {
  const day = todayOf(snap, today);
  const at = (ms: number) => {
    const d = new Date(ms);
    return { min: d.getHours() * 60 + d.getMinutes(), time: clock(ms) };
  };
  const items: TimelineItem[] = [
    ...(day?.doses ?? []).map((d) => ({ type: 'dose' as const, min: toMin(d.at), time: d.at, name: d.name, view: doseView(d, nowMin) })),
    ...(day?.meals ?? []).map((m) => ({ type: 'meal' as const, ...at(m.at), slot: m.slot, kind: m.kind, foods: m.foods, c: m.c })),
    ...(day?.sugar ?? []).map((r) => ({ type: 'sugar' as const, ...at(r.at), v: r.v, ctx: r.ctx, level: sugarStatus(r.v, r.ctx).l })),
    ...events
      .filter((e) => localDate(new Date(e.at)) === today && e.kind !== 'sugar')
      .map((e) => ({ type: 'event' as const, ...at(Date.parse(e.at)), kind: e.kind })),
  ];
  return items.sort((a, b) => a.min - b.min);
}

/** Score for the bar chart: the week from the care state plus today. */
export function weekScores(snap: Snapshot | null, state: CareState | null, today: string): { date: string; score: number }[] {
  const past = (state?.week ?? []).filter((d) => d.date !== today).map((d) => ({ date: d.date, score: d.score }));
  const now = todayOf(snap, today);
  return [...past, ...(now ? [{ date: today, score: now.score }] : [])].slice(-7);
}
