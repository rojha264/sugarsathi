import type { AppState, DayRecord, Profile } from '@/types';
import { addDays, dayDate, daysBetween } from './ids';
import { fractions, score, STREAK_MIN } from './score';
import { dayTotals } from './targets';

export const KEEP_DAYS = 30;
const LATE_KEEP_DAYS = 4;

export function closeDay(p: Profile, date: string): DayRecord {
  const f = fractions(p, date);
  return {
    date,
    score: score(p, date),
    walkMin: p.walkMin,
    medTaken: f.taken,
    medTotal: f.total,
    sugar: p.sugar.map((s) => s.v),
    drinks: dayTotals(p).std,
    treats: p.meals.filter((m) => m.kind === 'treat').length,
    water: p.water,
  };
}

/** Week number (Monday start), for one grace day per week. */
export const weekOf = (date: string) => Math.floor(daysBetween('2024-01-01', date) / 7);

function emptyDay(date: string, medTotal: number): DayRecord {
  return { date, score: 0, walkMin: 0, medTaken: 0, medTotal, sugar: [], drinks: 0, treats: 0 };
}

/**
 * Moves each profile's "today" into history when the calendar date changes.
 * Missed days are recorded as zero days. One low or missed day a week is a
 * "grace day" that keeps the streak (no shaming for a single off day).
 */
export function rollover(state: AppState, today: string): AppState {
  const gap = daysBetween(state.day, today);
  if (gap <= 0) return state;
  const profiles: Record<string, Profile> = {};
  for (const id in state.profiles) {
    const p = state.profiles[id];
    const closed = closeDay(p, state.day);
    const days = [...p.days, closed];
    // Zero days for the missed dates, counted back from yesterday so the kept history is the most recent.
    for (let i = Math.max(1, gap - KEEP_DAYS); i < gap; i++) days.push(emptyDay(addDays(state.day, i), p.meds.length));
    const good = closed.score >= STREAK_MIN;
    const badDays = (good ? 0 : 1) + (gap - 1);
    const badDate = good ? addDays(state.day, 1) : state.day;
    let streak = 0;
    let graceWeek = p.graceWeek;
    if (badDays === 0) streak = p.streak + 1;
    else if (badDays === 1 && p.streak > 0 && p.graceWeek !== weekOf(badDate)) {
      streak = p.streak + (good ? 1 : 0);
      graceWeek = weekOf(badDate);
      const rec = days.find((d) => d.date === badDate);
      if (rec) rec.grace = true;
    }
    profiles[id] = {
      ...p,
      days: days.slice(-KEEP_DAYS),
      streak,
      graceWeek,
      water: 0,
      // Late entries only need to stay until they have synced; a few days is plenty.
      late: p.late && {
        meals: p.late.meals.filter((m) => m.createdAt > dayDate(addDays(today, -LATE_KEEP_DAYS)).getTime()),
        sugar: p.late.sugar.filter((r) => r.createdAt > dayDate(addDays(today, -LATE_KEEP_DAYS)).getTime()),
      },
      meals: [],
      sugar: [],
      walkMin: 0,
      steps: 0,
      meds: p.meds.map((m) => ({ ...m, s: null })),
    };
  }
  return { ...state, day: today, profiles };
}
