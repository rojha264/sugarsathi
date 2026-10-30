import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';

import { FOOD_BY_ID, FOODS, SWAPS, type Food } from '@/data/foods';
import { THALIS, type Thali } from '@/data/thalis';
import { TIPS } from '@/data/tips';
import type { ExerciseVideo } from '@shared/youtube';
import { liveReels, type ServerReel } from '@/logic/reels';

/** Catalog rows as the API sends them (see server/prisma/schema.prisma). */
export type ServerFood = {
  id: string; emoji: string; nameEn: string; nameHi: string; aliases: string[]; diet: Food['diet']; group: Food['group']; gi: Food['gi']; unit: Food['unit'];
  role: Food['role']; servingG: number; std: number | null; sweet: boolean; carbs: number; protein: number; fiber: number; fat: number; kcal: number; sources: string[]; active: boolean; sort: number;
};
export type ServerTip = { id: string; emoji: string; en: string; hi: string; active: boolean; sort: number };
export type Exercise = { id: string; emoji: string; nameEn: string; nameHi: string; kind: string; defaultMin: number; intensity: string; safeFor: string[]; stepsEn: string; stepsHi: string; videoUrl: string | null; videos: ExerciseVideo[]; active: boolean; sort: number };
export type FoodRule = { id: string; band: 'low' | 'normal' | 'high' | 'very_high'; ctx: 'fasting' | 'after' | 'any'; recommend: string[]; avoid: string[]; messageEn: string; messageHi: string; active: boolean };
export type ServerThali = { id: string; emoji: string; nameEn: string; nameHi: string; diet: Thali['diet']; slots: Thali['slots']; items: { foodId: string; qty: number }[]; active: boolean; sort: number; deletedAt: string | null };
type Cache = { foods: Record<string, ServerFood>; tips: Record<string, ServerTip>; exercises: Record<string, Exercise>; rules: Record<string, FoodRule>; swaps: Record<string, string>; thalis: Record<string, ServerThali>; reels: Record<string, ServerReel> };

const store = createMMKV({ id: 'glucobuddy-catalog' });
const KEY = 'catalog';
let cache: Cache = { foods: {}, tips: {}, exercises: {}, rules: {}, swaps: {}, thalis: {}, reels: {} };

const SAVED_KEY = 'reels-saved';
const readSaved = (): string[] => {
  try {
    return JSON.parse(store.getString(SAVED_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** Reels for the Learn tab (screens re-render when a sync brings new ones) and the ones saved with ❤️ on this phone. */
export const useReels = create<{ reels: ServerReel[]; saved: string[]; toggleSave(id: string): boolean }>((set, get) => ({
  reels: [],
  saved: readSaved(),
  toggleSave: (id) => {
    const on = !get().saved.includes(id);
    const saved = on ? [id, ...get().saved] : get().saved.filter((x) => x !== id);
    store.set(SAVED_KEY, JSON.stringify(saved));
    set({ saved });
    return on;
  },
}));

const toFood = (f: ServerFood): Food => ({
  id: f.id, e: f.emoji, n: { en: f.nameEn, hi: f.nameHi }, kw: f.aliases, diet: f.diet, group: f.group, gi: f.gi, unit: f.unit, role: f.role,
  ...(f.std != null ? { std: f.std } : {}), ...(f.sweet ? { sweet: true } : {}),
  g: f.servingG, c: f.carbs, p: f.protein, f: f.fiber, fat: f.fat, kcal: f.kcal, src: f.sources,
});

/**
 * The bundled catalog is the first-launch fallback; server rows replace it in place, so every
 * screen that reads FOODS / FOOD_BY_ID / TIPS sees the dietitian's latest nutrition and foods.
 * Hidden foods leave the pickers but stay in FOOD_BY_ID so old logs keep their names.
 */
function apply() {
  const foods = Object.values(cache.foods);
  if (foods.length) {
    for (const f of foods) FOOD_BY_ID[f.id] = toFood(f);
    const visible = foods.filter((f) => f.active).sort((a, b) => a.sort - b.sort).map((f) => FOOD_BY_ID[f.id]);
    const known = new Set(foods.map((f) => f.id));
    // Keep bundled foods the server does not know yet (older server), hide the ones it turned off.
    FOODS.splice(0, FOODS.length, ...visible, ...FOODS.filter((f) => !known.has(f.id)));
  }
  for (const [from, to] of Object.entries(cache.swaps)) SWAPS[from] = to;
  const tips = Object.values(cache.tips).filter((t) => t.active).sort((a, b) => a.sort - b.sort);
  if (tips.length) TIPS.splice(0, TIPS.length, ...tips.map((t) => ({ e: t.emoji, en: t.en, hi: t.hi })));
  // Once the server has sent thalis, its list (order, hidden, deleted) replaces the bundled one entirely.
  const thalis = Object.values(cache.thalis);
  if (thalis.length) {
    const shown = thalis.filter((t) => t.active && !t.deletedAt).sort((a, b) => a.sort - b.sort);
    THALIS.splice(0, THALIS.length, ...shown.map((t) => ({ id: t.id, e: t.emoji, n: { en: t.nameEn, hi: t.nameHi }, diet: t.diet, slots: t.slots, items: Object.fromEntries(t.items.map((i) => [i.foodId, i.qty])) })));
  }
  useReels.setState({ reels: liveReels(cache.reels) });
}

export function loadCachedCatalog() {
  try {
    const raw = store.getString(KEY);
    if (raw) cache = { ...cache, ...JSON.parse(raw) };
    apply();
  } catch {
    // A broken cache only means the bundled catalog is used until the next pull.
  }
}

/** Merges rows changed on the server since the last pull. */
export function mergeCatalog(c: { foods: ServerFood[]; tips: ServerTip[]; exercises: Exercise[]; rules: FoodRule[]; swaps: { fromId: string; toId: string }[]; thalis?: ServerThali[]; reels?: ServerReel[] }) {
  const thalis = c.thalis ?? []; // older servers do not send thalis
  const reels = c.reels ?? []; // or reels
  if (!c.foods.length && !c.tips.length && !c.exercises.length && !c.rules.length && !c.swaps.length && !thalis.length && !reels.length) return false;
  for (const f of c.foods) cache.foods[f.id] = f;
  for (const t of c.tips) cache.tips[t.id] = t;
  for (const e of c.exercises) cache.exercises[e.id] = e;
  for (const r of c.rules) cache.rules[r.id] = r;
  for (const s of c.swaps) cache.swaps[s.fromId] = s.toId;
  for (const t of thalis) cache.thalis[t.id] = t;
  for (const r of reels) cache.reels[r.id] = r;
  store.set(KEY, JSON.stringify(cache));
  apply();
  return true;
}

export const exerciseById = (id: string) => cache.exercises[id];

/** Dietitian rules for what to eat at this sugar level (most specific context first). */
export function rulesFor(v: number, ctx: 'fasting' | 'after' | 'random'): FoodRule[] {
  const band = v < 70 ? 'low' : v > 250 ? 'very_high' : v > (ctx === 'fasting' ? 130 : 180) ? 'high' : 'normal';
  const c = ctx === 'random' ? 'any' : ctx;
  const all = Object.values(cache.rules).filter((r) => r.active && r.band === band);
  return [...all.filter((r) => r.ctx === c), ...all.filter((r) => r.ctx === 'any')];
}

loadCachedCatalog();
