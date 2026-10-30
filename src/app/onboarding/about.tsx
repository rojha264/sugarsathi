import { router } from 'expo-router';
import { useState } from 'react';

import { NumberStepper } from '@/components/NumberStepper';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Btn, Card, ChipRow, Field, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { defaultSugarEvery } from '@/logic/sugarPlan';
import { ageGroupFor, feetInches } from '@/logic/baseline';
import { useApp } from '@/store/useApp';
import type { DiabetesType, Sex } from '@/types';

const THIS_YEAR = new Date().getFullYear();

/** Signup step 1 of 3: who the plan is for. Big steppers instead of typing for older users. */
export default function AboutScreen() {
  const { t } = useT();
  const setup = useApp((s) => s.setup);
  const update = useApp((s) => s.updateSetup);
  const [name, setName] = useState(setup.name);
  const [age, setAge] = useState(setup.birthYear ? THIS_YEAR - setup.birthYear : 50);
  const [sex, setSex] = useState<Sex | null>(setup.sex ?? null);
  const [height, setHeight] = useState(setup.heightCm ?? 160);
  const [weight, setWeight] = useState(setup.weightKg ?? 65);
  const [type, setType] = useState<DiabetesType>(setup.type);
  const ready = !!sex;
  return (
    <Screen title={t('app')} back sos={false}>
      <StepHeader at="about" title={`🙂 ${t('aboutT')}`} sub={t('aboutSub')} />
      <Txt weight="bold" style={{ marginBottom: 4 }}>
        {t('nameOpt')}
      </Txt>
      <Field value={name} onChangeText={setName} placeholder={t('namePh')} autoCapitalize="words" returnKeyType="done" style={{ marginBottom: 10 }} />
      <Txt weight="bold" style={{ marginBottom: 4 }}>
        {t('sexQ')}
      </Txt>
      <ChipRow<Sex> value={sex ?? ('' as Sex)} options={['female', 'male', 'other']} onChange={setSex} label={(v) => t(v === 'female' ? 'sexF' : v === 'male' ? 'sexM' : 'sexO')} />
      <Card>
        <NumberStepper label={`🎂 ${t('ageQ')}`} value={age} step={1} min={10} max={100} unit={t('years')} onChange={setAge} />
        <NumberStepper label={`📏 ${t('heightQ')}`} value={height} step={1} min={100} max={220} unit={`cm (${feetInches(height)})`} onChange={setHeight} />
        <NumberStepper label={`⚖️ ${t('weightQ')}`} value={weight} step={0.5} min={25} max={200} unit="kg" onChange={setWeight} />
      </Card>
      <Txt weight="bold" style={{ marginTop: 6, marginBottom: 4 }}>
        {t('dtype')}
      </Txt>
      <ChipRow<DiabetesType> value={type} options={['type2', 'type1', 'gdm', 'pre', 'care']} onChange={setType} label={t} />
      <Btn
        label={t('next')}
        disabled={!ready}
        style={{ opacity: ready ? 1 : 0.5, marginTop: 8 }}
        onPress={() => {
          update({ name: name.trim(), sex: sex!, birthYear: THIS_YEAR - age, age: ageGroupFor(age), heightCm: height, weightKg: weight, type, sugarEvery: defaultSugarEvery(type) });
          router.push('/onboarding/sugar');
        }}
      />
    </Screen>
  );
}
