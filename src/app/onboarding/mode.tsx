import { router } from 'expo-router';

import { Screen } from '@/components/Screen';
import { H2, Tile } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import type { Mode } from '@/types';
import { StepBar } from '@/components/StepHeader';

export default function ModeScreen() {
  const { t } = useT();
  const setMode = useApp((s) => s.setMode);
  const pick = (m: Mode) => {
    setMode(m);
    router.push('/onboarding/diet');
  };
  return (
    <Screen title={t('app')} back sos={false}>
      <StepBar at="mode" />
      <H2>{t('modeTitle')}</H2>
      <Tile icon="👵" title={t('easy')} sub={t('easySub')} onPress={() => pick('easy')} />
      <Tile icon="🗣️" title={t('simple')} sub={t('simpleSub')} onPress={() => pick('simple')} />
      <Tile icon="📊" title={t('detailed')} sub={t('detailedSub')} onPress={() => pick('detailed')} />
    </Screen>
  );
}
