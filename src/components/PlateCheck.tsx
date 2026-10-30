import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useT } from '@/i18n/useT';
import type { PlateCheck as Check } from '@/logic/plate';
import { useColors, type Colors } from '@/theme/tokens';
import { Txt } from './ui';

const SEGMENTS: { key: 'veg' | 'protein' | 'grain'; from: number; to: number; col: keyof Colors; label: 'pVeg' | 'pProtein' | 'pGrain' }[] = [
  { key: 'veg', from: -90, to: 90, col: 'leaf', label: 'pVeg' },
  { key: 'protein', from: 90, to: 180, col: 'plum', label: 'pProtein' },
  { key: 'grain', from: 180, to: 270, col: 'haldi', label: 'pGrain' },
];

function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}

/**
 * Diabetes plate: the target split (½ sabzi, ¼ protein, ¼ roti/rice) drawn as a thali.
 * Each section fills in proportion to how close the plate is to its target share.
 */
export function PlateCheck({ check }: { check: Check }) {
  const { t } = useT();
  const c = useColors();
  const target = { veg: 0.5, protein: 0.25, grain: 0.25 };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <Svg width={92} height={92} viewBox="0 0 100 100" accessibilityLabel={t('plateT')}>
        <Circle cx={50} cy={50} r={48} fill={c.card} stroke={c.line} strokeWidth={2} />
        {SEGMENTS.map((s) => {
          const fill = Math.min(check.shares[s.key] / target[s.key], 1);
          return (
            <Path key={s.key} d={wedge(50, 50, 18 + 24 * fill, s.from + 2, s.to - 2)} fill={c[s.col]} opacity={0.35 + 0.65 * fill} />
          );
        })}
        <Circle cx={50} cy={50} r={44} fill="none" stroke={c.line} strokeWidth={1} strokeDasharray="3 3" />
      </Svg>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} weight="bold" color="mute">
          🍽️ {t('plateT')}
        </Txt>
        <Txt size={16} weight="semibold">
          {t(check.key)}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {SEGMENTS.map((s) => (
            <Txt key={s.key} size={13} color="mute">
              <Txt size={13} style={{ color: c[s.col] }}>
                ●
              </Txt>{' '}
              {t(s.label)} {Math.round(check.shares[s.key] * 100)}%
            </Txt>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Horizontal progress bar with a target marker range. */
export function GuideBar({ value, min, max, scaleMax, label }: { value: number; min: number; max: number; scaleMax: number; label: string }) {
  const c = useColors();
  const col = value > max ? c.chilli : value >= min ? c.leaf : c.haldi;
  return (
    <View style={{ marginBottom: 12 }}>
      <Txt size={15} weight="semibold" style={{ marginBottom: 4 }}>
        {label}
      </Txt>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: c.track, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: `${(min / scaleMax) * 100}%`, width: `${((max - min) / scaleMax) * 100}%`, top: 0, bottom: 0, backgroundColor: c.leafSoft }} />
        <View style={{ width: `${Math.min(value / scaleMax, 1) * 100}%`, height: 12, borderRadius: 6, backgroundColor: col }} />
      </View>
    </View>
  );
}
