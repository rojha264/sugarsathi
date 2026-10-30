/**
 * Ingredients IFCT 2017 does not cover, from USDA FoodData Central SR Legacy (public domain), by FDC id.
 * Reads the downloaded SR Legacy CSV folder and writes ingredients-usda.csv:
 *   npx tsx prisma/nutrition/usda.ts <FoodData_Central_sr_legacy_food_csv_2018-04 folder>
 * (download: https://fdc.nal.usda.gov/download-datasets)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCsv, toCsv } from './csv';

/** Recipe id → FDC id → Hindi / common name. */
export const USDA: [id: string, fdcId: number, nameHi: string][] = [
  ['curd', 171284, 'Dahi'],
  ['butter', 173410, 'Makkhan'],
  ['sugar', 169655, 'Cheeni'],
  ['salt', 173468, 'Namak'],
  ['bread', 174924, 'Bread'],
  ['brownbread', 172688, 'Brown bread'],
  ['pav', 172796, 'Pav'],
  ['oats', 173904, 'Oats'],
  ['cornflakes', 174648, 'Cornflakes'],
  ['cheese', 170853, 'Cheese'],
  ['cream', 170859, 'Malai'],
  ['honey', 169640, 'Shahad'],
  ['condensedmilk', 171275, 'Condensed milk'],
  ['chocolate', 167587, 'Chocolate'],
  ['ketchup', 168556, 'Ketchup'],
  ['mayonnaise', 171009, 'Mayonnaise'],
  ['soysauce', 174277, 'Soy sauce'],
  ['coconutmilk', 170173, 'Nariyal doodh'],
  ['soychunks', 174275, 'Soya chunks'],
  ['peanutbutter', 172470, 'Peanut butter'],
  ['pasta', 168927, 'Pasta'],
  ['cornstarch', 169698, 'Cornflour'],
  ['biscuit', 174950, 'Biscuit'],
  ['cola', 174852, 'Cola'],
  ['tea', 173227, 'Chai patti'],
  ['coffee', 171890, 'Coffee'],
  ['icecream', 167575, 'Ice cream'],
  ['custardpowder', 169609, 'Custard powder'],
  ['vinegar', 172237, 'Sirka'],
  ['besan', 174288, 'Besan'],
  ['riceflour', 169714, 'Chawal ka atta'],
  ['sabudana', 169717, 'Sabudana'],
  ['kabulichana', 173756, 'Kabuli chana'],
  ['turnip', 170465, 'Shalgam'],
  ['kuttu', 170687, 'Kuttu atta'],
  ['papad', 168106, 'Papad'],
];

const NUTRIENT = { carbTotal: '1005', protein: '1003', fat: '1004', fiber: '1079', sugar: '2000', sodium: '1093', water: '1051' } as const;

const dir = process.argv[2];
if (!dir) throw new Error('usage: usda.ts <SR Legacy CSV folder>');
const ids = new Set(USDA.map(([, f]) => String(f)));
const foods = new Map(parseCsv(readFileSync(join(dir, 'food.csv'), 'utf8')).filter((r) => ids.has(r.fdc_id)).map((r) => [r.fdc_id, r.description]));
// food_nutrient.csv is large: scan it line by line for our ids only.
const values = new Map<string, Record<string, number>>();
const wanted = new Set<string>(Object.values(NUTRIENT));
for (const line of readFileSync(join(dir, 'food_nutrient.csv'), 'utf8').split('\n')) {
  const c = line.split(',').map((x) => x.replace(/"/g, ''));
  if (!ids.has(c[1]) || !wanted.has(c[2])) continue;
  values.set(c[1], { ...(values.get(c[1]) ?? {}), [c[2]]: Number(c[3]) });
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const out = USDA.map(([id, fdc, nameHi]) => {
  const v = values.get(String(fdc)) ?? {};
  const get = (k: keyof typeof NUTRIENT) => v[NUTRIENT[k]] ?? 0;
  if (!foods.has(String(fdc))) throw new Error(`FDC ${fdc} (${id}) not found`);
  // USDA "carbohydrate by difference" includes fibre; IFCT and the app count available carbs (without fibre).
  return { code: `USDA:${fdc}`, id, nameEn: foods.get(String(fdc)), nameHiLatin: nameHi, group: 'USDA FoodData Central', carb: r2(Math.max(0, get('carbTotal') - get('fiber'))), protein: get('protein'), fat: get('fat'), fiber: get('fiber'), sugar: get('sugar'), sodium: get('sodium'), water: get('water') };
});
writeFileSync(join(__dirname, 'ingredients-usda.csv'), toCsv(Object.keys(out[0]), out));
console.log(`USDA ingredients: ${out.length}`);
