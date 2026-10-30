import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { AlertsService } from '../notify/alerts.service';
import { onceADay } from '@shared/meals';
import { isOnline } from '@shared/presence';
import { saveAppEvents, saveSessions, type AppEventIn, type SessionIn } from '../analytics/analytics.controller';
import { markDelivered } from '../chat/chat.controller';
import { ProgramService } from '../program/program.service';
import { recomputeStats } from '../stats/stats';

/** One batch from the app's offline outbox. Times are epoch ms; ids are the app's own. */
type PushBody = {
  meals?: { id: string; slot: string; kind?: string; at: number; items: { id: string; q: number }[]; updatedAt?: number; deleted?: boolean }[];
  readings?: { id: string; v: number; ctx: string; at: number; updatedAt?: number; deleted?: boolean }[];
  meds?: { id: string; name: string; time: string; kind?: string; dose?: number | null; unit?: string | null; stock?: number | null; updatedAt?: number; deleted?: boolean }[];
  doses?: { medId: string; date: string; status: 'taken' | 'skipped' | null; amount?: number | null }[];
  vitals?: { id: string; kind: 'weight' | 'bp'; weightKg?: number | null; sys?: number | null; dia?: number | null; pulse?: number | null; at: number; updatedAt?: number; deleted?: boolean }[];
  activity?: { date: string; walkMin: number; steps: number; water: number; score?: number }[];
  events?: { id: string; kind: 'sugar' | 'unwell' | 'sos'; data?: Record<string, unknown>; at: number }[];
  checkups?: { kind: string; lastDone: string; value?: number | null }[];
  /** Finished app visits (time in app), and this phone's install id for the onboarding funnel. */
  sessions?: SessionIn[];
  appEvents?: AppEventIn[];
  installId?: string;
};

const MAX = 500;
const DAY_MS = 86400_000;
/** Meal days follow India time. */
const IST_MS = 330 * 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const CTX = ['fasting', 'after', 'random'];

function check(ok: unknown, what: string): asserts ok {
  if (!ok) throw new BadRequestException(`invalid_${what}`);
}

