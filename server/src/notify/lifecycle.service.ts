import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { programDay } from '@shared/program';
import { PrismaService } from '../common/prisma.service';
import { istDate } from '../program/program.service';
import { NotificationsService } from './notifications.controller';

const HOUR = 3600_000;
const IST_MS = 330 * 60_000;
/** No messages at night: only between 8 AM and 8 PM India time. */
const SEND_FROM_H = 8;
const SEND_UNTIL_H = 20;

type Copy = { titleEn: string; titleHi: string; bodyEn: string; bodyHi: string; deeplink: string };

/**
 * Messages for the first week, when most people drop off. Day 2: one easy next step
 * (different for people who have not logged anything yet). Day 7: look back at the week.
 */
export const LIFECYCLE: Record<string, Copy & { fromH: number; toH: number }> = {
  'life:day2:new': {
    fromH: 24, toH: 72, deeplink: '/meal',
    titleEn: 'Start with one meal 🍽️', titleHi: 'एक खाने से शुरुआत करें 🍽️',
    bodyEn: 'Tap the mic and say what you ate. It takes 10 seconds.', bodyHi: 'माइक दबाइए और बोलिए क्या खाया। बस 10 सेकंड लगेंगे।',
  },
  'life:day2:active': {
    fromH: 24, toH: 72, deeplink: '/sugar',
    titleEn: 'Great start! 👏', titleHi: 'बढ़िया शुरुआत! 👏',
    bodyEn: 'Check your sugar before breakfast today. It helps your dietitian plan for you.', bodyHi: 'आज नाश्ते से पहले शुगर जाँचिए। इससे आपके डाइटीशियन आपका प्लान बना पाएँगे।',
  },
  'life:day7': {
    fromH: 144, toH: 216, deeplink: '/progress',
    titleEn: 'Your first week 🌱', titleHi: 'आपका पहला हफ़्ता 🌱',
    bodyEn: 'See how your week went and set one small goal for the next.', bodyHi: 'देखिए आपका हफ़्ता कैसा रहा, और अगले हफ़्ते के लिए एक छोटा लक्ष्य रखिए।',
  },
  'life:day14': {
    fromH: 13 * 24, toH: 16 * 24, deeplink: '/report',
    titleEn: '2 weeks with Sugar Saathi 🎉', titleHi: 'शुगर साथी के साथ 2 हफ़्ते 🎉',
    bodyEn: 'Your 2-week report is ready. Share it with your doctor on WhatsApp.', bodyHi: 'आपकी 2 हफ़्ते की रिपोर्ट तैयार है। इसे WhatsApp पर अपने डॉक्टर को भेजिए।',
  },
  'life:day30': {
    fromH: 29 * 24, toH: 33 * 24, deeplink: '/report',
    titleEn: 'One month done! 🏆', titleHi: 'एक महीना पूरा! 🏆',
    bodyEn: 'Look back at your month. HbA1c is best checked every 3 months: note your next test date.', bodyHi: 'अपना महीना देखिए। HbA1c हर 3 महीने में जाँचना अच्छा है: अगली जाँच की तारीख़ लिख लीजिए।',
  },
};

/** "We miss you": for anyone who stopped opening the app 3–30 days ago, at most once every 14 days. */
export const WINBACK: Copy = {
  deeplink: '/sugar',
  titleEn: 'We miss you 🙏', titleHi: 'हम आपको याद कर रहे हैं 🙏',
  bodyEn: 'One sugar check today gets you back on track. It takes a minute.', bodyHi: 'आज एक शुगर जाँच से फिर से शुरुआत कीजिए। बस एक मिनट लगेगा।',
};
const WINBACK_AFTER_DAYS = 3;
const WINBACK_UNTIL_DAYS = 30;
const WINBACK_EVERY_DAYS = 14;
/** Dedupe key: one win-back per 14-day window. */
export const winbackKey = (now: Date) => `life:winback:${Math.floor(now.getTime() / (WINBACK_EVERY_DAYS * 24 * HOUR))}`;

