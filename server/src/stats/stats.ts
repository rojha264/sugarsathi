import type { PrismaClient } from '@prisma/client';

import { estimateA1c } from '@shared/a1c';

const DAY = 86400_000;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Local YYYY-MM-DD n days before `now` (patients are in India; one fixed zone keeps admin filters simple). */
function dateBefore(now: Date, n: number, tz = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(now.getTime() - n * DAY));
}

/**
 * Rolls a patient's last 30 days into PatientStats, which the admin filters on
 * (sugar ranges, eA1c, adherence). Called after each sync and by the nightly job.
 */
export async function recomputeStats(db: PrismaClient, patientId: string, now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);
  const [readings, doses, meds, activity, lastMeal, weight, bp] = await Promise.all([
    db.sugarReading.findMany({ where: { patientId, deletedAt: null, at: { gte: since30 } }, orderBy: { at: 'asc' } }),
    db.doseLog.findMany({ where: { patientId, date: { gte: dateBefore(now, 7) } } }),
    db.medication.count({ where: { patientId, deletedAt: null } }),
    db.dailyActivity.findMany({ where: { patientId, date: { gte: dateBefore(now, 7) } } }),
    db.meal.findFirst({ where: { patientId, deletedAt: null }, orderBy: { at: 'desc' }, select: { at: true } }),
    db.vital.findFirst({ where: { patientId, kind: 'weight', deletedAt: null }, orderBy: { at: 'desc' } }),
    db.vital.findFirst({ where: { patientId, kind: 'bp', deletedAt: null }, orderBy: { at: 'desc' } }),
  ]);
  const v = (xs: typeof readings) => xs.map((r) => r.value);
  const r7 = readings.filter((r) => r.at >= since7);
  const last = readings.at(-1);
  const inRange = readings.length ? Math.round((readings.filter((r) => r.value >= 70 && r.value <= 180).length / readings.length) * 100) : null;
  const expectedDoses = meds * 7;
  const taken = doses.filter((d) => d.status === 'taken').length;
  const seen = [last?.at, lastMeal?.at, ...activity.map((a) => a.updatedAt)].filter(Boolean) as Date[];

  const data = {
    lastValue: last?.value ?? null,
    lastCtx: last?.ctx ?? null,
    lastAt: last?.at ?? null,
    avg7: avg(v(r7)),
    avg30: avg(v(readings)),
    fastingAvg7: avg(v(r7.filter((r) => r.ctx === 'fasting'))),
    fastingAvg30: avg(v(readings.filter((r) => r.ctx === 'fasting'))),
    afterAvg7: avg(v(r7.filter((r) => r.ctx === 'after'))),
    afterAvg30: avg(v(readings.filter((r) => r.ctx === 'after'))),
    readings30: readings.length,
    inRange30: inRange,
    lows30: readings.filter((r) => r.value < 70).length,
    ea1c: estimateA1c(v(readings)),
    medAdherence7: expectedDoses ? Math.min(100, Math.round((taken / expectedDoses) * 100)) : null,
    walkDays7: activity.filter((a) => a.walkMin >= 10).length,
    lastSeenAt: seen.length ? new Date(Math.max(...seen.map((d) => d.getTime()))) : null,
    weightKg: weight?.weightKg ?? null,
    bpSys: bp?.sys ?? null,
    bpDia: bp?.dia ?? null,
    vitalsAt: [weight?.at, bp?.at].filter((d): d is Date => !!d).reduce<Date | null>((a, d) => (!a || d > a ? d : a), null),
  };
  await db.patientStats.upsert({ where: { patientId }, create: { patientId, ...data }, update: data });
}
