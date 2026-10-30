import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';

import { portionFrom } from '@shared/nutrition';
import { MEAL_SLOTS, thaliNutrition, thaliProblem, type MealSlot, type NutritionFood, type ThaliItem } from '@shared/thali';
import { parseVideos } from '@shared/youtube';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.decorators';
import { paging, rankPage, type ListQuery } from '../common/list';
import { PrismaService } from '../common/prisma.service';

type ThaliBody = { emoji: string; nameEn: string; nameHi: string; slots?: string[]; items: ThaliItem[]; active?: boolean };
const NUTRITION_FIELDS = { id: true, carbs: true, protein: true, fiber: true, fat: true, kcal: true, gi: true, role: true, diet: true, servingG: true, active: true } as const;
const SLUG = /^[a-z0-9-]{2,40}$/;

type FoodBody = Omit<Prisma.FoodUncheckedCreateInput, 'updatedAt'> & { recipe?: { ingredientId: string; grams: number }[]; swapTo?: string | null };

/** Food catalog, ingredients, exercises, tips and sugar-based food rules (staff-managed, read by the app via /sync/pull). */
@ApiTags('catalog (admin)')
@ApiBearerAuth()
@Roles('DIETITIAN', 'OWNER')
@Controller('admin')
export class CatalogController {
  constructor(private readonly db: PrismaService) {}

  // ----- foods -----
  @Get('foods')
  async foods(@Query() q: ListQuery & { group?: string; diet?: string; active?: string; reviewStatus?: string; region?: string }) {
    const where: Prisma.FoodWhereInput = {
      ...(q.group ? { group: q.group } : {}),
      ...(q.diet ? { diet: q.diet } : {}),
      ...(q.active ? { active: q.active === 'true' } : {}),
      ...(q.reviewStatus ? { reviewStatus: q.reviewStatus } : {}),
      ...(q.region ? { regions: { has: q.region } } : {}),
    };
    if (q.q?.trim()) return rankPage(await this.db.food.findMany({ where, orderBy: { sort: 'asc' } }), q, (f) => [f.nameEn, f.nameHi, f.id, ...f.aliases]);
    const [data, total] = await Promise.all([this.db.food.findMany({ where, ...paging(q, ['nameEn', 'carbs', 'protein', 'kcal', 'sodium', 'sort', 'group', 'reviewStatus'], 'sort') }), this.db.food.count({ where })]);
    return { data, total };
  }

  /** Dietitian review: a verified food reaches phones on their next sync; back to draft hides it again. */
  @Post('foods/:id/review')
  async reviewFood(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { status: 'verified' | 'draft' }) {
    if (!['verified', 'draft'].includes(b?.status)) throw new BadRequestException('bad_status');
    return this.db.food.update({ where: { id }, data: { reviewStatus: b.status, reviewedById: u.id, reviewedAt: new Date() } });
  }

  @Get('foods/:id')
  async food(@Param('id') id: string) {
    const f = await this.db.food.findUnique({ where: { id }, include: { recipe: { include: { ingredient: true } }, swapsFrom: true } });
    if (!f) throw new NotFoundException();
    return f;
  }

  /** Create or update. With a recipe and manual=false, nutrition is computed from the ingredients. */
  @Put('foods/:id')
  async saveFood(@Param('id') id: string, @Body() body: FoodBody) {
    const { recipe, swapTo, ...food } = body;
    let nutrition = {};
    if (recipe && !food.manual) {
      const ings = await this.db.ingredient.findMany({ where: { id: { in: recipe.map((r) => r.ingredientId) } } });
      const per = new Map(ings.map((i) => [i.id, i]));
      const p = portionFrom(recipe.filter((r) => per.has(r.ingredientId)).map((r) => ({ grams: r.grams, per100: per.get(r.ingredientId)! })));
      nutrition = { carbs: p.c, protein: p.p, fiber: p.f, fat: p.fat, kcal: p.kcal };
    }
    const data = { ...food, ...nutrition, id };
    await this.db.$transaction(async (tx) => {
      await tx.food.upsert({ where: { id }, create: data as Prisma.FoodUncheckedCreateInput, update: data });
      if (recipe) {
        await tx.foodRecipe.deleteMany({ where: { foodId: id } });
        await tx.foodRecipe.createMany({ data: recipe.map((r) => ({ foodId: id, ingredientId: r.ingredientId, grams: r.grams })) });
      }
      if (swapTo !== undefined) {
        await tx.foodSwap.deleteMany({ where: { fromId: id } });
        if (swapTo) await tx.foodSwap.create({ data: { fromId: id, toId: swapTo } });
      }
    });
    return this.food(id);
  }

