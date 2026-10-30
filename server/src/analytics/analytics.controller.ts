import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, type PrismaClient } from '@prisma/client';

import { Public, Roles } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';

const DAY = 86400_000;
const IST_MS = 330 * 60_000;
/** Onboarding steps in the order the app shows them; the funnel counts installs that reached each. */
export const STEPS = ['open', 'lang', 'mode', 'diet', 'phone', 'otp', 'setup', 'done'] as const;
const MAX_SESSION_S = 6 * 3600;
const MAX_SCREENS = 40;

/** An IST calendar day (YYYY-MM-DD) from a UTC timestamp column. */
const istDay = (col: string) => Prisma.raw(`to_char((${col} at time zone 'UTC') at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`);
/** Midnight IST, `daysAgo` days back, as a UTC Date. */
const istMidnight = (daysAgo: number, now = Date.now()) => new Date(Math.floor((now + IST_MS) / DAY) * DAY - IST_MS - daysAgo * DAY);
const dayKey = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

export type SessionIn = { id: string; startedAt: number; seconds: number; screens?: Record<string, number>; platform?: string; appVersion?: string };

const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** Stores finished app visits from the outbox; repeats of the same id are ignored. Links the install to the user. */
export async function saveSessions(db: PrismaClient | PrismaService, userId: string, sessions: SessionIn[] | undefined, installId: string | undefined) {
  const id = str(installId, 64);
  if (id) await db.appInstall.updateMany({ where: { id, userId: null }, data: { userId } });
  if (!sessions?.length) return;
  const rows = sessions
    .filter((s) => str(s.id, 64) && Number.isFinite(s.startedAt) && Number.isInteger(s.seconds) && s.seconds > 0 && s.seconds <= MAX_SESSION_S && s.startedAt <= Date.now() + 60_000)
    .map((s) => ({
      id: s.id, userId, installId: id, startedAt: new Date(s.startedAt), seconds: s.seconds,
      screens: Object.fromEntries(
        Object.entries(s.screens ?? {})
          .filter(([k, v]) => k.length <= 60 && Number.isInteger(v) && v >= 0 && v <= MAX_SESSION_S)
          .slice(0, MAX_SCREENS),
      ),
      platform: str(s.platform, 20), appVersion: str(s.appVersion, 20),
    }));
  // Another user's id is never overwritten: createMany skips existing rows.
  await db.appSession.createMany({ data: rows, skipDuplicates: true });
}

export type AppEventIn = { id: string; name: string; props?: Record<string, unknown>; at: number };
const EVENT_NAMES = ['plan_ate', 'video_play', 'exercise_done', 'reel_view', 'reel_save', 'reel_share', 'invite_share'];
const MAX_PROPS_CHARS = 500;

/** Stores product events from the outbox (diet plan followed, video watched, exercise done); repeats are ignored. */
export async function saveAppEvents(db: PrismaClient | PrismaService, userId: string, events: AppEventIn[] | undefined) {
  if (!events?.length) return;
  const rows = events
    .filter((e) => str(e.id, 64) && EVENT_NAMES.includes(e.name) && Number.isFinite(e.at) && e.at <= Date.now() + 60_000 && JSON.stringify(e.props ?? {}).length <= MAX_PROPS_CHARS)
    .map((e) => ({ id: e.id, userId, name: e.name, props: (e.props ?? {}) as object, at: new Date(e.at) }));
  await db.appEvent.createMany({ data: rows, skipDuplicates: true });
}

type Daily = { day: string; signups: number; onboarded: number; active: number; sessions: number; minutesPerUser: number };

