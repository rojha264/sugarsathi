import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { bpBand, type BpBand } from '@shared/presence';
import { cloudDelete } from '@/cloud/sync';
import { Sparkline } from '@/components/charts';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Field, H3, Legal, styles as ui, Txt } from '@/components/ui';
import { WeightGuide } from '@/components/WeightGuide';
import { dateFormat, type TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { call } from '@/native/share';
import { say } from '@/native/tts';
import { useApp, useProfile } from '@/store/useApp';
import type { Vital } from '@/types';

const BAND: Record<BpBand, { tone: 'green' | 'amber' | 'red' | 'info'; key: TextKey }> = {
  normal: { tone: 'green', key: 'bpNormal' },
  elevated: { tone: 'amber', key: 'bpElevated' },
  high1: { tone: 'amber', key: 'bpHigh1' },
  high2: { tone: 'red', key: 'bpHigh2' },
  crisis: { tone: 'red', key: 'bpCrisis' },
  low: { tone: 'amber', key: 'bpLow' },
};

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** Weight and blood pressure: type the number, see what it means, follow the trend. */
export default function VitalsScreen() {
  const { t, lang } = useT();
  const p = useProfile();
  const addVital = useApp((s) => s.addVital);
  const removeVital = useApp((s) => s.removeVital);
  const vitals = p.vitals ?? [];
  const weights = vitals.filter((v): v is Extract<Vital, { kind: 'weight' }> => v.kind === 'weight');
  const bps = vitals.filter((v): v is Extract<Vital, { kind: 'bp' }> => v.kind === 'bp');
  const [weight, setWeight] = useState(() => (weights.at(-1) ? String(weights.at(-1)!.weightKg) : ''));
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [band, setBand] = useState<BpBand | null>(null);
  const fmt = dateFormat(lang, { day: 'numeric', month: 'short' });

  const saveWeight = () => {
    const w = num(weight);
    if (!(w >= 10 && w <= 300)) return toast(t('wBad'));
    addVital({ kind: 'weight', weightKg: Math.round(w * 10) / 10 });
    const prev = weights.at(-1)?.weightKg;
    const msg = prev ? t('wSavedDiff', { d: `${w - prev > 0 ? '+' : ''}${Math.round((w - prev) * 10) / 10}` }) : t('wSaved');
    toast(msg);
    say(msg, lang);
  };
  const saveBp = () => {
    const s = num(sys);
    const d = num(dia);
    if (!(s >= 60 && s <= 260 && d >= 30 && d <= 160 && s > d)) return toast(t('bpBad'));
    addVital({ kind: 'bp', sys: Math.round(s), dia: Math.round(d) });
    const b = bpBand(s, d);
    setBand(b);
    say(t(BAND[b].key), lang);
    setSys('');
    setDia('');
  };
  const remove = (v: Vital) =>
    Alert.alert(t('logRemoveQ'), v.kind === 'weight' ? `${v.weightKg} kg` : `${v.sys}/${v.dia}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => { cloudDelete('vitals', v.id); removeVital(v.id); } },
    ]);

  return (
    <Screen title={t('vitalsT')} back>
      <Card>
        <H3>⚖️ {t('wT')}</H3>
        <View style={ui.row}>
          <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="65.5" maxLength={5} style={{ flex: 1, fontSize: 30, textAlign: 'center' }} accessibilityLabel={t('wT')} />
          <Txt size={22} weight="bold">kg</Txt>
        </View>
        <Btn label={`✓ ${t('wSave')}`} onPress={saveWeight} style={{ marginTop: 10 }} />
        {weights.length > 1 ? (
          <>
            <Sparkline values={weights.slice(-20).map((w) => w.weightKg)} label={t('wT')} />
            <Txt size={14} color="mute" center>
              {t('wTrend', { a: weights.slice(-20)[0].weightKg, b: weights.at(-1)!.weightKg })}
            </Txt>
          </>
        ) : null}
        <WeightGuide weightKg={weights.at(-1)?.weightKg ?? null} />
      </Card>

      <Card>
        <H3>❤️ {t('bpT')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          {t('bpHow')}
        </Txt>
        <View style={ui.row}>
          <Field value={sys} onChangeText={setSys} keyboardType="number-pad" placeholder="120" maxLength={3} style={{ flex: 1, fontSize: 30, textAlign: 'center' }} accessibilityLabel={t('bpSys')} />
          <Txt size={30} weight="bold">/</Txt>
          <Field value={dia} onChangeText={setDia} keyboardType="number-pad" placeholder="80" maxLength={3} style={{ flex: 1, fontSize: 30, textAlign: 'center' }} accessibilityLabel={t('bpDia')} />
        </View>
        <View style={ui.row}>
          <Txt size={14} color="mute" center style={{ flex: 1 }}>{t('bpSys')}</Txt>
          <Txt size={14} color="mute" center style={{ flex: 1 }}>{t('bpDia')}</Txt>
        </View>
        <Btn label={`✓ ${t('bpSave')}`} onPress={saveBp} style={{ marginTop: 10 }} />
        {band ? (
          <Banner tone={BAND[band].tone} style={{ marginTop: 10, marginBottom: 0 }}>
            <Txt size={17} weight="bold">
              {t(BAND[band].key)}
            </Txt>
            {band === 'crisis' ? <Btn kind="red" small label={`📞 ${t('call108')}`} onPress={() => call('108')} style={{ marginTop: 8 }} /> : null}
          </Banner>
        ) : null}
        {bps.length > 1 ? <Sparkline values={bps.slice(-20).map((b) => b.sys)} label={t('bpT')} /> : null}
      </Card>

      {vitals.length ? (
        <Card>
          <H3>📅 {t('vitalsHistory')}</H3>
          {vitals
            .slice(-12)
            .reverse()
            .map((v) => (
              <View key={v.id} style={[ui.row, { paddingVertical: 6 }]}>
                <Txt size={15} color="mute" style={{ width: 70 }}>
                  {fmt.format(new Date(v.createdAt))}
                </Txt>
                <Txt size={17} weight="bold" style={{ flex: 1 }}>
                  {v.kind === 'weight' ? `⚖️ ${v.weightKg} kg` : `❤️ ${v.sys}/${v.dia}`}
                </Txt>
                {v.kind === 'bp' ? (
                  <Txt size={14} color={BAND[bpBand(v.sys, v.dia)].tone === 'red' ? 'chilli' : BAND[bpBand(v.sys, v.dia)].tone === 'green' ? 'leaf' : 'mute'}>
                    {t(`${BAND[bpBand(v.sys, v.dia)].key}Short` as TextKey)}
                  </Txt>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t('remove')} onPress={() => remove(v)} hitSlop={10} style={{ padding: 6 }}>
                  <Txt size={18}>🗑️</Txt>
                </Pressable>
              </View>
            ))}
        </Card>
      ) : null}
      <Legal />
    </Screen>
  );
}
