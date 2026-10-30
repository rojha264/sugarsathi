import type { Prisma, PrismaClient } from '@prisma/client';

import { PROGRAM_DAYS } from '@shared/program';
import type { Stage } from '@shared/lifecycle';
import { searchRank } from '@shared/search';

/** Saved and ad-hoc patient filters (Patients table, segments, notification audiences). */
export type PatientFilter = {
  q?: string;
  /** Which average the sugar range applies to. */
  ctx?: 'fasting' | 'after' | 'any';
  days?: 7 | 30;
  sugarMin?: number;
  sugarMax?: number;
  a1cMin?: number;
  a1cMax?: number;
  type?: string;
  ageGroup?: string;
  diet?: string;
  tier?: string;
  dietitianId?: string;
  /** low = any low in 30 days; inactive = nothing logged for 3 days; poorMeds = adherence < 70 %. */
  attention?: 'low' | 'inactive' | 'poorMeds' | 'high';
  /** Business stage: waiting | trial | ended | subscriber | none. */
  lifecycle?: Stage;
  /** Trials ending within this many days (with lifecycle=trial). */
  trialEndsIn?: number;
  /** Paid plans ending within this many days (with lifecycle=subscriber). */
  renewalIn?: number;
};

const DAY = 86400_000;
const IST_MS = 330 * 60_000;
const ymd = (days: number) => new Date(Date.now() + IST_MS + days * DAY).toISOString().slice(0, 10);
/** An active paid subscription right now. */
export const paidNow = (): Prisma.SubscriptionWhereInput => ({ status: 'active', endsAt: { gt: new Date() }, plan: { priceInr: { gt: 0 } } });

/** Where-clause for one lifecycle stage (same priority order as stageOf in @shared/lifecycle). */
export function stageWhere(stage: Stage, f: Pick<PatientFilter, 'trialEndsIn' | 'renewalIn'> = {}): Prisma.PatientWhereInput {
  const notPaid: Prisma.PatientWhereInput = { subscriptions: { none: paidNow() } };
  switch (stage) {
    case 'subscriber': {
      const within = num(f.renewalIn);
      return { subscriptions: { some: { ...paidNow(), ...(within !== undefined ? { endsAt: { gt: new Date(), lte: new Date(Date.now() + within * DAY) } } : {}) } } };
    }
    case 'waiting':
      return { ...notPaid, enrollments: { some: { status: 'pending_review' } } };
    case 'trial': {
      // Trial ends on startsOn + 13 days; "ends within N days" ⇔ startsOn ≤ today − (13 − N).
      const within = num(f.trialEndsIn);
      return { ...notPaid, enrollments: { some: { status: 'active', ...(within !== undefined ? { startsOn: { lte: ymd(-(PROGRAM_DAYS - 1 - within)) } } : {}) } } };
    }
    case 'ended':
      return {
        ...notPaid,
        enrollments: { none: { status: { in: ['pending_review', 'active'] } } },
        OR: [{ enrollments: { some: {} } }, { subscriptions: { some: { plan: { priceInr: { gt: 0 } } } } }],
      };
    case 'none':
      return { ...notPaid, enrollments: { none: {} }, subscriptions: { none: { plan: { priceInr: { gt: 0 } } } } };
  }
}

const STAT: Record<string, Record<number, keyof Prisma.PatientStatsWhereInput>> = {
  fasting: { 7: 'fastingAvg7', 30: 'fastingAvg30' },
  after: { 7: 'afterAvg7', 30: 'afterAvg30' },
  any: { 7: 'avg7', 30: 'avg30' },
};

const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));

/** Builds the Prisma where-clause; `scope` limits dietitians to their own patients. */
export function patientWhere(f: PatientFilter, scope: Prisma.PatientWhereInput): Prisma.PatientWhereInput {
  const stats: Prisma.PatientStatsWhereInput = {};
  const field = STAT[f.ctx ?? 'any'][Number(f.days) === 30 ? 30 : 7];
  const lo = num(f.sugarMin);
  const hi = num(f.sugarMax);
  if (lo !== undefined || hi !== undefined) Object.assign(stats, { [field]: { ...(lo !== undefined ? { gte: lo } : {}), ...(hi !== undefined ? { lte: hi } : {}) } });
  const alo = num(f.a1cMin);
  const ahi = num(f.a1cMax);
  if (alo !== undefined || ahi !== undefined) stats.ea1c = { ...(alo !== undefined ? { gte: alo } : {}), ...(ahi !== undefined ? { lte: ahi } : {}) };
  if (f.attention === 'low') stats.lows30 = { gt: 0 };
  if (f.attention === 'high') stats.avg7 = { gt: 180 };
  if (f.attention === 'poorMeds') stats.medAdherence7 = { lt: 70 };
  if (f.attention === 'inactive') stats.OR = [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 3 * 86400_000) } }];
  return {
    ...scope,
    type: f.type ? f.type : { not: 'care' },
    ...(f.ageGroup ? { ageGroup: f.ageGroup } : {}),
    ...(f.diet ? { diet: f.diet } : {}),
    ...(f.tier ? { tier: f.tier as Prisma.EnumTierFilter['equals'] } : {}),
    ...(f.dietitianId ? { assignedDietitianId: f.dietitianId === 'none' ? null : f.dietitianId } : {}),
    ...(f.q ? { user: { OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { phone: { contains: f.q.replace(/\s+/g, '') } }] } } : {}),
    ...(Object.keys(stats).length ? { stats } : {}),
    ...(f.lifecycle ? { AND: [stageWhere(f.lifecycle, f)] } : {}),
  };
}

/** Most patients one name search looks through (a dietitian's list, or the whole clinic for the owner). */
const NAME_SEARCH_MAX = 20000;

/**
 * Same as patientWhere, but a name search also works across scripts and spellings
 * ("rakesh" finds राकेश, "राकेश" finds Rakesh). Phone numbers keep the plain "contains" match.
 */
export async function patientWhereSearch(db: PrismaClient, f: PatientFilter, scope: Prisma.PatientWhereInput): Promise<Prisma.PatientWhereInput> {
  const q = f.q?.trim();
  if (!q || /^[+\d\s]+$/.test(q)) return patientWhere(f, scope);
  const rows = await db.patient.findMany({ where: { ...scope }, select: { userId: true, user: { select: { name: true, phone: true } } }, take: NAME_SEARCH_MAX });
  const ids = searchRank(rows, q, (r) => [r.user.name, r.user.phone]).map((r) => r.userId);
  return { ...patientWhere({ ...f, q: undefined }, scope), userId: { in: ids } };
}
