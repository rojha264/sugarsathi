import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { FamilyAlert } from '@/components/FamilyAlert';
import { Screen } from '@/components/Screen';
import { Banner, Btn, H2, Legal, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { cloudEvent } from '@/cloud/sync';
import { call } from '@/native/share';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

/**
 * Symptom-first help for people without a meter at hand or who can't read numbers:
 * pick how you feel, get the right guide.
 */
export default function FeelScreen() {
  const { t } = useT();
  const c = useColors();
  const name = useApp((s) => s.profiles[s.cur].name) || t('friend');

  const tile = (icon: string, label: string, bg: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}>
      <Txt size={40} style={{ lineHeight: 48 }}>
        {icon}
      </Txt>
      <Txt size={19} weight="bold" style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <Screen title={t('feelQ')} back>
      <H2>{t('feelT')}</H2>
      {tile('🥴', t('feelLow'), c.haldiSoft, () => {
        cloudEvent('unwell', { what: 'low' });
        router.replace('/emergency?tab=low');
      })}
      {tile('🥵', t('feelHigh'), c.skySoft, () => {
        cloudEvent('unwell', { what: 'high' });
        router.replace('/emergency?tab=high');
      })}
      {tile('🚑', t('feelDanger'), c.chilliSoft, () => {
        cloudEvent('unwell', { what: 'danger' });
        call('108');
      })}
      <Banner tone="info">
        <Txt weight="semibold">🩸 {t('feelCheck')}</Txt>
      </Banner>
      <Btn kind="alt" label={t('sugT')} onPress={() => router.replace('/sugar')} style={{ marginBottom: 10 }} />
      <FamilyAlert message={t('alertFeel', { name, what: t('feelQ').replace('😟 ', '') })} />
      <Legal />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 16, marginBottom: 12, minHeight: 96 },
});
