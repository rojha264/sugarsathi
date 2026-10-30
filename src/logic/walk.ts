export const WALK_MIN = 5;
export const WALK_MAX = 60;
export const WALK_STEP = 5;
export const WALK_DEFAULT = 10;
export const WALK_PRESETS = [10, 15, 20, 30];
/** Rough steps per minute of brisk walking, used only without a step sensor. */
export const STEPS_PER_MIN = 100;

export type Cheer = 'cheer0' | 'cheer25' | 'cheer50' | 'cheer75' | 'cheerLast';

/**
 * Motivation for where the walker is. `leftMin` makes "last minute" win
 * over the 75% message on short walks.
 */
export function cheerFor(progress: number, leftMin: number): Cheer {
  if (progress > 0 && leftMin <= 1) return 'cheerLast';
  if (progress >= 0.75) return 'cheer75';
  if (progress >= 0.5) return 'cheer50';
  if (progress >= 0.25) return 'cheer25';
  return 'cheer0';
}

/** 125 → "2:05". */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Whole minutes to credit when a walk is stopped early (at least 1 to count). */
export function creditMinutes(elapsedMin: number): number {
  return elapsedMin >= 1 ? Math.floor(elapsedMin) : 0;
}
