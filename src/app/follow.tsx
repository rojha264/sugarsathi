import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { join } from '@/cloud/link';
import { useCloud } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Btn, Card, Field, H3, Legal, styles as ui, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';

const STEPS = ['followStep1', 'followStep2', 'followStep3'] as const;

/** Caregiver side: follow an elder with the 6-digit code from their phone. Alerts arrive as app notifications. */
export default function FollowScreen() {
  const { t, lang } = useT();
  const myDefault = useCloud((s) => s.myName) || useApp.getState().setup.name;
  const [code, setCode] = useState('');
  const [name, setName] = useState(myDefault);
  const [busy, setBusy] = useState(false);
  const digits = code.replace(/\D/g, '');
  const ready = digits.length === 6 && !!name.trim();

  const go = async () => {
    setBusy(true);
    try {
      const f = await join(digits, name, lang);
      toast(t('followSent', { n: f.name }));
      router.replace(`/remote/${f.patientId}`);
    } catch (e) {
      const m = (e as Error).message;
      toast(m === 'bad_code' ? t('followBadCode') : m === 'own_circle' ? t('followOwn') : t('netFail'));
    }
    setBusy(false);
  };

  return (
    <Screen title={t('followT')} back>
      <Card>
        <H3>📲 {t('followHowT')}</H3>
        {STEPS.map((k, i) => (
          <View key={k} style={[ui.row, { paddingVertical: 4 }]}>
            <Txt size={18} weight="heavy" color="leaf" style={{ width: 24 }}>
              {i + 1}
            </Txt>
            <Txt size={16} style={{ flex: 1 }}>
              {t(k)}
            </Txt>
          </View>
        ))}
      </Card>
      <Card>
        <H3>🔢 {t('followCode')}</H3>
        <Field
          value={code}
          onChangeText={setCode}
          placeholder="123 456"
          keyboardType="number-pad"
          maxLength={7}
          style={{ fontSize: 32, textAlign: 'center', letterSpacing: 6, marginBottom: 10 }}
        />
        <Txt weight="bold" style={{ marginBottom: 4 }}>
          {t('followMyName')}
        </Txt>
        <Field value={name} onChangeText={setName} placeholder={t('namePh')} autoCapitalize="words" />
      </Card>
      <Btn label={`➕ ${t('followGo')}`} disabled={!ready || busy} style={{ opacity: ready ? 1 : 0.5 }} onPress={go} />
      <Txt size={14} color="mute" center style={{ marginTop: 10 }}>
        🔔 {t('followAlertsNote')}
      </Txt>
      <Legal />
    </Screen>
  );
}
