import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n/useT';
import { weightStatus } from '@/logic/numbers';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import { Btn, Txt } from './ui';

/**
 * Weight next to height: the healthy range for this height on a simple scale, where the person is
 * on it, and a realistic first goal (5% less). Asks for height when it is missing.
 */
export function WeightGuide({ weightKg }: { weightKg: number | null }) {
  const { t } = useT();
  const c = useColors();
  const setup = useApp((s) => s.setup);
  const isMe = useApp((s) => s.cur === 'me');
  if (!isMe || !weightKg) return null;
  const age = setup.birthYear ? new Date().getFullYear() - setup.birthYear : null;
  if (!setup.heightCm) {
    return (
      <View style={{ marginTop: 12 }}>
        <Txt size={15} color="mute">📏 {t('wNeedHeight')}</Txt>
        <Btn small kind="alt" label={t('wAddHeight')} onPress={() => router.push('/health')} style={{ marginTop: 6 }} />
      </View>
    );
  }
  const s = weightStatus(weightKg, setup.heightCm, { age, pregnant: setup.flags?.includes('pregnant') });
  if (!s) {
    return (
      <Txt size={15} color="mute" style={{ marginTop: 12 }}>
        🧒 {t('wChild')}
      </Txt>
    );
  }
  // Scale from a little under the range to a little over (or the person's weight, if further out).
  const lo = Math.floor(Math.min(s.min - 8, weightKg - 3));
  const hi = Math.ceil(Math.max(s.max + 15, weightKg + 3));
  const pos = (kg: number) => `${((kg - lo) / (hi - lo)) * 100}%` as const;
  return (
    <View style={{ marginTop: 14 }}>
      <Txt size={16} weight="bold">
        {t('wHealthyFor', { h: setup.heightCm, min: s.min, max: s.max })}
      </Txt>
      <View accessible accessibilityLabel={t('wHealthy', { min: s.min, max: s.max })} style={{ height: 34, marginTop: 8, justifyContent: 'center' }}>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: c.haldiSoft }} />
        <View style={{ position: 'absolute', left: pos(s.min), width: `${((s.max - s.min) / (hi - lo)) * 100}%`, height: 10, borderRadius: 5, backgroundColor: c.leaf }} />
        <View style={{ position: 'absolute', left: pos(weightKg), marginLeft: -9, width: 18, height: 30, borderRadius: 9, backgroundColor: c.ink, borderWidth: 3, borderColor: c.card }} />
      </View>
      <View style={{ height: 18 }}>
        <Txt size={12} color="mute" style={{ position: 'absolute', left: pos(s.min), marginLeft: -12 }}>{s.min}</Txt>
        <Txt size={12} color="mute" style={{ position: 'absolute', left: pos(s.max), marginLeft: -12 }}>{s.max}</Txt>
      </View>
      <Txt size={16} style={{ marginTop: 6 }}>
        {s.offBy > 0 ? t('wAboveLong', { n: s.offBy, bmi: s.bmi }) : s.offBy < 0 ? t('wBelowLong', { n: -s.offBy, bmi: s.bmi }) : t('wInRangeLong', { bmi: s.bmi })}
      </Txt>
      {s.goal ? (
        <Txt size={16} weight="bold" color="leaf" style={{ marginTop: 6 }}>
          🎯 {t('wGoal', { goal: s.goal, n: Math.round((weightKg - s.goal) * 10) / 10 })}
        </Txt>
      ) : null}
    </View>
  );
}
