import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Logger, Param, Post } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Tier } from '@prisma/client';

import { daysUntil } from '@shared/lifecycle';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notify/notifications.controller';

const DAY = 86400_000;
const METHODS = ['upi', 'cash', 'card', 'bank', 'manual'] as const;
/** Patients hear about a renewal this many days before the plan ends. */
const REMIND_DAYS = [7, 1];

type PaymentIn = { planId?: string; months?: number; amountInr?: number; method?: string; ref?: string; note?: string };

/** The app tier a plan unlocks (plan ids are free / basic / pro). */
const tierFor = (planId: string): Tier => (planId.includes('pro') ? 'PRO' : planId === 'free' ? 'FREE' : 'BASIC');

/**
 * Paid plans. Payments are recorded by staff (UPI / cash / card / bank) until an online gateway is added;
 * every renewal is a new Subscription row, so the rows are also the payment history.
 */
@Injectable()
export class SubscriptionService {
  private readonly log = new Logger('Subscriptions');
  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private validate(b: PaymentIn) {
    if (b.method && !(METHODS as readonly string[]).includes(b.method)) throw new BadRequestException('bad_method');
    if (b.amountInr !== undefined && !(Number.isInteger(b.amountInr) && b.amountInr >= 0 && b.amountInr <= 100000)) throw new BadRequestException('bad_amount');
    if (b.months !== undefined && !(Number.isInteger(b.months) && b.months >= 1 && b.months <= 24)) throw new BadRequestException('bad_months');
  }

