import { View } from 'react-native';
import Svg, { Circle, G, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { sparkPoints } from '@/logic/report';
import { FONT, useColors, type Colors } from '@/theme/tokens';
import { Txt } from './ui';

export type ThaliTask = 'meal' | 'walk' | 'medicine' | 'sugar';

const QUADRANTS: { e: string; col: keyof Colors; a: number; s: ThaliTask }[] = [
  { e: '🍽️', col: 'haldi', a: -90, s: 'meal' },
  { e: '🚶', col: 'sky', a: 0, s: 'walk' },
  { e: '💊', col: 'leaf', a: 90, s: 'medicine' },
  { e: '🩸', col: 'plum', a: 180, s: 'sugar' },
];

/** The "thali" score ring: a plate split into 4 quadrants that fill up as tasks are done. */
export function Thali({ fracs, score, label, size = 260, onPress }: { fracs: number[]; score: number | null; label?: string; size?: number; onPress?: (s: ThaliTask) => void }) {
  const c = useColors();
  const R = 76;
  const pt = (a: number): [number, number] => {
    const r = (a * Math.PI) / 180;
    return [100 + R * Math.cos(r), 100 + R * Math.sin(r)];
  };
  const arc = (a0: number, a1: number) => {
    const p0 = pt(a0);
    const p1 = pt(a1);
    return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${R} ${R} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityRole="image" accessibilityLabel={score === null ? undefined : `${score} ${label ?? ''}`}>
      <Circle cx={100} cy={100} r={96} fill={c.card} stroke={c.line} strokeWidth={2} />
      {QUADRANTS.map((q, i) => {
        const a0 = q.a + 5;
        const f = Math.max(0, Math.min(1, fracs[i] ?? 0));
        const m = pt(q.a + 45);
        return (
          <G key={q.s} onPress={onPress ? () => onPress(q.s) : undefined}>
            <Path d={arc(a0, q.a + 85)} fill="none" stroke={c.track} strokeWidth={24} strokeLinecap="round" />
            {f > 0 ? <Path d={arc(a0, a0 + 80 * f)} fill="none" stroke={c[q.col]} strokeWidth={24} strokeLinecap="round" /> : null}
            <SvgText x={m[0]} y={m[1] + 6} textAnchor="middle" fontSize={16}>
              {q.e}
            </SvgText>
          </G>
        );
      })}
      <Circle cx={100} cy={100} r={54} fill={c.bg} stroke={c.line} strokeWidth={2} />
      {score !== null ? (
        <>
          <SvgText x={100} y={110} textAnchor="middle" fontSize={44} fontFamily={FONT.heavy} fill={c.ink}>
            {String(score)}
          </SvgText>
          <SvgText x={100} y={132} textAnchor="middle" fontSize={13} fontFamily={FONT.semibold} fill={c.mute}>
            {label ?? ''}
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}

export function StepRing({ steps, goal, label, size = 240 }: { steps: number; goal: number; label: string; size?: number }) {
  const c = useColors();
  const C = 2 * Math.PI * 70;
  const pct = Math.min(steps / goal, 1);
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel={`${steps} ${label}`}>
      <Circle cx={100} cy={100} r={70} fill="none" stroke={c.track} strokeWidth={20} />
      {pct > 0 ? (
        <Circle
          cx={100} cy={100} r={70} fill="none" stroke={c.sky} strokeWidth={20} strokeLinecap="round"
          strokeDasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 100 100)"
        />
      ) : null}
      <SvgText x={100} y={108} textAnchor="middle" fontSize={38} fontFamily={FONT.heavy} fill={c.ink}>
        {String(steps)}
      </SvgText>
      <SvgText x={100} y={130} textAnchor="middle" fontSize={13} fontFamily={FONT.semibold} fill={c.mute}>
        {label}
      </SvgText>
    </Svg>
  );
}

export function Sparkline({ values, height = 70, label }: { values: number[]; height?: number; label?: string }) {
  const c = useColors();
  const pts = sparkPoints(values);
  if (!pts) return null;
  return (
    <Svg width="100%" height={height} viewBox="0 0 300 66" preserveAspectRatio="none" accessibilityLabel={label}>
      <Polyline points={pts} fill="none" stroke={c.plum} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Daily score bars; the last bar is today. */
export function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160, paddingTop: 8 }}>
      {values.map((v, i) => {
        const today = i === values.length - 1;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
            <Txt size={14} weight="semibold">
              {v}
            </Txt>
            <View style={{ width: '100%', height: Math.max(v, 4) * 1.05, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: today ? c.haldi : c.leaf }} />
            <Txt size={13} color="mute" numberOfLines={1}>
              {labels[i]}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/** Countdown clock: ring fills as the walk progresses, time left in the middle. */
export function ClockRing({ progress, time, label, size = 250, paused }: { progress: number; time: string; label: string; size?: number; paused?: boolean }) {
  const c = useColors();
  const C = 2 * Math.PI * 80;
  const pct = Math.max(0, Math.min(progress, 1));
  // Small dot at the leading edge, like a clock hand.
  const a = (pct * 360 - 90) * (Math.PI / 180);
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityRole="timer" accessibilityLabel={`${time} ${label}`}>
      <Circle cx={100} cy={100} r={80} fill="none" stroke={c.track} strokeWidth={16} />
      {pct > 0 ? (
        <Circle
          cx={100} cy={100} r={80} fill="none" stroke={paused ? c.haldi : c.sky} strokeWidth={16} strokeLinecap="round"
          strokeDasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 100 100)"
        />
      ) : null}
      {pct > 0 ? <Circle cx={100 + 80 * Math.cos(a)} cy={100 + 80 * Math.sin(a)} r={11} fill={c.card} stroke={paused ? c.haldi : c.sky} strokeWidth={4} /> : null}
      <SvgText x={100} y={108} textAnchor="middle" fontSize={46} fontFamily={FONT.heavy} fill={c.ink}>
        {time}
      </SvgText>
      <SvgText x={100} y={134} textAnchor="middle" fontSize={15} fontFamily={FONT.semibold} fill={c.mute}>
        {label}
      </SvgText>
    </Svg>
  );
}