  /** Foods are hidden, not deleted, so old meal logs keep their names. */
  @Delete('foods/:id')
  hideFood(@Param('id') id: string) {
    return this.db.food.update({ where: { id }, data: { active: false } });
  }

  // ----- ingredients -----
  @Get('ingredients')
  async ingredients(@Query() q: ListQuery) {
    if (q.q?.trim()) return rankPage(await this.db.ingredient.findMany({ orderBy: { id: 'asc' } }), q, (i) => [i.nameEn, i.nameHi, i.id, i.source]);
    const where = {};
    const [data, total] = await Promise.all([this.db.ingredient.findMany({ where, ...paging(q, ['id', 'nameEn', 'carb', 'protein'], 'id') }), this.db.ingredient.count({ where })]);
    return { data, total };
  }

  /** Changing an ingredient recomputes every food made from it (unless that food is set by hand). */
  @Put('ingredients/:id')
  async saveIngredient(@Param('id') id: string, @Body() body: Omit<Prisma.IngredientUncheckedCreateInput, 'updatedAt'>) {
    const ing = await this.db.ingredient.upsert({ where: { id }, create: { ...body, id }, update: { ...body, id } });
    const foods = await this.db.food.findMany({ where: { manual: false, recipe: { some: { ingredientId: id } } }, include: { recipe: { include: { ingredient: true } } } });
    for (const f of foods) {
      const p = portionFrom(f.recipe.map((r) => ({ grams: r.grams, per100: r.ingredient })));
      await this.db.food.update({ where: { id: f.id }, data: { carbs: p.c, protein: p.p, fiber: p.f, fat: p.fat, kcal: p.kcal } });
    }
    return { ...ing, foodsUpdated: foods.length };
  }

  // ----- exercises, tips, rules (simple CRUD) -----
  @Get('exercises')
  async exercises(@Query() q: ListQuery) {
    if (q.q?.trim()) return rankPage(await this.db.exercise.findMany({ orderBy: { sort: 'asc' } }), q, (e) => [e.nameEn, e.nameHi, e.id, e.kind]);
    const where = {};
    const [data, total] = await Promise.all([this.db.exercise.findMany({ where, ...paging(q, ['nameEn', 'kind', 'sort'], 'sort') }), this.db.exercise.count({ where })]);
    return { data, total };
  }
  /**
   * Sample videos: each row's `url` may be a YouTube id, any YouTube link or an <iframe> embed code;
   * only { id, title } is stored (up to 5). A bad link is rejected with its row number.
   */
  @Put('exercises/:id')
  saveExercise(@Param('id') id: string, @Body() body: Omit<Prisma.ExerciseUncheckedCreateInput, 'updatedAt' | 'videos'> & { videos?: { url?: string; id?: string; title?: string }[] }) {
    const { videos, ...rest } = body;
    let data: Prisma.ExerciseUncheckedCreateInput = { ...rest, id };
    if (videos !== undefined) {
      if (!Array.isArray(videos)) throw new BadRequestException('bad_videos');
      const parsed = parseVideos(videos);
      if ('badRow' in parsed) throw new BadRequestException(`bad_youtube_row_${parsed.badRow + 1}`);
      data = { ...data, videos: parsed.videos };
    }
    return this.db.exercise.upsert({ where: { id }, create: data, update: data });
  }
  // ----- thalis (one-tap plates on the app's meal screen) -----
  private async nutritionLookup() {
    const foods = await this.db.food.findMany({ select: { ...NUTRITION_FIELDS, reviewStatus: true } });
    // A draft food is not on phones yet, so it counts as unavailable.
    const byId = new Map<string, NutritionFood>(foods.map(({ reviewStatus, ...f }) => [f.id, { ...f, active: f.active && reviewStatus === 'verified' }]));
    return (id: string) => byId.get(id);
  }

