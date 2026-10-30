import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { searchRank } from '@shared/search';

import { NumberStepper } from '@/components/NumberStepper';
import { Screen } from '@/components/Screen';
import { Suggestions } from '@/components/Suggestions';
import { TimeStepper } from '@/components/TimeStepper';
import { Banner, Btn, Card, ChipRow, Field, H3, styles as ui, Txt } from '@/components/ui';
import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { MED_NAMES, medLabel } from '@/data/medicines';
import { daysLeft, lowMeds, medKey, REFILL_DAYS } from '@/logic/meds';
import { useApp, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import type { DoseUnit, MedKind, MedTime } from '@/types';

/** Tablets in a typical strip or bottle, for the "bought more" shortcuts. */
const BUY = [10, 30];

export default function MedicineScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const setMed = useApp((s) => s.setMed);
  const addMed = useApp((s) => s.addMed);
  const setMedTime = useApp((s) => s.setMedTime);
  const removeMed = useApp((s) => s.removeMed);
  const setStock = useApp((s) => s.setStock);
  const updateMed = useApp((s) => s.updateMed);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MedKind>('tablet');
  const [dose, setDose] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  /** Insulin: ask how many units were taken before marking it. */
  const [units, setUnits] = useState<{ index: number; value: number } | null>(null);

  // Hide the list once a suggestion was picked (the name then equals its label).
  const suggestions = name.trim() && !MED_NAMES.some((m) => medLabel(m, lang) === name) ? searchRank(MED_NAMES, name, (m) => [m.en, m.hi, ...m.brands], 5) : [];
  const add = (time: MedTime) => {
    if (!name.trim()) return;
    addMed(name, time, { kind, dose, unit: UNIT[kind] });
    setName('');
    setDose(DEFAULT_DOSE[kind]);
  };
  const take = (i: number) => {
    const m = p.meds[i];
    if (m.kind === 'insulin' && m.s !== 'taken') return setUnits({ index: i, value: m.dose ?? 10 });
    setMed(i, 'taken');
  };
  const remove = (i: number) =>
    Alert.alert(t('medRemoveQ', { name: p.meds[i].n }), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => removeMed(i) },
    ]);

  const low = lowMeds(p.meds, p.stock);
  // One tablet count per medicine name, in the order first listed.
  const names = [...new Map(p.meds.map((m) => [medKey(m.n), m.n])).entries()];

  return (
    <Screen title={t('medT')} back>
      {low.map((l) => (
        <Banner key={l.name} tone="red">
          <Txt weight="bold">{t('refillWarn', { name: l.name, n: l.left, d: l.days })}</Txt>
        </Banner>
      ))}
      {p.meds.map((m, i) => (
        <Card key={m.id} style={{ gap: 10 }}>
          <View style={ui.row}>
            <Txt size={30}>💊</Txt>
            <View style={{ flex: 1 }}>
              <Txt size={21} weight="bold">
                {m.n}
              </Txt>
              <Txt size={16} color="mute">
                {t(m.t)}
                {m.dose ? ` · ${KIND_ICON[m.kind ?? 'tablet']} ${doseText(m.dose, m.unit, t)}` : ''}
              </Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('remove')} onPress={() => remove(i)} hitSlop={8} style={styles.del}>
              <Txt size={20}>🗑️</Txt>
            </Pressable>
          </View>
          <TimeStepper icon="⏰" label={t('medAt')} value={m.at} onChange={(at) => setMedTime(i, at)} />
          {editing === i ? (
            <View style={{ gap: 6 }}>
              <ChipRow<MedKind> value={m.kind ?? 'tablet'} options={KINDS} onChange={(k) => updateMed(i, { kind: k, unit: UNIT[k], dose: m.dose ?? DEFAULT_DOSE[k] })} label={(k) => `${KIND_ICON[k]} ${t(KIND_KEY[k])}`} />
              <NumberStepper label={t('doseLabel')} value={m.dose ?? DEFAULT_DOSE[m.kind ?? 'tablet']} step={STEP[m.kind ?? 'tablet']} min={STEP[m.kind ?? 'tablet']} max={200} unit={t(UNIT_KEY[UNIT[m.kind ?? 'tablet']])} onChange={(v) => updateMed(i, { dose: v, unit: UNIT[m.kind ?? 'tablet'] })} />
              <Btn small kind="alt" label={`✓ ${t('done')}`} onPress={() => setEditing(null)} />
            </View>
          ) : (
            <Btn small kind="alt" label={`✏️ ${t('doseEdit')}`} onPress={() => setEditing(i)} />
          )}
          <View style={ui.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: m.s === 'taken' }}
              onPress={() => take(i)}
              style={[styles.choice, m.s === 'taken' ? { backgroundColor: c.leaf, borderColor: c.leaf } : { backgroundColor: c.card, borderColor: c.line }]}>
              <Txt weight="bold" style={m.s === 'taken' ? { color: c.onLeaf } : undefined}>
                ✓ {t('taken')}
                {m.s === 'taken' && m.kind === 'insulin' && m.taken ? ` · ${m.taken} ${t('uUnits')}` : ''}
              </Txt>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: m.s === 'skipped' }}
              onPress={() => setMed(i, 'skipped')}
              style={[styles.choice, m.s === 'skipped' ? { backgroundColor: c.track, borderColor: c.mute } : { backgroundColor: c.card, borderColor: c.line }]}>
              <Txt weight="bold">{t('skipped')}</Txt>
            </Pressable>
          </View>
        </Card>
      ))}

      {names.length ? (
        <Card style={{ gap: 6 }}>
          <H3>🧮 {t('stockT')}</H3>
          <Txt size={15} color="mute">
            {t('stockSub', { d: REFILL_DAYS })}
          </Txt>
          {names.map(([key, n]) => {
            const left = p.stock[key];
            const days = daysLeft(p.meds, p.stock, key);
            if (left === undefined)
              return <Btn key={key} small kind="alt" label={t('stockStart', { name: n })} onPress={() => setStock(n, 30)} />;
            return (
              <View key={key} style={[styles.stock, { borderColor: c.line }]}>
                <NumberStepper label={n} value={left} step={1} min={0} max={999} unit={t('tabs')} onChange={(v) => setStock(n, v)} />
                <Txt size={15} color={days !== null && days <= REFILL_DAYS ? 'chilli' : 'mute'}>
                  {t('daysLeft', { d: days ?? 0 })}
                </Txt>
                <View style={ui.row}>
                  {BUY.map((b) => (
                    <Btn key={b} small kind="alt" label={t('bought', { n: b })} onPress={() => setStock(n, left + b)} style={{ flex: 1 }} />
                  ))}
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <H3>{t('addMed')}</H3>
        <Field value={name} onChangeText={setName} placeholder={t('medName')} autoCorrect={false} style={{ marginBottom: suggestions.length ? 0 : 8 }} />
        {/* Autocomplete in Hindi or English, by medicine or brand name (Glycomet, मेटफ़ॉर्मिन…). */}
        <Suggestions
          items={suggestions.map((m) => ({ key: m.en, icon: '💊', title: lang === 'hi' ? m.hi : m.en, sub: `${lang === 'hi' ? m.en : m.hi} · ${m.brands.join(', ')}` }))}
          action="✓"
          onPick={(en) => {
            const m = MED_NAMES.find((x) => x.en === en)!;
            setName(medLabel(m, lang));
            if (/insulin/i.test(m.en)) {
              setKind('insulin');
              setDose(DEFAULT_DOSE.insulin);
            }
          }}
        />
        <ChipRow<MedKind>
          value={kind}
          options={KINDS}
          onChange={(k) => {
            setKind(k);
            setDose(DEFAULT_DOSE[k]);
          }}
          label={(k) => `${KIND_ICON[k]} ${t(KIND_KEY[k])}`}
        />
        <NumberStepper label={t('doseLabel')} value={dose} step={STEP[kind]} min={STEP[kind]} max={200} unit={t(UNIT_KEY[UNIT[kind]])} onChange={setDose} />
        <View style={ui.row}>
          <Btn kind="alt" small label={`+ ${t('morning')}`} onPress={() => add('morning')} style={{ flex: 1 }} />
          <Btn kind="alt" small label={`+ ${t('night')}`} onPress={() => add('night')} style={{ flex: 1 }} />
        </View>
      </Card>
      <Modal visible={!!units} transparent animationType="slide" onRequestClose={() => setUnits(null)}>
        <Pressable style={styles.backdrop} onPress={() => setUnits(null)} />
        <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.line }]}>
          <Txt size={21} weight="bold" center style={{ marginBottom: 6 }}>
            💉 {t('unitsQ')}
          </Txt>
          <Txt size={15} color="mute" center style={{ marginBottom: 10 }}>
            {units ? `${p.meds[units.index]?.n} · ${t('unitsPlanned', { n: p.meds[units.index]?.dose ?? '–' })}` : ''}
          </Txt>
          {units ? <NumberStepper label={t('uUnits')} value={units.value} step={1} min={1} max={100} unit={t('uUnits')} onChange={(v) => setUnits({ ...units, value: v })} /> : null}
          <Btn
            label={`✓ ${t('taken')}`}
            onPress={() => {
              if (units) setMed(units.index, 'taken', units.value);
              setUnits(null);
            }}
            style={{ marginTop: 12 }}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const KINDS: MedKind[] = ['tablet', 'insulin', 'syrup'];
const KIND_ICON: Record<MedKind, string> = { tablet: '💊', insulin: '💉', syrup: '🧴', other: '💊' };
const KIND_KEY: Record<MedKind, TextKey> = { tablet: 'kTablet', insulin: 'kInsulin', syrup: 'kSyrup', other: 'kTablet' };
const UNIT: Record<MedKind, DoseUnit> = { tablet: 'tab', insulin: 'units', syrup: 'ml', other: 'tab' };
const UNIT_KEY: Record<DoseUnit, TextKey> = { tab: 'uTab', units: 'uUnits', ml: 'uMl', mg: 'uMg' };
const STEP: Record<MedKind, number> = { tablet: 0.5, insulin: 1, syrup: 2.5, other: 0.5 };
const DEFAULT_DOSE: Record<MedKind, number> = { tablet: 1, insulin: 10, syrup: 5, other: 1 };
const doseText = (dose: number, unit: DoseUnit | undefined, t: (k: TextKey) => string) => `${dose} ${t(UNIT_KEY[unit ?? 'tab'])}`;

const styles = StyleSheet.create({
  choice: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  del: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stock: { borderTopWidth: 1, paddingTop: 8, gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16, paddingBottom: 32 },
});
