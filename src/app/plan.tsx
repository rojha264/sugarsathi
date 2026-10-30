import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { track } from '@/cloud/analytics';
import { fetchProgram } from '@/cloud/program';
import { useCloud, type PlanFood } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, H3, Legal, styles as ui, Txt } from '@/components/ui';
import { allowed, FOOD_BY_ID } from '@/data/foods';
import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { dayDate } from '@/logic/ids';
import { itemsFor, planDayToday, swapsFor } from '@/logic/program';
import { say } from '@/native/tts';
import { useApp, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import type { Diet, MealSlot } from '@/types';

const ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const SLOT_KEY: Record<MealSlot, TextKey> = { breakfast: 'bf', lunch: 'ln', dinner: 'dn', snack: 'sn' };
const ICON: Record<MealSlot, string> = { breakfast: '🌅', lunch: '☀️', snack: '🍎', dinner: '🌙' };

/** Today's diet plan from the dietitian, meal by meal; one tap logs a planned meal as eaten. */
export default function PlanScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const today = useApp((s) => s.day);
  const addMeal = useApp((s) => s.addMeal);
  const plan = useCloud((s) => s.plans.diet);
  // The free 14-day trial ended without a paid plan: offer results and the way to continue.
  const trialOver = useCloud((s) => s.program?.status === 'completed' || s.program?.status === 'dropped');
  const weekday = dayDate(today).getDay();
  // 14-day programme plans go by day number; other plans by weekday.
  const pday = plan ? planDayToday(plan, today) : null;
  const items = plan ? itemsFor(plan.items, pday, weekday) : [];
  const detail = useCloud((s) => s.programDetail);
  const swaps = useCloud((s) => s.planSwaps);
  const [swapFor, setSwapFor] = useState<PlanFood | null>(null);
  useEffect(() => {
    if (pday !== null) fetchProgram();
  }, [pday]);
  const dayInfo = pday !== null ? detail?.days?.find((d) => d.day === Math.min(Math.max(pday, 1), 14)) : undefined;
  const canLog = pday === null || (pday >= 1 && pday <= 14);
  /** The food shown for a plan item today: the patient's swap, if they made one. */
  const foodOf = (i: PlanFood) => swaps[`${today}:${i.id}`] ?? i.foodId;
  const diet = useApp((s) => s.setup.diet);
  const fits = (i: PlanFood) => allowed(FOOD_BY_ID[foodOf(i)], diet);
  const bySlot = ORDER.map((slot) => ({ slot, items: items.filter((i) => i.slot === slot && FOOD_BY_ID[foodOf(i)]) })).filter((s) => s.items.length);
  const target = (slot: MealSlot) => (slot === 'breakfast' ? plan?.carbsBreakfast : slot === 'lunch' ? plan?.carbsLunch : slot === 'dinner' ? plan?.carbsDinner : null);
  const name = (i: PlanFood) => `${FOOD_BY_ID[foodOf(i)].e} ${FOOD_BY_ID[foodOf(i)].n[lang]}${i.qty !== 1 ? ` ×${i.qty}` : ''}`;
  const logged = (slot: MealSlot) => p.meals.some((m) => m.slot === slot);

  const ate = (slot: MealSlot, list: PlanFood[]) => {
    addMeal(slot, Object.fromEntries(list.filter(fits).map((i) => [foodOf(i), i.qty])));
    if (plan) track('plan_ate', { planId: plan.id, slot, items: list.filter(fits).length, swaps: list.filter((i) => foodOf(i) !== i.foodId).length, ...(pday !== null ? { day: pday } : {}) });
    const msg = t('ateDone', { slot: t(SLOT_KEY[slot]) });
    toast(msg);
    say(msg, lang);
  };
  // Hindi readers see the dietitian's Hindi text when there is one.
  const notes = (lang === 'hi' && plan?.notesHi) || plan?.notes;
  const readAll = () =>
    say(bySlot.map((s) => `${t(SLOT_KEY[s.slot])}: ${s.items.map((i) => FOOD_BY_ID[foodOf(i)].n[lang]).join(', ')}`).join('. '), lang);

  if (!plan) {
    return (
      <Screen title={t('planT')} back>
        {trialOver ? (
          <Card style={{ borderColor: c.leaf, borderWidth: 2 }}>
            <Txt size={36} center>🌱</Txt>
            <H3>{t('trialOverT')}</H3>
            <Txt size={16} color="mute">
              {t('trialOverB')}
            </Txt>
            <Btn label={`📊 ${t('kickSeeResults')}`} onPress={() => router.push('/results')} style={{ marginTop: 10 }} />
            <Btn kind="alt" label={`💬 ${t('chatT')}`} onPress={() => router.push('/chat')} style={{ marginTop: 8 }} />
          </Card>
        ) : null}
        <Card>
          <Txt size={40} center>🥗</Txt>
          <H3>{t('planNoneT')}</H3>
          <Txt size={16} color="mute">
            {t('planNoneB')}
          </Txt>
        </Card>
        <Legal />
      </Screen>
    );
  }

  return (
    <Screen title={t('planT')} back>
      {pday !== null ? (
        pday <= 0 ? (
          <Banner tone="amber">
            <Txt weight="bold">🚀 {t('kickTomorrow')}</Txt>
          </Banner>
        ) : pday > 14 ? (
          <Card style={{ borderColor: c.leaf, borderWidth: 2 }}>
            <Txt size={18} weight="bold">🎉 {t('kickDone')}</Txt>
            <Btn label={`📊 ${t('kickSeeResults')}`} onPress={() => router.push('/results')} style={{ marginTop: 8 }} />
          </Card>
        ) : (
          <Card style={{ borderColor: c.leaf, borderWidth: 2 }}>
            <Txt size={14} weight="bold" color="leaf">
              {t('kickDayOf', { n: pday })}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 3, marginVertical: 6 }}>
              {Array.from({ length: 14 }, (_, k) => (
                <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k < pday ? c.leaf : c.line }} />
              ))}
            </View>
            {dayInfo ? (
              <>
                <Txt size={20} weight="bold">
                  {lang === 'hi' ? dayInfo.focusHi : dayInfo.focusEn}
                </Txt>
                <Txt size={16} style={{ marginTop: 4 }}>
                  💡 {lang === 'hi' ? dayInfo.tipHi : dayInfo.tipEn}
                </Txt>
                <View style={[ui.row, { marginTop: 8, flexWrap: 'wrap' }]}>
                  <Chip label={`🔊 ${t('listenTip')}`} onPress={() => say(lang === 'hi' ? dayInfo.tipHi : dayInfo.tipEn, lang)} />
                  {dayInfo.sugarCheck !== 'none' ? (
                    <Chip label={`🩸 ${t(dayInfo.sugarCheck === 'fasting' ? 'kickCheckFasting' : 'kickCheckAfter')}`} onPress={() => router.push('/sugar')} />
                  ) : null}
                  <Chip label={`🏃 ${t('kickExercise')}`} onPress={() => router.push('/exercise')} />
                </View>
              </>
            ) : null}
          </Card>
        )
      ) : null}
      <Card>
        <Txt size={20} weight="bold">
          {(lang === 'hi' && plan.titleHi) || plan.title}
        </Txt>
        {plan.dietitian ? (
          <Txt size={15} color="mute">
            👩‍⚕️ {t('planBy', { n: plan.dietitian.name })}
          </Txt>
        ) : null}
        {notes ? <Txt style={{ marginTop: 8 }}>{notes}</Txt> : null}
        <View style={[ui.row, { marginTop: 10, flexWrap: 'wrap' }]}>
          <Chip label={t('listenToday')} onPress={readAll} />
          {plan.protein ? <Chip label={`💪 ${plan.protein} g`} onPress={() => {}} /> : null}
          {plan.fiber ? <Chip label={`🥗 ${plan.fiber} g`} onPress={() => {}} /> : null}
        </View>
      </Card>
      {bySlot.map(({ slot, items: list }) => {
        const carbs = Math.round(list.reduce((a, i) => a + FOOD_BY_ID[foodOf(i)].c * i.qty, 0));
        const done = logged(slot);
        return (
          <Card key={slot} style={done ? { borderColor: c.leaf, borderWidth: 2 } : undefined}>
            <View style={ui.row}>
              <Txt size={22} weight="bold" style={{ flex: 1 }}>
                {ICON[slot]} {t(SLOT_KEY[slot])}
              </Txt>
              <Txt size={15} color="mute">
                ~{carbs}{target(slot) ? ` / ${target(slot)}` : ''} g {t('carbs')}
              </Txt>
            </View>
            {list.map((i) => (
              <View key={i.id} style={styles.item}>
                <View style={ui.row}>
                  <Txt size={18} weight="semibold" style={{ flex: 1 }}>
                    {name(i)}
                  </Txt>
                  {canLog && !done ? <Chip label={`🔄 ${t('swap')}`} onPress={() => setSwapFor(i)} /> : null}
                </View>
                {i.note ? (
                  <Txt size={15} color="mute">
                    {i.note}
                  </Txt>
                ) : null}
                {!fits(i) ? (
                  <Txt size={15} weight="semibold" color="chilli">
                    ⚠️ {t('planNotDiet')}
                  </Txt>
                ) : null}
              </View>
            ))}
            {done ? (
              <Banner tone="green" style={{ marginTop: 8, marginBottom: 0 }}>
                <Txt weight="bold">✓ {t('ateLogged')}</Txt>
              </Banner>
            ) : canLog ? (
              <Btn label={`✓ ${t('ateThis')}`} onPress={() => ate(slot, list)} style={{ marginTop: 8 }} />
            ) : null}
          </Card>
        );
      })}
      <SwapSheet
        item={swapFor}
        foodId={swapFor ? foodOf(swapFor) : ''}
        diet={diet}
        onClose={() => setSwapFor(null)}
        onPick={(foodId) => {
          if (!swapFor) return;
          useCloud.setState((st) => ({ planSwaps: { ...st.planSwaps, [`${today}:${swapFor.id}`]: foodId } }));
          setSwapFor(null);
        }}
      />
      <Legal />
    </Screen>
  );
}

