import type { AgeGroup, CareInfo, DiabetesType, Diet, Setup } from '@/types';

/** The person being logged for: the phone owner (setup) or a family member's own care info. */
export type Person = { diet: Diet; type: DiabetesType; age: AgeGroup };

export function personOf(cur: string, setup: Setup, care?: CareInfo): Person | null {
  if (cur === 'me') return { diet: setup.diet, type: setup.type, age: setup.age };
  return care ?? null;
}

/**
 * Care flags for the profile being logged for. Family members get the same safety rules
 * once their type and age are on file; without them they get none.
 */
export function careFlags(cur: string, setup: Setup, care?: CareInfo) {
  const p = personOf(cur, setup, care);
  return {
    pregnant: p?.type === 'gdm',
    senior: p?.age === 'senior',
    /** Children and pregnancy: no alcohol guidance at all. */
    drinkNotSafe: !!p && (p.age === 'child' || p.type === 'gdm'),
    /** Setup to pass to target adaptation (null when nothing is known about the person). */
    targetSetup: p ? { ...setup, diet: p.diet, type: p.type, age: p.age } : null,
  };
}
