import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NumberStepper } from '@/components/NumberStepper';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Banner, Btn, Card, Chip, ChipRow, Field, styles as ui, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { addDays, localDate } from '@/logic/ids';
import { validSugar } from '@/logic/baseline';
import { useApp } from '@/store/useApp';
import type { Meds, RiskFlag, SugarCtx } from '@/types';

type When = 'm0' | 'm3' | 'm6';
const CTXS: SugarCtx[] = ['fasting', 'after', 'random'];
const CTX_ICON: Record<SugarCtx, string> = { fasting: '🌅', after: '🍽️', random: '🕐' };
const MONTHS_AGO: Record<When, number> = { m0: 0, m3: 2, m6: 5 };

/**
 * Signup step 2 of 3: where their sugar is today. Everything can be skipped ("Don't know",
 * "Check tomorrow"), and medicines and pregnancy decide whether a dietitian reviews the plan first.
 */
export default function SugarScreen() {
  const { t } = useT();
  const setup = useApp((s) => s.setup);
  const update = useApp((s) => s.updateSetup);
  const setCheckupValue = useApp((s) => s.setCheckupValue);
  const markCheckup = useApp((s) => s.markCheckup);
  const [knowA1c, setKnowA1c] = useState<boolean | null>(null);
  const [a1c, setA1c] = useState(7.5);
  const [when, setWhen] = useState<When>('m0');
  // One box per kind of reading, so a fasting value never shows under "after a meal".
  const [values, setValues] = useState<Record<SugarCtx, string>>({ fasting: '', after: '', random: '' });
  const [later, setLater] = useState(false);
  const [meds, setMeds] = useState<Meds | null>(setup.meds ?? null);
  const [flags, setFlags] = useState<RiskFlag[]>(setup.flags ?? []);
  const filled = CTXS.filter((c) => values[c] !== '');
  const allValid = filled.every((c) => validSugar(Number(values[c])));
  const sugarOk = later || (filled.length > 0 && allValid);
  const ready = knowA1c !== null && sugarOk && !!meds;
  const toggle = (f: RiskFlag) => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  return (
    <Screen title={t('app')} back sos={false}>
      <StepHeader at="sugar" title={`🩸 ${t('sugarStepT')}`} sub={t('sugarStepSub')} />

      <Txt weight="bold" style={{ marginBottom: 4 }}>
        {t('a1cQ')}
      </Txt>
      <View style={ui.chips}>
        <Chip label={`🧪 ${t('a1cKnow')}`} on={knowA1c === true} onPress={() => setKnowA1c(true)} />
        <Chip label={`🤷 ${t('a1cDontKnow')}`} on={knowA1c === false} onPress={() => setKnowA1c(false)} />
      </View>
      {knowA1c ? (
        <Card>
          <NumberStepper label="HbA1c" value={a1c} step={0.1} min={4} max={18} unit="%" onChange={(x) => setA1c(Math.round(x * 10) / 10)} />
          <Txt size={15} weight="semibold" style={{ marginTop: 6 }}>
            {t('a1cWhen')}
          </Txt>
          <ChipRow<When> value={when} options={['m0', 'm3', 'm6']} onChange={setWhen} label={(w) => t(w === 'm0' ? 'a1cM0' : w === 'm3' ? 'a1cM3' : 'a1cM6')} />
        </Card>
      ) : knowA1c === false ? (
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          💡 {t('a1cWhy')}
        </Txt>
      ) : null}

      <Txt weight="bold" style={{ marginTop: 8, marginBottom: 4 }}>
        {t('sugarNowQ')}
      </Txt>
      {!later ? (
        <Card>
          <Txt size={14} color="mute" style={{ marginBottom: 6 }}>
            {t('sugarAnyOne')}
          </Txt>
          {CTXS.map((c) => {
            const raw = values[c];
            const bad = raw !== '' && !validSugar(Number(raw));
            return (
              <View key={c} style={{ marginBottom: 8 }}>
                <View style={[ui.row, { alignItems: 'center' }]}>
                  <Txt size={17} weight="semibold" style={{ flex: 1 }}>
                    {CTX_ICON[c]} {t(c)}
                  </Txt>
                  <Field
                    value={raw}
                    onChangeText={(x) => setValues((s) => ({ ...s, [c]: x.replace(/[^0-9]/g, '').slice(0, 3) }))}
                    keyboardType="number-pad"
                    placeholder="mg/dL"
                    accessibilityLabel={`${t(c)}, mg/dL`}
                    style={{ width: 120, marginBottom: 0, textAlign: 'center' }}
                  />
                </View>
                {bad ? (
                  <Txt size={14} color="chilli">
                    {t('sugarRange')}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}
      <View style={ui.chips}>
        <Chip label={`🌅 ${t('sugarLater')}`} on={later} onPress={() => setLater((x) => !x)} />
      </View>

      <Txt weight="bold" style={{ marginTop: 8, marginBottom: 4 }}>
        {t('medsQ')}
      </Txt>
      <ChipRow<Meds> value={meds ?? ('' as Meds)} options={['none', 'tablets', 'insulin']} onChange={setMeds} label={(m) => t(m === 'none' ? 'medsNone' : m === 'tablets' ? 'medsTablets' : 'medsInsulin')} />

      <Txt weight="bold" style={{ marginTop: 8, marginBottom: 4 }}>
        {t('flagsQ')}
      </Txt>
      <View style={ui.chips}>
        {setup.sex === 'female' ? <Chip label={`🤰 ${t('flagPregnant')}`} on={flags.includes('pregnant')} onPress={() => toggle('pregnant')} /> : null}
        <Chip label={`🫘 ${t('flagKidney')}`} on={flags.includes('kidney')} onPress={() => toggle('kidney')} />
      </View>
      {meds === 'insulin' || flags.length ? (
        <Banner tone="amber" style={{ marginTop: 6 }}>
          <Txt size={15}>👩‍⚕️ {t('reviewNote')}</Txt>
        </Banner>
      ) : null}

      <Btn
        label={t('next')}
        disabled={!ready}
        style={{ opacity: ready ? 1 : 0.5, marginTop: 10 }}
        onPress={() => {
          if (knowA1c) {
            setCheckupValue('a1c', a1c);
            markCheckup('a1c', addDays(localDate(), -30 * MONTHS_AGO[when]));
          }
          update({ meds: meds!, flags, firstReading: null, firstReadings: later ? null : filled.map((c) => ({ v: Number(values[c]), ctx: c })) });
          router.push('/onboarding/setup');
        }}
      />
    </Screen>
  );
}
