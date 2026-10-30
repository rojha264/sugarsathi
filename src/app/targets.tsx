import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NumberStepper } from '@/components/NumberStepper';
import { SugarEveryChips } from '@/components/SugarEveryChips';
import { Screen } from '@/components/Screen';
import { Banner, Card, Chip, H3, KV, Legal, styles as ui, Txt } from '@/components/ui';
import { useTargetsText } from '@/i18n/targetsText';
import { careFlags } from '@/logic/care';
import { autoAllowed, isLowPaused } from '@/logic/smartTargets';
import { FASTING_MAX, OTHER_MAX } from '@/logic/sugar';
import { isLowered, lastChangeFor, MAIN_SLOTS, SNACK_MAX } from '@/logic/targets';
import { useApp, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import type { MainSlot } from '@/types';


export default function TargetsScreen() {
  const { t, fieldName, line, reason, date } = useTargetsText();
  const c = useColors();
  const p = useProfile();
  const cur = useApp((s) => s.cur);
  const setup = useApp((s) => s.setup);
  const setTargetBase = useApp((s) => s.setTargetBase);
  const setSugarEvery = useApp((s) => s.setSugarEvery);
  const tg = p.targets;
  const [open, setOpen] = useState<MainSlot | null>(null);
  const openChange = open ? lastChangeFor(tg, open) : undefined;

  const care = careFlags(cur, setup, p.care);
  const blocked = autoAllowed(tg, care.targetSetup);
  const lowPause = isLowPaused(tg);
  const gdm = care.pregnant;
  const editBase = (patch: Partial<typeof tg.base>) => setTargetBase(cur, { ...tg.base, ...patch }, tg.mode);

  return (
    <Screen title={p.name ? t('targetsT', { n: p.name }) : t('myTargets')} back>
      <Card>
        <H3>🩸 {t('sugarGoals')}</H3>
        {gdm ? (
          <Txt color="mute">🤰 {t('gdmTargets')}</Txt>
        ) : (
          <>
            <KV k={t('goalBeforeL')} v={`80–${FASTING_MAX} mg/dL`} />
            <KV k={t('goalAfterL')} v={`< ${OTHER_MAX} mg/dL`} last />
          </>
        )}
        <Txt size={14} color="mute" style={{ marginTop: 6, marginBottom: 10 }}>
          {t('testTip')}
        </Txt>
        <Txt weight="bold" style={{ marginBottom: 6 }}>
          📅 {t('sugEveryQ')}
        </Txt>
        <SugarEveryChips value={p.sugarPlan.every} onChange={(v) => setSugarEvery(cur, v)} />
      </Card>

      {blocked === 'type' ? (
        <Banner tone="info">
          <Txt size={15} weight="semibold">{t('pausedType')}</Txt>
        </Banner>
      ) : lowPause ? (
        <Banner tone="amber">
          <Txt size={15} weight="semibold">⚠️ {t('pausedLow')}</Txt>
        </Banner>
      ) : null}

      <Card>
        <H3>🍚 {t('carbGuide')}</H3>
        <View style={styles.slots}>
          {MAIN_SLOTS.map((s) => {
            const lowered = isLowered(tg, s);
            return (
              <Chip
                key={s}
                label={`${fieldName(s)} ${tg.slot[s]} g${lowered ? ' ↓' : ''}`}
                on={open === s}
                tone={lowered ? 'chilli' : 'leaf'}
                onPress={() => setOpen(open === s ? null : s)}
              />
            );
          })}
          <Chip label={`${fieldName('snack')} ${SNACK_MAX} g`} onPress={() => setOpen(null)} />
        </View>
        {open ? (
          <Txt size={15} color="mute" style={{ marginBottom: 6 }}>
            {openChange ? t('lowered', { why: reason(openChange) }) : t('noChanges')}
          </Txt>
        ) : null}
        <KV k={`💪 ${t('tgProtein')}`} v={`${tg.protein} g`} />
        <KV k={`🥗 ${t('tgFiber')}`} v={`${tg.fiber} g`} last />
      </Card>

      <Card>
        <View style={[ui.chips, { marginBottom: 6 }]}>
          <Chip label={`🤖 ${t('modeAuto')}`} on={tg.mode === 'auto'} onPress={() => setTargetBase(cur, tg.base, 'auto')} />
          <Chip label={`👩‍⚕️ ${t('modeDoctor')}`} on={tg.mode === 'doctor'} onPress={() => setTargetBase(cur, tg.base, 'doctor')} />
        </View>
        {tg.mode === 'auto' ? (
          <Txt size={14} color="mute">
            {t('autoNote')}
          </Txt>
        ) : null}
        <NumberStepper label={t('tgMeal')} value={tg.base.meal} step={5} min={30} max={90} unit="g" onChange={(v) => editBase({ meal: v })} />
        <NumberStepper label={t('tgProtein')} value={tg.base.protein} step={5} min={30} max={150} unit="g" onChange={(v) => editBase({ protein: v })} />
        <NumberStepper label={t('tgFiber')} value={tg.base.fiber} step={5} min={15} max={50} unit="g" onChange={(v) => editBase({ fiber: v })} />
        <Txt size={14} color="mute" style={{ marginTop: 6 }}>
          {t('targetsSub')}
        </Txt>
      </Card>

      <Card>
        <H3>📝 {t('whyChanged')}</H3>
        {tg.log.length ? (
          [...tg.log].reverse().map((a, i) => (
            <View key={i} style={[styles.logRow, { borderBottomColor: c.line }, i === tg.log.length - 1 && { borderBottomWidth: 0 }]}>
              <Txt size={14} color="mute">
                {date(a.at)}
              </Txt>
              <Txt size={15} weight="semibold">
                {line(a)}
              </Txt>
            </View>
          ))
        ) : (
          <Txt size={15} color="mute">
            {t('noChanges')}
          </Txt>
        )}
      </Card>
      <Legal />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  logRow: { paddingVertical: 8, borderBottomWidth: 1 },
});
