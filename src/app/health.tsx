import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useCloud } from '@/cloud/store';
import { NumberStepper } from '@/components/NumberStepper';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, ChipRow, H3, styles as ui, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { ageGroupFor, feetInches } from '@/logic/baseline';
import { localDate } from '@/logic/ids';
import { defaultSugarEvery } from '@/logic/sugarPlan';
import { useApp } from '@/store/useApp';
import type { DiabetesType, Meds, Region, RiskFlag, Sex } from '@/types';

const THIS_YEAR = new Date().getFullYear();
const REGION_KEY = { north: 'rNorth', south: 'rSouth', east: 'rEast', west: 'rWest', northeast: 'rNortheast' } as const;

/**
 * The signup answers, editable any time from Settings. Saved together (not on every tap), so the
 * dietitian sees one clear update; a new weight is also logged, a new HbA1c counts as this month's test.
 */
export default function HealthScreen() {
  const { t } = useT();
  const setup = useApp((s) => s.setup);
  const update = useApp((s) => s.updateSetup);
  const addVital = useApp((s) => s.addVital);
  const setCheckupValue = useApp((s) => s.setCheckupValue);
  const markCheckup = useApp((s) => s.markCheckup);
  const a1cNow = useApp((s) => s.profiles.me.checkupValues?.a1c);
  const inProgram = useCloud((s) => s.program?.status === 'active');

  const [age, setAge] = useState(setup.birthYear ? THIS_YEAR - setup.birthYear : 50);
  const [sex, setSex] = useState<Sex | undefined>(setup.sex);
  const [height, setHeight] = useState(setup.heightCm ?? 160);
  const [weight, setWeight] = useState(setup.weightKg ?? 65);
  const [type, setType] = useState<DiabetesType>(setup.type);
  const [a1c, setA1c] = useState<number | null>(a1cNow ?? null);
  const [meds, setMeds] = useState<Meds>(setup.meds ?? 'none');
  const [flags, setFlags] = useState<RiskFlag[]>(setup.flags ?? []);
  const [region, setRegion] = useState<Region | undefined>(setup.region);
  const toggle = (f: RiskFlag) => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  // Starting insulin or a pregnancy/kidney problem changes what is safe: say the dietitian will check.
  const riskier = (meds === 'insulin' && setup.meds !== 'insulin') || flags.some((f) => !(setup.flags ?? []).includes(f)) || (type === 'type1' && setup.type !== 'type1');

  const save = () => {
    update({
      sex, birthYear: THIS_YEAR - age, age: ageGroupFor(age), heightCm: height, weightKg: weight, meds, flags, region,
      type, ...(type !== setup.type ? { sugarEvery: defaultSugarEvery(type) } : {}),
    });
    if (weight !== setup.weightKg) addVital({ kind: 'weight', weightKg: weight });
    if (a1c !== null && a1c !== a1cNow) {
      setCheckupValue('a1c', a1c);
      markCheckup('a1c', localDate());
    }
    toast(t('healthSaved'));
    router.back();
  };

  return (
    <Screen title={t('healthT')} back>
      <Txt size={16} color="mute" style={{ marginBottom: 8 }}>
        {t('healthSub')}
      </Txt>
      <Card>
        <H3>🙂 {t('aboutT')}</H3>
        <Txt weight="bold" style={{ marginBottom: 4 }}>{t('sexQ')}</Txt>
        <ChipRow<Sex> value={sex ?? ('' as Sex)} options={['female', 'male', 'other']} onChange={setSex} label={(v) => t(v === 'female' ? 'sexF' : v === 'male' ? 'sexM' : 'sexO')} />
        <NumberStepper label={`🎂 ${t('ageQ')}`} value={age} step={1} min={10} max={100} unit={t('years')} onChange={setAge} />
        <NumberStepper label={`📏 ${t('heightQ')}`} value={height} step={1} min={100} max={220} unit={`cm (${feetInches(height)})`} onChange={setHeight} />
        <NumberStepper label={`⚖️ ${t('weightQ')}`} value={weight} step={0.5} min={25} max={200} unit="kg" onChange={setWeight} />
        <Txt weight="bold" style={{ marginTop: 6, marginBottom: 4 }}>{t('dtype')}</Txt>
        <ChipRow<DiabetesType> value={type} options={['type2', 'type1', 'gdm', 'pre', 'care']} onChange={setType} label={t} />
      </Card>

      <Card>
        <H3>🩸 {t('healthSugarT')}</H3>
        <Txt weight="bold" style={{ marginBottom: 4 }}>{t('a1cQ')}</Txt>
        {a1c === null ? (
          <View style={ui.chips}>
            <Chip label={`🧪 ${t('a1cAdd')}`} onPress={() => setA1c(7.5)} />
          </View>
        ) : (
          <NumberStepper label="HbA1c" value={a1c} step={0.1} min={4} max={18} unit="%" onChange={(x) => setA1c(Math.round(x * 10) / 10)} />
        )}
        <Txt weight="bold" style={{ marginTop: 6, marginBottom: 4 }}>{t('medsQ')}</Txt>
        <ChipRow<Meds> value={meds} options={['none', 'tablets', 'insulin']} onChange={setMeds} label={(m) => t(m === 'none' ? 'medsNone' : m === 'tablets' ? 'medsTablets' : 'medsInsulin')} />
        <Txt weight="bold" style={{ marginTop: 6, marginBottom: 4 }}>{t('flagsQ')}</Txt>
        <View style={ui.chips}>
          {sex === 'female' ? <Chip label={`🤰 ${t('flagPregnant')}`} on={flags.includes('pregnant')} onPress={() => toggle('pregnant')} /> : null}
          <Chip label={`🫘 ${t('flagKidney')}`} on={flags.includes('kidney')} onPress={() => toggle('kidney')} />
        </View>
      </Card>

      <Card>
        <H3>🍛 {t('regionQ')}</H3>
        <ChipRow<Region> value={region ?? ('' as Region)} options={['north', 'south', 'east', 'west', 'northeast']} onChange={setRegion} label={(r) => t(REGION_KEY[r])} />
        {inProgram && region !== setup.region ? (
          <Txt size={14} color="mute">{t('regionLater')}</Txt>
        ) : null}
      </Card>

      {riskier ? (
        <Banner tone="amber">
          <Txt size={15}>👩‍⚕️ {t('healthReview')}</Txt>
        </Banner>
      ) : null}
      <Btn label={`💾 ${t('healthSave')}`} onPress={save} />
    </Screen>
  );
}
