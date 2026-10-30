import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { eats, type Diet } from '@shared/diet';
import { AccessService } from '../common/access.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { ProgramService } from '../program/program.service';

type DietItem = { weekday?: number | null; day?: number | null; slot: string; foodId: string; qty?: number; note?: string };
type DietBody = {
  patientId: string; title: string; titleHi?: string; startsOn?: string; endsOn?: string | null; status?: string; notes?: string; notesHi?: string;
  carbsBreakfast?: number | null; carbsLunch?: number | null; carbsDinner?: number | null; protein?: number | null; fiber?: number | null; kcal?: number | null;
  items: DietItem[];
};
type ExItem = { exerciseId: string; weekdays?: number[]; day?: number | null; time?: string; minutes: number; note?: string };
type ExBody = { patientId: string; title: string; titleHi?: string; startsOn?: string; endsOn?: string | null; status?: string; notes?: string; notesHi?: string; items: ExItem[] };
type TemplateBody = { title: string; titleHi?: string; diet?: string; kcal?: number; notes?: string; notesHi?: string; items: DietItem[] };
const TEMPLATE_FIELDS: (keyof TemplateBody)[] = ['title', 'titleHi', 'diet', 'kcal', 'notes', 'notesHi'];

/** Copies only the listed keys that are present (ignores ids, relations and timestamps a client sends back). */
const pick = <T extends object, K extends keyof T>(o: T, keys: K[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) as Partial<Pick<T, K>>;

// `day` (1–14) keeps a 14-day programme item on its day when a dietitian edits the plan.
const dietItems = (items: DietItem[]) => items.map((i, sort) => ({ weekday: i.weekday ?? null, day: i.day ?? null, slot: i.slot, foodId: i.foodId, qty: i.qty ?? 1, note: i.note ?? '', sort }));
/** Template items have no programme day (templates repeat by weekday). */
const templateItems = (items: DietItem[]) => dietItems(items).map(({ day: _day, ...rest }) => rest);
const exItems = (items: ExItem[]) => items.map((i, sort) => ({ exerciseId: i.exerciseId, weekdays: i.weekdays ?? [], day: i.day ?? null, time: i.time ?? '', minutes: i.minutes, note: i.note ?? '', sort }));

/** Diet and exercise plans per patient, plus reusable diet templates. */
@ApiTags('plans (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class PlansController {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly program: ProgramService,
  ) {}

  /** A plan may only contain foods the patient eats (no egg for a vegetarian, no meat for an eggetarian). */
  private async assertFitsDiet(patientId: string, items: DietItem[]) {
    const p = await this.db.patient.findUniqueOrThrow({ where: { userId: patientId }, select: { diet: true } });
    const foods = await this.db.food.findMany({ where: { id: { in: items.map((i) => i.foodId) } }, select: { id: true, diet: true, reviewStatus: true } });
    const bad = foods.filter((f) => !eats(p.diet as Diet, f.diet as Diet)).map((f) => f.id);
    if (bad.length) throw new BadRequestException(`foods_not_in_diet:${bad.join(',')}`);
    // Draft foods are not on phones yet, so a plan cannot use them.
    const draft = foods.filter((f) => f.reviewStatus !== 'verified').map((f) => f.id);
    if (draft.length) throw new BadRequestException(`foods_not_verified:${draft.join(',')}`);
  }

  @Get('diet-plans')
  async dietPlans(@CurrentUser() u: AuthUser, @Query('patientId') patientId: string) {
    await this.access.assertStaffCanSee(u, patientId);
    return this.db.dietPlan.findMany({ where: { patientId }, orderBy: { startsOn: 'desc' }, include: { items: { orderBy: { sort: 'asc' }, include: { food: true } }, dietitian: { select: { name: true } } } });
  }

  /** A new active plan ends the previous one. */
  @Post('diet-plans')
  async createDiet(@CurrentUser() u: AuthUser, @Body() b: DietBody) {
    await this.access.assertStaffCanSee(u, b.patientId);
    await this.assertFitsDiet(b.patientId, b.items ?? []);
    const { items, startsOn, endsOn } = b;
    const rest = { ...pick(b, ['titleHi', 'notes', 'notesHi', 'status', 'carbsBreakfast', 'carbsLunch', 'carbsDinner', 'protein', 'fiber', 'kcal']), patientId: b.patientId, title: b.title };
    const active = (b.status ?? 'active') === 'active';
    if (active) await this.db.dietPlan.updateMany({ where: { patientId: b.patientId, status: 'active' }, data: { status: 'ended', endsOn: new Date() } });
    const plan = await this.db.dietPlan.create({
      data: { ...rest, dietitianId: u.id, startsOn: startsOn ? new Date(startsOn) : new Date(), endsOn: endsOn ? new Date(endsOn) : null, items: { create: dietItems(items) } },
      include: { items: true },
    });
    // Sharing a plan with someone not paying starts their 14-day trial today.
    if (active) await this.program.startTrialFromPlan(b.patientId, u.id);
    return plan;
  }

  @Put('diet-plans/:id')
  async updateDiet(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: DietBody) {
    const plan = await this.db.dietPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException();
    await this.access.assertStaffCanSee(u, plan.patientId);
    await this.assertFitsDiet(plan.patientId, b.items ?? []);
    const { items, startsOn, endsOn } = b;
    // Only editable fields: the admin sends the plan back as it loaded it (with id, dietitian, dates…).
    const rest = pick(b, ['title', 'titleHi', 'notes', 'notesHi', 'status', 'carbsBreakfast', 'carbsLunch', 'carbsDinner', 'protein', 'fiber', 'kcal']);
    return this.db.$transaction(async (tx) => {
      await tx.dietPlanItem.deleteMany({ where: { planId: id } });
      return tx.dietPlan.update({
        where: { id },
        data: { ...rest, ...(startsOn ? { startsOn: new Date(startsOn) } : {}), ...(endsOn !== undefined ? { endsOn: endsOn ? new Date(endsOn) : null } : {}), items: { create: dietItems(items) } },
        include: { items: true },
      });
    });
  }

  @Delete('diet-plans/:id')
  async endDiet(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const plan = await this.db.dietPlan.findUniqueOrThrow({ where: { id } });
    await this.access.assertStaffCanSee(u, plan.patientId);
    return this.db.dietPlan.update({ where: { id }, data: { status: 'ended', endsOn: new Date() } });
  }

  // ----- templates -----
  @Get('diet-templates')
  async templates() {
    const data = await this.db.dietTemplate.findMany({ orderBy: { title: 'asc' }, include: { items: { orderBy: { sort: 'asc' }, include: { food: true } } } });
    return { data, total: data.length };
  }

  @Post('diet-templates')
  createTemplate(@Body() b: TemplateBody) {
    const rest = { ...pick(b, TEMPLATE_FIELDS), title: b.title };
    return this.db.dietTemplate.create({ data: { ...rest, items: { create: templateItems(b.items) } } });
  }

  @Put('diet-templates/:id')
  updateTemplate(@Param('id') id: string, @Body() b: TemplateBody) {
    const { items } = b;
    const rest = pick(b, TEMPLATE_FIELDS);
    return this.db.$transaction(async (tx) => {
      await tx.dietTemplateItem.deleteMany({ where: { templateId: id } });
      return tx.dietTemplate.update({ where: { id }, data: { ...rest, items: { create: templateItems(items) } } });
    });
  }

  @Delete('diet-templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.db.dietTemplate.delete({ where: { id } });
  }

  // ----- exercise plans -----
  @Get('exercise-plans')
  async exercisePlans(@CurrentUser() u: AuthUser, @Query('patientId') patientId: string) {
    await this.access.assertStaffCanSee(u, patientId);
    return this.db.exercisePlan.findMany({ where: { patientId }, orderBy: { startsOn: 'desc' }, include: { items: { orderBy: { sort: 'asc' }, include: { exercise: true } } } });
  }

  @Post('exercise-plans')
  async createExercise(@CurrentUser() u: AuthUser, @Body() b: ExBody) {
    await this.access.assertStaffCanSee(u, b.patientId);
    const { items, startsOn, endsOn } = b;
    const rest = { ...pick(b, ['titleHi', 'notes', 'notesHi', 'status']), patientId: b.patientId, title: b.title };
    await this.db.exercisePlan.updateMany({ where: { patientId: b.patientId, status: 'active' }, data: { status: 'ended', endsOn: new Date() } });
    return this.db.exercisePlan.create({
      data: { ...rest, dietitianId: u.id, startsOn: startsOn ? new Date(startsOn) : new Date(), endsOn: endsOn ? new Date(endsOn) : null, items: { create: exItems(items) } },
    });
  }

  @Delete('exercise-plans/:id')
  async endExercise(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const plan = await this.db.exercisePlan.findUniqueOrThrow({ where: { id } });
    await this.access.assertStaffCanSee(u, plan.patientId);
    return this.db.exercisePlan.update({ where: { id }, data: { status: 'ended', endsOn: new Date() } });
  }
}

/** The patient's own plan for a day (weekday-specific items plus every-day items). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MyPlanController {
  constructor(private readonly db: PrismaService) {}

  @Get('plan')
  async plan(@CurrentUser() u: AuthUser, @Query('date') date?: string) {
    const d = date ? new Date(`${date}T12:00:00+05:30`) : new Date();
    const weekday = d.getUTCDay();
    const [diet, exercise] = await Promise.all([
      this.db.dietPlan.findFirst({
        where: { patientId: u.id, status: 'active' }, orderBy: { startsOn: 'desc' },
        include: { dietitian: { select: { name: true } }, items: { where: { OR: [{ weekday: null }, { weekday }] }, orderBy: { sort: 'asc' }, include: { food: true } } },
      }),
      this.db.exercisePlan.findFirst({
        where: { patientId: u.id, status: 'active' }, orderBy: { startsOn: 'desc' },
        include: { items: { orderBy: { sort: 'asc' }, include: { exercise: true } } },
      }),
    ]);
    return { weekday, diet, exercise: exercise && { ...exercise, items: exercise.items.filter((i) => !i.weekdays.length || i.weekdays.includes(weekday)) } };
  }
}
