import { useEffect, useState } from 'react';

import { api } from '../providers/api';

export type Food = {
  id: string; emoji: string; nameEn: string; nameHi: string; diet: string; group: string; gi: string; unit: string;
  carbs: number; protein: number; fiber: number; fat: number; kcal: number; active: boolean; role: string; servingG: number; reviewStatus?: 'draft' | 'verified'; aliases?: string[];
  category?: string;
};

/** Can go into plans, thalis and picks: shown in the app and verified by a dietitian (drafts are not on phones yet). */
export const usable = (f: Food) => f.active && f.reviewStatus !== 'draft';

let cache: Food[] | null = null;

/** The whole food catalog (~600 rows), loaded once per session for pickers and totals. */
export function useFoods() {
  const [foods, setFoods] = useState<Food[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api<{ data: Food[] }>('/admin/foods?pageSize=2000').then((r) => {
      cache = r.data;
      setFoods(r.data);
    });
  }, []);
  return foods;
}
