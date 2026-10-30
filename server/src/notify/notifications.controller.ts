import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Logger, Param, Post, Query } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';

import { patientWhereSearch, type PatientFilter } from '../admin/patient-filter';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { paging, type ListQuery } from '../common/list';
import { PrismaService } from '../common/prisma.service';
import { PushService } from './push.service';

type Audience = { userIds?: string[]; segmentId?: string; filter?: PatientFilter; all?: boolean };
type ComposeBody = { titleEn: string; titleHi?: string; bodyEn: string; bodyHi?: string; deeplink?: string; audience: Audience; scheduledAt?: string };

/** Resolves an audience to patient ids the sender may reach, writes inbox receipts and pushes in each user's language. */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');
  constructor(
    private readonly db: PrismaService,
    private readonly push: PushService,
    private readonly access: AccessService,
  ) {}

  async resolve(sender: AuthUser, a: Audience): Promise<string[]> {
    const scope = this.access.patientScope(sender);
    let where: Prisma.PatientWhereInput;
    if (a.userIds?.length) where = { ...scope, userId: { in: a.userIds } };
    else if (a.segmentId) {
      const seg = await this.db.segment.findUniqueOrThrow({ where: { id: a.segmentId } });
      where = await patientWhereSearch(this.db, seg.filter as PatientFilter, scope);
    } else if (a.filter) where = await patientWhereSearch(this.db, a.filter, scope);
    else if (a.all) where = { ...scope, type: { not: 'care' } };
    else throw new BadRequestException('no_audience');
    return (await this.db.patient.findMany({ where, select: { userId: true } })).map((p) => p.userId);
  }

  async deliver(id: string) {
    const n = await this.db.notification.findUniqueOrThrow({ where: { id }, include: { receipts: { select: { userId: true } } } });
    const ids = n.receipts.map((r) => r.userId);
    const langs = new Map((await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, lang: true } })).map((u) => [u.id, u.lang]));
    const pushed = await this.push.toUsers(ids, (uid) => {
      const hi = langs.get(uid) === 'hi';
      return { title: (hi && n.titleHi) || n.titleEn, body: (hi && n.bodyHi) || n.bodyEn, data: { route: n.deeplink || '/inbox', notificationId: n.id } };
    });
    await this.db.notification.update({ where: { id }, data: { sentAt: new Date(), pushed } });
    this.log.log(`notification ${id}: ${ids.length} recipients, ${pushed} pushes`);
  }

  /** Sends scheduled notifications whose time has come. */
  @Cron('* * * * *')
  async due() {
    const due = await this.db.notification.findMany({ where: { sentAt: null, scheduledAt: { lte: new Date() } }, select: { id: true } });
    for (const n of due) await this.deliver(n.id);
  }
}

@ApiTags('notifications (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class NotificationsController {
  constructor(
    private readonly db: PrismaService,
    private readonly svc: NotificationsService,
  ) {}

  /** How many patients an audience reaches, before sending. */
  @Post('notifications/preview')
  @HttpCode(200)
  async preview(@CurrentUser() u: AuthUser, @Body() b: { audience: Audience }) {
    return { recipients: (await this.svc.resolve(u, b.audience)).length };
  }

  @Post('notifications')
  async send(@CurrentUser() u: AuthUser, @Body() b: ComposeBody) {
    if (!b.titleEn?.trim() || !b.bodyEn?.trim()) throw new BadRequestException('title_and_body_required');
    const ids = await this.svc.resolve(u, b.audience);
    if (!ids.length) throw new BadRequestException('nobody_matches');
    const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : new Date();
    const n = await this.db.notification.create({
      data: {
        senderId: u.id, titleEn: b.titleEn, titleHi: b.titleHi ?? '', bodyEn: b.bodyEn, bodyHi: b.bodyHi ?? '', deeplink: b.deeplink ?? '/inbox',
        audience: b.audience as object, scheduledAt, recipients: ids.length, receipts: { create: ids.map((userId) => ({ userId })) },
      },
    });
    if (scheduledAt <= new Date()) await this.svc.deliver(n.id);
    return this.db.notification.findUnique({ where: { id: n.id } });
  }

  @Get('notifications')
  async list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    const where = u.role === 'OWNER' ? {} : { senderId: u.id };
    const [rows, total] = await Promise.all([
      this.db.notification.findMany({ where, ...paging(q, ['createdAt', 'scheduledAt'], 'createdAt'), orderBy: { createdAt: 'desc' }, include: { sender: { select: { name: true } }, _count: { select: { receipts: { where: { readAt: { not: null } } } } } } }),
      this.db.notification.count({ where }),
    ]);
    return { total, data: rows.map(({ _count, ...n }) => ({ ...n, read: _count.receipts })) };
  }

  @Delete('notifications/:id')
  cancel(@Param('id') id: string) {
    return this.db.notification.deleteMany({ where: { id, sentAt: null } });
  }

  // ----- saved segments -----
  @Get('segments')
  async segments() {
    const data = await this.db.segment.findMany({ orderBy: { createdAt: 'asc' } });
    return { data, total: data.length };
  }

  @Post('segments')
  addSegment(@CurrentUser() u: AuthUser, @Body() b: { name: string; filter: PatientFilter }) {
    return this.db.segment.create({ data: { name: b.name, filter: b.filter as object, createdBy: u.id } });
  }

  @Delete('segments/:id')
  deleteSegment(@Param('id') id: string) {
    return this.db.segment.delete({ where: { id } });
  }
}

/** The user's inbox of dietitian notices. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/inbox')
export class InboxController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async inbox(@CurrentUser() u: AuthUser) {
    const rows = await this.db.notificationReceipt.findMany({
      where: { userId: u.id, notification: { sentAt: { not: null } } },
      orderBy: { notification: { sentAt: 'desc' } }, take: 50,
      include: { notification: { include: { sender: { select: { name: true } } } } },
    });
    return rows.map((r) => ({
      id: r.notificationId, readAt: r.readAt, sentAt: r.notification.sentAt, from: r.notification.sender?.name ?? '',
      titleEn: r.notification.titleEn, titleHi: r.notification.titleHi, bodyEn: r.notification.bodyEn, bodyHi: r.notification.bodyHi, deeplink: r.notification.deeplink,
    }));
  }

  @Post(':id/read')
  @HttpCode(200)
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.db.notificationReceipt.updateMany({ where: { notificationId: id, userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
