import type { AppState, Setup } from '@/types';

const APP = 'glucobuddy';
export const BACKUP_VERSION = 1;

/** Bump when the consent text changes in a way users must agree to again. */
export const CONSENT_VERSION = 2;

export const needsConsent = (setup: Setup) => (setup.consentVer ?? 0) < CONSENT_VERSION;

export function encodeBackup(state: AppState, now = Date.now()): string {
  return JSON.stringify({ app: APP, v: BACKUP_VERSION, at: now, state });
}

/** The saved state from a backup file, or null when the file is not a Sugar Saathi (formerly GlucoBuddy) backup. */
export function decodeBackup(text: string): AppState | null {
  try {
    const b = JSON.parse(text);
    const s = b?.state;
    if (b?.app !== APP || typeof b.v !== 'number' || b.v > BACKUP_VERSION) return null;
    if (!s?.setup || !s.profiles?.me || typeof s.day !== 'string') return null;
    return s as AppState;
  } catch {
    return null;
  }
}
