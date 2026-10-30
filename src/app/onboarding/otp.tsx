import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { requestOtp, verifyOtp } from '@/cloud/auth';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Field, H2, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import { StepBar } from '@/components/StepHeader';

const RESEND_S = 30;

/** Type the 6-digit code from the SMS. */
export default function OtpScreen() {
  const { t } = useT();
  const { phone = '', testCode: firstCode } = useLocalSearchParams<{ phone: string; testCode?: string }>();
  // Test mode (no SMS service): the server tells us the code so testing is not blocked.
  const [testCode, setTestCode] = useState(firstCode);
  const onboarded = useApp((s) => s.onboarded);
  const updateSetup = useApp((s) => s.updateSetup);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_S);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const verify = async (c = code) => {
    if (c.length !== 6) return;
    setBusy(true);
    try {
      const r = await verifyOtp(phone, c);
      toast(t('loginOk'));
      if (r.name && !useApp.getState().setup.name) updateSetup({ name: r.name });
      router.replace(onboarded ? '/' : '/onboarding/about');
    } catch (e) {
      toast((e as { status?: number }).status === 0 ? t('netFail') : t('wrongCode'));
      setCode('');
    }
    setBusy(false);
  };

  return (
    <Screen title={t('otpT')} back sos={false}>
      {!onboarded ? <StepBar at="phone" /> : null}
      <H2>🔐 {t('otpQ')}</H2>
      <Txt size={17} color="mute" style={{ marginBottom: 12 }}>
        {t('otpSub', { phone })}
      </Txt>
      {testCode ? (
        <Banner tone="amber">
          <Txt weight="bold">🧪 {t('otpTestMode', { code: testCode })}</Txt>
          <Btn small kind="alt" label={t('otpUseTest')} onPress={() => { setCode(testCode); verify(testCode); }} style={{ marginTop: 8 }} />
        </Banner>
      ) : null}
      <Card>
        <Field
          value={code}
          onChangeText={(v) => {
            const d = v.replace(/\D/g, '').slice(0, 6);
            setCode(d);
            if (d.length === 6) verify(d);
          }}
          placeholder="••••••"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={6}
          style={{ fontSize: 36, letterSpacing: 10, textAlign: 'center' }}
          accessibilityLabel={t('otpT')}
        />
      </Card>
      <Btn label={t('verify')} disabled={code.length !== 6 || busy} style={{ opacity: code.length === 6 ? 1 : 0.5, marginBottom: 10 }} onPress={() => verify()} />
      <Btn
        kind="alt"
        small
        label={wait > 0 ? t('resendIn', { s: wait }) : t('resend')}
        disabled={wait > 0}
        onPress={async () => {
          await requestOtp(phone)
            .then((r) => setTestCode(r.testCode))
            .catch(() => toast(t('netFail')));
          setWait(RESEND_S);
        }}
      />
    </Screen>
  );
}
