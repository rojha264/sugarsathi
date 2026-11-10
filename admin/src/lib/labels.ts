export const TYPES: Record<string, string> = { type2: 'Type 2', type1: 'Type 1', gdm: 'Pregnancy (GDM)', pre: 'Pre-diabetes', care: 'Caregiver' };
export const AGES: Record<string, string> = { child: 'Child', adult: 'Adult', senior: 'Senior' };
export const DIETS: Record<string, string> = { veg: '🟢 Veg', egg: '🟡 Egg', nonveg: '🔴 Non-veg' };
export const TIERS: Record<string, string> = { FREE: 'Free', BASIC: 'Diet plan', PRO: 'Pro' };
export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', snack: '🍎 Snack', dinner: '🌙 Dinner' };
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const CTX: Record<string, string> = { fasting: 'Fasting', after: '2 h after meal', random: 'Random' };
import { CATEGORIES, CATEGORY_LABEL } from '@shared/category';

/** Food categories for filters and pickers: "🍎 Fruits · फल". */
export const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: `${CATEGORY_LABEL[value].en} · ${CATEGORY_LABEL[value].hi.replace(/^\S+\s/, '')}` }));
export const categoryName = (c?: string) => (c && c in CATEGORY_LABEL ? CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL].en : '–');

export const GROUPS = ['starter', 'grain', 'dalsabzi', 'protein', 'snack', 'drink', 'sweet', 'treat', 'alcohol', 'mixer'];
/** Which app tab a food group appears under (meal screen), so editors know where a food will show. */
export const GROUP_LABEL: Record<string, string> = {
  starter: '⭐ Eat first (पहले खाएँ)', grain: 'Roti & Rice', dalsabzi: 'Dal & Sabzi', protein: 'Protein', snack: 'Snacks',
  drink: 'Sweets & Chai: drinks', sweet: 'Sweets & Chai: sweets', treat: '🎉 Treat', alcohol: '🍺 Drinks (alcohol)', mixer: 'Mixer (with alcohol)',
};
export const UNITS = ['piece', 'katori', 'glass', 'plate', 'pcs', 'peg', 'beer', 'wine'];
export const EX_KINDS = ['walk', 'yoga', 'strength', 'chair', 'breathing', 'stretch'];
export const BANDS: Record<string, string> = { low: 'Low (< 70)', normal: 'In range', high: 'High', very_high: 'Very high (> 250)' };

/** Colour for a sugar value, using the app's thresholds (low < 70, high > 180, danger > 250). */
export function sugarColor(v: number | null | undefined, ctx = 'random') {
  if (v == null) return 'default';
  if (v < 70 || v > 250) return 'red';
  return v <= (ctx === 'fasting' ? 130 : 180) ? 'green' : 'orange';
}

export const fmt = (n: number | null | undefined, unit = '') => (n == null ? '–' : `${Math.round(n * 10) / 10}${unit}`);

export const REGIONS = ['north', 'south', 'east', 'west', 'northeast', 'pan'];
export const REGION_LABEL: Record<string, string> = { north: 'North', south: 'South', east: 'East', west: 'West', northeast: 'Northeast', pan: 'All India' };
