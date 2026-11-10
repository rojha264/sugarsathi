import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Prisma, Tier } from '@prisma/client';

import { eats, type Diet } from '@shared/diet';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { buildDay } from '../family/day';
import { ProgramService } from '../program/program.service';
import { daysUntil, RENEWAL_DUE_DAYS, stageOf, STAGES, trialInfo, TRIAL_ENDING_DAYS } from '@shared/lifecycle';
import { patientWhereSearch, stageWhere, type PatientFilter } from './patient-filter';

const DAY = 86400_000;
const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Stage plus what the admin needs to act on it: trial day and days left, or plan and days to renewal. */
export function lifecycleOf(
  e: { status: string; startsOn: string; riskReasons?: string[]; result?: unknown } | null,
  sub: { id: string; status: string; endsAt: Date; amountInr: number | null; plan: { name: string; priceInr: number } } | null,
) {
  const paidActive = !!sub && sub.status === 'active' && sub.endsAt > new Date();
  const stage = stageOf(e, paidActive, !!sub);
  return {
    stage,
    trial: e && e.status === 'active' ? trialInfo(e.startsOn, todayIst()) : null,
    trialEnded: e && ['completed', 'dropped', 'converted'].includes(e.status) ? { status: e.status, improved: !!(e.result as { improved?: boolean } | null)?.improved } : null,
    riskReasons: e?.status === 'pending_review' ? e.riskReasons ?? [] : [],
    subscription: sub ? { id: sub.id, plan: sub.plan.name, endsAt: sub.endsAt, daysLeft: daysUntil(sub.endsAt), active: paidActive, amountInr: sub.amountInr ?? sub.plan.priceInr } : null,
  };
}
const range = (from?: string, to?: string, days = 30) => ({
  gte: from ? new Date(from) : new Date(Date.now() - days * DAY),
  lte: to ? new Date(to) : new Date(),
});

