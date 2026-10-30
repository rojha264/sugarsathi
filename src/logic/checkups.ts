import type { Checkup } from '@/types';
import { addDays, daysBetween } from './ids';

/**
 * Routine tests from the ADA / RSSDI care schedule: HbA1c every 3 months,
 * and a yearly dilated eye exam, foot exam and kidney (urine albumin) test.
 */
export const CHECKUPS: { id: Checkup; e: string; everyDays: number }[] = [
  { id: 'a1c', e: '🧪', everyDays: 90 },
  { id: 'eye', e: '👁️', everyDays: 365 },
  { id: 'foot', e: '🦶', everyDays: 365 },
  { id: 'kidney', e: '🫘', everyDays: 365 },
];

/** "Soon" this many days before the due date. */
export const SOON_DAYS = 14;

export type CheckupState = 'unknown' | 'due' | 'soon' | 'ok';
export type CheckupStatus = { id: Checkup; e: string; last?: string; due?: string; daysLeft?: number; state: CheckupState };

export function checkupStatus(id: Checkup, last: string | undefined, today: string): CheckupStatus {
  const c = CHECKUPS.find((x) => x.id === id)!;
  if (!last) return { id, e: c.e, state: 'unknown' };
  const due = addDays(last, c.everyDays);
  const daysLeft = daysBetween(today, due);
  const state = daysLeft <= 0 ? 'due' : daysLeft <= SOON_DAYS ? 'soon' : 'ok';
  return { id, e: c.e, last, due, daysLeft, state };
}

export const allCheckups = (done: Partial<Record<Checkup, string>>, today: string) =>
  CHECKUPS.map((c) => checkupStatus(c.id, done[c.id], today));

/** Checkups to nudge about on Today: overdue first, then never recorded. */
export function checkupsToNudge(done: Partial<Record<Checkup, string>>, today: string): CheckupStatus[] {
  const all = allCheckups(done, today);
  return [...all.filter((s) => s.state === 'due'), ...all.filter((s) => s.state === 'unknown')];
}

/** "Done N months ago" for people who remember roughly, not the exact date. */
export const monthsAgo = (today: string, months: number) => addDays(today, -Math.round(months * 30.4));
