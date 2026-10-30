/**
 * Turns dishes/*.csv into foods with nutrition computed from raw ingredients (IFCT 2017, USDA),
 * checks every row, and writes:
 *   build/foods.json  — what seed-foods.ts imports
 *   build/report.md   — counts, errors and outliers for the dietitian's review
 *   npx tsx prisma/nutrition/build.ts      (exit code 1 when a row is invalid)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { portionFrom, type Per100 } from '@shared/nutrition';
import { parseCsv } from './csv';

const HERE = __dirname;
const GROUPS = ['starter', 'grain', 'dalsabzi', 'protein', 'snack', 'drink', 'sweet', 'treat'];
const ROLES = ['veg', 'protein', 'grain', 'other'];
const DIETS = ['veg', 'egg', 'nonveg'];
const REGIONS = ['north', 'south', 'east', 'west', 'northeast', 'pan'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const UNITS = ['piece', 'katori', 'glass', 'plate', 'pcs'];
const GI = ['low', 'med', 'high'];
/** Computed carbs further than this from a published reference go to the review list. */
const OUTLIER = 0.2;

export type IngredientRow = Per100 & { key: string; code: string; nameEn: string; nameHi: string; group: string };
export type BuiltFood = {
  id: string; nameEn: string; nameHi: string; aliases: string[]; emoji: string; group: string; role: string; diet: string;
  regions: string[]; slots: string[]; unit: string; measure: string; servedG: number;
  recipe: { key: string; grams: number }[];
  carbs: number; protein: number; fiber: number; fat: number; kcal: number; sugar: number; sodium: number;
  gi: string; giValue: number | null; giSource: string; refCarbs: number | null; refSource: string; notes: string; batch: string;
};

/** Every ingredient a recipe may use: IFCT by code (A019), USDA by id (curd). */
export function loadIngredients(): Map<string, IngredientRow> {
  const out = new Map<string, IngredientRow>();
  const n = (v: string) => Number(v) || 0;
  for (const r of parseCsv(readFileSync(join(HERE, 'ingredients-ifct.csv'), 'utf8'))) {
    out.set(r.code, { key: r.code, code: r.code, nameEn: r.nameEn, nameHi: r.nameHiLatin, group: r.group, carb: n(r.carb), protein: n(r.protein), fat: n(r.fat), fiber: n(r.fiber), sugar: n(r.sugar), sodium: n(r.sodium) });
  }
  for (const r of parseCsv(readFileSync(join(HERE, 'ingredients-usda.csv'), 'utf8'))) {
    out.set(r.id, { key: r.id, code: r.code, nameEn: r.nameEn, nameHi: r.nameHiLatin, group: r.group, carb: n(r.carb), protein: n(r.protein), fat: n(r.fat), fiber: n(r.fiber), sugar: n(r.sugar), sodium: n(r.sodium) });
  }
  return out;
}

const list = (v: string) => v.split('|').map((x) => x.trim()).filter(Boolean);