/** Messages for the 14-day Kickstart, by programme day (day 15 = results ready, 17 = offer reminder). */
export const KICKSTART: Record<string, Copy & { day: number }> = {
  'kick:day1': { day: 1, deeplink: '/plan', titleEn: 'Day 1 of your 14 days 🚀', titleHi: 'आपके 14 दिनों का पहला दिन 🚀', bodyEn: "Today: check fasting sugar before tea, and eat salad first at lunch. Open today's plan.", bodyHi: 'आज: चाय से पहले खाली पेट शुगर जाँचिए, और दोपहर में पहले सलाद खाइए। आज का प्लान खोलिए।' },
  'kick:day3': { day: 3, deeplink: '/sugar', titleEn: 'Fasting sugar check 🩸', titleHi: 'खाली पेट शुगर जाँच 🩸', bodyEn: 'One more fasting check today helps us measure your progress fairly.', bodyHi: 'आज एक और खाली पेट जाँच से आपकी प्रगति सही से नापी जा सकेगी।' },
  'kick:day7': { day: 7, deeplink: '/plan', titleEn: 'Halfway there! 🎉', titleHi: 'आधा सफ़र पूरा! 🎉', bodyEn: 'One week done. Keep going: the next 7 days show the real change.', bodyHi: 'एक हफ़्ता पूरा। जारी रखिए: अगले 7 दिनों में असली बदलाव दिखेगा।' },
  'kick:day12': { day: 12, deeplink: '/sugar', titleEn: '2 days left ⏳', titleHi: '2 दिन बाकी ⏳', bodyEn: 'Check fasting sugar today, tomorrow and the day after to see your results.', bodyHi: 'नतीजे देखने के लिए आज, कल और परसों खाली पेट शुगर जाँचिए।' },
  'kick:results': { day: 15, deeplink: '/results', titleEn: 'Your 14-day results are ready 📊', titleHi: 'आपके 14 दिन के नतीजे तैयार हैं 📊', bodyEn: 'See how your sugar and weight changed, and what comes next.', bodyHi: 'देखिए आपकी शुगर और वज़न में क्या बदला, और आगे क्या करें।' },
  'kick:offer': { day: 17, deeplink: '/results', titleEn: 'Keep your progress going 💪', titleHi: 'अपनी प्रगति जारी रखिए 💪', bodyEn: 'Continue with your dietitian: a plan made only for you, and chat any time.', bodyHi: 'अपने डाइटीशियन के साथ जारी रखिए: सिर्फ़ आपके लिए प्लान, और कभी भी चैट।' },
};

/** Which Kickstart message is due on this programme day (the latest one not yet sent, never one from the future). */
export function kickstartDue(day: number, sent: Set<string>, paid: boolean): string | null {
  const due = Object.entries(KICKSTART).filter(([k, m]) => m.day <= day && day - m.day <= 1 && !sent.has(k) && !(k === 'kick:offer' && paid));
  return due.length ? due[due.length - 1][0] : null;
}

/** Which first-week message a patient is due, if any (day 2 picks its version by whether they logged anything). */
export function lifecycleDue(onboardedAt: Date, now: Date, hasLogs: boolean, alreadySent: Set<string>): string | null {
  const h = (now.getTime() - onboardedAt.getTime()) / HOUR;
  const day2 = hasLogs ? 'life:day2:active' : 'life:day2:new';
  const sentDay2 = alreadySent.has('life:day2:new') || alreadySent.has('life:day2:active');
  if (!sentDay2 && h >= LIFECYCLE[day2].fromH && h < LIFECYCLE[day2].toH) return day2;
  for (const k of ['life:day7', 'life:day14', 'life:day30']) {
    if (!alreadySent.has(k) && h >= LIFECYCLE[k].fromH && h < LIFECYCLE[k].toH) return k;
  }
  return null;
}

export const isDaytimeIST = (now: Date) => {
  const h = new Date(now.getTime() + IST_MS).getUTCHours();
  return h >= SEND_FROM_H && h < SEND_UNTIL_H;
};

