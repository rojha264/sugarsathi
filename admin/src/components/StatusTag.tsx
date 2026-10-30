import { Tag, Tooltip } from 'antd';

import { fmt, sugarColor } from '../lib/labels';

export type Stats = {
  lastValue?: number | null; lastCtx?: string | null; avg7?: number | null; fastingAvg7?: number | null; afterAvg7?: number | null;
  ea1c?: number | null; medAdherence7?: number | null; lows30?: number; lastSeenAt?: string | null; inRange30?: number | null;
};

export const SugarTag = ({ v, ctx }: { v?: number | null; ctx?: string | null }) => (v == null ? <Tag>–</Tag> : <Tag color={sugarColor(v, ctx ?? 'random')}>{fmt(v)}</Tag>);

/** One glance: red when something is dangerous, orange when it needs a look. */
export function AttentionTags({ s }: { s?: Stats | null }) {
  if (!s) return <Tag>No data</Tag>;
  const tags = [];
  if ((s.lows30 ?? 0) > 0) tags.push(<Tag key="low" color="red">⬇ {s.lows30} lows</Tag>);
  if ((s.avg7 ?? 0) > 180) tags.push(<Tag key="high" color="orange">⬆ High avg</Tag>);
  if (s.medAdherence7 != null && s.medAdherence7 < 70) tags.push(<Tag key="med" color="orange">💊 {s.medAdherence7}%</Tag>);
  const days = s.lastSeenAt ? (Date.now() - Date.parse(s.lastSeenAt)) / 86400_000 : Infinity;
  if (days > 3) tags.push(<Tooltip key="seen" title="Nothing logged for 3+ days"><Tag color="default">💤 Inactive</Tag></Tooltip>);
  return tags.length ? <>{tags}</> : <Tag color="green">✓ OK</Tag>;
}
