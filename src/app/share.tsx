import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { approve, members, newCode, removeMember, startSharing, stopSharing, type Member } from '@/cloud/link';
import { useCloud } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, Field, H3, Legal, styles as ui, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { shareWhatsApp } from '@/native/share';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

/** Patient side: share my day with family who follow me, and decide who can see it. */
export default function ShareScreen() {
  const { t } = useT();
  const c = useColors();
  const setup = useApp((s) => s.setup);
  const update = useApp((s) => s.updateSetup);
  const circleId = useCloud((s) => s.circleId);
  const code = useCloud((s) => s.code);
  const [agreed, setAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Member[]>([]);
  const [now] = useState(() => Date.now());

  const reload = useCallback(() => {
    members().then(setList).catch(() => {});
  }, []);
  useEffect(() => {
    if (circleId) reload();
  }, [circleId, reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast(t('netFail'));
    }
    setBusy(false);
  };

  const codeValid = code && code.expires > now;
  const pending = list.filter((m) => m.status === 'pending');
  const active = list.filter((m) => m.status === 'active');

  if (!circleId) {
    return (
      <Screen title={t('shareT')} back>
        <Card>
          <H3>👨‍👩‍👦 {t('shareWhy')}</H3>
          <Txt size={16} style={{ marginBottom: 8 }}>
            {t('shareWhat')}
          </Txt>
          <Txt size={15} color="mute" style={{ marginBottom: 10 }}>
            {t('shareSafe')}
          </Txt>
          <Field value={setup.name} onChangeText={(name) => update({ name })} placeholder={t('namePh')} autoCapitalize="words" style={{ marginBottom: 8 }} />
          <Field value={phone} onChangeText={setPhone} placeholder={t('sharePhone')} keyboardType="phone-pad" maxLength={15} style={{ marginBottom: 10 }} />
          <Chip label={`${agreed ? '☑️' : '⬜'} ${t('shareOk')}`} on={agreed} onPress={() => setAgreed((a) => !a)} />
        </Card>
        <Btn
          label={`🔗 ${t('shareStart')}`}
          disabled={!agreed || !setup.name.trim() || busy}
          style={{ opacity: agreed && setup.name.trim() ? 1 : 0.5 }}
          onPress={() => run(() => startSharing(setup.name.trim(), phone.trim()))}
        />
        <Legal />
      </Screen>
    );
  }

  return (
    <Screen title={t('shareT')} back>
      <Card>
        <H3>🔢 {t('shareCodeT')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          {t('shareCodeSub')}
        </Txt>
        {codeValid ? (
          <>
            <Txt size={44} weight="heavy" center style={{ letterSpacing: 6, lineHeight: 54, color: c.leaf }} selectable>
              {code.value.replace(/(\d{3})(\d{3})/, '$1 $2')}
            </Txt>
            <Btn small label={`💬 ${t('shareCodeWa')}`} onPress={() => shareWhatsApp(t('shareCodeMsg', { name: setup.name, code: code.value }))} style={{ marginVertical: 8 }} />
          </>
        ) : null}
        <Btn small kind="alt" label={t('shareNewCode')} disabled={busy} onPress={() => run(newCode)} />
      </Card>

      {pending.map((m) => (
        <Banner key={m.user_id} tone="amber">
          <Txt size={18} weight="bold" style={{ marginBottom: 8 }}>
            {t('shareAsk', { n: m.name || t('family') })}
          </Txt>
          <View style={ui.row}>
            <Btn small label={`✓ ${t('shareAllow')}`} onPress={() => run(() => approve(m.user_id).then(reload))} style={{ flex: 1 }} />
            <Btn small kind="alt" label={t('shareDeny')} onPress={() => run(() => removeMember(m.user_id).then(reload))} style={{ flex: 1 }} />
          </View>
        </Banner>
      ))}

      <Card>
        <H3>👀 {t('shareWho')}</H3>
        {active.length ? (
          active.map((m) => (
            <View key={m.user_id} style={[ui.row, { paddingVertical: 6 }]}>
              <Txt weight="bold" style={{ flex: 1 }}>
                {m.name || t('family')}
              </Txt>
              <Chip
                label={t('remove')}
                onPress={() =>
                  Alert.alert(t('shareRemoveQ', { n: m.name || t('family') }), undefined, [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('remove'), style: 'destructive', onPress: () => run(() => removeMember(m.user_id).then(reload)) },
                  ])
                }
              />
            </View>
          ))
        ) : (
          <Txt color="mute">{t('shareNone')}</Txt>
        )}
        <Btn small kind="alt" label={`🔄 ${t('shareRefresh')}`} onPress={reload} style={{ marginTop: 8 }} />
      </Card>

      <Btn
        kind="alt"
        small
        label={t('shareStop')}
        onPress={() =>
          Alert.alert(t('shareStopQ'), t('shareStopB'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('shareStop'), style: 'destructive', onPress: () => run(stopSharing) },
          ])
        }
      />
      <Legal />
    </Screen>
  );
}
