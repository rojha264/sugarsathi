export const EA1C_MIN_READINGS = 10;

/**
 * Estimated HbA1c (%) from average glucose, ADAG formula: (avg mg/dL + 46.7) / 28.7.
 * Only an estimate from home readings; the lab test is the real number.
 */
export function estimateA1c(readings: number[]): number | null {
  if (readings.length < EA1C_MIN_READINGS) return null;
  const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
  return Math.round(((avg + 46.7) / 28.7) * 10) / 10;
}
