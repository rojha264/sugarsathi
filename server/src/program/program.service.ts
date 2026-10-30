import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { eats, type Diet } from '@shared/diet';
import {
  dailyKcal, pickTemplate, portionNote, portionScale, PROGRAM_TITLE, programDay, PROGRAM_DAYS, results, riskFor, riskReasons,
  type Baseline, type DayReading, type Meds, type Region, type Sex,
} from '@shared/program';
import { PrismaService } from '../common/prisma.service';
import { PushService } from '../notify/push.service';

/** What a new risk means, in the patient's words (for the chat note to the dietitian). */
const RISK_TEXT: Record<string, string> = {
  type1: 'type 1 diabetes', gdm: 'diabetes in pregnancy', child: 'under 18', senior75: 'age 75+', insulin: 'now on insulin', pregnant: 'pregnant',
  kidney: 'kidney problem', a1c_high: 'HbA1c 10 or more', sugar_high: 'sugar 250 or more', sugar_low: 'sugar below 70',
};
const RISK_TEXT_HI: Record<string, string> = {
  type1: 'टाइप 1 डायबिटीज़', gdm: 'गर्भावस्था में डायबिटीज़', child: '18 से कम उम्र', senior75: 'उम्र 75+', insulin: 'अब इंसुलिन पर', pregnant: 'गर्भवती',
  kidney: 'किडनी की समस्या', a1c_high: 'HbA1c 10 या ज़्यादा', sugar_high: 'शुगर 250 या ज़्यादा', sugar_low: 'शुगर 70 से कम',
};

const DAY = 86400_000;
const IST_MS = 330 * 60_000;
/** YYYY-MM-DD in India time, `days` from now. */
export const istDate = (days = 0, now = Date.now()) => new Date(now + IST_MS + days * DAY).toISOString().slice(0, 10);
const dateAt = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);

/**
 * The 14-day Kickstart: on finishing onboarding every patient gets a personal copy of the best
 * ready-made plan (diet, region, medicines), with grain portions scaled to their calories.
 * Risky profiles wait as `pending_review` until a dietitian approves; the rest start right away.
 * The free trial = these 14 days, and day 1 is the day the plan is shared with the patient.
 */
@Injectable()
export class ProgramService {
  private readonly log = new Logger('Program');
  constructor(
    private readonly db: PrismaService,
    @Optional() private readonly push?: PushService,
  ) {}

  /** What the server knows about the patient right now: profile, latest HbA1c and first sugar reading. */
  async baseline(patientId: string): Promise<Baseline & { diet: Diet; region: Region | null }> {
    const [p, a1c, sugar] = await Promise.all([
      this.db.patient.findUniqueOrThrow({ where: { userId: patientId } }),
      this.db.checkup.findFirst({ where: { patientId, kind: 'a1c', value: { not: null } } }),
      this.db.sugarReading.findFirst({ where: { patientId, deletedAt: null }, orderBy: { at: 'asc' } }),
    ]);
    const age = p.dob ? new Date().getUTCFullYear() - p.dob.getUTCFullYear() : p.ageGroup === 'senior' ? 65 : p.ageGroup === 'child' ? 14 : 40;
    return {
      type: p.type, sex: (p.sex as Sex) ?? null, age, heightCm: p.heightCm, weightKg: p.weightKg, meds: p.meds as Meds, flags: p.flags,
      a1c: a1c?.value ?? null, sugar: sugar ? { v: sugar.value, ctx: sugar.ctx } : null, diet: p.diet as Diet, region: (p.region as Region) ?? null,
    };
  }

  /** Creates the programme once (caregivers never get one). Returns the enrollment. */
  async enroll(patientId: string) {
    const existing = await this.db.enrollment.findFirst({ where: { patientId, status: { in: ['pending_review', 'active'] } } });
    if (existing) return existing;
    const b = await this.baseline(patientId);
    if (b.type === 'care') return null;
    const templates = await this.db.programTemplate.findMany({ where: { active: true } });
    const template = pickTemplate(templates, { diet: b.diet, region: b.region, risk: riskFor(b) });
    const reasons: string[] = riskReasons(b);
    if (!template) reasons.push('no_template');
    const kcal = dailyKcal(b);
    // Trial day 1 = the day the plan is shared (today when no review is needed; approval resets it).
    const startsOn = istDate(0);
    const e = await this.db.enrollment.create({
      data: { patientId, templateId: template?.id ?? null, status: reasons.length ? 'pending_review' : 'active', startsOn, kcal, baseline: b as object, riskReasons: reasons },
    });
    if (template) await this.copyPlan(e.id, reasons.length ? 'draft' : 'active');
    this.log.log(`enrolled ${patientId} in ${template?.id ?? 'none'} (${e.status}${reasons.length ? `: ${reasons.join(',')}` : ''})`);
    return e;
  }

