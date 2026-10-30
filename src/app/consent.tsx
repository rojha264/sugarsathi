import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { ConsentCard } from '@/components/ConsentCard';
import { Screen } from '@/components/Screen';
import { Btn } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';

/** Shown once when the consent text has changed since the user last agreed. */
export default function ConsentScreen() {
  const { t } = useT();
  const agree = useApp((s) => s.agreeConsent);
  const [agreed, setAgreed] = useState(false);
  // Android back must not skip agreeing.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);
  return (
    <Screen title={t('consentNew')} sos={false}>
      <ConsentCard agreed={agreed} onToggle={() => setAgreed((x) => !x)} />
      <Btn
        label={t('consentGo')}
        disabled={!agreed}
        style={{ opacity: agreed ? 1 : 0.5 }}
        onPress={() => {
          agree();
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
    </Screen>
  );
}
