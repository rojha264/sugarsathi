import { router } from 'expo-router';
import { useState } from 'react';

import { cloudEnabled, signedIn } from '@/cloud/client';
import { DietPicker } from '@/components/DietPicker';
import { Screen } from '@/components/Screen';
import { Btn, H2, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import type { Diet } from '@/types';
import { StepBar } from '@/components/StepHeader';

/** Onboarding step: what the person eats. Only those foods are shown from then on. */
export default function DietScreen() {
  const { t } = useT();
  const update = useApp((s) => s.updateSetup);
  const [diet, setDiet] = useState<Diet | null>(null);
  return (
    <Screen title={t('app')} back sos={false}>
      <StepBar at="diet" />
      <H2>🍽️ {t('dietTitle')}</H2>
      <Txt size={17} color="mute" style={{ marginBottom: 14 }}>
        {t('dietSub')}
      </Txt>
      <DietPicker value={diet} onChange={setDiet} />
      <Txt size={15} color="mute" center style={{ marginVertical: 14 }}>
        ⚙️ {t('dietLater')}
      </Txt>
      <Btn
        label={t('dietNext')}
        disabled={!diet}
        style={{ opacity: diet ? 1 : 0.5 }}
        onPress={() => {
          if (!diet) return;
          update({ diet });
          router.push(cloudEnabled && !signedIn() ? '/onboarding/phone' : '/onboarding/about');
        }}
      />
    </Screen>
  );
}
