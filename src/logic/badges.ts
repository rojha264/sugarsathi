import type { Profile } from '@/types';

/** A walk of at least this long counts toward the walker badge. */
const WALK_DAY_MIN = 10;

export type BadgeId = 'starter' | 'firstCheck' | 'tenChecks' | 'walker' | 'fighter' | 'learner' | 'champion' | 'star60' | 'legend';
export type Badge = { id: BadgeId; icon: string; earned: boolean; /** How many more to go (days, checks, walks…), for the "next badge" hint. */ left: number };

/** What the badges count, from the profile (history plus today). */
export function badgeStats(p: Pick<Profile, 'days' | 'sugar' | 'walkMin'>, streak: number, savedReels: number) {
  return {
    readings: p.days.reduce((n, d) => n + d.sugar.length, 0) + p.sugar.length,
    walkDays: p.days.filter((d) => d.walkMin >= WALK_DAY_MIN).length + (p.walkMin >= WALK_DAY_MIN ? 1 : 0),
    streak,
    savedReels,
  };
}

/** Small wins first (first check, a week of walks), then streaks up to 100 days: there is always a next badge. */
export function badges(s: ReturnType<typeof badgeStats>): Badge[] {
  const b = (id: BadgeId, icon: string, have: number, need: number): Badge => ({ id, icon, earned: have >= need, left: Math.max(0, need - have) });
  return [
    { id: 'starter', icon: '⭐', earned: true, left: 0 },
    b('firstCheck', '🩸', s.readings, 1),
    b('tenChecks', '🔟', s.readings, 10),
    b('walker', '🚶', s.walkDays, 7),
    b('fighter', '🥈', s.streak, 7),
    b('learner', '🎬', s.savedReels, 1),
    b('champion', '🏆', s.streak, 30),
    b('star60', '🎖️', s.streak, 60),
    b('legend', '💎', s.streak, 100),
  ];
}

/** The badge to aim for next: the locked one closest to being earned. */
export const nextBadge = (list: Badge[]) => list.filter((x) => !x.earned).sort((a, b) => a.left - b.left)[0] ?? null;
