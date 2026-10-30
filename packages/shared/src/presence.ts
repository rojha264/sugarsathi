/** Someone counts as online if their app or admin panel talked to the server in the last 2 minutes. */
export const ONLINE_MS = 2 * 60 * 1000;

export const isOnline = (lastActiveAt: string | number | Date | null | undefined, now = Date.now()) =>
  !!lastActiveAt && now - new Date(lastActiveAt).getTime() < ONLINE_MS;

/** Blood pressure band (ACC/AHA): normal < 120/80, elevated, high stage 1 ≥ 130/80, stage 2 ≥ 140/90, crisis ≥ 180/120. */
export type BpBand = 'normal' | 'elevated' | 'high1' | 'high2' | 'crisis' | 'low';
export function bpBand(sys: number, dia: number): BpBand {
  if (sys >= 180 || dia >= 120) return 'crisis';
  if (sys < 90 || dia < 60) return 'low';
  if (sys >= 140 || dia >= 90) return 'high2';
  if (sys >= 130 || dia >= 80) return 'high1';
  if (sys >= 120) return 'elevated';
  return 'normal';
}

/** BMI from weight and height; null without a height. */
export const bmi = (weightKg: number, heightCm?: number | null) => (heightCm ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null);