  /**
   * Readings and HbA1c usually sync just after the profile, so the first check can miss them.
   * Re-check a young programme; new risks send it to review before day 1 starts.
   */
  async recheck(patientId: string) {
    const e = await this.db.enrollment.findFirst({ where: { patientId, status: 'active' }, orderBy: { createdAt: 'desc' } });
    if (!e || programDay(e.startsOn, istDate()) > 1) return;
    const added = riskReasons(await this.baseline(patientId)).filter((r) => !e.riskReasons.includes(r));
    if (!added.length) return;
    await this.db.enrollment.update({ where: { id: e.id }, data: { status: 'pending_review', riskReasons: [...e.riskReasons, ...added] } });
    await this.db.dietPlan.updateMany({ where: { patientId, status: 'active', title: { startsWith: '🚀' } }, data: { status: 'draft' } });
  }

  /**
   * The patient edited their health details. Before day 1 this works like a new reading (back to review if
   * riskier). During the programme the plan keeps running, but the dietitian is told in chat and by push.
   */
  async profileChanged(patientId: string) {
    await this.followDiet(patientId);
    const e = await this.db.enrollment.findFirst({ where: { patientId, status: 'active' }, orderBy: { createdAt: 'desc' } });
    if (!e) return;
    if (programDay(e.startsOn, istDate()) <= 1) return this.recheck(patientId);
    const added = riskReasons(await this.baseline(patientId)).filter((r) => !e.riskReasons.includes(r));
    if (!added.length) return;
    await this.db.enrollment.update({ where: { id: e.id }, data: { riskReasons: [...e.riskReasons, ...added] } });
    const p = await this.db.patient.findUniqueOrThrow({ where: { userId: patientId }, include: { user: { select: { name: true, lang: true } } } });
    // The message shows in the patient's own chat, so it is in their language.
    const text = p.user.lang === 'hi'
      ? `ℹ️ मैंने अपनी सेहत की जानकारी बदली है: ${added.map((r) => RISK_TEXT_HI[r] ?? r).join(', ')}। कृपया देखिए कि मेरा 14 दिन का प्लान अब भी सही है।`
      : `ℹ️ I updated my health details: ${added.map((r) => RISK_TEXT[r] ?? r).join(', ')}. Please check my 14-day plan is still right for me.`;
    await this.db.chatMessage.create({ data: { patientId, senderId: patientId, fromStaff: false, text } });
    const to = p.assignedDietitianId ? [p.assignedDietitianId] : (await this.db.user.findMany({ where: { role: 'OWNER', active: true }, select: { id: true } })).map((x) => x.id);
    await this.push?.toUsers(to, { title: `⚠️ ${p.user.name || 'Patient'}: health details changed`, body: text.slice(0, 120), data: { route: `/patients/show/${patientId}` } });
  }

  /**
   * Food preference changed (e.g. non-veg → veg): a running or waiting programme whose template has food they
   * no longer eat moves to the best template for the new diet, keeping its start date (so the day count stays).
   */
  async followDiet(patientId: string) {
    const e = await this.db.enrollment.findFirst({ where: { patientId, status: { in: ['active', 'pending_review'] }, templateId: { not: null } }, orderBy: { createdAt: 'desc' }, include: { template: true } });
    if (!e?.template) return;
    const b = await this.baseline(patientId);
    if (eats(b.diet, e.template.diet as Diet)) return;
    const next = pickTemplate(await this.db.programTemplate.findMany({ where: { active: true } }), { diet: b.diet, region: b.region, risk: riskFor(b) });
    if (!next) return;
    await this.db.enrollment.update({ where: { id: e.id }, data: { templateId: next.id } });
    await this.copyPlan(e.id, e.status === 'active' ? 'active' : 'draft');
    this.log.log(`diet changed for ${patientId}: ${e.template.id} → ${next.id}`);
  }

