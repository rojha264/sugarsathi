import type { AgeGroup } from '@/types';

/** Age bands the rest of the app uses (food safety, targets, exercise). */
export const ageGroupFor = (age: number): AgeGroup => (age < 18 ? 'child' : age >= 60 ? 'senior' : 'adult');

/** 160 → "5 ft 3 in", so people who think in feet can check their height. */
export function feetInches(cm: number) {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)} ft ${inches % 12} in`;
}

/** HbA1c entered at signup: a sane lab range only. */
export const validA1c = (v: number) => v >= 4 && v <= 18;
/** A sugar reading typed at signup (mg/dL). */
export const validSugar = (v: number) => v >= 20 && v <= 600;
