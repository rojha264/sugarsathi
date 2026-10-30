/**
 * Search that works the same in Hindi and English, used by the app, the admin panel and the API.
 * "roti", "रोटी", "chawal", "chaval" and "चावल" all find the right food: Devanagari is spelled out in
 * Latin letters, then both sides are reduced to a sound key (no "a"/"h", ee→i, w→v, z→j, …), so
 * Hinglish spellings and the Hindi script meet in the middle.
 */

const DEVANAGARI = /[ऀ-ॿ]/;
export const isDevanagari = (s: string) => DEVANAGARI.test(s);

const VOWELS: Record<string, string> = { अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o' };
const MATRAS: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o' };
const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h',
};
const NASAL = new Set(['ं', 'ँ']);
const VIRAMA = '्';
const NUKTA = '़';

/** Devanagari spelled out in Latin letters ("चावल" → "chaaval"); other characters pass through. */
export function romanize(text: string): string {
  const s = text.normalize('NFD').replace(new RegExp(NUKTA, 'g'), '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const c = CONSONANTS[ch];
    if (c) {
      const next = s[i + 1];
      out += c;
      if (next && MATRAS[next]) {
        out += MATRAS[next];
        i++;
      } else if (next === VIRAMA) {
        i++;
      } else if (next && (CONSONANTS[next] || NASAL.has(next) || next === 'ः')) {
        out += 'a';
      } else if (!next || !DEVANAGARI.test(next)) {
        // Word-final consonant: no inherent "a" (चावल → chaaval).
      } else {
        out += 'a';
      }
      continue;
    }
    if (VOWELS[ch]) out += VOWELS[ch];
    else if (NASAL.has(ch)) out += 'n';
    else if (ch === 'ः') out += 'h';
    else if (MATRAS[ch]) out += MATRAS[ch];
    else if (ch === '।') out += ' ';
    else out += ch;
  }
  return out;
}

/** Lower case, Hindi spelled out in Latin letters, punctuation as spaces. */
export function normalize(text: string): string {
  return romanize(text.normalize('NFC')).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();
}

/** A rough "sounds like" key: survives Hinglish spelling differences and Hindi ↔ English script. */
export function soundKey(text: string): string {
  return normalize(text)
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/y/g, 'i')
    .replace(/([bcdfgjklmnprstv])h+/g, '$1')
    .replace(/a/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/ /g, '');
}

const keyCache = new Map<string, { text: string; words: string[]; key: string }>();
function prepared(field: string) {
  let p = keyCache.get(field);
  if (!p) {
    const text = normalize(field);
    p = { text, words: text.split(' '), key: soundKey(field) };
    if (keyCache.size > 20000) keyCache.clear();
    keyCache.set(field, p);
  }
  return p;
}

/**
 * How well `query` matches any of `fields` (0 = no match). Higher is better: starts with the query,
 * then a word starts with it, then contains it, then sounds like it.
 */
export function matchScore(query: string, fields: readonly (string | null | undefined)[]): number {
  const q = normalize(query);
  if (!q) return 0;
  const qKey = soundKey(query);
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    const raw = f.toLowerCase();
    const p = prepared(f);
    let s = 0;
    if (raw.startsWith(query.trim().toLowerCase()) || p.text.startsWith(q)) s = 100;
    else if (p.words.some((w) => w.startsWith(q))) s = 80;
    else if (p.text.includes(q) || raw.includes(query.trim().toLowerCase())) s = 60;
    else if (qKey.length >= 2 && p.key.startsWith(qKey)) s = 45;
    else if (qKey.length >= 3 && p.key.includes(qKey)) s = 30;
    if (s > best) best = s;
    if (best === 100) break;
  }
  return best;
}

/** Items matching `query`, best first (ties keep their original order). */
export function searchRank<T>(items: readonly T[], query: string, fields: (item: T) => readonly (string | null | undefined)[], limit?: number): T[] {
  if (!normalize(query)) return items.slice(0, limit);
  const scored: { item: T; s: number; i: number }[] = [];
  items.forEach((item, i) => {
    const s = matchScore(query, fields(item));
    if (s > 0) scored.push({ item, s, i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return (limit ? scored.slice(0, limit) : scored).map((x) => x.item);
}