  /** All thalis in app order, each with its nutrition worked out from the current food catalog. */
  @Get('thalis')
  async thalis() {
    const [rows, food] = await Promise.all([this.db.thali.findMany({ where: { deletedAt: null }, orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }] }), this.nutritionLookup()]);
    const data = rows.map((t) => ({ ...t, nutrition: thaliNutrition(t.items as ThaliItem[], food) }));
    return { data, total: data.length };
  }

  /** Creates or updates a thali. Diet comes from its foods, so a plate with chicken is never shown to a vegetarian. */
  @Put('thalis/:id')
  async saveThali(@Param('id') id: string, @Body() b: ThaliBody) {
    if (!SLUG.test(id)) throw new BadRequestException('bad_id');
    const food = await this.nutritionLookup();
    const items = (b.items ?? []).map((i) => ({ foodId: String(i.foodId), qty: Number(i.qty) }));
    const problem = thaliProblem({ ...b, items }, (fid) => !!food(fid));
    if (problem) throw new BadRequestException(problem);
    const slots = (b.slots ?? []).filter((x): x is MealSlot => (MEAL_SLOTS as string[]).includes(x));
    const n = thaliNutrition(items, food);
    const data = { emoji: b.emoji.trim(), nameEn: b.nameEn.trim(), nameHi: b.nameHi.trim(), slots: slots.length ? slots : MEAL_SLOTS, items, diet: n.diet, active: b.active ?? true, deletedAt: null };
    const last = await this.db.thali.aggregate({ _max: { sort: true } });
    const saved = await this.db.thali.upsert({ where: { id }, create: { id, ...data, sort: (last._max.sort ?? -1) + 1 }, update: data });
    return { ...saved, nutrition: n };
  }

  /** New app order: ids top to bottom. */
  @Post('thalis/order')
  async orderThalis(@Body() b: { ids: string[] }) {
    if (!Array.isArray(b?.ids)) throw new BadRequestException('bad_ids');
    await this.db.$transaction(b.ids.map((id, sort) => this.db.thali.update({ where: { id }, data: { sort } })));
    return { ok: true };
  }

  /** Removes it from the app (kept as deleted so phones drop it on their next sync). */
  @Delete('thalis/:id')
  deleteThali(@Param('id') id: string) {
    return this.db.thali.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  }

  @Delete('exercises/:id')
  hideExercise(@Param('id') id: string) {
    return this.db.exercise.update({ where: { id }, data: { active: false } });
  }

  @Get('tips')
  async tips(@Query() q: ListQuery) {
    if (q.q?.trim()) return rankPage(await this.db.tip.findMany({ orderBy: { sort: 'asc' } }), q, (t) => [t.en, t.hi, t.category]);
    const where = {};
    const [data, total] = await Promise.all([this.db.tip.findMany({ where, ...paging(q, ['sort', 'category'], 'sort') }), this.db.tip.count({ where })]);
    return { data, total };
  }
  @Post('tips')
  addTip(@Body() body: Prisma.TipCreateInput) {
    return this.db.tip.create({ data: body });
  }
  @Put('tips/:id')
  saveTip(@Param('id') id: string, @Body() body: Prisma.TipUpdateInput) {
    return this.db.tip.update({ where: { id }, data: body });
  }
  @Delete('tips/:id')
  hideTip(@Param('id') id: string) {
    return this.db.tip.update({ where: { id }, data: { active: false } });
  }

  @Get('food-rules')
  async rules() {
    const data = await this.db.foodRule.findMany({ orderBy: [{ band: 'asc' }, { ctx: 'asc' }] });
    return { data, total: data.length };
  }
  @Post('food-rules')
  addRule(@Body() body: Prisma.FoodRuleCreateInput) {
    return this.db.foodRule.create({ data: body });
  }
  @Put('food-rules/:id')
  saveRule(@Param('id') id: string, @Body() body: Prisma.FoodRuleUpdateInput) {
    return this.db.foodRule.update({ where: { id }, data: body });
  }
  @Delete('food-rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.db.foodRule.delete({ where: { id } });
  }
}
