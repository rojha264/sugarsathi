import type { Med, MedStatus, MedTime } from '@/types';

/** Warn when this many days of tablets or fewer are left. */
export const REFILL_DAYS = 5;

/** Default dose times; morning follows the reminder time chosen at setup. */
export const defaultMedTime = (t: MedTime, morning: string) => (t === 'morning' ? morning : '21:00');

/** Doses of the same medicine share one tablet count ("Metformin" morning + night). */
export const medKey = (name: string) => name.trim().toLowerCase();

export const dosesPerDay = (meds: Med[], key: string) => meds.filter((m) => medKey(m.n) === key).length;

/** Whole days of tablets left, or null when the count is not tracked. */
export function daysLeft(meds: Med[], stock: Record<string, number>, key: string): number | null {
  if (stock[key] === undefined) return null;
  return Math.floor(stock[key] / Math.max(1, dosesPerDay(meds, key)));
}

/** Medicines running out, once per name. */
export function lowMeds(meds: Med[], stock: Record<string, number>): { name: string; left: number; days: number }[] {
  const seen = new Set<string>();
  const out: { name: string; left: number; days: number }[] = [];
  for (const m of meds) {
    const key = medKey(m.n);
    if (seen.has(key)) continue;
    seen.add(key);
    const days = daysLeft(meds, stock, key);
    if (days !== null && days <= REFILL_DAYS) out.push({ name: m.n, left: stock[key], days });
  }
  return out;
}

/** Tablet count after a dose is marked: taking uses one, un-taking gives it back. */
export function afterDose(stock: Record<string, number>, name: string, prev: MedStatus, next: MedStatus): Record<string, number> {
  const key = medKey(name);
  const delta = (next === 'taken' ? 1 : 0) - (prev === 'taken' ? 1 : 0);
  if (stock[key] === undefined || delta === 0) return stock;
  return { ...stock, [key]: Math.max(0, stock[key] - delta) };
}

/** Distinct dose times with the medicines due at each, earliest first. */
export function doseTimes(meds: Med[]): { at: string; names: string[] }[] {
  const by = new Map<string, string[]>();
  for (const m of meds) {
    const names = by.get(m.at) ?? [];
    if (!names.includes(m.n)) names.push(m.n);
    by.set(m.at, names);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([at, names]) => ({ at, names }));
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Untaken doses within `windowMin` of now, for the one-tap "Took medicine" button. */
export function dosesNow(meds: Med[], hhmm: string, windowMin = 180): number[] {
  const now = toMin(hhmm);
  return meds.flatMap((m, i) => (m.s !== 'taken' && Math.abs(toMin(m.at) - now) <= windowMin ? [i] : []));
}
