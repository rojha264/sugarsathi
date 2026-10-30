import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { alertText, dueAlerts, eventAlert, localNow, type Alert, type EventKind } from '@shared/family';
import { PrismaService } from '../common/prisma.service';
import { buildDay } from '../family/day';
import { recomputeStats } from '../stats/stats';
import { PushService } from './push.service';

/**
 * Family alerts. Instant ones (very low/high sugar, unwell, SOS) come from synced events;
 * scheduled ones (missed dose, no update by 1 PM, 9 PM digest) run every 15 minutes.
 * Each alert is sent once per patient (AlertSent), only to caregivers who have not muted it.
 */
@Injectable()
export class AlertsService {
  private readonly log = new Logger('Alerts');
  constructor(
    private readonly db: PrismaService,
    private readonly push: PushService,
  ) {}

  async send(patientId: string, alert: Alert): Promise<boolean> {
    const claimed = await this.db.alertSent.createMany({ data: [{ patientId, key: alert.key }], skipDuplicates: true });
    if (!claimed.count) return false;
    const members = await this.db.circleMember.findMany({ where: { status: 'active', circle: { patientId } } });
    const to = members.filter((m) => !m.mutedAlerts.includes(alert.kind));
    const lang = new Map(to.map((m) => [m.userId, m.lang === 'hi' ? 'hi' : 'en'] as const));
    await this.push.toUsers(
      to.map((m) => m.userId),
      (uid) => ({ ...alertText(alert, lang.get(uid) ?? 'en'), data: { route: `/remote/${patientId}` } }),
    );
    return true;
  }

  async onEvent(patientId: string, ev: { id: string; kind: string; data: Record<string, unknown> }) {
    const p = await this.db.user.findUnique({ where: { id: patientId }, select: { name: true } });
    const alert = eventAlert(ev.kind as EventKind, ev.data, p?.name ?? '', ev.id);
    if (alert) await this.send(patientId, alert);
  }

  @Cron('*/15 * * * *')
  async watch() {
    const circles = await this.db.circle.findMany({ where: { members: { some: { status: 'active' } } }, select: { patientId: true, patient: { select: { tz: true } } } });
    let sent = 0;
    for (const c of circles) {
      const now = localNow(new Date(), c.patient.tz);
      const { snap, state } = await buildDay(this.db, c.patientId);
      const done = await this.db.alertSent.findMany({ where: { patientId: c.patientId, key: { contains: now.day } }, select: { key: true } });
      for (const a of dueAlerts(snap, state, now, new Set(done.map((d) => d.key)))) if (await this.send(c.patientId, a)) sent++;
    }
    if (sent) this.log.log(`sent ${sent} scheduled alerts`);
  }

  /** Nightly refresh so 7/30-day windows move even for people who stopped logging. */
  @Cron('30 2 * * *')
  async nightlyStats() {
    const patients = await this.db.patient.findMany({ select: { userId: true } });
    for (const p of patients) await recomputeStats(this.db, p.userId);
  }
}