  /** Keeps Patient.tier / tierUntil in step with the latest active paid plan. */
  async syncTier(patientId: string) {
    const active = await this.db.subscription.findFirst({ where: { patientId, status: 'active', endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
    await this.db.patient.update({ where: { userId: patientId }, data: active ? { tier: tierFor(active.planId), tierUntil: active.endsAt } : { tier: 'FREE', tierUntil: null } });
  }

  /** Starts a paid plan from now (or right after the current one ends, for a renewal). */
  async start(patientId: string, staffId: string, b: PaymentIn, renewOf?: string) {
    this.validate(b);
    const current = renewOf ? await this.db.subscription.findUniqueOrThrow({ where: { id: renewOf } }) : null;
    const plan = await this.db.subscriptionPlan.findUnique({ where: { id: String(b.planId ?? current?.planId ?? '') } });
    if (!plan || !plan.active || plan.priceInr <= 0) throw new BadRequestException('bad_plan');
    const months = b.months ?? plan.months;
    const startsAt = current && current.endsAt > new Date() ? current.endsAt : new Date();
    const sub = await this.db.subscription.create({
      data: {
        patientId, planId: plan.id, status: 'active', startsAt, endsAt: new Date(startsAt.getTime() + months * 30 * DAY),
        provider: b.method ?? 'manual', ref: b.ref?.trim().slice(0, 80) || null, amountInr: b.amountInr ?? plan.priceInr * Math.max(1, Math.round(months / plan.months)),
        createdById: staffId, note: b.note?.trim().slice(0, 200) ?? '',
      },
    });
    await this.syncTier(patientId);
    // The trial converted (or a lapsed patient came back).
    await this.db.enrollment.updateMany({ where: { patientId, status: { in: ['active', 'completed', 'dropped'] } }, data: { status: 'converted', convertedAt: new Date() } });
    if (!renewOf) {
      await this.notify(patientId, 'sub:start', {
        titleEn: `💚 Welcome to ${plan.name}`, titleHi: `💚 ${plan.name} में स्वागत है`,
        bodyEn: 'Your dietitian will keep your plan updated every week. Chat any time.', bodyHi: 'आपके डाइटीशियन हर हफ़्ते आपका प्लान अपडेट करेंगे। कभी भी चैट कीजिए।',
      });
    }
    return sub;
  }

  async cancel(subId: string) {
    const sub = await this.db.subscription.update({ where: { id: subId }, data: { status: 'cancelled', endsAt: new Date() } });
    await this.syncTier(sub.patientId);
    return sub;
  }

  private async notify(patientId: string, kind: string, copy: { titleEn: string; titleHi: string; bodyEn: string; bodyHi: string }) {
    const n = await this.db.notification.create({ data: { ...copy, kind, deeplink: '/chat', audience: { userIds: [patientId] }, recipients: 1, receipts: { create: [{ userId: patientId }] } } });
    await this.notifications.deliver(n.id);
  }

  /** Nightly: plans past their end become expired and the patient drops to the free tier. */
  @Cron('25 1 * * *')
  async expire() {
    const ended = await this.db.subscription.findMany({ where: { status: 'active', endsAt: { lte: new Date() } }, select: { id: true, patientId: true } });
    if (!ended.length) return 0;
    await this.db.subscription.updateMany({ where: { id: { in: ended.map((e) => e.id) } }, data: { status: 'expired' } });
    for (const pid of new Set(ended.map((e) => e.patientId))) await this.syncTier(pid);
    this.log.log(`expired ${ended.length} subscriptions`);
    return ended.length;
  }

  /** Daily at 10:00 IST: "your plan ends in 7 days / tomorrow", once per subscription and reminder. */
  @Cron('30 4 * * *')
  async remind() {
    const soon = await this.db.subscription.findMany({
      where: { status: 'active', endsAt: { gt: new Date(), lte: new Date(Date.now() + Math.max(...REMIND_DAYS) * DAY) }, plan: { priceInr: { gt: 0 } } },
      include: { plan: true },
    });
    let n = 0;
    for (const s of soon) {
      const left = daysUntil(s.endsAt);
      const due = REMIND_DAYS.find((d) => left <= d);
      if (!due) continue;
      // A renewal already paid (a later subscription) means no reminder.
      if (await this.db.subscription.count({ where: { patientId: s.patientId, startsAt: { gte: s.endsAt } } })) continue;
      const key = `sub:${s.id}:d${due}`;
      const claimed = await this.db.alertSent.createMany({ data: [{ patientId: s.patientId, key }], skipDuplicates: true });
      if (!claimed.count) continue;
      await this.notify(s.patientId, 'sub:renew', {
        titleEn: left <= 1 ? `⏰ ${s.plan.name} ends tomorrow` : `⏰ ${s.plan.name} ends in ${left} days`,
        titleHi: left <= 1 ? `⏰ ${s.plan.name} कल ख़त्म होगा` : `⏰ ${s.plan.name} ${left} दिन में ख़त्म होगा`,
        bodyEn: 'Renew to keep your dietitian and your plan. Reply in chat and we will help.', bodyHi: 'अपने डाइटीशियन और प्लान को जारी रखने के लिए रिन्यू कीजिए। चैट में बताइए, हम मदद करेंगे।',
      });
      n++;
    }
    return n;
  }
}

@ApiTags('subscriptions (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class SubscriptionsController {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly subs: SubscriptionService,
  ) {}

  /** Payment history, newest first. */
  @Get('patients/:id/subscriptions')
  async history(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    const rows = await this.db.subscription.findMany({ where: { patientId: id }, orderBy: { startsAt: 'desc' }, include: { plan: { select: { name: true, priceInr: true, months: true } } } });
    return { data: rows };
  }

  @Post('patients/:id/subscriptions')
  async start(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: PaymentIn) {
    await this.access.assertStaffCanSee(u, id);
    return this.subs.start(id, u.id, b);
  }

  @Post('subscriptions/:id/renew')
  async renew(@CurrentUser() u: AuthUser, @Param('id') subId: string, @Body() b: PaymentIn) {
    const s = await this.db.subscription.findUniqueOrThrow({ where: { id: subId } });
    await this.access.assertStaffCanSee(u, s.patientId);
    return this.subs.start(s.patientId, u.id, b, subId);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() u: AuthUser, @Param('id') subId: string) {
    const s = await this.db.subscription.findUniqueOrThrow({ where: { id: subId } });
    await this.access.assertStaffCanSee(u, s.patientId);
    return this.subs.cancel(subId);
  }
}