@ApiTags('sync')
@ApiBearerAuth()
@Roles('USER')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly db: PrismaService,
    private readonly alerts: AlertsService,
    private readonly program: ProgramService,
  ) {}

  /**
   * Upserts everything the app logged (safe to resend: same ids, same result).
   * Nutrition totals are recomputed from the server catalog so the admin sees consistent numbers.
   */
  @Post('push')
  @HttpCode(200)
  async push(@CurrentUser() u: AuthUser, @Body() b: PushBody) {
    const pid = u.id;
    const n = (b.meals?.length ?? 0) + (b.readings?.length ?? 0) + (b.meds?.length ?? 0) + (b.doses?.length ?? 0) + (b.activity?.length ?? 0) + (b.events?.length ?? 0) + (b.vitals?.length ?? 0);
    check(n <= MAX && (b.sessions?.length ?? 0) <= MAX && (b.appEvents?.length ?? 0) <= MAX, 'batch_too_large');
    // Ids owned by someone else are ignored rather than overwritten.
    const foreign = async (model: 'meal' | 'sugarReading' | 'medication' | 'careEvent' | 'vital', ids: string[]) =>
      new Set(
        ids.length
          ? (await (this.db[model] as unknown as { findMany(a: unknown): Promise<{ id: string }[]> }).findMany({ where: { id: { in: ids }, patientId: { not: pid } }, select: { id: true } })).map((r) => r.id)
          : [],
      );

    if (b.meals?.length) {
      const foods = new Map((await this.db.food.findMany({ select: { id: true, carbs: true, protein: true, fiber: true, kcal: true } })).map((f) => [f.id, f]));
      const skip = await foreign('meal', b.meals.map((m) => m.id));
      for (const m of b.meals) {
        check(typeof m.id === 'string' && SLOTS.includes(m.slot) && Number.isFinite(m.at) && Array.isArray(m.items), 'meal');
        if (skip.has(m.id)) continue;
        const items = m.items.filter((i) => foods.has(i.id) && i.q > 0 && i.q <= 20);
        const t = items.reduce(
          (a, i) => {
            const f = foods.get(i.id)!;
            return { carbs: a.carbs + f.carbs * i.q, protein: a.protein + f.protein * i.q, fiber: a.fiber + f.fiber * i.q, kcal: a.kcal + f.kcal * i.q };
          },
          { carbs: 0, protein: 0, fiber: 0, kcal: 0 },
        );
        const data = {
          slot: m.slot, kind: m.kind ?? 'meal', at: new Date(m.at), items, ...t,
          updatedAt: new Date(m.updatedAt ?? Date.now()), deletedAt: m.deleted ? new Date() : null,
        };
        await this.db.meal.upsert({ where: { id: m.id }, create: { id: m.id, patientId: pid, ...data }, update: data });
        // One breakfast / lunch / dinner per day (older apps could add several): the latest saved one stays.
        if (!m.deleted && onceADay(m.slot)) {
          const start = new Date(Math.floor((m.at + IST_MS) / DAY_MS) * DAY_MS - IST_MS);
          await this.db.meal.updateMany({
            where: { patientId: pid, slot: m.slot, id: { not: m.id }, deletedAt: null, at: { gte: start, lt: new Date(start.getTime() + DAY_MS) }, updatedAt: { lte: data.updatedAt } },
            data: { deletedAt: new Date() },
          });
        }
      }
    }
    if (b.readings?.length) {
      const skip = await foreign('sugarReading', b.readings.map((r) => r.id));
      for (const r of b.readings) {
        check(typeof r.id === 'string' && Number.isInteger(r.v) && r.v >= 20 && r.v <= 600 && CTX.includes(r.ctx) && Number.isFinite(r.at), 'reading');
        if (skip.has(r.id)) continue;
        const data = { value: r.v, ctx: r.ctx, at: new Date(r.at), updatedAt: new Date(r.updatedAt ?? Date.now()), deletedAt: r.deleted ? new Date() : null };
        await this.db.sugarReading.upsert({ where: { id: r.id }, create: { id: r.id, patientId: pid, ...data }, update: data });
      }
    }
    if (b.meds?.length) {
      const skip = await foreign('medication', b.meds.map((m) => m.id));
      for (const m of b.meds) {
        check(typeof m.id === 'string' && typeof m.name === 'string' && HHMM.test(m.time), 'med');
        if (skip.has(m.id)) continue;
        const kind = ['tablet', 'insulin', 'syrup', 'other'].includes(m.kind ?? '') ? m.kind! : 'tablet';
        const data = {
          name: m.name.trim().slice(0, 80), time: m.time, kind, dose: m.dose != null && m.dose > 0 && m.dose < 1000 ? m.dose : null, unit: m.unit ? String(m.unit).slice(0, 12) : null,
          stock: m.stock ?? null, updatedAt: new Date(m.updatedAt ?? Date.now()), deletedAt: m.deleted ? new Date() : null,
        };
        await this.db.medication.upsert({ where: { id: m.id }, create: { id: m.id, patientId: pid, ...data }, update: data });
      }
    }
    for (const d of b.doses ?? []) {
      check(DATE.test(d.date) && (d.status === null || d.status === 'taken' || d.status === 'skipped'), 'dose');
      const med = await this.db.medication.findFirst({ where: { id: d.medId, patientId: pid }, select: { id: true } });
      if (!med) continue;
      const id = `${d.medId}:${d.date}`;
      if (d.status === null) await this.db.doseLog.deleteMany({ where: { id } });
      else {
        const amount = d.amount != null && d.amount > 0 && d.amount < 1000 ? d.amount : null;
        await this.db.doseLog.upsert({ where: { id }, create: { id, patientId: pid, medicationId: d.medId, date: d.date, status: d.status, amount, updatedAt: new Date() }, update: { status: d.status, amount, updatedAt: new Date() } });
      }
    }
    if (b.vitals?.length) {
      const skip = await foreign('vital', b.vitals.map((v) => v.id));
      for (const v of b.vitals) {
        const okWeight = v.kind === 'weight' && v.weightKg != null && v.weightKg >= 10 && v.weightKg <= 300;
        const okBp = v.kind === 'bp' && v.sys != null && v.dia != null && v.sys >= 60 && v.sys <= 260 && v.dia >= 30 && v.dia <= 160 && v.sys > v.dia;
        check(typeof v.id === 'string' && Number.isFinite(v.at) && (okWeight || okBp || v.deleted), 'vital');
        if (skip.has(v.id)) continue;
        const data = {
          kind: v.kind, weightKg: v.kind === 'weight' ? v.weightKg : null, sys: v.kind === 'bp' ? v.sys : null, dia: v.kind === 'bp' ? v.dia : null,
          pulse: v.pulse ?? null, at: new Date(v.at), updatedAt: new Date(v.updatedAt ?? Date.now()), deletedAt: v.deleted ? new Date() : null,
        };
        await this.db.vital.upsert({ where: { id: v.id }, create: { id: v.id, patientId: pid, ...data }, update: data });
      }
    }
    for (const a of b.activity ?? []) {
      check(DATE.test(a.date), 'activity');
      const id = `${pid}:${a.date}`;
      const data = { walkMin: Math.max(0, a.walkMin | 0), steps: Math.max(0, a.steps | 0), water: Math.max(0, a.water | 0), score: a.score ?? null, updatedAt: new Date() };
      await this.db.dailyActivity.upsert({ where: { id }, create: { id, patientId: pid, date: a.date, ...data }, update: data });
    }
    for (const c of b.checkups ?? []) {
      check(['a1c', 'eye', 'foot', 'kidney'].includes(c.kind) && DATE.test(c.lastDone), 'checkup');
      const id = `${pid}:${c.kind}`;
      const data = { lastDone: c.lastDone, value: c.value ?? null, updatedAt: new Date() };
      await this.db.checkup.upsert({ where: { id }, create: { id, patientId: pid, kind: c.kind, ...data }, update: data });
    }
    const newEvents: { id: string; kind: string; data: Record<string, unknown> }[] = [];
    if (b.events?.length) {
      const skip = await foreign('careEvent', b.events.map((e) => e.id));
      for (const e of b.events) {
        check(typeof e.id === 'string' && ['sugar', 'unwell', 'sos'].includes(e.kind) && Number.isFinite(e.at), 'event');
        if (skip.has(e.id)) continue;
        const created = await this.db.careEvent.createMany({ data: [{ id: e.id, patientId: pid, kind: e.kind, data: (e.data ?? {}) as object, at: new Date(e.at) }], skipDuplicates: true });
        if (created.count) newEvents.push({ id: e.id, kind: e.kind, data: e.data ?? {} });
      }
    }

    await saveSessions(this.db, pid, b.sessions, b.installId);
    await saveAppEvents(this.db, pid, b.appEvents);
    // A first reading or HbA1c can make a brand-new programme need a dietitian's review.
    if (b.readings?.length || b.checkups?.length) await this.program.recheck(pid);
    await recomputeStats(this.db, pid);
    for (const e of newEvents) await this.alerts.onEvent(pid, e);
    return { ok: true, serverTime: Date.now() };
  }

  /**
   * Everything the app needs that can change on the server: catalog rows changed since `since`,
   * the profile and targets, active diet/exercise plans, unread notices and family requests.
   */
  @Get('pull')
  async pull(@CurrentUser() u: AuthUser, @Query('since') since?: string) {
    const after = since ? new Date(Number(since) || since) : new Date(0);
    const changed = { updatedAt: { gt: after } };
    const [foods, ingredients, exercises, tips, rules, swaps, thalis, reels, me, diet, exercise, inbox, circle] = await Promise.all([
      // Draft foods stay off phones until a dietitian verifies them.
      this.db.food.findMany({ where: { ...changed, reviewStatus: 'verified' }, orderBy: { sort: 'asc' } }),
      this.db.ingredient.findMany({ where: changed }),
      this.db.exercise.findMany({ where: changed, orderBy: { sort: 'asc' } }),
      this.db.tip.findMany({ where: changed, orderBy: { sort: 'asc' } }),
      this.db.foodRule.findMany({ where: changed }),
      this.db.foodSwap.findMany({ where: changed }),
      this.db.thali.findMany({ where: changed, orderBy: { sort: 'asc' } }),
      // Deleted reels come too (with deletedAt) so phones drop them.
      this.db.reel.findMany({ where: changed, orderBy: { sort: 'asc' }, select: { id: true, youtubeId: true, titleEn: true, titleHi: true, category: true, lang: true, featured: true, active: true, sort: true, deletedAt: true, updatedAt: true } }),
      this.db.user.findUniqueOrThrow({ where: { id: u.id }, select: { id: true, phone: true, name: true, lang: true, patient: { include: { assignedDietitian: { select: { name: true } } } } } }),
      this.db.dietPlan.findFirst({ where: { patientId: u.id, status: 'active' }, orderBy: { startsOn: 'desc' }, include: { items: { orderBy: { sort: 'asc' } }, dietitian: { select: { name: true } } } }),
      this.db.exercisePlan.findFirst({ where: { patientId: u.id, status: 'active' }, orderBy: { startsOn: 'desc' }, include: { items: { orderBy: { sort: 'asc' } } } }),
      this.db.notificationReceipt.findMany({ where: { userId: u.id }, orderBy: { notification: { sentAt: 'desc' } }, take: 30, include: { notification: { include: { sender: { select: { name: true } } } } } }),
      this.db.circle.findUnique({ where: { patientId: u.id }, include: { members: { where: { status: 'pending' } }, messages: { where: { readAt: null }, orderBy: { at: 'asc' } } } }),
    ]);
    const [chatUnread, dietitian, enrollment, picks] = await Promise.all([
      this.db.chatMessage.count({ where: { patientId: u.id, fromStaff: true, readAt: null } }),
      this.db.patient.findUnique({ where: { userId: u.id }, select: { assignedDietitian: { select: { name: true, lastActiveAt: true } } } }),
      this.db.enrollment.findFirst({ where: { patientId: u.id }, orderBy: { createdAt: 'desc' }, select: { status: true, startsOn: true, template: { select: { title: true } } } }),
      this.db.foodPick.findMany({ where: { patientId: u.id, food: { active: true } }, orderBy: { sort: 'asc' }, select: { foodId: true, slots: true, note: true } }),
      // The phone now knows about the dietitian's messages, so they count as delivered.
      markDelivered(this.db, u.id, true),
    ]);
    return {
      serverTime: Date.now(),
      catalog: { foods, ingredients, exercises, tips, rules, swaps, thalis, reels },
      me,
      plans: { diet, exercise },
      inbox: inbox
        .filter((r) => r.notification.sentAt)
        .map((r) => ({
          id: r.notificationId, readAt: r.readAt, sentAt: r.notification.sentAt, from: r.notification.sender?.name ?? '',
          titleEn: r.notification.titleEn, titleHi: r.notification.titleHi, bodyEn: r.notification.bodyEn, bodyHi: r.notification.bodyHi, deeplink: r.notification.deeplink,
        })),
      /** "For you" foods the dietitian chose (whole list each time; it is small). */
      picks,
      /** The 14-day Kickstart, if any (details from GET /me/program). */
      program: enrollment ? { status: enrollment.status, startsOn: enrollment.startsOn, title: enrollment.template?.title ?? '' } : null,
      chat: {
        unread: chatUnread,
        dietitian: dietitian?.assignedDietitian ? { name: dietitian.assignedDietitian.name, online: isOnline(dietitian.assignedDietitian.lastActiveAt) } : null,
      },
      family: circle
        ? { circleId: circle.id, requests: circle.members.map((m) => ({ userId: m.userId, name: m.name })), messages: circle.messages }
        : null,
    };
  }
}
