import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { MEAL_SLOTS } from '@shared/thali';
import { programDay, PROGRAM_DAYS } from '@shared/program';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { PushService } from '../notify/push.service';
import { istDate, ProgramService } from './program.service';

const SLUG = /^[a-z0-9-]{2,40}$/;
type DayIn = { day: number; focusEn?: string; focusHi?: string; tipEn?: string; tipHi?: string; sugarCheck?: string; exercises?: { exerciseId: string; minutes: number }[] };
type MealIn = { day: number; slot: string; foodId: string; qty?: number; altGroup?: string };

/** The patient's side: today's programme day, tips, results and the offer. */
@ApiTags('program')
@ApiBearerAuth()
@Roles('USER')
@Controller('me/program')
export class ProgramController {
  constructor(
    private readonly db: PrismaService,
    private readonly program: ProgramService,
    private readonly push: PushService,
  ) {}

  @Get()
  async mine(@CurrentUser() u: AuthUser) {
    const e = await this.db.enrollment.findFirst({ where: { patientId: u.id }, orderBy: { createdAt: 'desc' }, include: { template: { include: { days: { orderBy: { day: 'asc' } } } } } });
    if (!e) return { enrollment: null };
    const day = programDay(e.startsOn, istDate());
    const showResults = e.status === 'completed' || e.status === 'converted' || (e.status === 'active' && day >= PROGRAM_DAYS - 2);
    const [result, plans] = await Promise.all([
      showResults ? (e.result ?? this.program.results(e.id)) : null,
      this.db.subscriptionPlan.findMany({ where: { active: true, priceInr: { gt: 0 } }, orderBy: { priceInr: 'asc' } }),
    ]);
    return {
      enrollment: { id: e.id, status: e.status, startsOn: e.startsOn, day, kcal: e.kcal, title: e.template?.title ?? '', offerShownAt: e.offerShownAt },
      days: (e.template?.days ?? []).map((d) => ({ day: d.day, focusEn: d.focusEn, focusHi: d.focusHi, tipEn: d.tipEn, tipHi: d.tipHi, sugarCheck: d.sugarCheck })),
      result,
      offer: plans.map((p) => ({ id: p.id, name: p.name, nameHi: p.nameHi, priceInr: p.priceInr, months: p.months, features: p.features, featuresHi: p.featuresHi })),
    };
  }

  /** "I want to continue": tells the dietitian in chat; payment is arranged by the team for now. */
  @Post('interest')
  @HttpCode(200)
  async interest(@CurrentUser() u: AuthUser, @Body() b: { planId: string }) {
    const [e, plan, p] = await Promise.all([
      this.db.enrollment.findFirst({ where: { patientId: u.id }, orderBy: { createdAt: 'desc' } }),
      this.db.subscriptionPlan.findUnique({ where: { id: String(b?.planId ?? '') } }),
      this.db.patient.findUniqueOrThrow({ where: { userId: u.id }, include: { user: { select: { name: true, lang: true } } } }),
    ]);
    if (!e || !plan) throw new BadRequestException('bad_plan');
    await this.db.enrollment.update({ where: { id: e.id }, data: { offerShownAt: e.offerShownAt ?? new Date() } });
    const text = p.user.lang === 'hi'
      ? `🚀 मेरे 14 दिन पूरे हुए, मैं "${plan.name}" (₹${plan.priceInr}) के साथ आगे चलना चाहता/चाहती हूँ। कृपया शुरू करने में मदद कीजिए।`
      : `🚀 I finished my 14 days and want to continue with "${plan.name}" (₹${plan.priceInr}). Please help me start.`;
    await this.db.chatMessage.create({ data: { patientId: u.id, senderId: u.id, fromStaff: false, text } });
    const to = p.assignedDietitianId ? [p.assignedDietitianId] : (await this.db.user.findMany({ where: { role: 'OWNER', active: true }, select: { id: true } })).map((x) => x.id);
    await this.push.toUsers(to, { title: `💰 ${p.user.name || 'Patient'} wants ${plan.name}`, body: text.slice(0, 120), data: { route: `/chats/${u.id}` } });
    return { ok: true };
  }

  @Post('offer-seen')
  @HttpCode(200)
  async offerSeen(@CurrentUser() u: AuthUser) {
    await this.db.enrollment.updateMany({ where: { patientId: u.id, offerShownAt: null }, data: { offerShownAt: new Date() } });
    return { ok: true };
  }
}

