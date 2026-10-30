import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayChips } from '@/components/DayChips';
import { EatNow } from '@/components/EatNow';
import { TodayLog } from '@/components/TodayLog';
import { FamilyAlert } from '@/components/FamilyAlert';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, ChipRow, Legal, SUGAR_TONE, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { mealBeforeAfterReading, type Adapted } from '@/logic/smartTargets';
import { isUrgentLow, METER_MAX, METER_MIN, sugarStatus, type SugarStatus } from '@/logic/sugar';
import { useTargetsText } from '@/i18n/targetsText';
import { cloudEvent } from '@/cloud/sync';
import { say } from '@/native/tts';
import { useApp, useDiabetesType, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import type { SugarCtx } from '@/types';

export default function SugarScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const mode = useApp((s) => s.mode);
  const addSugar = useApp((s) => s.addSugar);
  const type = useDiabetesType();
  const [val, setVal] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  // Guess the reading type: "2 h after" if a meal was logged 1–3 h ago, fasting before 10 am.
  const [ctx, setCtx] = useState<SugarCtx>(() => {
    const now = Date.now();
    if (mealBeforeAfterReading(p.meals, now)) return 'after';
    return new Date().getHours() < 10 && !p.meals.length ? 'fasting' : 'random';
  });
  /** The saved reading, its status, and what it changed in the targets. */
  const [res, setRes] = useState<(SugarStatus & { v: number; adapted: Adapted }) | null>(null);
  const adapted = res?.adapted;
  const tt = useTargetsText();

  const press = (d: string) => {
    if (val.length < 3) {
      setVal(val + d);
      setRes(null);
    }
  };
  const save = () => {
    const v = parseInt(val, 10);
    if (!v) return toast(t('enter'));
    if (v < METER_MIN || v > METER_MAX) return toast(t('outOfRange', { a: METER_MIN, b: METER_MAX }));
    const st = sugarStatus(v, ctx, { type });
    setRes({ ...st, v, adapted: addSugar(v, ctx, daysAgo) });
    setVal('');
    if (st.l === 'r') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Family is alerted on the server for very low or very high readings.
    if (!daysAgo) cloudEvent('sugar', { v, ctx });
    if (mode !== 'detailed' || isUrgentLow(v)) say(t(st.k), lang);
    // Very low now: the steps matter more than anything else on this screen.
    if (!daysAgo && isUrgentLow(v)) router.push('/emergency');
  };

  const key = (label: string, onPress: () => void, primary?: boolean, a11y?: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        { borderColor: primary ? c.leaf : c.line, backgroundColor: primary ? c.leaf : c.card, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Txt size={28} weight="bold" style={primary ? { color: c.onLeaf } : undefined}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <Screen title={t('sugT')} back>
      <DayChips value={daysAgo} onChange={(n) => { setDaysAgo(n); setRes(null); }} />
      <ChipRow<SugarCtx>
        value={ctx}
        options={['fasting', 'after', 'random']}
        onChange={(v) => {
          setCtx(v);
          setRes(null);
        }}
        label={t}
      />
      <Txt size={64} weight="heavy" center style={{ lineHeight: 72, color: val ? c.ink : c.line }} accessibilityLiveRegion="polite">
        {val || '---'}
      </Txt>
      <Txt size={16} color="mute" center style={{ marginBottom: 8 }}>
        mg/dL · {t('enter')}
      </Txt>

      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => press(d)))}
        {key('⌫', () => { setVal(val.slice(0, -1)); setRes(null); }, false, t('back'))}
        {key('0', () => press('0'))}
        {key('✓', save, true, t('ok'))}
      </View>

      {res ? (
        <Banner tone={SUGAR_TONE[res.l]}>
          <Txt size={30} weight="heavy">
            {res.v} mg/dL
          </Txt>
          <Txt weight="semibold">{t(res.k)}</Txt>
          {res.l === 'r' ? (
            <>
              <Btn kind="red" small label={t('openEm')} onPress={() => router.push(res.k === 'sHigh' ? '/emergency?tab=high' : '/emergency')} style={{ marginTop: 8, marginBottom: 8 }} />
              <FamilyAlert message={t('alertMsg', { name: p.name || t('friend'), v: res.v, status: t(res.k) })} />
            </>
          ) : null}
        </Banner>
      ) : null}

      {res ? <EatNow v={res.v} ctx={ctx} /> : null}

      {adapted?.pair ? (
        <Card>
          <Txt size={17} weight="bold">
            {t('pairCard', { slot: tt.fieldName(adapted.pair.slot), after: adapted.pair.after })}
          </Txt>
          <Txt size={15} color="mute">
            {adapted.pair.rise !== undefined
              ? t('pairRise', { before: adapted.pair.before!, rise: `${adapted.pair.rise > 0 ? '+' : ''}${adapted.pair.rise}` })
              : t('pairNoBefore')}
          </Txt>
        </Card>
      ) : null}
      {adapted?.changes.length ? (
        <Card>
          <Txt size={17} weight="bold" style={{ marginBottom: 4 }}>
            🎯 {t('myTargets')}
          </Txt>
          {adapted.changes.map((a, i) => (
            <Txt key={i} size={15} weight="semibold">
              • {tt.line(a)}
            </Txt>
          ))}
          <Btn small kind="alt" label={t('whyChanged')} onPress={() => router.push('/targets')} style={{ marginTop: 8 }} />
        </Card>
      ) : null}
      {!res ? (
        <Txt size={14} color="mute" center style={{ marginBottom: 10 }}>
          ⏱️ {t('testTip')}
        </Txt>
      ) : null}

      <TodayLog kind="sugar" />

      {res ? <Btn kind="alt" label={t('done')} onPress={() => router.back()} /> : null}
      <Legal text={t('targetNote')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  key: { width: '31%', flexGrow: 1, minHeight: 62, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
