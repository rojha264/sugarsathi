import { programDay, PROGRAM_DAYS } from './program';

/**
 * Where a patient is in the business funnel. One stage at a time, in priority order:
 * subscriber (active paid plan) > waiting (plan not shared yet) > trial (14 days running) >
 * ended (trial over or subscription lapsed, not paying) > none (joined before trials existed).
 */
export type Stage = 'subscriber' | 'waiting' | 'trial' | 'ended' | 'none';
export const STAGES: Stage[] = ['waiting', 'trial', 'ended', 'subscriber', 'none'];
/** Trials ending within this many days are flagged in the admin panel. */
export const TRIAL_ENDING_DAYS = 3;
/** Subscriptions ending within this many days are flagged for renewal. */
export const RENEWAL_DUE_DAYS = 7;

export type EnrollmentLite = { status: string; startsOn: string } | null;

export function stageOf(e: EnrollmentLite, paidActive: boolean, everPaid: boolean): Stage {
  if (paidActive) return 'subscriber';
  if (e?.status === 'pending_review') return 'waiting';
  if (e?.status === 'active') return 'trial';
  if (e || everPaid) return 'ended';
  return 'none';
}

/** Trial day (1–14), days left after today (0 = last day) and the last day (YYYY-MM-DD). */
export function trialInfo(startsOn: string, today: string) {
  const day = programDay(startsOn, today);
  const end = new Date(Date.parse(`${startsOn}T00:00:00Z`) + (PROGRAM_DAYS - 1) * 86400_000).toISOString().slice(0, 10);
  return { day, daysLeft: Math.max(0, PROGRAM_DAYS - day), endsOn: end };
}

/** Whole days from now until a subscription ends (0 = ends today). */
export const daysUntil = (endsAt: Date | string, now = Date.now()) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 86400_000));
