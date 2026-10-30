import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomInt } from 'node:crypto';

import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { PushService } from '../notify/push.service';
import { buildDay } from './day';

const CODE_HOURS = 48;
const MESSAGE = {
  en: { cheer: (n: string) => `💛 ${n} is cheering for you`, remind: (n: string) => `💊 Reminder from ${n}`, remindBody: 'Please take your medicine and mark it in Sugar Saathi.', ask: (n: string) => `👨‍👩‍👦 ${n} wants to see your day`, askBody: 'Open Sugar Saathi and tap Allow if you agree.' },
  hi: { cheer: (n: string) => `💛 ${n} आपका हौसला बढ़ा रहे हैं`, remind: (n: string) => `💊 ${n} की याद`, remindBody: 'कृपया दवा लीजिए और शुगर साथी में दर्ज कीजिए।', ask: (n: string) => `👨‍👩‍👦 ${n} आपका दिन देखना चाहते हैं`, askBody: 'सहमत हों तो शुगर साथी खोलकर “अनुमति दें” दबाइए।' },
};

/** Family sharing: a patient shares with approved caregivers, who see their day and get alerts. */
@ApiTags('family')
@ApiBearerAuth()
@Roles('USER')
@Controller('family')
export class FamilyController {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly push: PushService,
  ) {}

  private async newCode(circleId: string) {
    for (;;) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const clash = await this.db.circle.findUnique({ where: { inviteCode: code } });
      if (clash && clash.codeExpiresAt && clash.codeExpiresAt > new Date()) continue;
      if (clash) await this.db.circle.update({ where: { id: clash.id }, data: { inviteCode: null } });
      const expires = new Date(Date.now() + CODE_HOURS * 3600_000);
      await this.db.circle.update({ where: { id: circleId }, data: { inviteCode: code, codeExpiresAt: expires } });
      return { code, expiresAt: expires };
    }
  }

  // ----- patient side -----
  /** Start sharing (or get a fresh code). */
  @Post('share')
  @HttpCode(200)
  async share(@CurrentUser() u: AuthUser) {
    const circle = await this.db.circle.upsert({ where: { patientId: u.id }, create: { patientId: u.id }, update: {} });
    return { circleId: circle.id, ...(await this.newCode(circle.id)) };
  }

  @Get('members')
  async members(@CurrentUser() u: AuthUser) {
    const c = await this.db.circle.findUnique({ where: { patientId: u.id }, include: { members: { orderBy: { createdAt: 'asc' } } } });
    return c ? c.members.map((m) => ({ userId: m.userId, name: m.name, status: m.status })) : [];
  }

  @Post('members/:userId/approve')
  @HttpCode(200)
  async approve(@CurrentUser() u: AuthUser, @Param('userId') userId: string) {
    const c = await this.db.circle.findUniqueOrThrow({ where: { patientId: u.id } });
    await this.db.circleMember.update({ where: { circleId_userId: { circleId: c.id, userId } }, data: { status: 'active' } });
    return { ok: true };
  }

  @Delete('members/:userId')
  async removeMember(@CurrentUser() u: AuthUser, @Param('userId') userId: string) {
    const c = await this.db.circle.findUniqueOrThrow({ where: { patientId: u.id } });
    await this.db.circleMember.deleteMany({ where: { circleId: c.id, userId } });
    return { ok: true };
  }

  /** Stops sharing with everyone. Logs stay; only family access goes. */
  @Delete('share')
  async stop(@CurrentUser() u: AuthUser) {
    await this.db.circle.deleteMany({ where: { patientId: u.id } });
    return { ok: true };
  }

  @Post('messages/:id/read')
  @HttpCode(200)
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.db.familyMessage.updateMany({ where: { id, circle: { patientId: u.id } }, data: { readAt: new Date() } });
    return { ok: true };
  }

  // ----- caregiver side -----
  @Post('join')
  @HttpCode(200)
  async join(@CurrentUser() u: AuthUser, @Body() b: { code: string; name: string; lang?: string }) {
    const c = await this.db.circle.findUnique({ where: { inviteCode: String(b.code ?? '').replace(/\D/g, '') }, include: { patient: { include: { user: true } } } });
    if (!c || !c.codeExpiresAt || c.codeExpiresAt < new Date()) throw new BadRequestException('bad_code');
    if (c.patientId === u.id) throw new BadRequestException('own_circle');
    const name = String(b.name ?? '').trim().slice(0, 60);
    await this.db.circleMember.upsert({
      where: { circleId_userId: { circleId: c.id, userId: u.id } },
      create: { circleId: c.id, userId: u.id, name, lang: b.lang === 'hi' ? 'hi' : 'en' },
      update: { name },
    });
    const m = MESSAGE[c.patient.user.lang === 'hi' ? 'hi' : 'en'];
    await this.push.toUsers([c.patientId], { title: m.ask(name), body: m.askBody, data: { route: '/' } });
    return { patientId: c.patientId, name: c.patient.user.name };
  }

  @Get('following')
  async following(@CurrentUser() u: AuthUser) {
    const rows = await this.db.circleMember.findMany({ where: { userId: u.id }, include: { circle: { include: { patient: { include: { user: { select: { name: true, phone: true } } } } } } } });
    return rows.map((m) => ({ patientId: m.circle.patientId, name: m.circle.patient.user.name, phone: m.circle.patient.user.phone, status: m.status, mutedAlerts: m.mutedAlerts, lang: m.lang }));
  }

  /** The elder's day for the caregiver screen (approved followers only). */
  @Get(':patientId/day')
  async day(@CurrentUser() u: AuthUser, @Param('patientId') patientId: string) {
    await this.access.assertCaregiver(u.id, patientId);
    const [{ snap, state, lastSeen }, user, events] = await Promise.all([
      buildDay(this.db, patientId),
      this.db.user.findUniqueOrThrow({ where: { id: patientId }, select: { name: true, phone: true } }),
      this.db.careEvent.findMany({ where: { patientId, at: { gte: new Date(Date.now() - 48 * 3600_000) } }, orderBy: { at: 'desc' } }),
    ]);
    return { name: user.name, phone: user.phone ?? '', snap, state, lastSeen: lastSeen?.getTime() ?? null, events: events.map((e) => ({ id: e.id, kind: e.kind, data: e.data, at: e.at.toISOString() })) };
  }

  @Patch(':patientId')
  async prefs(@CurrentUser() u: AuthUser, @Param('patientId') patientId: string, @Body() b: { mutedAlerts?: string[]; lang?: string }) {
    const c = await this.db.circle.findUnique({ where: { patientId } });
    if (!c) throw new NotFoundException();
    return this.db.circleMember.update({
      where: { circleId_userId: { circleId: c.id, userId: u.id } },
      data: { ...(b.mutedAlerts ? { mutedAlerts: b.mutedAlerts } : {}), ...(b.lang ? { lang: b.lang === 'hi' ? 'hi' : 'en' } : {}) },
    });
  }

  @Delete(':patientId')
  async unfollow(@CurrentUser() u: AuthUser, @Param('patientId') patientId: string) {
    await this.db.circleMember.deleteMany({ where: { userId: u.id, circle: { patientId } } });
    return { ok: true };
  }

  @Post(':patientId/message')
  async message(@CurrentUser() u: AuthUser, @Param('patientId') patientId: string, @Body() b: { kind: 'cheer' | 'remind'; text?: string }) {
    const m = await this.access.assertCaregiver(u.id, patientId);
    if (b.kind !== 'cheer' && b.kind !== 'remind') throw new BadRequestException('bad_kind');
    const msg = await this.db.familyMessage.create({ data: { circleId: m.circleId, fromId: u.id, fromName: m.name, kind: b.kind, text: String(b.text ?? '').slice(0, 300) } });
    const patient = await this.db.user.findUniqueOrThrow({ where: { id: patientId }, select: { lang: true } });
    const t = MESSAGE[patient.lang === 'hi' ? 'hi' : 'en'];
    await this.push.toUsers([patientId], { title: b.kind === 'cheer' ? t.cheer(m.name) : t.remind(m.name), body: msg.text || (b.kind === 'remind' ? t.remindBody : ''), data: { route: '/' } });
    return msg;
  }
}