@ApiTags('patients (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class PatientsController {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly program: ProgramService,
  ) {}

  /** The main table: filter by sugar range (fasting / after / any, 7 or 30 days), eA1c, type, tier, dietitian, attention. */
  @Get('patients')
  async list(@CurrentUser() u: AuthUser, @Query() q: PatientFilter & { page?: string; pageSize?: string; sort?: string; order?: string }) {
    const where = await patientWhereSearch(this.db, q, this.access.patientScope(u));
    const pageSize = Math.min(Number(q.pageSize) || 20, 200);
    const skip = ((Number(q.page) || 1) - 1) * pageSize;
    const dir = q.order === 'asc' ? 'asc' : 'desc';
    const statSort = ['avg7', 'fastingAvg7', 'afterAvg7', 'ea1c', 'medAdherence7', 'lastSeenAt', 'inRange30'];
    const orderBy: Prisma.PatientOrderByWithRelationInput =
      q.sort && statSort.includes(q.sort) ? { stats: { [q.sort]: { sort: dir, nulls: 'last' } } } : q.sort === 'name' ? { user: { name: dir } } : { stats: { avg7: { sort: 'desc', nulls: 'last' } } };
    const [rows, total] = await Promise.all([
      this.db.patient.findMany({
        where, skip, take: pageSize, orderBy,
        include: {
          user: { select: { name: true, phone: true, lang: true } }, stats: true, assignedDietitian: { select: { id: true, name: true } },
          enrollments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, startsOn: true, riskReasons: true, result: true } },
          subscriptions: { where: { plan: { priceInr: { gt: 0 } } }, orderBy: { endsAt: 'desc' }, take: 1, include: { plan: { select: { name: true, priceInr: true } } } },
        },
      }),
      this.db.patient.count({ where }),
    ]);
    return {
      total,
      data: rows.map((p) => ({
        id: p.userId, name: p.user.name, phone: p.user.phone, lang: p.user.lang, type: p.type, ageGroup: p.ageGroup, diet: p.diet,
        tier: p.tier, dietitian: p.assignedDietitian, stats: p.stats, lifecycle: lifecycleOf(p.enrollments[0] ?? null, p.subscriptions[0] ?? null),
      })),
    };
  }

  /** Tab counts for the Patients page, plus the two things that need action soon. */
  @Get('patients/lifecycle')
  async lifecycle(@CurrentUser() u: AuthUser) {
    const scope = { ...this.access.patientScope(u), type: { not: 'care' } };
    const [counts, trialsEnding, renewalsDue] = await Promise.all([
      Promise.all(STAGES.map((st) => this.db.patient.count({ where: { ...scope, AND: [stageWhere(st)] } }))),
      this.db.patient.count({ where: { ...scope, AND: [stageWhere('trial', { trialEndsIn: TRIAL_ENDING_DAYS })] } }),
      this.db.patient.count({ where: { ...scope, AND: [stageWhere('subscriber', { renewalIn: RENEWAL_DUE_DAYS })] } }),
    ]);
    return { counts: Object.fromEntries(STAGES.map((st, i) => [st, counts[i]])), trialsEnding, renewalsDue, trialEndingDays: TRIAL_ENDING_DAYS, renewalDueDays: RENEWAL_DUE_DAYS };
  }

  @Get('patients/:id')
  async detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    const [p, day] = await Promise.all([
      this.db.patient.findUniqueOrThrow({
        where: { userId: id },
        include: {
          user: { select: { name: true, phone: true, lang: true, createdAt: true, lastActiveAt: true } },
          stats: true,
          assignedDietitian: { select: { id: true, name: true } },
          medications: { where: { deletedAt: null }, orderBy: { time: 'asc' } },
          checkups: true,
          circle: { include: { members: { select: { name: true, status: true } } } },
          subscriptions: { orderBy: { endsAt: 'desc' }, take: 1, include: { plan: true } },
          enrollments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, startsOn: true, riskReasons: true, result: true } },
          // Meal menu source for the header: custom list, else the active diet plan.
          _count: { select: { foodPicks: true, dietPlans: { where: { status: 'active' } } } },
        },
      }),
      buildDay(this.db, id),
    ]);
    const paidSub = p.subscriptions.find((x) => x.plan.priceInr > 0) ?? null;
    return { ...p, today: day.snap, care: day.state, lifecycle: lifecycleOf(p.enrollments[0] ?? null, paidSub) };
  }

  @Get('patients/:id/readings')
  async readings(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    await this.access.assertStaffCanSee(u, id);
    return this.db.sugarReading.findMany({ where: { patientId: id, deletedAt: null, at: range(from, to) }, orderBy: { at: 'asc' } });
  }

  @Get('patients/:id/meals')
  async meals(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    await this.access.assertStaffCanSee(u, id);
    return this.db.meal.findMany({ where: { patientId: id, deletedAt: null, at: range(from, to, 7) }, orderBy: { at: 'desc' } });
  }

  @Get('patients/:id/activity')
  async activity(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    const [activity, doses] = await Promise.all([
      this.db.dailyActivity.findMany({ where: { patientId: id }, orderBy: { date: 'desc' }, take: 30 }),
      this.db.doseLog.findMany({ where: { patientId: id }, orderBy: { date: 'desc' }, take: 120, include: { medication: { select: { name: true, time: true } } } }),
    ]);
    return { activity, doses };
  }

  /** Targets, tier and (owner only) dietitian assignment. */
  @Patch('patients/:id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() b: { targetMealCarbs?: number; targetProtein?: number; targetFiber?: number; targetKcal?: number | null; targetMode?: string; tier?: Tier; tierUntil?: string | null; assignedDietitianId?: string | null },
  ) {
    await this.access.assertStaffCanSee(u, id);
    const { assignedDietitianId, tierUntil, ...rest } = b;
    return this.db.patient.update({
      where: { userId: id },
      data: {
        ...rest,
        ...(tierUntil !== undefined ? { tierUntil: tierUntil ? new Date(tierUntil) : null } : {}),
        ...(assignedDietitianId !== undefined && u.role === 'OWNER' ? { assignedDietitianId } : {}),
      },
    });
  }

  @Get('patients/:id/notes')
  async notes(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    return this.db.dietitianNote.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } });
  }

  @Post('patients/:id/notes')
  async addNote(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { text: string }) {
    await this.access.assertStaffCanSee(u, id);
    return this.db.dietitianNote.create({ data: { patientId: id, authorId: u.id, text: String(b.text ?? '').slice(0, 4000) } });
  }

  /** Bulk: assign a dietitian (owner) or apply a diet template to many patients. */
  @Post('patients/bulk')
  @HttpCode(200)
  async bulk(@CurrentUser() u: AuthUser, @Body() b: { ids: string[]; action: 'assign' | 'applyTemplate'; dietitianId?: string | null; templateId?: string }) {
    const ids = (await this.db.patient.findMany({ where: { userId: { in: b.ids ?? [] }, ...this.access.patientScope(u) }, select: { userId: true } })).map((p) => p.userId);
    if (b.action === 'assign' && u.role === 'OWNER') {
      await this.db.patient.updateMany({ where: { userId: { in: ids } }, data: { assignedDietitianId: b.dietitianId ?? null } });
    }
    if (b.action === 'applyTemplate' && b.templateId) {
      const t = await this.db.dietTemplate.findUniqueOrThrow({ where: { id: b.templateId }, include: { items: { include: { food: { select: { diet: true } } } } } });
      const diets = new Map((await this.db.patient.findMany({ where: { userId: { in: ids } }, select: { userId: true, diet: true } })).map((p) => [p.userId, p.diet as Diet]));
      let skipped = 0;
      for (const pid of ids) {
        // Each patient gets only the template foods they eat (a non-veg template on a vegetarian drops the meat).
        const items = t.items.filter((i) => eats(diets.get(pid) ?? 'veg', i.food.diet as Diet));
        skipped += t.items.length - items.length;
        await this.db.dietPlan.updateMany({ where: { patientId: pid, status: 'active' }, data: { status: 'ended', endsOn: new Date() } });
        await this.db.dietPlan.create({
          data: {
            patientId: pid, dietitianId: u.id, title: t.title, titleHi: t.titleHi, startsOn: new Date(), kcal: t.kcal, notes: t.notes, notesHi: t.notesHi,
            items: { create: items.map(({ weekday, slot, foodId, qty, note, sort }) => ({ weekday, slot, foodId, qty, note, sort })) },
          },
        });
        // A shared plan starts the free trial for anyone not paying (once per person).
        await this.program.startTrialFromPlan(pid, u.id);
      }
      return { updated: ids.length, skippedFoods: skipped };
    }
    return { updated: ids.length };
  }

  /** Home screen numbers and who needs attention today. */
  @Get('dashboard')
  async dashboard(@CurrentUser() u: AuthUser) {
    const scope = { ...this.access.patientScope(u), type: { not: 'care' } };
    const [total, high, lows, inactive, poorMeds, paid, unassigned, reviews, trialsEnding, renewalsDue, inRange, recentEvents, trend] = await Promise.all([
      this.db.patient.count({ where: scope }),
      this.db.patient.count({ where: { ...scope, stats: { avg7: { gt: 180 } } } }),
      this.db.patient.count({ where: { ...scope, stats: { lows30: { gt: 0 } } } }),
      this.db.patient.count({ where: { ...scope, stats: { OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 3 * DAY) } }] } } }),
      this.db.patient.count({ where: { ...scope, stats: { medAdherence7: { lt: 70 } } } }),
      this.db.patient.count({ where: { ...scope, tier: { not: 'FREE' } } }),
      this.db.patient.count({ where: { ...scope, assignedDietitianId: null, consentAt: { not: null } } }),
      this.db.enrollment.count({ where: { status: 'pending_review', patient: scope } }),
      this.db.patient.count({ where: { ...scope, AND: [stageWhere('trial', { trialEndsIn: TRIAL_ENDING_DAYS })] } }),
      this.db.patient.count({ where: { ...scope, AND: [stageWhere('subscriber', { renewalIn: RENEWAL_DUE_DAYS })] } }),
      this.db.patientStats.aggregate({ where: { patient: scope }, _avg: { inRange30: true, avg7: true, ea1c: true, medAdherence7: true } }),
      this.db.careEvent.findMany({
        where: { patient: scope, at: { gte: new Date(Date.now() - 2 * DAY) } },
        orderBy: { at: 'desc' }, take: 15, include: { patient: { select: { user: { select: { name: true } } } } },
      }),
      this.db.$queryRaw<{ day: string; avg: number; n: number }[]>`
        select to_char((r."at" at time zone 'UTC') at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day, round(avg(r.value)::numeric, 1)::float as avg, count(*)::int as n
        from "SugarReading" r join "Patient" p on p."userId" = r."patientId"
        where r."deletedAt" is null and r."at" > now() - interval '30 days'
          and (${u.role === 'OWNER'} or p."assignedDietitianId" = ${u.id})
        group by 1 order by 1`,
    ]);
    return {
      counts: { total, high, lows, inactive, poorMeds, paid, unassigned, reviews, trialsEnding, renewalsDue },
      averages: inRange._avg,
      events: recentEvents.map((e) => ({ id: e.id, patientId: e.patientId, name: e.patient.user.name, kind: e.kind, data: e.data, at: e.at })),
      trend,
    };
  }
}
