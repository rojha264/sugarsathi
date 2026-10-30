import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { parseReel, REEL_CATEGORIES, type ReelInput } from '@shared/reels';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { rankPage, type ListQuery } from '../common/list';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notify/notifications.controller';

type ReelBody = ReelInput & { notify?: boolean };

/** Short diabetes videos (YouTube links) for the app's "Learn" feed. Phones get them through /sync/pull. */
@ApiTags('reels (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class ReelsController {
  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Feed order; search works in Hindi or English. */
  @Get('reels')
  async list(@Query() q: ListQuery & { category?: string; lang?: string }) {
    const rows = await this.db.reel.findMany({
      where: {
        deletedAt: null,
        ...(q.category && (REEL_CATEGORIES as readonly string[]).includes(q.category) ? { category: q.category } : {}),
        ...(q.lang ? { lang: q.lang } : {}),
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    });
    return rankPage(rows, { ...q, pageSize: q.pageSize ?? '200' }, (r) => [r.titleEn, r.titleHi, r.youtubeId, r.category]);
  }

  /** Adds (id "new") or edits a reel. New reels go to the top of the feed. */
  @Put('reels/:id')
  async save(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: ReelBody) {
    const parsed = parseReel(b ?? {});
    if ('error' in parsed) throw new BadRequestException(parsed.error);
    const isNew = id === 'new';
    let saved;
    if (isNew) {
      const first = await this.db.reel.aggregate({ where: { deletedAt: null }, _min: { sort: true } });
      saved = await this.db.reel.create({ data: { ...parsed.reel, sort: (first._min.sort ?? 1) - 1, createdById: u.id } });
    } else {
      saved = await this.db.reel.update({ where: { id }, data: parsed.reel });
    }
    if (b.notify && saved.active) await this.announce(u, saved);
    return saved;
  }

  /** Staff drag reels into order; the list is the new order, top first. */
  @Post('reels/order')
  @HttpCode(200)
  async order(@Body() b: { ids: string[] }) {
    if (!Array.isArray(b?.ids)) throw new BadRequestException('ids_required');
    await this.db.$transaction(b.ids.map((id, sort) => this.db.reel.update({ where: { id }, data: { sort } })));
    return { ok: true };
  }

  /** Hidden from phones on their next sync (kept for analytics). */
  @Delete('reels/:id')
  remove(@Param('id') id: string) {
    return this.db.reel.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  }

  /** "New video" notice to the sender's patients (all patients for the owner); opens the reel. */
  private async announce(u: AuthUser, r: { id: string; titleEn: string; titleHi: string }) {
    const ids = await this.notifications.resolve(u, { all: true });
    if (!ids.length) return;
    const n = await this.db.notification.create({
      data: {
        senderId: u.id, kind: 'reel', deeplink: `/reels?id=${r.id}`, audience: { all: true }, recipients: ids.length,
        titleEn: '🎬 New video for you', titleHi: '🎬 आपके लिए नया वीडियो',
        bodyEn: r.titleEn, bodyHi: r.titleHi || r.titleEn,
        receipts: { create: ids.map((userId) => ({ userId })) },
      },
    });
    await this.notifications.deliver(n.id);
  }
}
