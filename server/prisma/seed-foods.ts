/**
 * Imports the IFCT 2017 / USDA ingredient tables and the built dishes (prisma/nutrition/build/foods.json)
 * into Ingredient, Food and FoodRecipe. New dishes arrive as `draft` and reach phones only after a
 * dietitian verifies them in the admin panel. Existing foods keep their values and review status;
 * they only gain free sugar and sodium from their recipes.
 *   npx tsx prisma/nutrition/build.ts && npx tsx prisma/seed-foods.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { loadIngredients, type BuiltFood } from './nutrition/build';

export async function seedFoods(db: PrismaClient) {
  const tables = loadIngredients();
  // Ingredients already in the catalog under a slug (atta = IFCT A019) keep their id.
  const current = await db.ingredient.findMany({ select: { id: true, source: true } });
  const slugFor = new Map<string, string>();
  for (const i of current) {
    const m = i.source.match(/IFCT ([A-Z]\d{3})/);
    if (m) slugFor.set(m[1], i.id);
  }
  const idOf = (key: string) => slugFor.get(key) ?? key;
  const known = new Set(current.map((i) => i.id));

  for (const row of tables.values()) {
    const id = idOf(row.key);
    const values = { carb: row.carb, protein: row.protein, fat: row.fat, fiber: row.fiber, sugar: row.sugar ?? 0, sodium: row.sodium ?? 0, ifctCode: row.code };
    const source = row.code.startsWith('USDA:') ? `USDA FoodData Central SR Legacy ${row.code.slice(5)} ${row.nameEn}` : `IFCT 2017 ${row.code} ${row.nameEn}`;
    if (known.has(id)) await db.ingredient.update({ where: { id }, data: { sugar: values.sugar, sodium: values.sodium, ifctCode: row.code } });
    else await db.ingredient.create({ data: { id, nameEn: row.nameEn, nameHi: row.nameHi, source, ...values } });
  }

  const file = join(__dirname, 'nutrition', 'build', 'foods.json');
  const foods: BuiltFood[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const last = await db.food.aggregate({ _max: { sort: true } });
  let sort = (last._max.sort ?? 0) + 1;
  let created = 0;
  for (const f of foods) {
    const data = {
      emoji: f.emoji, nameEn: f.nameEn, nameHi: f.nameHi, aliases: f.aliases, diet: f.diet, group: f.group, gi: f.gi, unit: f.unit, role: f.role,
      servingG: f.servedG, carbs: f.carbs, protein: f.protein, fiber: f.fiber, fat: f.fat, kcal: f.kcal, sugar: f.sugar, sodium: f.sodium,
      regions: f.regions, slots: f.slots, measure: f.measure, giValue: f.giValue, giSource: f.giSource, refCarbs: f.refCarbs, refSource: f.refSource,
      manual: false, sources: [...new Set(f.recipe.map((p) => tables.get(p.key)!.code))],
    };
    const exists = await db.food.findUnique({ where: { id: f.id }, select: { id: true } });
    if (exists) await db.food.update({ where: { id: f.id }, data });
    else {
      await db.food.create({ data: { id: f.id, ...data, reviewStatus: 'draft', sort: sort++ } });
      created++;
    }
    await db.foodRecipe.deleteMany({ where: { foodId: f.id } });
    await db.foodRecipe.createMany({ data: f.recipe.map((p) => ({ foodId: f.id, ingredientId: idOf(p.key), grams: p.grams })) });
  }

  // Existing foods: free sugar and sodium from their recipes (other values unchanged).
  const withRecipes = await db.food.findMany({ where: { manual: false, recipe: { some: {} } }, include: { recipe: { include: { ingredient: true } } } });
  for (const f of withRecipes) {
    const sugar = f.recipe.reduce((n, r) => n + (r.ingredient.sugar * r.grams) / 100, 0);
    const sodium = f.recipe.reduce((n, r) => n + (r.ingredient.sodium * r.grams) / 100, 0);
    await db.food.update({ where: { id: f.id }, data: { sugar: Math.round(sugar * 10) / 10, sodium: Math.round(sodium) } });
  }
  console.log(`Ingredients: ${tables.size} · dishes: ${foods.length} (${created} new, draft)`);
}

if (require.main === module) {
  const db = new PrismaClient();
  seedFoods(db)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
