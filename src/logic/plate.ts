import { FOOD_BY_ID } from '@/data/foods';
import type { Basket } from './meal';

/** Plate method (ICMR-NIN 2024, ADA): ½ vegetables, ¼ protein, ¼ grain/starch. */
export const PLATE_TARGET = { veg: 0.5, protein: 0.25, grain: 0.25 } as const;
const SLACK = 0.1;

export type PlateKey = 'plateGood' | 'plateMoreVeg' | 'plateLessGrain' | 'plateAddProtein';
export type PlateCheck = { shares: { veg: number; protein: number; grain: number }; key: PlateKey };

/** Compares the plate's gram shares with the plate method. Null when nothing on it counts. */
export function plateCheck(basket: Basket): PlateCheck | null {
  const w = { veg: 0, protein: 0, grain: 0 };
  for (const id in basket) {
    const f = FOOD_BY_ID[id];
    if (!f || f.role === 'other') continue;
    w[f.role] += f.g * basket[id];
  }
  const sum = w.veg + w.protein + w.grain;
  if (!sum) return null;
  const shares = { veg: w.veg / sum, protein: w.protein / sum, grain: w.grain / sum };
  const gaps: [PlateKey, number][] = [
    ['plateLessGrain', shares.grain - PLATE_TARGET.grain],
    ['plateMoreVeg', PLATE_TARGET.veg - shares.veg],
    ['plateAddProtein', PLATE_TARGET.protein - shares.protein],
  ];
  const [key, gap] = gaps.sort((a, b) => b[1] - a[1])[0];
  return { shares, key: gap > SLACK ? key : 'plateGood' };
}