/** Dietitians: write the 14-day templates, review risky enrolments, follow each patient's programme. */
@ApiTags('program (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class AdminProgramController {
  constructor(
    private readonly db: PrismaService,
    private readonly program: ProgramService,
    private readonly access: AccessService,
  ) {}

  @Get('programs')
  async templates() {
    const rows = await this.db.programTemplate.findMany({ orderBy: [{ diet: 'asc' }, { region: 'asc' }, { risk: 'asc' }], include: { _count: { select: { meals: true, enrollments: true } } } });
    return { data: rows.map(({ _count, ...t }) => ({ ...t, meals: _count.meals, enrolled: _count.enrollments })), total: rows.length };
  }

  @Get('programs/:id')
  async template(@Param('id') id: string) {
    return this.db.programTemplate.findUniqueOrThrow({ where: { id }, include: { days: { orderBy: { day: 'asc' } }, meals: { orderBy: [{ day: 'asc' }, { sort: 'asc' }] } } });
  }

  /** Saves the whole template (meta, 14 days, meals). Only verified, active foods. Running programmes keep their copy. */
  @Put('programs/:id')
  async save(@Param('id') id: string, @Body() b: { title: string; titleHi?: string; notesHi?: string; diet: string; region: string; risk?: string; kcal?: number; notes?: string; active?: boolean; days: DayIn[]; meals: MealIn[] }) {
    if (!SLUG.test(id)) throw new BadRequestException('bad_id');
    if (!b?.title?.trim() || !['veg', 'egg', 'nonveg'].includes(b.diet) || !['north', 'south', 'east', 'west', 'northeast'].includes(b.region)) throw new BadRequestException('bad_template');
    const meals = b.meals ?? [];
    const days = (b.days ?? []).filter((d) => d.day >= 1 && d.day <= PROGRAM_DAYS);
    for (const m of meals) if (!(m.day >= 1 && m.day <= PROGRAM_DAYS) || !(MEAL_SLOTS as string[]).includes(m.slot)) throw new BadRequestException('bad_meal');
    const ids = [...new Set(meals.map((m) => m.foodId))];
    const ok = new Set((await this.db.food.findMany({ where: { id: { in: ids }, active: true, reviewStatus: 'verified' }, select: { id: true } })).map((f) => f.id));
    const bad = ids.filter((f) => !ok.has(f));
    if (bad.length) throw new BadRequestException(`foods_not_available:${bad.join(',')}`);
    const meta = { title: b.title.trim(), diet: b.diet, region: b.region, risk: b.risk === 'hypo_safe' ? 'hypo_safe' : 'standard', kcal: b.kcal ?? 1500, notes: b.notes ?? '', titleHi: b.titleHi?.trim() ?? '', notesHi: b.notesHi ?? '', active: b.active ?? true };
    await this.db.$transaction([
      this.db.programTemplate.upsert({ where: { id }, create: { id, ...meta }, update: meta }),
      this.db.programDay.deleteMany({ where: { templateId: id } }),
      this.db.programMeal.deleteMany({ where: { templateId: id } }),
      this.db.programDay.createMany({
        data: days.map((d) => ({
          templateId: id, day: d.day, focusEn: d.focusEn ?? '', focusHi: d.focusHi ?? '', tipEn: d.tipEn ?? '', tipHi: d.tipHi ?? '',
          sugarCheck: ['fasting', 'after_meal'].includes(d.sugarCheck ?? '') ? d.sugarCheck! : 'none', exercises: (d.exercises ?? []) as object,
        })),
      }),
      this.db.programMeal.createMany({ data: meals.map((m, sort) => ({ templateId: id, day: m.day, slot: m.slot, foodId: m.foodId, qty: m.qty ?? 1, altGroup: m.altGroup ?? '', sort })) }),
    ]);
    return this.template(id);
  }

  @Delete('programs/:id')
  hide(@Param('id') id: string) {
    return this.db.programTemplate.update({ where: { id }, data: { active: false } });
  }

  /** Review queue (and other statuses) for the signed-in dietitian's patients. */
  @Get('enrollments')
  async enrollments(@CurrentUser() u: AuthUser, @Query('status') status = 'pending_review') {
    const rows = await this.db.enrollment.findMany({
      where: { status, patient: this.access.patientScope(u) }, orderBy: { createdAt: 'asc' },
      include: { template: { select: { id: true, title: true } }, patient: { select: { diet: true, region: true, user: { select: { name: true, phone: true } } } } },
    });
    return { data: rows, total: rows.length };
  }

  @Post('enrollments/:id/approve')
  @HttpCode(200)
  async approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { templateId?: string }) {
    const e = await this.db.enrollment.findUniqueOrThrow({ where: { id } });
    await this.access.assertStaffCanSee(u, e.patientId);
    return this.program.approve(id, u.id, b?.templateId);
  }

  /** Kickstart tab: programme, per-day progress (meals, plan ticks, readings, exercise) and results so far. */
  @Get('patients/:id/enrollment')
  async patient(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    const e = await this.db.enrollment.findFirst({ where: { patientId: id }, orderBy: { createdAt: 'desc' }, include: { template: { select: { id: true, title: true } } } });
    if (!e) return { enrollment: null };
    const from = new Date(`${e.startsOn}T00:00:00+05:30`);
    const to = new Date(from.getTime() + PROGRAM_DAYS * 86400_000);
    const dayOf = (at: Date) => Math.floor((at.getTime() - from.getTime()) / 86400_000) + 1;
    const [meals, events, readings] = await Promise.all([
      this.db.meal.findMany({ where: { patientId: id, deletedAt: null, at: { gte: from, lt: to } }, select: { at: true } }),
      this.db.appEvent.findMany({ where: { userId: id, at: { gte: from, lt: to }, name: { in: ['plan_ate', 'exercise_done'] } }, select: { at: true, name: true } }),
      this.db.sugarReading.findMany({ where: { patientId: id, deletedAt: null, at: { gte: from, lt: to } }, select: { at: true, value: true, ctx: true } }),
    ]);
    const days = Array.from({ length: PROGRAM_DAYS }, (_, i) => {
      const d = i + 1;
      return {
        day: d,
        meals: meals.filter((m) => dayOf(m.at) === d).length,
        planTicks: events.filter((x) => x.name === 'plan_ate' && dayOf(x.at) === d).length,
        exercise: events.some((x) => x.name === 'exercise_done' && dayOf(x.at) === d),
        readings: readings.filter((r) => dayOf(r.at) === d).map((r) => ({ v: r.value, ctx: r.ctx })),
      };
    });
    return { enrollment: { ...e, day: programDay(e.startsOn, istDate()) }, days, result: e.result ?? (await this.program.results(e.id)) };
  }
}
