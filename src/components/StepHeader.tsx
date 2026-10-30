import { View } from 'react-native';

import { cloudEnabled } from '@/cloud/client';
import { useT } from '@/i18n/useT';
import { useColors } from '@/theme/tokens';
import { H2, Txt } from './ui';

/** Every onboarding screen in order (the code screen belongs to "phone"); "phone" only when the app has a server. */
const ONBOARDING = ['lang', 'mode', 'diet', 'phone', 'about', 'sugar', 'setup'] as const;
export type OnboardingStep = (typeof ONBOARDING)[number];
const steps = ONBOARDING.filter((s) => s !== 'phone' || cloudEnabled);

/** "Step 4 of 7" and a bar, counted the same way on every onboarding screen. */
export function StepBar({ at }: { at: OnboardingStep }) {
  const { t } = useT();
  const c = useColors();
  const step = steps.indexOf(at) + 1;
  return (
    <View style={{ marginBottom: 8 }} accessibilityLabel={t('stepOf', { n: step, of: steps.length })}>
      <Txt size={14} weight="bold" color="leaf">
        {t('stepOf', { n: step, of: steps.length })}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step ? c.leaf : c.line }} />
        ))}
      </View>
    </View>
  );
}

/** Step bar, title and one-line why: short steps feel quicker than one long form. */
export function StepHeader({ at, title, sub }: { at: OnboardingStep; title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <StepBar at={at} />
      <H2>{title}</H2>
      {sub ? (
        <Txt size={16} color="mute">
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}
