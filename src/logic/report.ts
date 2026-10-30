import type { Profile } from '@/types';
import { closeDay } from './day';
import { WALK_GOAL_MIN } from './score';
import { LOW, OTHER_MAX } from './sugar';

export { EA1C_MIN_READINGS, estimateA1c } from '@shared/a1c';

export type Weekly = {
  readings: number[];
  avgSugar: number | null;
  inRange: number | null;
  walkDays: number;
  medPct: number | null;
  avgScore: number;
  scores: number[];
  drinks: number;
  treats: number;
};

/** Last 7 days including today (today counted as it stands now). */
export function weekly(p: Profile, today: string): Weekly {
  const week = [...p.days.slice(-6), closeDay(p, today)];
  const readings = week.flatMap((d) => d.sugar);
  const taken = week.reduce((a, d) => a + d.medTaken, 0);
  const total = week.reduce((a, d) => a + d.medTotal, 0);
  const scores = week.map((d) => d.score);
  return {
    readings,
    avgSugar: readings.length ? Math.round(readings.reduce((a, b) => a + b, 0) / readings.length) : null,
    inRange: readings.length ? Math.round((readings.filter((v) => v >= LOW && v <= OTHER_MAX).length / readings.length) * 100) : null,
    walkDays: week.filter((d) => d.walkMin >= WALK_GOAL_MIN).length,
    medPct: total ? Math.round((taken / total) * 100) : null,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    scores,
    drinks: week.reduce((a, d) => a + (d.drinks ?? 0), 0),
    treats: week.reduce((a, d) => a + (d.treats ?? 0), 0),
  };
}

/** Readings needed before an HbA1c estimate is shown. */
/** SVG polyline points for a sparkline in a 300 x 66 box. */
export function sparkPoints(values: number[], w = 300, h = 66): string {
  if (values.length < 2) return '';
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  return values
    .map((v, i) => ((i / (values.length - 1)) * w).toFixed(1) + ',' + (h - 6 - ((v - mn) / (mx - mn || 1)) * (h - 16)).toFixed(1))
    .join(' ');
}

export type ReportLabels = {
  title: string; forDoc: string; type: string; avgSugar: string; inRange: string; walkDays: string;
  medAdh: string; avgScore: string; legal: string; dash: string; drinks: string; treats: string;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function shareText(name: string, w: Weekly, L: ReportLabels): string {
  return `${name} - ${L.title}: ${L.avgSugar} ${w.avgSugar ?? L.dash} mg/dL, ${L.inRange} ${w.inRange ?? L.dash}%, ${L.walkDays} ${w.walkDays}/7, ${L.medAdh} ${w.medPct ?? L.dash}%, ${L.treats} ${w.treats}${w.drinks ? `, ${L.drinks} ${w.drinks}` : ''}.`;
}

export function reportHtml(name: string, date: string, w: Weekly, L: ReportLabels): string {
  const pts = sparkPoints(w.readings);
  const row = (k: string, v: string) => `<tr><td>${esc(k)}</td><td class="v">${esc(v)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Roboto,"Noto Sans Devanagari",sans-serif;color:#16302A;padding:28px}
h1{margin:0 0 4px;font-size:26px}p{margin:0 0 16px;color:#5A726C}
table{width:100%;border-collapse:collapse;font-size:17px}td{padding:10px 0;border-bottom:1px solid #D9E6DE}
td.v{text-align:right;font-weight:700}.legal{margin-top:24px;font-size:12px;color:#5A726C}
</style></head><body>
<h1>${esc(L.title)}</h1><p>${esc(L.forDoc)} · ${esc(name)} · ${esc(L.type)} · ${esc(date)}</p>
${pts ? `<svg width="100%" height="80" viewBox="0 0 300 66" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#8A4BA8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>` : ''}
<table>
${row(L.avgSugar, w.avgSugar === null ? L.dash : `${w.avgSugar} mg/dL`)}
${row(L.inRange, w.inRange === null ? L.dash : `${w.inRange}%`)}
${row(L.walkDays, `${w.walkDays} / 7`)}
${row(L.medAdh, w.medPct === null ? L.dash : `${w.medPct}%`)}
${row(L.avgScore, String(w.avgScore))}
${row(L.treats, String(w.treats))}
${w.drinks ? row(L.drinks, String(w.drinks)) : ''}
</table><p class="legal">${esc(L.legal)}</p></body></html>`;
}
