import { Tag, Typography } from 'antd';

/** Shared labels for the 14-day Kickstart (review queue, patient tab). */
export const REASON: Record<string, string> = {
  type1: 'Type 1', gdm: 'Pregnancy diabetes', child: 'Child', senior75: 'Age 75+', insulin: 'On insulin', pregnant: 'Pregnant', kidney: 'Kidney problem',
  a1c_high: 'HbA1c ≥ 10', sugar_high: 'Sugar ≥ 250', sugar_low: 'Sugar < 70', no_template: 'No matching plan',
};
export const STATUS: Record<string, { color: string; label: string }> = {
  pending_review: { color: 'orange', label: 'Needs review' }, active: { color: 'green', label: 'Active' }, completed: { color: 'blue', label: 'Completed' },
  converted: { color: 'gold', label: 'Paid' }, dropped: { color: 'default', label: 'Dropped' },
};

export type Baseline = { type?: string; sex?: string | null; age?: number | null; heightCm?: number | null; weightKg?: number | null; meds?: string | null; flags?: string[]; a1c?: number | null; sugar?: { v: number; ctx: string } | null };
export type Result = { fastingBefore: number | null; fastingAfter: number | null; afterMealBefore: number | null; afterMealAfter: number | null; inRangeBefore: number | null; inRangeAfter: number | null; weightBefore: number | null; weightAfter: number | null; daysFollowed: number; improved: boolean };

export function Reasons({ list }: { list: string[] }) {
  return list.length ? <>{list.map((r) => <Tag key={r} color="red">{REASON[r] ?? r}</Tag>)}</> : <Tag color="green">No risks</Tag>;
}

/** "58 y · F · 158 cm · 72 kg · HbA1c 8.1 · fasting 168 · tablets". */
export function BaselineText({ b }: { b: Baseline }) {
  const parts = [
    b.age ? `${b.age} y` : null, b.sex ? b.sex[0].toUpperCase() : null, b.heightCm ? `${b.heightCm} cm` : null, b.weightKg ? `${b.weightKg} kg` : null,
    b.a1c ? `HbA1c ${b.a1c}` : 'HbA1c ?', b.sugar ? `${b.sugar.ctx} ${b.sugar.v}` : null, b.meds && b.meds !== 'none' ? b.meds : 'no meds',
  ].filter(Boolean);
  return <Typography.Text type="secondary">{parts.join(' · ')}</Typography.Text>;
}

const arrow = (before: number | null, after: number | null, unit: string, lowerBetter = true) => {
  if (before === null && after === null) return '–';
  if (before === null || after === null) return `${before ?? '–'} → ${after ?? '–'} ${unit}`;
  const good = lowerBetter ? after < before : after > before;
  return <span>{before} → <b style={{ color: good ? '#1E8A5A' : after === before ? undefined : '#cf1322' }}>{after}</b> {unit}</span>;
};

export function ResultLine({ r }: { r: Result }) {
  return (
    <span>
      {r.improved ? <Tag color="green">Improved</Tag> : <Tag>No clear change</Tag>} Fasting {arrow(r.fastingBefore, r.fastingAfter, 'mg/dL')} · After meal {arrow(r.afterMealBefore, r.afterMealAfter, 'mg/dL')} · Weight{' '}
      {arrow(r.weightBefore, r.weightAfter, 'kg')} · Followed {r.daysFollowed}/14
    </span>
  );
}
