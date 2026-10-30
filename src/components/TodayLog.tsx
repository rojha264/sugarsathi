import { Alert, Pressable, View } from 'react-native';

import { cloudDelete } from '@/cloud/sync';
import { FOOD_BY_ID } from '@/data/foods';
import type { TextKey } from '@/i18n/strings';
import { dateFormat } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { sugarStatus } from '@/logic/sugar';
import { useApp, useDiabetesType, useProfile } from '@/store/useApp';
import type { MealSlot } from '@/types';
import { Card, H3, SUGAR_TONE, styles as ui, Txt } from './ui';

const SLOT_KEY: Record<MealSlot, TextKey> = { breakfast: 'bf', lunch: 'ln', dinner: 'dn', snack: 'sn' };
const TONE_COLOR = { green: 'leaf', amber: 'haldi', red: 'chilli', info: 'mute' } as const;

/** Today's meals or sugar readings, each with a 🗑️ to remove a mistake (asks first). */
export function TodayLog({ kind }: { kind: 'meals' | 'sugar' }) {
  const { t, lang } = useT();
  const p = useProfile();
  const diabetesType = useDiabetesType();
  const removeMeal = useApp((s) => s.removeMeal);
  const removeSugar = useApp((s) => s.removeSugar);
  const time = dateFormat(lang, { hour: 'numeric', minute: '2-digit' });
  const rows = kind === 'meals' ? p.meals : p.sugar;
  if (!rows.length) return null;

  const confirm = (id: string, what: string) =>
    Alert.alert(t('logRemoveQ'), what, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: () => {
          // Queue the server delete before the row leaves the phone.
          cloudDelete(kind === 'meals' ? 'meals' : 'readings', id);
          if (kind === 'meals') removeMeal(id);
          else removeSugar(id);
        },
      },
    ]);

  return (
    <Card>
      <H3>{kind === 'meals' ? `🍽️ ${t('logMealsT')}` : `🩸 ${t('logSugarT')}`}</H3>
      {kind === 'meals'
        ? p.meals.map((m) => {
            const what = `${t(SLOT_KEY[m.slot])} · ${m.items.map((i) => `${FOOD_BY_ID[i.id]?.e ?? ''} ${FOOD_BY_ID[i.id]?.n[lang] ?? i.id}${i.q !== 1 ? ` ×${i.q}` : ''}`).join(', ')}`;
            return (
              <View key={m.id} style={[ui.row, { paddingVertical: 6 }]}>
                <Txt size={15} color="mute" style={{ width: 70 }}>
                  {time.format(new Date(m.createdAt))}
                </Txt>
                <Txt size={16} style={{ flex: 1 }}>
                  {what}
                </Txt>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('remove')}: ${what}`} onPress={() => confirm(m.id, what)} hitSlop={10} style={{ padding: 6 }}>
                  <Txt size={20}>🗑️</Txt>
                </Pressable>
              </View>
            );
          })
        : p.sugar.map((r) => {
            const st = sugarStatus(r.v, r.ctx, { type: diabetesType });
            const what = `${r.v} mg/dL · ${t(r.ctx)}`;
            return (
              <View key={r.id} style={[ui.row, { paddingVertical: 6 }]}>
                <Txt size={15} color="mute" style={{ width: 70 }}>
                  {time.format(new Date(r.createdAt))}
                </Txt>
                <Txt size={17} weight="bold" color={TONE_COLOR[SUGAR_TONE[st.l]]} style={{ flex: 1 }}>
                  {what}
                </Txt>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('remove')}: ${what}`} onPress={() => confirm(r.id, what)} hitSlop={10} style={{ padding: 6 }}>
                  <Txt size={20}>🗑️</Txt>
                </Pressable>
              </View>
            );
          })}
      <Txt size={13} color="mute" style={{ marginTop: 4 }}>
        {t('logRemoveHint')}
      </Txt>
    </Card>
  );
}
