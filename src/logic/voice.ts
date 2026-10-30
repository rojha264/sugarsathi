import { FOOD_BY_ID, FOODS, NUMBER_WORDS } from '@/data/foods';
import { MAX_QTY, type Basket } from './meal';

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/(\d)([^\d\s])/g, '$1 $2')
    .replace(/[,.;!?।“”"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const PIECE_WORDS = ['piece', 'pieces', 'pc', 'pcs', 'peice', 'पीस', 'टुकड़े', 'टुकड़ा'];

/** Looks back at most 2 words, never past the previous food, for a number. */
function qtyBefore(tokens: string[], idx: number, floor: number): { q: number; pieces: boolean } {
  let pieces = false;
  for (let k = idx - 1; k >= Math.max(floor, idx - 2); k--) {
    const w = tokens[k];
    if (PIECE_WORDS.includes(w)) pieces = true;
    else if (/^\d+(\.\d+)?$/.test(w)) return { q: +w, pieces };
    else if (NUMBER_WORDS[w]) return { q: NUMBER_WORDS[w], pieces };
  }
  return { q: 1, pieces: false };
}

type Matcher = { words: string[]; foodId: string };

/** Longest phrases first, so "brown rice" beats "rice". */
const MATCHERS: Matcher[] = FOODS.flatMap((f) => f.kw.map((kw) => ({ words: kw.split(' '), foodId: f.id }))).sort(
  (a, b) => b.words.length - a.words.length,
);

function matchAt(tokens: string[], i: number): Matcher | undefined {
  return MATCHERS.find((m) => m.words.every((w, k) => tokens[i + k]?.startsWith(w)));
}

/** Turns "2 roti, 1 dal aur ek sabzi" into { roti: 2, dal: 1, sabzi: 1 }. */
export function parseFoods(text: string): Basket {
  const tokens = normalise(text);
  const out: Basket = {};
  let floor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const m = matchAt(tokens, i);
    if (!m) continue;
    const found = qtyBefore(tokens, i, floor);
    // "4 piece chicken" = 2 standard portions of 2 pieces each.
    const raw = found.pieces && FOOD_BY_ID[m.foodId].unit === 'pcs' ? found.q / 2 : found.q;
    const q = Math.min(Math.max(raw, 0.5), MAX_QTY);
    out[m.foodId] = Math.min((out[m.foodId] ?? 0) + q, MAX_QTY);
    i += m.words.length - 1;
    floor = i + 1;
  }
  return out;
}

/** Keywords handed to the recogniser as context to bias it toward food names. */
export const VOICE_HINTS = FOODS.filter((f) => f.group !== 'mixer').flatMap((f) => [f.n.en, f.n.hi]);
