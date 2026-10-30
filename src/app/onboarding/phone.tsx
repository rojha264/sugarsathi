import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { requestOtp } from '@/cloud/auth';
import { useCloud } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Btn, Card, Field, H2, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import { StepBar } from '@/components/StepHeader';

/** Sign in with a mobile number: works for new and returning users. */
export default function PhoneScreen() {
  const { t } = useT();
  const onboarded = useApp((s) => s.onboarded);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '');

  const send = async () => {
    setBusy(true);
    try {
      const r = await requestOtp(digits);
      router.push({ pathname: '/onboarding/otp', params: { phone: r.phone, ...(r.testCode ? { testCode: r.testCode } : {}) } });
    } catch (e) {
      toast((e as Error).message === 'too_many_requests' ? t('otpTooMany') : (e as { status?: number }).status === 0 ? t('netFail') : t('badPhone'));
    }
    setBusy(false);
  };
  const skip = () => {
    useCloud.setState({ skipLogin: true });
    if (onboarded) router.replace('/');
    else router.replace('/onboarding/about');
  };

  return (
    <Screen title={t('loginT')} back={!onboarded} sos={false}>
      {!onboarded ? <StepBar at="phone" /> : null}
      <H2>📱 {t('loginQ')}</H2>
      <Txt size={17} color="mute" style={{ marginBottom: 12 }}>
        {t('loginSub')}
      </Txt>
      <Card>
        <Txt weight="bold" style={{ marginBottom: 6 }}>
          {t('phoneLabel')}
        </Txt>
        <Field
          value={phone}
          onChangeText={setPhone}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          maxLength={14}
          autoFocus
          style={{ fontSize: 28, letterSpacing: 2, textAlign: 'center' }}
          accessibilityLabel={t('phoneLabel')}
        />
      </Card>
      <Btn label={t('sendCode')} disabled={digits.length < 10 || busy} style={{ opacity: digits.length >= 10 ? 1 : 0.5, marginBottom: 12 }} onPress={send} />
      <Pressable accessibilityRole="button" onPress={skip} style={{ paddingVertical: 12 }}>
        <Txt size={16} color="mute" center>
          {t('skipLogin')}
        </Txt>
      </Pressable>
    </Screen>
  );
}
