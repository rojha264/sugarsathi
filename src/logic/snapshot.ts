import type { CareState, Snapshot } from '@shared/family';
import { FOOD_BY_ID } from '@/data/foods';
import type { Lang, Profile } from '@/types';
import { checkupsToNudge } from './checkups';
import { lowMeds } from './meds';
import { score } from './score';

/** Today's log in the shape caregivers see: food names, not ids, so old app versions and the server need no catalog. */
export function buildSnapshot(p: Profile, day: string, now = Date.now()): Snapshot {
  return {
    day,
    updatedAt: now,
    score: score(p, day),
    meals: p.meals.map((m) => ({
      slot: m.slot,
      at: m.createdAt,
      kind: m.kind ?? 'meal',
      c: m.c,
      foods: m.items.flatMap((it) => {
        const f = FOOD_BY_ID[it.id];
        return f ? [{ e: f.e, en: f.n.en, hi: f.n.hi, q: it.q }] : [];
      }),
    })),
    doses: [...p.meds].sort((a, b) => a.at.localeCompare(b.at)).map((m) => ({ name: m.n, at: m.at, s: m.s })),
    sugar: p.sugar.map((r) => ({ v: r.v, ctx: r.ctx, at: r.createdAt })),
    walkMin: p.walkMin,
    steps: p.steps,
    water: p.water,
  };
}

export function buildCareState(p: Profile, name: string, lang: Lang, day: string): CareState {
  return {
    name,
    lang,
    streak: p.streak,
    low: lowMeds(p.meds, p.stock),
    checkupsDue: checkupsToNudge(p.checkups, day).filter((c) => c.state === 'due').map((c) => c.id),
    week: p.days.slice(-7).map((d) => ({ date: d.date, score: d.score, sugar: d.sugar, medTaken: d.medTaken, medTotal: d.medTotal, walkMin: d.walkMin })),
  };
}