/** Same food group, similar carbs, food the person eats: swap without breaking the plan. */
function SwapSheet({ item, foodId, diet, onClose, onPick }: { item: PlanFood | null; foodId: string; diet: Diet; onClose(): void; onPick(foodId: string): void }) {
  const { t, lang } = useT();
  const c = useColors();
  const food = FOOD_BY_ID[foodId];
  const options = item && food ? swapsFor(food, item.qty, diet) : [];
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View style={{ backgroundColor: c.bg, padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <Txt size={18} weight="bold">
          🔄 {t('swapT', { n: food ? food.n[lang] : '' })}
        </Txt>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          {t('swapSub')}
        </Txt>
        {options.length ? (
          options.map((f) => (
            <Pressable key={f.id} accessibilityRole="button" onPress={() => onPick(f.id)} style={[ui.row, { paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line }]}>
              <Txt size={18} style={{ flex: 1 }}>
                {f.e} {f.n[lang]}
              </Txt>
              <Txt size={14} color="mute">
                ~{Math.round(f.c * (item?.qty ?? 1))} g {t('carbs')}
              </Txt>
            </Pressable>
          ))
        ) : (
          <Txt color="mute">{t('swapNone')}</Txt>
        )}
        {item && foodId !== item.foodId ? <Btn kind="alt" small label={t('swapBack')} onPress={() => onPick(item.foodId)} style={{ marginTop: 10 }} /> : null}
        <Btn kind="alt" small label={t('close')} onPress={onClose} style={{ marginTop: 10 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 6 },
});
