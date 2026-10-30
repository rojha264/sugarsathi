import { BadRequestException, Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { eats, type Diet } from '@shared/diet';
import { MEAL_SLOTS, type MealSlot } from '@shared/thali';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notify/notifications.controller';

const MAX_PICKS = 30;
const MAX_NOTE = 120;

type PickIn = { foodId: string; slots?: string[]; note?: string };

/** "For you" foods: what a dietitian recommends for one patient, shown first on the app's meal screen. */
@ApiTags('patients (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin/patients/:id/picks')
export class PicksController {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.assertStaffCanSee(u, id);
    const rows = await this.db.foodPick.findMany({ where: { patientId: id }, orderBy: { sort: 'asc' }, include: { addedBy: { select: { name: true } } } });
    return { data: rows.map((r) => ({ foodId: r.foodId, slots: r.slots, note: r.note, addedBy: r.addedBy?.name ?? null, updatedAt: r.updatedAt })) };
  }

  /** Replaces the whole list (order = app order). Foods the patient does not eat are refused, never silently shown. */
  @Put()
  async save(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { picks: PickIn[]; notify?: boolean }) {
    await this.access.assertStaffCanSee(u, id);
    if (!Array.isArray(b?.picks) || b.picks.length > MAX_PICKS) throw new BadRequestException('bad_picks');
    const patient = await this.db.patient.findUniqueOrThrow({ where: { userId: id }, select: { diet: true, user: { select: { lang: true } } } });
    const ids = [...new Set(b.picks.map((p) => String(p.foodId)))];
    if (ids.length !== b.picks.length) throw new BadRequestException('duplicate_food');
    const foods = new Map((await this.db.food.findMany({ where: { id: { in: ids }, active: true, reviewStatus: 'verified' }, select: { id: true, diet: true } })).map((f) => [f.id, f.diet]));
    for (const fid of ids) {
      if (!foods.has(fid)) throw new BadRequestException(`unknown_food_${fid}`);
      if (!eats(patient.diet as Diet, foods.get(fid) as Diet)) throw new BadRequestException(`not_in_diet_${fid}`);
    }
    const before = new Set((await this.db.foodPick.findMany({ where: { patientId: id }, select: { foodId: true } })).map((p) => p.foodId));
    await this.db.$transaction([
      this.db.foodPick.deleteMany({ where: { patientId: id } }),
      this.db.foodPick.createMany({
        data: b.picks.map((p, sort) => ({
          patientId: id, foodId: String(p.foodId), sort, addedById: u.id,
          slots: (p.slots ?? []).filter((x): x is MealSlot => (MEAL_SLOTS as string[]).includes(x)),
          note: String(p.note ?? '').trim().slice(0, MAX_NOTE),
        })),
      }),
    ]);
    const added = ids.filter((f) => !before.has(f)).length;
    if (b.notify && added) {
      const n = await this.db.notification.create({
        data: {
          senderId: u.id, kind: 'picks', deeplink: '/meal', audience: { userIds: [id] }, recipients: 1, receipts: { create: [{ userId: id }] },
          titleEn: '⭐ New foods for you', titleHi: '⭐ आपके लिए नया खाना',
          bodyEn: `Your dietitian picked ${added} food${added > 1 ? 's' : ''} for you. See them under "For you" when you log a meal.`,
          bodyHi: `आपके डाइटीशियन ने आपके लिए ${added} चीज़ें चुनी हैं। खाना जोड़ते समय "आपके लिए" में देखिए।`,
        },
      });
      await this.notifications.deliver(n.id);
    }
    return { saved: b.picks.length, added, notified: !!(b.notify && added) };
  }
}