@Injectable()
export class LifecycleService {
  private readonly log = new Logger('Lifecycle');
  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Hourly: one inbox notice + push per message kind, to everyone due for it. */
  @Cron('5 * * * *')
  async run(now = new Date()) {
    if (!isDaytimeIST(now)) return 0;
    const patients = await this.db.patient.findMany({
      where: { type: { not: 'care' }, consentAt: { gte: new Date(now.getTime() - LIFECYCLE['life:day30'].toH * HOUR), lte: new Date(now.getTime() - 24 * HOUR) }, user: { active: true } },
      select: { userId: true, consentAt: true, _count: { select: { meals: true, readings: true } } },
    });
    // People in the 14-day Kickstart get its own messages instead of the generic first-week ones.
    const enrolled = await this.db.enrollment.findMany({ where: { status: { in: ['active', 'completed'] }, createdAt: { gte: new Date(now.getTime() - 25 * 24 * HOUR) } }, select: { patientId: true, startsOn: true } });
    const inProgram = new Set(enrolled.map((e) => e.patientId));
    const sent = await this.db.alertSent.findMany({ where: { patientId: { in: [...patients.map((p) => p.userId), ...inProgram] }, key: { startsWith: 'life:' } } });
    const kickSent = await this.db.alertSent.findMany({ where: { patientId: { in: [...inProgram] }, key: { startsWith: 'kick:' } } });
    const byPatient = new Map<string, Set<string>>();
    for (const s of sent) byPatient.set(s.patientId, (byPatient.get(s.patientId) ?? new Set()).add(s.key));
    const due = new Map<string, string[]>();
    const paid = new Set((await this.db.subscription.findMany({ where: { patientId: { in: [...inProgram] }, status: 'active', endsAt: { gt: now } }, select: { patientId: true } })).map((x) => x.patientId));
    const kickBy = new Map<string, Set<string>>();
    for (const k of kickSent) kickBy.set(k.patientId, (kickBy.get(k.patientId) ?? new Set()).add(k.key));
    for (const e of enrolled) {
      const kind = kickstartDue(programDay(e.startsOn, istDate(0, now.getTime())), kickBy.get(e.patientId) ?? new Set(), paid.has(e.patientId));
      if (kind) due.set(kind, [...(due.get(kind) ?? []), e.patientId]);
    }
    for (const p of patients) {
      if (inProgram.has(p.userId)) continue;
      const kind = lifecycleDue(p.consentAt!, now, p._count.meals + p._count.readings > 0, byPatient.get(p.userId) ?? new Set());
      if (kind) due.set(kind, [...(due.get(kind) ?? []), p.userId]);
    }
    // Win-back: quiet for 3–30 days (not brand-new users, not people in the 14-day plan, who get their own messages).
    const quiet = await this.db.user.findMany({
      where: {
        role: 'USER', active: true,
        lastActiveAt: { gte: new Date(now.getTime() - WINBACK_UNTIL_DAYS * 24 * HOUR), lte: new Date(now.getTime() - WINBACK_AFTER_DAYS * 24 * HOUR) },
        patient: { type: { not: 'care' }, consentAt: { lte: new Date(now.getTime() - 7 * 24 * HOUR) } },
      },
      select: { id: true },
    });
    const wb = winbackKey(now);
    const quietIds = quiet.map((u) => u.id).filter((id) => !inProgram.has(id));
    if (quietIds.length) due.set(wb, quietIds);

    let total = 0;
    for (const [kind, ids] of due) {
      // Claim first so a second server (or a rerun) never sends twice.
      const claimed = (await Promise.all(ids.map((id) => this.db.alertSent.createMany({ data: [{ patientId: id, key: kind }], skipDuplicates: true })))).map((r, i) => (r.count ? ids[i] : null)).filter((x): x is string => !!x);
      if (!claimed.length) continue;
      const m = LIFECYCLE[kind] ?? KICKSTART[kind] ?? WINBACK;
      const copy: Copy = { titleEn: m.titleEn, titleHi: m.titleHi, bodyEn: m.bodyEn, bodyHi: m.bodyHi, deeplink: m.deeplink };
      const n = await this.db.notification.create({
        // Win-back keys carry their 14-day window; analytics groups them under one kind.
        data: { ...copy, kind: kind.startsWith('life:winback') ? 'life:winback' : kind, audience: { userIds: claimed }, scheduledAt: now, recipients: claimed.length, receipts: { create: claimed.map((userId) => ({ userId })) } },
      });
      await this.notifications.deliver(n.id);
      total += claimed.length;
    }
    if (total) this.log.log(`first-week messages: ${total}`);
    return total;
  }
}
