import { router } from 'expo-router';
import { useState } from 'react';

import { cloudEnabled } from '@/cloud/client';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { SugarEveryChips } from '@/components/SugarEveryChips';
import { TimeStepper } from '@/components/TimeStepper';
import { ConsentCard } from '@/components/ConsentCard';
import { Btn, Card, ChipRow, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import { CONSENT_VERSION } from '@/logic/backup';
import type { Goal, Region, Setup } from '@/types';

const REGION_KEY = { north: 'rNorth', south: 'rSouth', east: 'rEast', west: 'rWest', northeast: 'rNortheast' } as const;

export default function SetupScreen() {
  const { t } = useT();
  const initial = useApp((s) => s.setup);
  const finishSetup = useApp((s) => s.finishSetup);
  const [f, setF] = useState<Setup>(initial);
  const [agreed, setAgreed] = useState(false);
  const addVital = useApp((s) => s.addVital);
  const addSugar = useApp((s) => s.addSugar);
  const ready = agreed && !!f.region;
  // Only what changes the app goes up front; the rest has sensible defaults and lives behind "More options".
  const [more, setMore] = useState(false);
  const up = <K extends keyof Setup>(k: K) => (v: Setup[K]) => setF((s) => ({ ...s, [k]: v }));

  const label = (text: string) => (
    <Txt weight="bold" style={{ marginTop: 6, marginBottom: 4 }}>
      {text}
    </Txt>
  );

  return (
    <Screen title={t('app')} back sos={false}>
      <StepHeader at="setup" title={`🍛 ${t('foodStepT')}`} sub={t('setupLast')} />
      {label(t('regionQ'))}
      <Txt size={15} color="mute" style={{ marginBottom: 4 }}>
        {t('regionWhy')}
      </Txt>
      <ChipRow<Region> value={f.region ?? ('' as Region)} options={['north', 'south', 'east', 'west', 'northeast']} onChange={up('region')} label={(r) => t(REGION_KEY[r])} />
      {more ? (
        <>
          {label(t('goal'))}
          <ChipRow<Goal> value={f.goal} options={['g1', 'g2', 'g3']} onChange={up('goal')} label={t} />
          {label(t('rem'))}
          <Card>
            <TimeStepper icon="🚶" label={t('rWalk')} value={f.tw} onChange={up('tw')} />
            <TimeStepper icon="💊" label={t('rMed')} value={f.tm} onChange={up('tm')} />
            <TimeStepper icon="🩸" label={t('rSug')} value={f.ts} onChange={up('ts')} />
          </Card>
          {label(t('sugEveryQ'))}
          <SugarEveryChips value={f.sugarEvery} onChange={up('sugarEvery')} />
        </>
      ) : (
        <Btn kind="alt" small label={`⚙️ ${t('setupMore')}`} onPress={() => setMore(true)} style={{ marginBottom: 4 }} />
      )}
      <ConsentCard agreed={agreed} onToggle={() => setAgreed((x) => !x)} />
      <Btn
        label={cloudEnabled ? `🚀 ${t('startKickstart')}` : t('start')}
        disabled={!ready}
        style={{ opacity: ready ? 1 : 0.5 }}
        onPress={() => {
          finishSetup({ ...f, consentAt: Date.now(), consentVer: CONSENT_VERSION, firstReading: null, firstReadings: null });
          // The baseline entered on the earlier steps becomes the first weight and sugar entries.
          if (f.weightKg) addVital({ kind: 'weight', weightKg: f.weightKg });
          for (const r of f.firstReadings ?? (f.firstReading ? [f.firstReading] : [])) addSugar(r.v, r.ctx);
          router.replace('/');
        }}
      />
    </Screen>
  );
}