/** Install funnel (no login needed) and owner-only product analytics. */
@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly db: PrismaService) {}

  /** The phone reports which onboarding steps this install has reached; earliest time per step wins. */
  @Public()
  @Post('analytics/install')
  @HttpCode(200)
  async install(@Body() b: { id: string; platform: string; appVersion?: string; lang?: string; steps?: Record<string, number> }) {
    const id = str(b?.id, 64);
    const platform = str(b?.platform, 20);
    if (!id || !platform) throw new BadRequestException('bad_install');
    const steps = Object.fromEntries(
      Object.entries(b.steps ?? {})
        .filter(([k, v]) => (STEPS as readonly string[]).includes(k) && Number.isFinite(v))
        .map(([k, v]) => [k, new Date(Math.min(v, Date.now())).toISOString()]),
    );
    const old = await this.db.appInstall.findUnique({ where: { id }, select: { steps: true } });
    const merged = { ...steps, ...((old?.steps as Record<string, string>) ?? {}) };
    const data = { platform, appVersion: str(b.appVersion, 20), lang: str(b.lang, 5), steps: merged, lastSeen: new Date() };
    await this.db.appInstall.upsert({ where: { id }, create: { id, ...data }, update: data });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Roles('OWNER')
  @Get('admin/analytics')
  async report(@Query('days') daysQ?: string) {
    const days = Math.min(Math.max(Number(daysQ) || 30, 7), 180);
    const since = istMidnight(days - 1);
    const prevSince = new Date(since.getTime() - days * DAY);
    const db = this.db;

    const [signups, activity, totals, windows, period, prev, funnel, cohorts, features, screens, ops, unassigned, waiting] = await Promise.all([
      db.$queryRaw<{ day: string; signups: number; onboarded: number }[]>`
        select ${istDay('u."createdAt"')} as day, count(*)::int as signups, count(p."consentAt")::int as onboarded
        from "User" u left join "Patient" p on p."userId" = u.id
        where u.role = 'USER' and u."createdAt" >= ${since} group by 1`,
      db.$queryRaw<{ day: string; active: number; sessions: number; seconds: number }[]>`
        select ${istDay('"startedAt"')} as day, count(distinct "userId")::int as active, count(*)::int as sessions, sum(seconds)::int as seconds
        from "AppSession" where "startedAt" >= ${since} group by 1`,
      db.$queryRaw<[{ users: number; patients: number; caregivers: number; onboarded: number; before: number }]>`
        select count(*)::int as users,
          count(*) filter (where coalesce(p.type, '') <> 'care')::int as patients,
          count(*) filter (where p.type = 'care')::int as caregivers,
          count(p."consentAt")::int as onboarded,
          count(*) filter (where u."createdAt" < ${since})::int as before
        from "User" u left join "Patient" p on p."userId" = u.id where u.role = 'USER'`,
      db.$queryRaw<[{ dau: number; wau: number; mau: number }]>`
        select count(distinct "userId") filter (where "startedAt" >= ${istMidnight(0)})::int as dau,
          count(distinct "userId") filter (where "startedAt" >= ${istMidnight(6)})::int as wau,
          count(distinct "userId")::int as mau
        from "AppSession" where "startedAt" >= ${istMidnight(29)}`,
      this.engagement(since, new Date()),
      Promise.all([this.engagement(prevSince, since), db.user.count({ where: { role: 'USER', createdAt: { gte: prevSince, lt: since } } })]),
      db.$queryRaw<Record<string, number>[]>`
        select count(*)::int as installs,
          ${Prisma.join(STEPS.map((s) => Prisma.sql`count(*) filter (where steps ? ${s})::int as ${Prisma.raw(`"${s}"`)}`))},
          count(*) filter (where i."userId" is not null and (
            exists (select 1 from "Meal" m where m."patientId" = i."userId") or
            exists (select 1 from "SugarReading" r where r."patientId" = i."userId") or
            exists (select 1 from "DoseLog" d where d."patientId" = i."userId")))::int as "firstLog",
          count(*) filter (where (
            select count(distinct ${istDay('s."startedAt"')}) from "AppSession" s
            where s."userId" = i."userId" and s."startedAt" < i."firstSeen" + interval '7 days') >= 3)::int as "week1"
        from "AppInstall" i where i."firstSeen" >= ${since}`,
      this.retention(),
      db.$queryRaw<{ feature: string; actions: number; users: number }[]>`
        select 'meals' as feature, count(*)::int as actions, count(distinct "patientId")::int as users from "Meal" where "deletedAt" is null and "at" >= ${since}
        union all select 'sugar', count(*)::int, count(distinct "patientId")::int from "SugarReading" where "deletedAt" is null and "at" >= ${since}
        union all select 'medicine', count(*)::int, count(distinct "patientId")::int from "DoseLog" where status = 'taken' and date >= ${dayKey(since)}
        union all select 'walk', count(*)::int, count(distinct "patientId")::int from "DailyActivity" where "walkMin" > 0 and date >= ${dayKey(since)}
        union all select 'vitals', count(*)::int, count(distinct "patientId")::int from "Vital" where "deletedAt" is null and "at" >= ${since}
        union all select 'chat', count(*)::int, count(distinct "patientId")::int from "ChatMessage" where not "fromStaff" and "createdAt" >= ${since}`,
      db.$queryRaw<{ screen: string; minutes: number; users: number }[]>`
        select k as screen, round(sum(v::int) / 60.0, 1)::float as minutes, count(distinct s."userId")::int as users
        from "AppSession" s, jsonb_each_text(s.screens) as e(k, v)
        where s."startedAt" >= ${since} group by k order by 2 desc limit 15`,
      this.ops(since),
      db.patient.count({ where: { assignedDietitianId: null, type: { not: 'care' }, consentAt: { not: null }, user: { role: 'USER', active: true } } }),
      db.$queryRaw<[{ n: number }]>`
        select count(*)::int as n from (
          select distinct on ("patientId") "fromStaff" from "ChatMessage" order by "patientId", "createdAt" desc) last
        where not last."fromStaff"`,
    ]);

    // Every day in the range, including quiet ones.
    const sMap = new Map(signups.map((r) => [r.day, r]));
    const aMap = new Map(activity.map((r) => [r.day, r]));
    let cumulative = totals[0].before;
    const daily: (Daily & { users: number })[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = dayKey(new Date(istMidnight(i).getTime() + 1));
      const s = sMap.get(day);
      const a = aMap.get(day);
      cumulative += s?.signups ?? 0;
      daily.push({
        day, signups: s?.signups ?? 0, onboarded: s?.onboarded ?? 0, users: cumulative,
        active: a?.active ?? 0, sessions: a?.sessions ?? 0, minutesPerUser: a?.active ? round(a.seconds / 60 / a.active) : 0,
      });
    }
    const w = windows[0];
    const f = funnel[0];
    const [prevEng, prevNew] = prev;
    return {
      days,
      kpis: {
        totalUsers: totals[0].users, patients: totals[0].patients, caregivers: totals[0].caregivers,
        onboardedPct: pct(totals[0].onboarded, totals[0].users),
        newUsers: daily.reduce((n, d) => n + d.signups, 0), prevNewUsers: prevNew,
        dau: w.dau, wau: w.wau, mau: w.mau, stickiness: pct(w.dau, w.mau),
        activeUsers: period.users, prevActiveUsers: prevEng.users,
        minutesPerDay: period.minutesPerDay, prevMinutesPerDay: prevEng.minutesPerDay,
        sessionMinutes: period.sessionMinutes, sessionsPerDay: period.sessionsPerDay,
        unassigned, waitingChats: waiting[0].n,
      },
      daily,
      funnel: [
        ...STEPS.map((s) => ({ step: s, count: f[s] ?? 0 })),
        { step: 'firstLog', count: f.firstLog ?? 0 },
        { step: 'week1', count: f.week1 ?? 0 },
      ],
      retention: cohorts,
      features: features.map((x) => ({ ...x, pctOfActive: pct(x.users, period.users) })),
      screens,
      segments: await this.segments(since),
      ops,
      ...(await this.extras(since)),
    };
  }

  /** Active users, minutes per active day and session length between two times. */
  private async engagement(from: Date, to: Date) {
    const [r] = await this.db.$queryRaw<[{ users: number; userDays: number; sessions: number; seconds: number }]>`
      select count(distinct "userId")::int as users, count(distinct ("userId", ${istDay('"startedAt"')}))::int as "userDays",
        count(*)::int as sessions, coalesce(sum(seconds), 0)::int as seconds
      from "AppSession" where "startedAt" >= ${from} and "startedAt" < ${to}`;
    return {
      users: r.users,
      minutesPerDay: r.userDays ? round(r.seconds / 60 / r.userDays) : 0,
      sessionMinutes: r.sessions ? round(r.seconds / 60 / r.sessions) : 0,
      sessionsPerDay: r.userDays ? round(r.sessions / r.userDays) : 0,
    };
  }

  /** Weekly signup cohorts (last 8 weeks): share of each cohort that opened the app in week 0, 1, 2… after joining. */
  private async retention() {
    const rows = await this.db.$queryRaw<{ cohort: string; size: number; week: number | null; active: number }[]>`
      with c as (
        select u.id, date_trunc('week', (u."createdAt" at time zone 'UTC') at time zone 'Asia/Kolkata') as cw
        from "User" u where u.role = 'USER' and u."createdAt" >= now() - interval '56 days'),
      sizes as (select cw, count(*)::int as size from c group by cw),
      act as (
        select c.cw, floor(extract(epoch from (((s."startedAt" at time zone 'UTC') at time zone 'Asia/Kolkata') - c.cw)) / 604800)::int as week, s."userId"
        from "AppSession" s join c on c.id = s."userId")
      select to_char(sizes.cw, 'YYYY-MM-DD') as cohort, sizes.size, act.week, count(distinct act."userId")::int as active
      from sizes left join act on act.cw = sizes.cw and act.week >= 0
      group by 1, 2, 3 order by 1, 3`;
    const out = new Map<string, { cohort: string; size: number; weeks: (number | null)[] }>();
    const thisWeek = Math.floor((Date.now() + IST_MS) / DAY);
    for (const r of rows) {
      const start = Math.floor(new Date(`${r.cohort}T00:00:00Z`).getTime() / DAY);
      const elapsed = Math.floor((thisWeek - start) / 7);
      const c = out.get(r.cohort) ?? { cohort: r.cohort, size: r.size, weeks: Array.from({ length: 8 }, (_, i) => (i <= elapsed ? 0 : null)) };
      if (r.week !== null && r.week < 8 && r.week <= elapsed) c.weeks[r.week] = pct(r.active, r.size);
      out.set(r.cohort, c);
    }
    return [...out.values()];
  }

  /** Users, active users and minutes per active day, split by language, age group, diet, type, plan and phone. */
  private async segments(since: Date) {
    const dims: Record<string, string> = { lang: 'u.lang', ageGroup: 'p."ageGroup"', diet: 'p.diet', type: 'p.type', tier: 'p.tier::text' };
    const one = (col: string) =>
      this.db.$queryRaw<{ key: string; users: number; active: number; minutesPerDay: number }[]>`
        with s as (
          select "userId", count(distinct ${istDay('"startedAt"')}) as days, sum(seconds) as seconds
          from "AppSession" where "startedAt" >= ${since} group by 1)
        select coalesce(${Prisma.raw(col)}, 'unknown') as key, count(*)::int as users, count(s."userId")::int as active,
          coalesce(round(sum(s.seconds) / 60.0 / nullif(sum(s.days), 0), 1), 0)::float as "minutesPerDay"
        from "User" u join "Patient" p on p."userId" = u.id left join s on s."userId" = u.id
        where u.role = 'USER' group by 1 order by 2 desc`;
    const platform = this.db.$queryRaw<{ key: string; users: number; active: number; minutesPerDay: number }[]>`
      select coalesce(platform, 'unknown') as key, count(distinct "userId")::int as users, count(distinct "userId")::int as active,
        round(sum(seconds) / 60.0 / nullif(count(distinct ("userId", ${istDay('"startedAt"')})), 0), 1)::float as "minutesPerDay"
      from "AppSession" where "startedAt" >= ${since} group by 1 order by 2 desc`;
    const keys = Object.keys(dims);
    const res = await Promise.all([...keys.map((k) => one(dims[k])), platform]);
    return Object.fromEntries([...keys, 'platform'].map((k, i) => [k, res[i]]));
  }

  /** Diet plan and exercise video use, first-week messages, outcomes by signup week, and revenue. */
  async extras(since: Date) {
    const db = this.db;
    const [plan, videos, topVideos, exercise, lifecycle, outcomeWeeks, outcomeA1c, revenue, kickstart, reels] = await Promise.all([
      db.$queryRaw<[{ patients: number; followers: number; followDays: number; planDays: number }]>`
        with p as (
          select "patientId", greatest("startsOn", ${since}) as f from "DietPlan" where status = 'active' and "startsOn" < now()),
        e as (
          select distinct "userId", ${istDay('"at"')} as day from "AppEvent" where name = 'plan_ate' and "at" >= ${since})
        select (select count(distinct "patientId") from p)::int as patients,
          (select count(distinct e."userId") from e join p on p."patientId" = e."userId")::int as followers,
          (select count(*) from e join p on p."patientId" = e."userId")::int as "followDays",
          coalesce((select sum(ceil(extract(epoch from (now() - f)) / 86400)) from p), 0)::int as "planDays"`,
      db.$queryRaw<[{ plays: number; users: number; avgSec: number }]>`
        select count(*)::int as plays, count(distinct "userId")::int as users, coalesce(round(avg((props->>'seconds')::int)), 0)::int as "avgSec"
        from "AppEvent" where name = 'video_play' and "at" >= ${since}`,
      db.$queryRaw<{ videoId: string; title: string; plays: number; users: number; avgSec: number }[]>`
        select props->>'videoId' as "videoId", max(props->>'title') as title, count(*)::int as plays, count(distinct "userId")::int as users,
          round(avg((props->>'seconds')::int))::int as "avgSec"
        from "AppEvent" where name = 'video_play' and "at" >= ${since} group by 1 order by 3 desc limit 8`,
      db.$queryRaw<[{ done: number; users: number; minutes: number }]>`
        select count(*)::int as done, count(distinct "userId")::int as users, coalesce(sum((props->>'minutes')::int), 0)::int as minutes
        from "AppEvent" where name = 'exercise_done' and "at" >= ${since}`,
      // Did the first-week message bring people back? "Returned" = opened the app within 48 h of it.
      db.$queryRaw<{ kind: string; sent: number; opened: number; returned: number }[]>`
        select n.kind, count(*)::int as sent, count(r."readAt")::int as opened,
          count(*) filter (where exists (select 1 from "AppSession" s where s."userId" = r."userId" and s."startedAt" between n."sentAt" and n."sentAt" + interval '48 hours'))::int as returned
        from "Notification" n join "NotificationReceipt" r on r."notificationId" = n.id
        where n.kind like 'life:%' and n."sentAt" >= ${since} group by 1 order by 1`,
      db.$queryRaw<{ cohort: string; week: number; inRange: number; n: number }[]>`
        with c as (
          select u.id, date_trunc('week', (u."createdAt" at time zone 'UTC') at time zone 'Asia/Kolkata') as cw
          from "User" u join "Patient" p on p."userId" = u.id
          where u.role = 'USER' and p.type <> 'care' and u."createdAt" >= now() - interval '56 days')
        select to_char(c.cw, 'YYYY-MM-DD') as cohort,
          floor(extract(epoch from (((r."at" at time zone 'UTC') at time zone 'Asia/Kolkata') - c.cw)) / 604800)::int as week,
          round(avg(case when r.value between 70 and 180 then 100.0 else 0 end))::int as "inRange", count(*)::int as n
        from "SugarReading" r join c on c.id = r."patientId" where r."deletedAt" is null group by 1, 2 having count(*) >= 3 order by 1, 2`,
      // Estimated HbA1c (from average sugar) in each person's first 2 weeks of readings vs the last 2 weeks; lab values when entered.
      db.$queryRaw<{ cohort: string; size: number; startA1c: number | null; nowA1c: number | null; labA1c: number | null }[]>`
        with c as (
          select u.id, date_trunc('week', (u."createdAt" at time zone 'UTC') at time zone 'Asia/Kolkata') as cw
          from "User" u join "Patient" p on p."userId" = u.id
          where u.role = 'USER' and p.type <> 'care' and u."createdAt" >= now() - interval '56 days'),
        f as (select "patientId", min("at") as first from "SugarReading" where "deletedAt" is null group by 1),
        per as (
          select c.cw, c.id,
            avg(r.value) filter (where r."at" < f.first + interval '14 days') as start,
            avg(r.value) filter (where r."at" >= now() - interval '14 days' and r."at" >= f.first + interval '14 days') as recent
          from c left join "SugarReading" r on r."patientId" = c.id and r."deletedAt" is null left join f on f."patientId" = c.id
          group by 1, 2)
        select to_char(per.cw, 'YYYY-MM-DD') as cohort, count(*)::int as size,
          round(((avg(per.start) + 46.7) / 28.7)::numeric, 1)::float as "startA1c",
          round(((avg(per.recent) + 46.7) / 28.7)::numeric, 1)::float as "nowA1c",
          round((select avg(k.value) from "Checkup" k join c c2 on c2.id = k."patientId" where k.kind = 'a1c' and k.value is not null and c2.cw = per.cw)::numeric, 1)::float as "labA1c"
        from per group by per.cw order by 1`,
      this.revenue(since),
      this.kickstart(since),
      this.reels(since),
    ]);
    const cohorts = new Map<string, (number | null)[]>();
    for (const r of outcomeWeeks) {
      if (r.week < 0 || r.week > 7) continue;
      const row = cohorts.get(r.cohort) ?? Array<number | null>(8).fill(null);
      row[r.week] = r.inRange;
      cohorts.set(r.cohort, row);
    }
    const p = plan[0];
    return {
      engagement: {
        plan: { patients: p.patients, followers: p.followers, followDaysPct: pct(p.followDays, p.planDays) },
        videos: { ...videos[0], top: topVideos },
        exercise: exercise[0],
        reels,
      },
      lifecycle: lifecycle.map((l) => ({ ...l, openedPct: pct(l.opened, l.sent), returnedPct: pct(l.returned, l.sent) })),
      outcomes: outcomeA1c.map((o) => ({ ...o, inRange: cohorts.get(o.cohort) ?? Array(8).fill(null) })),
      revenue,
      kickstart,
    };
  }

  /**
   * 14-day Kickstart funnel for programmes started in the period: enrolled → still opening the app on day 7+ →
   * completed → improved → paid afterwards; plus the average fasting change of completed ones.
   */
  /** Reels: views (a reel counts once it was on screen 3 s or more), viewers, watch time, saves and shares, and the top reels. */
  private async reels(since: Date) {
    const [totals, top] = await Promise.all([
      this.db.$queryRaw<[{ views: number; viewers: number; avgSec: number; saves: number; shares: number }]>`
        select count(*) filter (where name = 'reel_view')::int as views,
          count(distinct "userId") filter (where name = 'reel_view')::int as viewers,
          coalesce(round(avg((props->>'seconds')::int) filter (where name = 'reel_view')), 0)::int as "avgSec",
          count(*) filter (where name = 'reel_save')::int as saves,
          count(*) filter (where name = 'reel_share')::int as shares
        from "AppEvent" where name in ('reel_view', 'reel_save', 'reel_share') and "at" >= ${since}`,
      this.db.$queryRaw<{ reelId: string; title: string | null; views: number; viewers: number; avgSec: number; saves: number; shares: number }[]>`
        select e.props->>'reelId' as "reelId", max(r."titleEn") as title,
          count(*) filter (where e.name = 'reel_view')::int as views,
          count(distinct e."userId") filter (where e.name = 'reel_view')::int as viewers,
          coalesce(round(avg((e.props->>'seconds')::int) filter (where e.name = 'reel_view')), 0)::int as "avgSec",
          count(*) filter (where e.name = 'reel_save')::int as saves,
          count(*) filter (where e.name = 'reel_share')::int as shares
        from "AppEvent" e left join "Reel" r on r.id = e.props->>'reelId'
        where e.name in ('reel_view', 'reel_save', 'reel_share') and e."at" >= ${since}
        group by 1 order by 3 desc limit 10`,
    ]);
    return { ...totals[0], top };
  }

  private async kickstart(since: Date) {
    const [r] = await this.db.$queryRaw<[{ enrolled: number; review: number; day7: number; completed: number; improved: number; paid: number; fastingChange: number | null }]>`
      with e as (
        select en.*, (en."startsOn"::date at time zone 'Asia/Kolkata') at time zone 'UTC' as start_utc
        from "Enrollment" en where en."createdAt" >= ${since})
      select count(*)::int as enrolled,
        count(*) filter (where e.status = 'pending_review')::int as review,
        count(*) filter (where exists (select 1 from "AppSession" s where s."userId" = e."patientId" and s."startedAt" >= e.start_utc + interval '6 days'))::int as day7,
        count(*) filter (where e.status in ('completed', 'converted'))::int as completed,
        count(*) filter (where (e.result->>'improved')::boolean)::int as improved,
        count(*) filter (where exists (
          select 1 from "Subscription" sub join "SubscriptionPlan" sp on sp.id = sub."planId"
          where sub."patientId" = e."patientId" and sp."priceInr" > 0 and sub."startsAt" >= e."createdAt"))::int as paid,
        round(avg(((e.result->>'fastingAfter')::numeric - (e.result->>'fastingBefore')::numeric)) filter (where e.result->>'fastingAfter' is not null and e.result->>'fastingBefore' is not null), 1)::float as "fastingChange"
      from e`;
    return { ...r, completionPct: pct(r.completed, r.enrolled), conversionPct: pct(r.paid, r.completed) };
  }

  /** Subscriptions: monthly recurring revenue, paying users, conversion, new and churned, and money in per month. */
  private async revenue(since: Date) {
    const db = this.db;
    const [now, start, newPaid, churned, monthly, byPlan, onboarded] = await Promise.all([
      db.$queryRaw<[{ paying: number; mrr: number }]>`
        select count(distinct s."patientId")::int as paying, coalesce(sum(p."priceInr"::float / greatest(p.months, 1)), 0)::int as mrr
        from "Subscription" s join "SubscriptionPlan" p on p.id = s."planId"
        where s.status = 'active' and s."startsAt" <= now() and s."endsAt" > now() and p."priceInr" > 0`,
      db.$queryRaw<[{ n: number }]>`
        select count(distinct "patientId")::int as n from "Subscription" s join "SubscriptionPlan" p on p.id = s."planId"
        where p."priceInr" > 0 and s."startsAt" < ${since} and s."endsAt" >= ${since}`,
      db.$queryRaw<[{ n: number }]>`
        select count(*)::int as n from (
          select s."patientId", min(s."startsAt") as first from "Subscription" s join "SubscriptionPlan" p on p.id = s."planId"
          where p."priceInr" > 0 group by 1) x where x.first >= ${since}`,
      // Churned: was paying, the last paid period ended in this window, and nothing active now.
      db.$queryRaw<[{ n: number }]>`
        select count(*)::int as n from (
          select s."patientId", max(s."endsAt") as last from "Subscription" s join "SubscriptionPlan" p on p.id = s."planId"
          where p."priceInr" > 0 group by 1) x
        where x.last >= ${since} and x.last < now()`,
      db.$queryRaw<{ month: string; revenue: number; payments: number }[]>`
        select to_char(date_trunc('month', (s."startsAt" at time zone 'UTC') at time zone 'Asia/Kolkata'), 'YYYY-MM') as month,
          sum(p."priceInr")::int as revenue, count(*)::int as payments
        from "Subscription" s join "SubscriptionPlan" p on p.id = s."planId"
        where p."priceInr" > 0 and s."startsAt" >= date_trunc('month', now()) - interval '5 months' group by 1 order by 1`,
      db.$queryRaw<{ plan: string; price: number; active: number }[]>`
        select p.name as plan, p."priceInr" as price, count(s.id) filter (where s.status = 'active' and s."startsAt" <= now() and s."endsAt" > now())::int as active
        from "SubscriptionPlan" p left join "Subscription" s on s."planId" = p.id where p."priceInr" > 0 group by 1, 2 order by 2`,
      db.patient.count({ where: { type: { not: 'care' }, consentAt: { not: null } } }),
    ]);
    const n = now[0];
    return {
      mrr: n.mrr, paying: n.paying, conversionPct: pct(n.paying, onboarded), arppu: n.paying ? Math.round(n.mrr / n.paying) : 0,
      newPaid: newPaid[0].n, churned: churned[0].n, churnPct: pct(churned[0].n, start[0].n), monthly, byPlan,
    };
  }

  /** Per dietitian: patients, how many were active, messages sent and the median time to answer a patient. */
  private async ops(since: Date) {
    const [staff, replies] = await Promise.all([
      this.db.$queryRaw<{ id: string; name: string; patients: number; active: number; sent: number }[]>`
        select d.id, d.name,
          (select count(*) from "Patient" p where p."assignedDietitianId" = d.id)::int as patients,
          (select count(distinct s."userId") from "AppSession" s join "Patient" p on p."userId" = s."userId"
            where p."assignedDietitianId" = d.id and s."startedAt" >= ${since})::int as active,
          (select count(*) from "ChatMessage" m where m."senderId" = d.id and m."createdAt" >= ${since})::int as sent
        from "User" d where d.role = 'DIETITIAN' and d.active order by 3 desc`,
      // A question is a patient message that follows a staff message (or opens the chat); the answer is the next staff message.
      this.db.$queryRaw<{ dietitianId: string | null; asked: number; answered: number; medianMin: number | null }[]>`
        with m as (
          select "patientId", "fromStaff", "createdAt", lag("fromStaff") over (partition by "patientId" order by "createdAt") as prev
          from "ChatMessage"),
        q as (
          select m."patientId", m."createdAt" as asked,
            (select min(c."createdAt") from "ChatMessage" c where c."patientId" = m."patientId" and c."fromStaff" and c."createdAt" > m."createdAt") as answered
          from m where not m."fromStaff" and (m.prev is null or m.prev) and m."createdAt" >= ${since})
        select p."assignedDietitianId" as "dietitianId", count(*)::int as asked, count(q.answered)::int as answered,
          round((percentile_cont(0.5) within group (order by extract(epoch from (q.answered - q.asked)) / 60))::numeric, 1)::float as "medianMin"
        from q join "Patient" p on p."userId" = q."patientId" group by 1`,
    ]);
    const r = new Map(replies.map((x) => [x.dietitianId, x]));
    return staff.map((s) => ({ ...s, asked: r.get(s.id)?.asked ?? 0, answered: r.get(s.id)?.answered ?? 0, medianReplyMin: r.get(s.id)?.medianMin ?? null }));
  }
}

const round = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** The active dietitian with the fewest patients, for new signups (AUTO_ASSIGN=off turns it off). */
export async function leastLoadedDietitian(db: PrismaService) {
  if (process.env.AUTO_ASSIGN === 'off') return null;
  const staff = await db.user.findMany({
    where: { role: 'DIETITIAN', active: true },
    select: { id: true, _count: { select: { assigned: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return staff.sort((a, b) => a._count.assigned - b._count.assigned)[0]?.id ?? null;
}
