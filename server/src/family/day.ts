import type { PrismaClient } from '@prisma/client';

import type { CareState, Snapshot } from '@shared/family';
import { localNow } from '@shared/family';

const DAY = 86400_000;

/** Start of the patient's local day as a Date. */
function dayStart(day: string, tz: string) {
  // Asia/Kolkata has no DST; other zones are close enough for a daily window.
  const offset = tz === 'Asia/Kolkata' ? 5.5 * 3600_000 : 0;
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

/**
 * The patient's day in the shape caregivers and alert rules use (see @shared/family),
 * built from the synced logs, plus slower-moving facts (streak, refill, checkups, week).
 */
export async function buildDay(db: PrismaClient, patientId: string, now = new Date()): Promise<{ snap: Snapshot; state: CareState; lastSeen: Date | null }> {
  const p = await db.patient.findUniqueOrThrow({ where: { userId: patientId }, include: { user: true, stats: true } });
  const { day } = localNow(now, p.tz);
  const from = dayStart(day, p.tz);
  const to = new Date(from.getTime() + DAY);
  const [foods, meals, readings, meds, doses, activity, week, checkups] = await Promise.all([
    db.food.findMany({ select: { id: true, emoji: true, nameEn: true, nameHi: true } }),
    db.meal.findMany({ where: { patientId, deletedAt: null, at: { gte: from, lt: to } }, orderBy: { at: 'asc' } }),
    db.sugarReading.findMany({ where: { patientId, deletedAt: null, at: { gte: from, lt: to } }, orderBy: { at: 'asc' } }),
    db.medication.findMany({ where: { patientId, deletedAt: null }, orderBy: { time: 'asc' } }),
    db.doseLog.findMany({ where: { patientId, date: day } }),
    db.dailyActivity.findUnique({ where: { id: `${patientId}:${day}` } }),
    db.dailyActivity.findMany({ where: { patientId, date: { lt: day } }, orderBy: { date: 'desc' }, take: 7 }),
    db.checkup.findMany({ where: { patientId } }),
  ]);
  const byId = new Map(foods.map((f) => [f.id, f]));
  const status = new Map(doses.map((d) => [d.medicationId, d.status]));
  const snap: Snapshot = {
    day,
    updatedAt: (p.stats?.lastSeenAt ?? now).getTime(),
    score: activity?.score ?? 0,
    meals: meals.map((m) => ({
      slot: m.slot as Snapshot['meals'][number]['slot'],
      at: m.at.getTime(),
      kind: m.kind as Snapshot['meals'][number]['kind'],
      c: Math.round(m.carbs),
      foods: (m.items as { id: string; q: number }[]).flatMap((it) => {
        const f = byId.get(it.id);
        return f ? [{ e: f.emoji, en: f.nameEn, hi: f.nameHi, q: it.q }] : [];
      }),
    })),
    doses: meds.map((m) => ({ name: m.name, at: m.time, s: (status.get(m.id) as 'taken' | 'skipped' | undefined) ?? null })),
    sugar: readings.map((r) => ({ v: r.value, ctx: r.ctx as 'fasting' | 'after' | 'random', at: r.at.getTime() })),
    walkMin: activity?.walkMin ?? 0,
    steps: activity?.steps ?? 0,
    water: activity?.water ?? 0,
  };
  // Days of tablets left = stock / doses per day of that medicine name.
  const perName = new Map<string, { left: number; perDay: number }>();
  for (const m of meds) {
    if (m.stock == null) continue;
    const k = m.name.trim().toLowerCase();
    const e = perName.get(k) ?? { left: m.stock, perDay: 0 };
    perName.set(k, { left: Math.min(e.left, m.stock), perDay: e.perDay + 1 });
  }
  const low = [...perName.entries()]
    .map(([k, v]) => ({ name: meds.find((m) => m.name.trim().toLowerCase() === k)!.name, left: v.left, days: Math.floor(v.left / Math.max(1, v.perDay)) }))
    .filter((l) => l.days <= 5);
  const due = { a1c: 90, eye: 365, foot: 365, kidney: 365 } as Record<string, number>;
  const checkupsDue = checkups.filter((c) => (now.getTime() - Date.parse(c.lastDone)) / DAY >= (due[c.kind] ?? 365)).map((c) => c.kind);
  const readingsByDay = new Map<string, number[]>();
  for (const r of await db.sugarReading.findMany({ where: { patientId, deletedAt: null, at: { gte: new Date(from.getTime() - 7 * DAY), lt: from } } })) {
    const d = localNow(r.at, p.tz).day;
    readingsByDay.set(d, [...(readingsByDay.get(d) ?? []), r.value]);
  }
  const takenByDay = await db.doseLog.groupBy({ by: ['date'], where: { patientId, status: 'taken', date: { in: week.map((w) => w.date) } }, _count: true });
  const state: CareState = {
    name: p.user.name,
    lang: p.user.lang === 'hi' ? 'hi' : 'en',
    streak: week.filter((w) => (w.score ?? 0) >= 60).length,
    low,
    checkupsDue,
    week: week
      .reverse()
      .map((w) => ({
        date: w.date,
        score: w.score ?? 0,
        sugar: readingsByDay.get(w.date) ?? [],
        medTaken: takenByDay.find((t) => t.date === w.date)?._count ?? 0,
        medTotal: meds.length,
        walkMin: w.walkMin,
      })),
  };
  return { snap, state, lastSeen: p.stats?.lastSeenAt ?? null };
}
