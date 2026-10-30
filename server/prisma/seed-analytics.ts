/**
 * Demo usage data for the Analytics page: app visits for the 40 demo patients, 60 newer signups
 * spread over the last 60 days (some never finish onboarding), and anonymous installs that drop
 * out during onboarding. Deterministic and idempotent: skipped when sessions already exist.
 * Run alone: `npx tsx prisma/seed-analytics.ts` (add `--force` to redo it).
 */
import { PrismaClient } from '@prisma/client';

import { LIFECYCLE } from '../src/notify/lifecycle.service';
import { recomputeStats } from '../src/stats/stats';

const DAY = 86400_000;
const MIN = 60_000;
const STEPS = ['open', 'lang', 'mode', 'diet', 'phone', 'otp', 'setup', 'done'];
/** Where time goes, roughly: home first, then logging screens. */
const SCREENS: [string, number][] = [
  ['/', 34], ['/meal', 20], ['/sugar', 12], ['/medicine', 8], ['/walk', 6], ['/chat', 5],
  ['/plan', 4], ['/progress', 4], ['/exercise', 3], ['/vitals', 2], ['/report', 1], ['/family', 1],
];
const GROWTH_NAMES = [
  'Asha', 'Bharat', 'Chitra', 'Deepak', 'Esha', 'Farhan', 'Gauri', 'Harish', 'Indu', 'Jatin', 'Kavita', 'Lalit', 'Meena', 'Naveen', 'Omkar',
  'Pooja', 'Qasim', 'Rekha', 'Suresh', 'Tara', 'Uday', 'Vimla', 'Wasim', 'Yamini', 'Zubair',
];

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedAnalytics(db: PrismaClient, force = false) {
  if (!force && (await db.appSession.count()) > 0) return;
  const r = rng(2026);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const now = Date.now();

  await db.appSession.deleteMany({});
  await db.appInstall.deleteMany({});
  await db.appEvent.deleteMany({});
  await db.notification.deleteMany({ where: { kind: { startsWith: 'life:' } } });
  await db.alertSent.deleteMany({ where: { key: { startsWith: 'life:' } } });
  await db.subscription.deleteMany({ where: { provider: 'demo' } });
  await db.user.deleteMany({ where: { phone: { startsWith: '+9190000001' } } }); // growth users (+91 90000 001NN)

  const screens = (seconds: number) => {
    const total = SCREENS.reduce((n, [, w]) => n + w, 0);
    const out: Record<string, number> = {};
    for (const [s, w] of SCREENS) {
      const v = Math.round((seconds * w * (0.5 + r())) / total);
      if (v > 4) out[s] = v;
    }
    return out;
  };
  const sessions: { id: string; userId: string; installId: string; startedAt: Date; seconds: number; screens: object; platform: string; appVersion: string }[] = [];
  const visit = (userId: string, installId: string, at: number, platform: string) => {
    const seconds = between(90, 540);
    sessions.push({ id: crypto.randomUUID(), userId, installId, startedAt: new Date(at), seconds, screens: screens(seconds), platform, appVersion: r() < 0.7 ? '1.2.0' : '1.1.0' });
  };
  const installs: { id: string; userId: string | null; platform: string; appVersion: string; lang: string; steps: object; firstSeen: Date; lastSeen: Date }[] = [];
  const install = (userId: string | null, firstSeen: number, lastStep: number, lang: string, platform: string) => {
    const id = crypto.randomUUID();
    const steps = Object.fromEntries(STEPS.slice(0, lastStep + 1).map((s, i) => [s, new Date(firstSeen + i * 40_000).toISOString()]));
    installs.push({ id, userId, platform, appVersion: '1.2.0', lang, steps, firstSeen: new Date(firstSeen), lastSeen: new Date(firstSeen) });
    return id;
  };

  // The 40 demo patients: a visit around each day they logged something.
  const core = await db.user.findMany({ where: { role: 'USER', phone: { startsWith: '+9190000000' } }, select: { id: true, lang: true, createdAt: true } });
  for (const u of core) {
    const platform = r() < 0.85 ? 'android' : 'ios';
    const iid = install(u.id, u.createdAt.getTime() - 4 * MIN, STEPS.length - 1, u.lang, platform);
    const [meals, readings] = await Promise.all([
      db.meal.findMany({ where: { patientId: u.id, at: { gte: new Date(now - 30 * DAY) } }, select: { at: true } }),
      db.sugarReading.findMany({ where: { patientId: u.id, at: { gte: new Date(now - 30 * DAY) } }, select: { at: true } }),
    ]);
    const byDay = new Map<number, number>();
    for (const x of [...meals, ...readings]) {
      const d = Math.floor(x.at.getTime() / DAY);
      byDay.set(d, Math.min(byDay.get(d) ?? x.at.getTime(), x.at.getTime()));
    }
    // Before the logged month: most days, at a typical morning time.
    for (let t = u.createdAt.getTime(); t < now - 30 * DAY; t += DAY) if (r() < 0.85) byDay.set(Math.floor(t / DAY), Math.floor(t / DAY) * DAY + between(150, 300) * MIN);
    for (const first of byDay.values()) {
      const n = between(1, 3);
      for (let i = 0; i < n; i++) visit(u.id, iid, Math.min(first + i * between(3, 6) * 3600_000, now - MIN), platform);
    }
  }

  const growth: { id: string; consentAt: number; hasLogs: boolean; type: string }[] = [];
  // Newer signups: more of them recently; 80 % finish onboarding, and use fades over the first weeks.
  const dietitians = await db.user.findMany({ where: { role: 'DIETITIAN' }, select: { id: true } });
  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(60 * (1 - Math.sqrt(r())));
    const created = now - daysAgo * DAY - between(1, 600) * MIN;
    const onboarded = r() < 0.8;
    const lang = r() < 0.6 ? 'hi' : 'en';
    const platform = r() < 0.85 ? 'android' : 'ios';
    const type = pick(['type2', 'type2', 'type2', 'pre', 'type1', 'care']);
    const user = await db.user.create({
      data: {
        phone: `+91900000${(100 + i).toString().padStart(4, '0')}`, name: onboarded ? `${pick(GROWTH_NAMES)} ${pick(['ji', 'Devi', 'Kumar', 'Singh', ''])}`.trim() : '',
        lang, role: 'USER', createdAt: new Date(created),
        patient: {
          create: onboarded
            ? {
                type, ageGroup: pick(['adult', 'senior', 'senior']), diet: pick(['veg', 'veg', 'egg', 'nonveg']),
                consentVer: 1, consentAt: new Date(created + 5 * MIN), assignedDietitianId: type === 'care' ? null : dietitians[i % dietitians.length]?.id,
              }
            : {},
        },
      },
    });
    const iid = install(user.id, created - 4 * MIN, onboarded ? STEPS.length - 1 : STEPS.indexOf('otp'), lang, platform);
    visit(user.id, iid, created, platform);
    if (!onboarded) continue;
    const meals = [];
    const readings = [];
    for (let k = 1; k <= daysAgo; k++) {
      if (r() > 0.15 + 0.6 * Math.exp(-k / 12)) continue;
      const at = created + k * DAY + between(-180, 180) * MIN;
      if (at > now) break;
      for (let j = between(1, 2) - 1; j >= 0; j--) if (at + j * 4 * 3600_000 < now) visit(user.id, iid, at + j * 4 * 3600_000, platform);
      if (r() < 0.7) meals.push({ id: crypto.randomUUID(), patientId: user.id, slot: pick(['breakfast', 'lunch', 'dinner']), at: new Date(at), items: [{ id: 'roti', q: 2 }, { id: 'dal', q: 1 }], carbs: 52, protein: 14, fiber: 8, kcal: 380, updatedAt: new Date(at) });
      if (r() < 0.5) readings.push({ id: crypto.randomUUID(), patientId: user.id, value: between(95, 230), ctx: pick(['fasting', 'after', 'random']), at: new Date(at), updatedAt: new Date(at) });
    }
    if (meals.length) await db.meal.createMany({ data: meals });
    if (readings.length) await db.sugarReading.createMany({ data: readings });
    await recomputeStats(db, user.id);
    growth.push({ id: user.id, consentAt: created + 5 * MIN, hasLogs: meals.length + readings.length > 0, type });
  }

  // People who installed but stopped before verifying their phone.
  for (let i = 0; i < 90; i++) {
    const last = pick([0, 0, 1, 1, 2, 3, 3, 4, 4, 4]);
    install(null, now - Math.floor(60 * (1 - Math.sqrt(r()))) * DAY - between(1, 900) * MIN, last, r() < 0.6 ? 'hi' : 'en', r() < 0.85 ? 'android' : 'ios');
  }

  // Product events on days people opened the app: plan meals ticked, exercise videos watched, exercises finished.
  const [dietPlans, exPlans, exercises] = await Promise.all([
    db.dietPlan.findMany({ where: { status: 'active' }, select: { id: true, patientId: true, startsOn: true } }),
    db.exercisePlan.findMany({ where: { status: 'active' }, select: { patientId: true, items: { select: { exerciseId: true, minutes: true } } } }),
    db.exercise.findMany({ select: { id: true, nameEn: true, videos: true } }),
  ]);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const firstVisit = new Map<string, Map<number, number>>();
  for (const v of sessions) {
    const days = firstVisit.get(v.userId) ?? new Map<number, number>();
    const d = Math.floor(v.startedAt.getTime() / DAY);
    days.set(d, Math.min(days.get(d) ?? Infinity, v.startedAt.getTime()));
    firstVisit.set(v.userId, days);
  }
  const events: { id: string; userId: string; name: string; props: object; at: Date }[] = [];
  const ev = (userId: string, name: string, props: object, at: number) => events.push({ id: crypto.randomUUID(), userId, name, props, at: new Date(Math.min(at, now - MIN)) });
  for (const pl of dietPlans) {
    for (const t of firstVisit.get(pl.patientId)?.values() ?? []) {
      if (t < pl.startsOn.getTime()) continue;
      for (const slot of ['breakfast', 'lunch', 'dinner']) if (r() < 0.45) ev(pl.patientId, 'plan_ate', { planId: pl.id, slot, items: between(2, 4) }, t + between(0, 600) * MIN);
    }
  }
  for (const pl of exPlans) {
    for (const t of firstVisit.get(pl.patientId)?.values() ?? []) {
      const item = pick(pl.items);
      const ex = item && exById.get(item.exerciseId);
      if (!ex) continue;
      const vids = (ex.videos as { id: string; title: string }[]) ?? [];
      if (r() < 0.2) ev(pl.patientId, 'video_play', { videoId: vids[0]?.id ?? `demo-${ex.id}`, title: vids[0]?.title ?? ex.nameEn, seconds: between(20, 240) }, t + 30 * MIN);
      if (r() < 0.35) ev(pl.patientId, 'exercise_done', { exerciseId: ex.id, minutes: item.minutes }, t + 45 * MIN);
    }
  }
  await db.appEvent.createMany({ data: events });

  // First-week messages already sent to newer signups (the hourly job sends the rest).
  let life = 0;
  for (const g of growth.filter((x) => x.type !== 'care')) {
    for (const [kind, afterH] of [[g.hasLogs ? 'life:day2:active' : 'life:day2:new', 30], ['life:day7', 150]] as const) {
      const sentAt = g.consentAt + afterH * 3600_000;
      if (sentAt > now) continue;
      const { fromH: _f, toH: _t, ...copy } = LIFECYCLE[kind];
      await db.notification.create({
        data: {
          ...copy, kind, audience: { userIds: [g.id] }, scheduledAt: new Date(sentAt), sentAt: new Date(sentAt), recipients: 1,
          receipts: { create: [{ userId: g.id, readAt: r() < 0.55 ? new Date(sentAt + between(5, 600) * MIN) : null }] },
        },
      });
      await db.alertSent.create({ data: { patientId: g.id, key: kind } });
      life++;
    }
  }

  // Subscription history: renewals for today's paid patients, some who stopped paying, and newer signups who upgraded.
  const subs: { patientId: string; planId: string; status: string; startsAt: Date; endsAt: Date; provider: string }[] = [];
  const paid = await db.subscription.findMany({ where: { provider: { not: 'demo' }, status: 'active' }, select: { patientId: true, planId: true, startsAt: true } });
  for (const p of paid) {
    for (let k = 1; k <= between(1, 4); k++) {
      const start = p.startsAt.getTime() - k * 30 * DAY;
      subs.push({ patientId: p.patientId, planId: p.planId, status: 'expired', startsAt: new Date(start), endsAt: new Date(start + 30 * DAY), provider: 'demo' });
    }
  }
  const free = await db.patient.findMany({ where: { tier: 'FREE', type: { not: 'care' }, user: { phone: { startsWith: '+9190000000' } } }, select: { userId: true }, take: 8 });
  for (const f of free) {
    const end = now - between(2, 28) * DAY;
    for (let k = 0; k < between(1, 3); k++) subs.push({ patientId: f.userId, planId: 'basic', status: 'expired', startsAt: new Date(end - (k + 1) * 30 * DAY), endsAt: new Date(end - k * 30 * DAY), provider: 'demo' });
  }
  for (const g of growth.filter((x) => x.type !== 'care' && x.hasLogs)) {
    if (r() > 0.18) continue;
    const start = g.consentAt + between(3, 9) * DAY;
    if (start > now) continue;
    const planId = r() < 0.7 ? 'basic' : 'pro';
    subs.push({ patientId: g.id, planId, status: 'active', startsAt: new Date(start), endsAt: new Date(start + 30 * DAY), provider: 'demo' });
    await db.patient.update({ where: { userId: g.id }, data: { tier: planId === 'pro' ? 'PRO' : 'BASIC', tierUntil: new Date(start + 30 * DAY) } });
  }
  await db.subscription.createMany({ data: subs });

  await db.appInstall.createMany({ data: installs });
  await db.appSession.createMany({ data: sessions.filter((s) => s.startedAt.getTime() <= now) });
  console.log(`Analytics demo: ${installs.length} installs, ${sessions.length} visits, ${events.length} events, ${life} first-week messages, ${subs.length} subscriptions.`);
}

if (require.main === module) {
  const db = new PrismaClient();
  seedAnalytics(db, process.argv.includes('--force'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
