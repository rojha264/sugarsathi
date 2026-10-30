import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Btn, Card, ChipRow, Field, H3, Txt } from '@/components/ui';
import { DietPicker } from '@/components/DietPicker';
import type { AgeGroup, CareInfo, DiabetesType } from '@/types';
import { useT } from '@/i18n/useT';
import { cloudEnabled } from '@/cloud/client';
import { FamilyList } from '@/components/FamilyList';
import { careFlags } from '@/logic/care';
import { score, streakOf } from '@/logic/score';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

export default function FamilyScreen() {
  const { t } = useT();
  const c = useColors();
  const profiles = useApp((s) => s.profiles);
  const cur = useApp((s) => s.cur);
  const switchProfile = useApp((s) => s.switchProfile);
  const addMember = useApp((s) => s.addMember);
  const setAlcohol = useApp((s) => s.setAlcohol);
  const setup = useApp((s) => s.setup);
  const today = useApp((s) => s.day);
  const curP = profiles[cur];
  const tg = curP.targets;
  const notSafe = careFlags(cur, setup, curP.care).drinkNotSafe;
  const [name, setName] = useState('');
  const setCare = useApp((s) => s.setCare);
  const [newCare, setNewCare] = useState<CareInfo>({ diet: setup.diet, type: 'type2', age: 'senior' });
  const alcLabel = curP.name ? t('alcShow', { n: curP.name }) : t('alcShowMe');

  return (
    <Screen title={t('famT')} settings>
      {cloudEnabled ? (
        <>
          <H3>👵 {t('careFor')}</H3>
          <FamilyList />
          <H3>📱 {t('onThisPhone')}</H3>
        </>
      ) : null}

      {Object.values(profiles).map((p) => {
        const on = cur === p.id;
        const nm = p.role === 'me' ? p.name || t('me') : p.name;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              switchProfile(p.id);
              toast(t('nowFor', { n: p.name || t('friend') }));
              router.navigate('/');
            }}
            style={[styles.person, { borderColor: on ? c.leaf : c.line, backgroundColor: on ? c.leafSoft : c.card }]}>
            <Txt size={34}>{p.av}</Txt>
            <View style={{ flex: 1 }}>
              <Txt size={20} weight="bold">
                {nm}
              </Txt>
              <Txt size={15} color="mute">
                🔥 {streakOf(p, today)} · {score(p, today)}/100
              </Txt>
            </View>
          </Pressable>
        );
      })}

      <Card>
        {notSafe ? (
          <Txt size={16} color="mute">
            🚫 {t('alcNo')}
          </Txt>
        ) : (
          <View style={styles.toggle}>
            <View style={{ flex: 1 }}>
              <Txt weight="bold">{alcLabel}</Txt>
              <Txt size={14} color="mute">
                {t('alcShowSub')}
              </Txt>
            </View>
            <Switch
              accessibilityLabel={alcLabel}
              value={curP.alcohol}
              onValueChange={(on) => setAlcohol(cur, on)}
              trackColor={{ true: c.leaf, false: c.track }}
            />
          </View>
        )}
      </Card>

      <Card>
        <H3>{curP.name ? t('targetsT', { n: curP.name }) : t('myTargets')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          🍚 {t('bf')} {tg.slot.breakfast} · {t('ln')} {tg.slot.lunch} · {t('dn')} {tg.slot.dinner} g · 💪 {tg.protein} g · 🥗 {tg.fiber} g
        </Txt>
        <Btn small kind="alt" label={t('myTargets')} onPress={() => router.push('/targets')} />
      </Card>

      {cur !== 'me' ? (
        <Card>
          <H3>
            {curP.av} {t('aboutMember', { n: curP.name })}
          </H3>
          <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
            {t('aboutMemberSub')}
          </Txt>
          <CareEditor value={curP.care ?? { diet: setup.diet, type: 'type2', age: 'senior' }} onChange={(c) => setCare(cur, c)} />
        </Card>
      ) : null}

      <Card>
        <H3>{t('addMember')}</H3>
        <Field value={name} onChangeText={setName} placeholder={t('memberName')} autoCapitalize="words" style={{ marginBottom: 8 }} />
        {name.trim() ? <CareEditor value={newCare} onChange={(c) => setNewCare({ ...newCare, ...c })} /> : null}
        <Btn
          small
          label={t('add')}
          onPress={() => {
            if (!name.trim()) return;
            addMember(name, newCare);
            toast(t('memberAdded', { n: name.trim() }));
            setName('');
          }}
          style={{ marginTop: 8 }}
        />
      </Card>

    </Screen>
  );
}

/** A family member's food preference, diabetes type and age group (drives their foods, targets and safety rules). */
function CareEditor({ value, onChange }: { value: CareInfo; onChange(c: Partial<CareInfo>): void }) {
  const { t } = useT();
  return (
    <View style={{ gap: 6 }}>
      <DietPicker compact value={value.diet} onChange={(diet) => onChange({ diet })} />
      <Txt weight="bold" style={{ marginTop: 6 }}>
        {t('dtype')}
      </Txt>
      <ChipRow<DiabetesType> value={value.type} options={['type2', 'type1', 'gdm', 'pre']} onChange={(type) => onChange({ type })} label={t} />
      <Txt weight="bold">{t('age')}</Txt>
      <ChipRow<AgeGroup> value={value.age} options={['child', 'adult', 'senior']} onChange={(age) => onChange({ age })} label={t} />
    </View>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 2, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, minHeight: 68 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
