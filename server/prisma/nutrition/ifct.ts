/**
 * Builds ingredients-ifct.csv from the IFCT 2017 tables (Longvah et al., ICMR-NIN).
 * Input: the compositions CSV distributed by the @ifct2017/compositions package (v2.0.9, MIT),
 * a transcription of the published book. Only facts are kept: code, names and per-100 g values.
 *   npx tsx prisma/nutrition/ifct.ts <path/to/index.csv>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCsv, toCsv } from './csv';

const src = process.argv[2];
if (!src) throw new Error('usage: ifct.ts <ifct index.csv>');
const rows = parseCsv(readFileSync(src, 'utf8'));
const col = (r: Record<string, string>, key: string) => r[Object.keys(r).find((k) => k.endsWith(`; ${key}`))!];
const num = (v: string) => (v === '' || v === undefined ? 0 : Math.round(Number(v) * 100) / 100);

/** The Hindi name from IFCT's local-name list ("...; H. Atta; ..."), if it has one. */
function hindi(lang: string) {
  for (const part of lang.split(';')) {
    const m = part.trim().match(/^((?:[A-Z][a-z]*\.,?\s*)+)(.+)$/);
    if (m && /\bH\./.test(m[1])) return m[2].replace(/\.$/, '').trim();
  }
  return '';
}

const out = rows.map((r) => ({
  code: col(r, 'code'),
  nameEn: col(r, 'name'),
  nameHiLatin: hindi(col(r, 'lang') ?? ''),
  group: col(r, 'grup'),
  carb: num(col(r, 'choavldf')),
  protein: num(col(r, 'protcnt')),
  fat: num(col(r, 'fatce')),
  fiber: num(col(r, 'fibtg')),
  sugar: num(col(r, 'fsugar')),
  // The source lists sodium in g/100 g; the app uses mg.
  sodium: Math.round(Number(col(r, 'na') || 0) * 1000 * 10) / 10,
  water: num(col(r, 'water')),
}));
writeFileSync(join(__dirname, 'ingredients-ifct.csv'), toCsv(Object.keys(out[0]), out));
console.log(`IFCT ingredients: ${out.length}`);