  /**
   * The patient's own copy of the template as a DietPlan and ExercisePlan with `day` 1–14, so the
   * existing plan screens and editors work and a dietitian can change one patient without the template.
   */
  async copyPlan(enrollmentId: string, status: 'active' | 'draft') {
    const e = await this.db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { template: { include: { days: true, meals: { include: { food: { select: { role: true } } }, orderBy: { sort: 'asc' } } } } } });
    if (!e.template) return;
    const t = e.template;
    const scale = portionScale(e.kcal);
    const startsOn = dateAt(e.startsOn);
    const endsOn = new Date(startsOn.getTime() + (PROGRAM_DAYS - 1) * DAY);
    const title = `${PROGRAM_TITLE.en}: ${t.title}`;
    const titleHi = `${PROGRAM_TITLE.hi}: ${t.titleHi || t.title}`;
    const portion = portionNote(e.kcal);
    await this.db.$transaction(async (tx) => {
      // Replace an earlier programme copy (template switched during review).
      await tx.dietPlan.deleteMany({ where: { patientId: e.patientId, title: { startsWith: '🚀' }, status: { in: ['draft', 'active'] } } });
      await tx.exercisePlan.deleteMany({ where: { patientId: e.patientId, title: { startsWith: '🚀' }, status: { in: ['draft', 'active'] } } });
      if (status === 'active') {
        await tx.dietPlan.updateMany({ where: { patientId: e.patientId, status: 'active' }, data: { status: 'ended', endsOn: new Date() } });
        await tx.exercisePlan.updateMany({ where: { patientId: e.patientId, status: 'active' }, data: { status: 'ended', endsOn: new Date() } });
      }
      await tx.dietPlan.create({
        data: {
          patientId: e.patientId, title, titleHi, startsOn, endsOn, status, kcal: e.kcal,
          notes: `${t.notes}\n${portion.en}`.trim(),
          notesHi: `${t.notesHi || t.notes}\n${portion.hi}`.trim(),
          items: {
            create: t.meals.map((m, i) => ({
              day: m.day, slot: m.slot, foodId: m.foodId, sort: i,
              qty: m.food.role === 'grain' ? Math.max(0.5, Math.round(m.qty * scale * 2) / 2) : m.qty,
            })),
          },
        },
      });
      await tx.exercisePlan.create({
        data: {
          patientId: e.patientId, title, titleHi, startsOn, endsOn, status,
          items: { create: t.days.flatMap((d) => (d.exercises as { exerciseId: string; minutes: number }[]).map((x, i) => ({ day: d.day, exerciseId: x.exerciseId, minutes: x.minutes, sort: i, weekdays: [] }))) },
        },
      });
    });
  }

  /** Dietitian approves (optionally switching template); the plan is shared now, so the trial starts today. */
  async approve(enrollmentId: string, staffId: string, templateId?: string) {
    const e = await this.db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    const startsOn = istDate(0);
    await this.db.enrollment.update({
      where: { id: e.id },
      data: { status: 'active', startsOn, reviewedById: staffId, reviewedAt: new Date(), ...(templateId ? { templateId } : {}) },
    });
    const switched = templateId && templateId !== e.templateId;
    const hasCopy = await this.db.dietPlan.count({ where: { patientId: e.patientId, title: { startsWith: '🚀' }, status: 'draft' } });
    if (switched || !hasCopy || startsOn !== e.startsOn) await this.copyPlan(e.id, 'active');
    else {
      await this.db.dietPlan.updateMany({ where: { patientId: e.patientId, status: 'active' }, data: { status: 'ended', endsOn: new Date() } });
      await this.db.dietPlan.updateMany({ where: { patientId: e.patientId, title: { startsWith: '🚀' }, status: 'draft' }, data: { status: 'active' } });
      await this.db.exercisePlan.updateMany({ where: { patientId: e.patientId, title: { startsWith: '🚀' }, status: 'draft' }, data: { status: 'active' } });
    }
    return this.db.enrollment.findUniqueOrThrow({ where: { id: e.id } });
  }

  /**
   * A dietitian shared a plan by hand (Diet plan tab). For someone not paying and not yet in a trial,
   * that starts their 14-day trial today; a waiting (in review) programme counts as approved.
   */
  async startTrialFromPlan(patientId: string, staffId: string) {
    const paid = await this.db.subscription.count({ where: { patientId, status: 'active', endsAt: { gt: new Date() }, plan: { priceInr: { gt: 0 } } } });
    if (paid) return null;
    const open = await this.db.enrollment.findFirst({ where: { patientId, status: { in: ['pending_review', 'active'] } }, orderBy: { createdAt: 'desc' } });
    if (open?.status === 'active') return open;
    if (open) return this.db.enrollment.update({ where: { id: open.id }, data: { status: 'active', startsOn: istDate(0), reviewedById: staffId, reviewedAt: new Date() } });
    if (await this.db.enrollment.count({ where: { patientId } })) return null; // one free trial per person
    const b = await this.baseline(patientId);
    if (b.type === 'care') return null;
    return this.db.enrollment.create({
      data: { patientId, status: 'active', startsOn: istDate(0), kcal: dailyKcal(b), baseline: b as object, riskReasons: riskReasons(b), reviewedById: staffId, reviewedAt: new Date() },
    });
  }

  /** Before (days 1–3) vs after (days 12–14), days followed and weight change, from what was logged. */
  async results(enrollmentId: string) {
    const e = await this.db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    const from = dateAt(e.startsOn);
    const to = new Date(from.getTime() + PROGRAM_DAYS * DAY);
    const dayOf = (at: Date) => Math.floor((at.getTime() - from.getTime()) / DAY) + 1;
    const [readings, weights, ate, meals] = await Promise.all([
      this.db.sugarReading.findMany({ where: { patientId: e.patientId, deletedAt: null, at: { gte: from, lt: to } } }),
      this.db.vital.findMany({ where: { patientId: e.patientId, kind: 'weight', deletedAt: null, at: { gte: new Date(from.getTime() - 2 * DAY), lt: to } }, orderBy: { at: 'asc' } }),
      this.db.appEvent.findMany({ where: { userId: e.patientId, name: 'plan_ate', at: { gte: from, lt: to } }, select: { at: true } }),
      this.db.meal.findMany({ where: { patientId: e.patientId, deletedAt: null, at: { gte: from, lt: to } }, select: { at: true } }),
    ]);
    // A day counts as followed with a plan meal ticked, or at least two meals logged.
    const mealsPerDay = new Map<number, number>();
    for (const m of meals) mealsPerDay.set(dayOf(m.at), (mealsPerDay.get(dayOf(m.at)) ?? 0) + 1);
    const followed = new Set([...ate.map((a) => dayOf(a.at)), ...[...mealsPerDay.entries()].filter(([, n]) => n >= 2).map(([d]) => d)]);
    const rs: DayReading[] = readings.map((r) => ({ day: dayOf(r.at), v: r.value, ctx: r.ctx }));
    const ws = weights.filter((w) => w.weightKg).map((w) => ({ day: Math.max(1, dayOf(w.at)), kg: w.weightKg! }));
    return results(rs, ws, followed.size);
  }

  /**
   * Nightly: trials past day 14 end with their results saved. Paying patients become `converted` and keep
   * their plan; the rest have the trial plan closed (the app then shows results and the offer).
   */
  @Cron('15 1 * * *')
  async completeFinished() {
    const due = await this.db.enrollment.findMany({ where: { status: 'active' } });
    let n = 0;
    for (const e of due) {
      if (programDay(e.startsOn, istDate()) <= PROGRAM_DAYS) continue;
      const paid = await this.db.subscription.count({ where: { patientId: e.patientId, status: 'active', endsAt: { gt: new Date() }, plan: { priceInr: { gt: 0 } } } });
      await this.db.enrollment.update({ where: { id: e.id }, data: { status: paid ? 'converted' : 'completed', result: (await this.results(e.id)) as object, ...(paid ? { convertedAt: e.convertedAt ?? new Date() } : {}) } });
      if (!paid) {
        await this.db.dietPlan.updateMany({ where: { patientId: e.patientId, status: 'active', title: { startsWith: '🚀' } }, data: { status: 'ended', endsOn: new Date() } });
        await this.db.exercisePlan.updateMany({ where: { patientId: e.patientId, status: 'active', title: { startsWith: '🚀' } }, data: { status: 'ended', endsOn: new Date() } });
      }
      n++;
    }
    if (n) this.log.log(`completed ${n} programmes`);
    return n;
  }
}
