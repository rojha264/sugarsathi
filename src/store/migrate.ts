import { defaultMedTime } from '@/logic/meds';
import { defaultSugarEvery } from '@/logic/sugarPlan';
import { newTargets } from '@/logic/targets';
import type { AppState, Profile } from '@/types';

/**
 * Fills in anything older saved data is missing. Every step only adds what is absent,
 * so it is safe to run on every load, whatever version number the data claims.
 */
export function normalize(persisted: unknown): AppState {
  const s = persisted as AppState;
  if (!s?.profiles || !s.setup) return s;
  // v2: food preference. Existing users see every food.
  // v7: sugar-check schedule, defaulted from the diabetes type.
  const every = s.setup.sugarEvery ?? defaultSugarEvery(s.setup.type);
  // v8: text size and family alert contact.
  s.setup = {
    ...s.setup,
    diet: s.setup.diet ?? 'nonveg',
    sugarEvery: every,
    textSize: s.setup.textSize ?? 'normal',
    caregiver: s.setup.caregiver ?? { name: '', phone: '' },
    // v9: after-meal check time; a consent given before versioning was to version 1.
    ta: s.setup.ta ?? '14:30',
    consentVer: s.setup.consentVer ?? (s.setup.consentAt ? 1 : undefined),
  };
  for (const id in s.profiles) {
    const p = s.profiles[id] as Partial<Profile> & Profile;
    const tm = s.setup.tm;
    s.profiles[id] = {
      ...p,
      // v3: alcohol opt-in and food frequency.
      alcohol: p.alcohol ?? false,
      freq: p.freq ?? {},
      // v4/v5: adaptive targets; an old { mealMax, protein, fiber } becomes the base.
      targets: upgradeTargets(p.targets),
      // v6: foods remembered per meal time.
      slotFreq: p.slotFreq ?? {},
      lastMeal: p.lastMeal ?? {},
      sugarPlan: p.sugarPlan ?? { every: id === 'me' ? every : 'every3', from: s.day },
      water: p.water ?? 0,
      // v9: a time per dose, tablet counts and checkup dates.
      meds: p.meds.map((m) => ({ ...m, at: m.at ?? defaultMedTime(m.t, tm) })),
      stock: p.stock ?? {},
      checkups: p.checkups ?? {},
    };
  }
  return s;
}

function upgradeTargets(t: Profile['targets'] | undefined): Profile['targets'] {
  const old = t as unknown as { mealMax?: number; protein?: number; fiber?: number } | undefined;
  if (!old) return newTargets();
  if ('mealMax' in old) return newTargets({ meal: old.mealMax ?? 60, protein: old.protein ?? 60, fiber: old.fiber ?? 25 });
  return t!;
}

/** zustand persist hook for version changes; the work is the same idempotent fill. */
export const migrate = (persisted: unknown, _version: number): AppState => normalize(persisted);
