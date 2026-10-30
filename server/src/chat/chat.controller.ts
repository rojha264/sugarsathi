import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { isOnline } from '@shared/presence';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { PushService } from '../notify/push.service';

const MAX_LEN = 1000;
const PAGE = 100;

const clean = (text: unknown) => {
  const t = String(text ?? '').trim().slice(0, MAX_LEN);
  if (!t) throw new BadRequestException('empty_message');
  return t;
};

/** How many of the sender's latest messages carry tick updates on an incremental fetch. */
const RECEIPTS = 50;

type Row = { id: string; text: string; fromStaff: boolean; createdAt: Date; deliveredAt: Date | null; readAt: Date | null; sender: { name: string } | null };

/** Messages as both sides see them. */
const view = (m: Row) => ({
  id: m.id, text: m.text, fromStaff: m.fromStaff, at: m.createdAt.toISOString(),
  deliveredAt: m.deliveredAt?.toISOString() ?? null, readAt: m.readAt?.toISOString() ?? null, sender: m.sender?.name ?? '',
});

/** Messages sent to this reader (staff messages for the patient, or the patient's for staff) have reached them. */
export const markDelivered = (db: PrismaService, patientId: string, fromStaff: boolean) =>
  db.chatMessage.updateMany({ where: { patientId, fromStaff, deliveredAt: null }, data: { deliveredAt: new Date() } });

/** Marks messages read; reading also counts as delivered. */
const markRead = async (db: PrismaService, patientId: string, fromStaff: boolean) => {
  await markDelivered(db, patientId, fromStaff);
  await db.chatMessage.updateMany({ where: { patientId, fromStaff, readAt: null }, data: { readAt: new Date() } });
};

/** The patient's side of the conversation with their dietitian. */
@ApiTags('chat')
@ApiBearerAuth()
@Roles('USER')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly db: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Messages (newest last) plus who the dietitian is and whether they are online now. */
  @Get()
  async thread(@CurrentUser() u: AuthUser, @Query('after') after?: string) {
    await markDelivered(this.db, u.id, true);
    const p = await this.db.patient.findUnique({ where: { userId: u.id }, include: { assignedDietitian: { select: { id: true, name: true, lastActiveAt: true } } } });
    // Ticks on messages already on the phone change too, so an incremental fetch also sends their status.
    const receipts = after
      ? await this.db.chatMessage.findMany({ where: { patientId: u.id, fromStaff: false }, orderBy: { createdAt: 'desc' }, take: RECEIPTS, select: { id: true, deliveredAt: true, readAt: true } })
      : [];
    const messages = await this.db.chatMessage.findMany({
      where: { patientId: u.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: 'desc' }, take: PAGE, include: { sender: { select: { name: true } } },
    });
    const d = p?.assignedDietitian;
    return {
      dietitian: d ? { name: d.name, online: isOnline(d.lastActiveAt), lastSeen: d.lastActiveAt?.toISOString() ?? null } : null,
      messages: messages.reverse().map(view),
      receipts: receipts.map((r) => ({ id: r.id, deliveredAt: r.deliveredAt?.toISOString() ?? null, readAt: r.readAt?.toISOString() ?? null })),
    };
  }

  @Post()
  async send(@CurrentUser() u: AuthUser, @Body() b: { text: string }) {
    const text = clean(b.text);
    const p = await this.db.patient.findUniqueOrThrow({ where: { userId: u.id }, include: { user: { select: { name: true } } } });
    const m = await this.db.chatMessage.create({ data: { patientId: u.id, senderId: u.id, fromStaff: false, text }, include: { sender: { select: { name: true } } } });
    // The assigned dietitian (or every owner when nobody is assigned) gets a push.
    const to = p.assignedDietitianId ? [p.assignedDietitianId] : (await this.db.user.findMany({ where: { role: 'OWNER', active: true }, select: { id: true } })).map((x) => x.id);
    await this.push.toUsers(to, { title: `💬 ${p.user.name || 'Patient'}`, body: text.slice(0, 120), data: { route: `/chats/${u.id}` } });
    return view(m);
  }

  /** Marks the dietitian's messages as read (they see "Read"). */
  @Post('read')
  @HttpCode(200)
  async read(@CurrentUser() u: AuthUser) {
    await markRead(this.db, u.id, true);
    return { ok: true };
  }
}

/** The dietitian's side: every assigned patient's conversation. */
@ApiTags('chat (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class AdminChatController {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly push: PushService,
  ) {}

  /** Conversations, most recent first, with unread counts and whether the patient is online. */
  @Get('chats')
  async list(@CurrentUser() u: AuthUser) {
    const scope = this.access.patientScope(u);
    // The dietitian's panel has the patients' messages now.
    await this.db.chatMessage.updateMany({ where: { patient: scope, fromStaff: false, deliveredAt: null }, data: { deliveredAt: new Date() } });
    const last = await this.db.chatMessage.findMany({
      where: { patient: scope }, orderBy: { createdAt: 'desc' }, distinct: ['patientId'],
      include: { patient: { select: { user: { select: { name: true, phone: true, lastActiveAt: true } } } } },
    });
    const unread = await this.db.chatMessage.groupBy({ by: ['patientId'], where: { patient: scope, fromStaff: false, readAt: null }, _count: true });
    const n = new Map(unread.map((x) => [x.patientId, x._count]));
    const data = last.map((m) => ({
      patientId: m.patientId, name: m.patient.user.name, phone: m.patient.user.phone,
      online: isOnline(m.patient.user.lastActiveAt), lastSeen: m.patient.user.lastActiveAt?.toISOString() ?? null,
      last: { text: m.text, fromStaff: m.fromStaff, at: m.createdAt.toISOString() }, unread: n.get(m.patientId) ?? 0,
    }));
    return { data, total: data.length, unread: data.reduce((a, c) => a + c.unread, 0) };
  }

  @Get('patients/:id/chat')
  async thread(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('after') after?: string) {
    await this.access.assertStaffCanSee(u, id);
    await markDelivered(this.db, id, false);
    const [p, messages] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id }, select: { name: true, phone: true, lastActiveAt: true } }),
      this.db.chatMessage.findMany({
        where: { patientId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
        orderBy: { createdAt: 'desc' }, take: PAGE, include: { sender: { select: { name: true } } },
      }),
    ]);
    return { patient: { name: p.name, phone: p.phone, online: isOnline(p.lastActiveAt), lastSeen: p.lastActiveAt?.toISOString() ?? null }, messages: messages.reverse().map(view) };
  }

  @Post('patients/:id/chat')
  async send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { text: string }) {
    await this.access.assertStaffCanSee(u, id);
    const text = clean(b.text);
    const m = await this.db.chatMessage.create({ data: { patientId: id, senderId: u.id, fromStaff: true, text }, include: { sender: { select: { name: true } } } });
    const lang = (await this.db.user.findUnique({ where: { id }, select: { lang: true } }))?.lang;
    await this.push.toUsers([id], { title: `💬 ${m.sender?.name ?? (lang === 'hi' ? 'डाइटीशियन' : 'Dietitian')}`, body: text.slice(0, 120), data: { route: '/chat' } });
    return view(m);
  }

  @Post('patients/:id/chat/read')
  @HttpCode(200)
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    await markRead(this.db, id, false);
    return { ok: true };
  }

  @Get('patients/:id/vitals')
  async vitals(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    return this.db.vital.findMany({ where: { patientId: id, deletedAt: null }, orderBy: { at: 'asc' }, take: 365 });
  }
}