export function build() {
  const ings = loadIngredients();
  // Independent references (USDA FNDDS, per 100 g) for dishes without a published per-serving value.
  const refs = new Map(existsSync(join(HERE, 'references.csv')) ? parseCsv(readFileSync(join(HERE, 'references.csv'), 'utf8')).map((r) => [r.dishId, r] as const) : []);
  const existing = new Set(readFileSync(join(HERE, 'existing-ids.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
  const dir = join(HERE, 'dishes');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.csv')).sort() : [];
  const foods: BuiltFood[] = [];
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const names = new Map<string, string>();

  for (const file of files) {
    const batch = file.replace(/\.csv$/, '');
    parseCsv(readFileSync(join(dir, file), 'utf8')).forEach((r, i) => {
      const at = `${file}:${i + 2} ${r.id || '(no id)'}`;
      const bad = (msg: string) => errors.push(`${at}: ${msg}`);
      const before = errors.length;
      if (!/^[a-z0-9]{2,40}$/.test(r.id ?? '')) bad('id must be 2–40 lowercase letters/digits');
      if (existing.has(r.id)) bad('id already exists in the app catalog');
      if (seen.has(r.id)) bad(`duplicate id (also in ${seen.get(r.id)})`);
      const nameKey = (r.nameEn ?? '').toLowerCase().replace(/[^a-z]/g, '');
      if (names.has(nameKey)) bad(`same name as ${names.get(nameKey)}`);
      if (!r.nameEn || !r.nameHi) bad('nameEn and nameHi are required');
      if (r.nameHi && !/[ऀ-ॿ]/.test(r.nameHi)) bad('nameHi must be in Devanagari');
      if (!GROUPS.includes(r.group)) bad(`group "${r.group}"`);
      if (!ROLES.includes(r.role)) bad(`role "${r.role}"`);
      if (!DIETS.includes(r.diet)) bad(`diet "${r.diet}"`);
      if (!UNITS.includes(r.unit)) bad(`unit "${r.unit}"`);
      if (!GI.includes(r.gi)) bad(`gi "${r.gi}"`);
      const regions = list(r.regions ?? '');
      const slots = list(r.slots ?? '');
      if (!regions.length || regions.some((x) => !REGIONS.includes(x))) bad(`regions "${r.regions}"`);
      if (!slots.length || slots.some((x) => !SLOTS.includes(x))) bad(`slots "${r.slots}"`);
      const servedG = Number(r.servedG);
      if (!(servedG > 0 && servedG <= 1000)) bad(`servedG "${r.servedG}"`);
      const recipe = list(r.recipe ?? '').map((t) => {
        const [key, g] = t.split(':').map((x) => x.trim());
        return { key, grams: Number(g) };
      });
      if (!recipe.length) bad('empty recipe');
      for (const p of recipe) {
        if (!ings.has(p.key)) bad(`unknown ingredient "${p.key}"`);
        if (!(p.grams > 0 && p.grams <= 800)) bad(`bad grams for ${p.key}`);
      }
      if (recipe.length && recipe.every((p) => ['salt', 'T005', 'T006', 'T012', 'T013', 'T001', 'T004', 'T011', 'T008'].includes(p.key))) bad('recipe has only oil / salt');
      if (errors.length > before) return;
      seen.set(r.id, file);
      names.set(nameKey, r.id);
      const p = portionFrom(recipe.map((x) => ({ grams: x.grams, per100: ings.get(x.key)! })));
      const extRef = refs.get(r.id);
      const ref = r.refCarbs ? Number(r.refCarbs) : extRef ? Math.round(((Number(extRef.carbsPer100g) * servedG) / 100) * 10) / 10 : null;
      foods.push({
        id: r.id, nameEn: r.nameEn, nameHi: r.nameHi, aliases: list(r.aliases ?? '').map((a) => a.toLowerCase()), emoji: r.emoji || '🍽️',
        group: r.group, role: r.role, diet: r.diet, regions, slots, unit: r.unit, measure: r.measure ?? '', servedG, recipe,
        carbs: p.c, protein: p.p, fiber: p.f, fat: p.fat, kcal: p.kcal, sugar: p.sugar, sodium: p.sodium,
        gi: r.gi, giValue: r.giValue ? Number(r.giValue) : null, giSource: r.giSource || 'estimate',
        refCarbs: ref !== null && Number.isFinite(ref) ? ref : null, refSource: r.refCarbs ? r.refSource ?? '' : extRef ? `${extRef.source}, per 100 g scaled to ${servedG} g` : '', notes: r.notes ?? '', batch,
      });
    });
  }
  return { foods, errors, files };
}

function report(foods: BuiltFood[], errors: string[], files: string[]) {
  const count = (k: (f: BuiltFood) => string[]) => {
    const m = new Map<string, number>();
    for (const f of foods) for (const v of k(f)) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(' · ');
  };
  const outliers = foods
    .filter((f) => f.refCarbs !== null && f.refCarbs > 0 && Math.abs(f.carbs - f.refCarbs) / f.refCarbs > OUTLIER)
    .map((f) => `| ${f.id} | ${f.nameEn} | ${f.carbs} | ${f.refCarbs} | ${Math.round(((f.carbs - f.refCarbs!) / f.refCarbs!) * 100)}% | ${f.refSource} |`);
  const flags = foods.flatMap((f) => {
    const out: string[] = [];
    if (f.kcal > 900) out.push(`${f.id}: ${f.kcal} kcal per serving`);
    if (f.sodium > 1500) out.push(`${f.id}: ${f.sodium} mg sodium per serving`);
    if (f.servedG && (f.carbs / f.servedG) * 100 > 85) out.push(`${f.id}: ${Math.round((f.carbs / f.servedG) * 100)} g carbs per 100 g served (check servedG)`);
    return out;
  });
  const paneer = foods.filter((f) => f.recipe.some((p) => p.key === 'L003')).map((f) => f.id);
  if (paneer.length) flags.push(`IFCT paneer (L003) lists 12.4 g carbs/100 g, higher than most labels (~3–4 g); ${paneer.length} dishes use it: ${paneer.join(', ')}`);
  const withRef = foods.filter((f) => f.refCarbs !== null).length;
  return [
    '# Food build report',
    '',
    `Files: ${files.join(', ')}  `,
    `Dishes built: **${foods.length}** · with a published carb reference: ${withRef} · outliers (>${OUTLIER * 100}%): ${outliers.length} · invalid rows: ${errors.length}`,
    '',
    `**By region:** ${count((f) => f.regions)}  `,
    `**By app tab:** ${count((f) => [f.group])}  `,
    `**By diet:** ${count((f) => [f.diet])}`,
    '',
    '## Invalid rows (fix before import)',
    errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.',
    '',
    '## Computed vs published carbs (review)',
    outliers.length ? ['| id | dish | computed g | published g | diff | source |', '|---|---|---|---|---|---|', ...outliers].join('\n') : 'None.',
    '',
    '## Other things to check',
    flags.length ? flags.map((f) => `- ${f}`).join('\n') : 'None.',
    '',
  ].join('\n');
}

if (require.main === module) {
  const { foods, errors, files } = build();
  const out = join(HERE, 'build');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'foods.json'), JSON.stringify(foods, null, 1));
  writeFileSync(join(out, 'report.md'), report(foods, errors, files));
  console.log(`dishes: ${foods.length}, invalid rows: ${errors.length} → prisma/nutrition/build/report.md`);
  if (errors.length) process.exit(1);
}
