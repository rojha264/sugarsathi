import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allowed, FOOD_BY_ID } from '@/data/foods';
import { dateFormat, type TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { MEAL_CARBS } from '@shared/thali';
import { basketOf, defaultSlot, loggedMeal, MAX_QTY, totals, type Basket } from '@/logic/meal';
import { dosesNow } from '@/logic/meds';
import { sugarStatus } from '@/logic/sugar';
import { fractions } from '@/logic/score';
import { suggestFor } from '@/logic/usual';
import { say } from '@/native/tts';
import { useApp, useDiabetesType, useDiet, useProfile } from '@/store/useApp';
import { useColors, type Colors } from '@/theme/tokens';
import type { MealSlot } from '@/types';
import { CareNudges } from './CareNudges';
import { CoachLinks } from './CoachLinks';
import { fmtQty } from './FoodGrid';
import { KickstartCard } from './KickstartCard';
import { VitalsCard } from './VitalsCard';
import { ReelsCard } from './ReelsCard';
import { tipFor } from '@/data/tips';
import { FamilyMessages } from './FamilyMessages';
import { Screen } from './Screen';
import { toast } from './Toast';
import { Btn, Txt } from './ui';

const SLOT_KEY: Record<MealSlot, TextKey> = { breakfast: 'bf', lunch: 'ln', dinner: 'dn', snack: 'sn' };

/** Common foods to offer when nothing has been logged at this meal time yet. */
const STAPLES: Record<MealSlot, string[]> = {
  breakfast: ['roti', 'poha', 'idli', 'paratha', 'upma', 'curd'],
  lunch: ['roti', 'rice', 'dal', 'sabzi', 'salad', 'curd'],
  dinner: ['roti', 'rice', 'dal', 'sabzi', 'khichdi', 'salad'],
  snack: ['chana', 'sprouts', 'chaas', 'salad', 'curd', 'poha'],
};
const PICKS = 6;

const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const done = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/** `warn` turns the tile red with ⚠️ (e.g. a dangerous sugar reading) instead of a tick. */
function BigButton({ icon, label, status, bg, ok, warn, onPress }: { icon: string; label: string; status: string; bg: keyof Colors; ok: boolean; warn?: boolean; onPress(): void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.big, { backgroundColor: c[bg], borderColor: warn ? c.chilli : ok ? c.leaf : 'transparent', opacity: pressed ? 0.85 : 1 }]}>
      <Txt size={56} style={{ lineHeight: 66 }}>
        {icon}
      </Txt>
      <Txt size={24} weight="heavy" center>
        {label}
      </Txt>
      <Txt size={17} weight={warn ? 'heavy' : 'semibold'} color={warn ? 'chilli' : ok ? 'leaf' : 'mute'} center>
        {warn ? '⚠️ ' : ok ? '✓ ' : ''}
        {status}
      </Txt>
    </Pressable>
  );
}

function Sheet({ open, onClose, children }: { open: boolean; onClose(): void; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.line, paddingBottom: 16 + insets.bottom }]}>{children}</View>
    </Modal>
  );
}

/**
 * Home for people who find the full app too much: four giant buttons, every tap
 * confirmed by voice and a tick. A helper can switch to the full app at any time.
 */
export function EasyHome() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const diabetesType = useDiabetesType();
  const today = useApp((s) => s.day);
  const diet = useDiet();
  const addMeal = useApp((s) => s.addMeal);
  const setMed = useApp((s) => s.setMed);
  const setMode = useApp((s) => s.setMode);
  const [eatOpen, setEatOpen] = useState(false);
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [pick, setPick] = useState<Basket>({});
  const clock = (at: number) => dateFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(new Date(at));

  const f = fractions(p, today);
  const tip = tipFor(today);
  const name = p.name || t('friend');
  const reading = p.sugar.at(-1);
  const lastSugar = reading?.v;
  const sugarLevel = reading ? sugarStatus(reading.v, reading.ctx, { type: diabetesType }) : null;

  // Lunch is logged once a day: opening the sheet again edits it instead of adding a second lunch.
  const logged = loggedMeal(p.meals, slot, today);
  const openEat = () => {
    const s = defaultSlot();
    const prev = loggedMeal(p.meals, s, today);
    setSlot(s);
    setPick(prev ? basketOf(prev) : {});
    setEatOpen(true);
    say(prev ? t('eAlready', { slot: t(SLOT_KEY[s]), time: clock(prev.createdAt) }) : t('eAteQ', { slot: t(SLOT_KEY[s]) }), lang);
  };
  const keep = (id: string) => !!FOOD_BY_ID[id] && FOOD_BY_ID[id].group !== 'alcohol' && allowed(FOOD_BY_ID[id], diet);
  const usual = suggestFor(p, slot, keep, PICKS);
  const options = [...usual, ...STAPLES[slot].filter((id) => keep(id) && !usual.includes(id))].slice(0, PICKS);
  const last = p.lastMeal[slot];
  const lastNames = last ? Object.keys(last).filter((id) => FOOD_BY_ID[id]).map((id) => FOOD_BY_ID[id].n[lang]) : [];

  /** Sets a food's portions in the quick sheet; 0 removes it. */
  const setQty = (id: string, q: number) =>
    setPick(({ [id]: _old, ...rest }) => (q > 0 ? { ...rest, [id]: Math.min(q, MAX_QTY) } : rest));
  const sum = totals(pick);
  const heavy = sum.c <= MEAL_CARBS.good ? 'good' : sum.c <= MEAL_CARBS.heavy ? 'high' : 'heavy';

  const saveMeal = (basket: Basket) => {
    if (!Object.keys(basket).length) return;
    const result = addMeal(slot, basket);
    setEatOpen(false);
    done();
    const msg = t(result === 'updated' ? 'eAteUpdated' : 'eAteDone', { slot: t(SLOT_KEY[slot]) });
    toast(msg);
    say(msg, lang);
  };

  const takeMeds = () => {
    const due = dosesNow(p.meds, hhmm());
    if (!due.length) {
      const msg = f.total && f.taken === f.total ? t('eMedAll') : t('eMedNone');
      say(msg, lang);
      toast(msg);
      return;
    }
    due.forEach((i) => setMed(i, 'taken'));
    done();
    const msg = t('eMedDone', { list: due.map((i) => p.meds[i].n).join(', ') });
    toast(msg);
    say(msg, lang);
  };

  return (
    <Screen title={`${t('hi')}, ${name}`} settings>
      <FamilyMessages />
      <CareNudges />
      <KickstartCard />
      <CoachLinks big />
      <VitalsCard />
      <View style={styles.grid}>
        <BigButton icon="🍽️" label={t('eAte')} status={t('mealsOf', { n: f.meals })} bg="haldiSoft" ok={f.meals >= 3} onPress={openEat} />
        <BigButton icon="💊" label={t('eMed')} status={t('medsOf', { a: f.taken, b: f.total })} bg="leafSoft" ok={f.med >= 1} onPress={takeMeds} />
        <BigButton icon="🚶" label={t('eWalk')} status={t('minDone', { n: p.walkMin })} bg="skySoft" ok={f.walk >= 1} onPress={() => router.push('/walk')} />
        <BigButton
          icon="🩸"
          label={t('eSugar')}
          status={lastSugar ? `${lastSugar} · ${t(sugarLevel!.k)}` : f.sugDue ? t('sugDue') : t('sugOff')}
          bg="plumSoft"
          ok={sugarLevel?.l === 'g'}
          warn={sugarLevel?.l === 'r'}
          onPress={() => router.push('/sugar')}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/feel')}
        style={({ pressed }) => [styles.feel, { borderColor: c.chilli, backgroundColor: c.chilliSoft, opacity: pressed ? 0.85 : 1 }]}>
        <Txt size={22} weight="bold">
          {t('feelQ')}
        </Txt>
        <Txt size={24}>›</Txt>
      </Pressable>

      {/* One tip a day, read aloud on tap: simple mode gets learning too. */}
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('tipT')}. ${tip[lang]}`} onPress={() => say(tip[lang], lang)} style={[styles.tip, { backgroundColor: c.card, borderColor: c.line }]}>
        <Txt size={17} weight="bold">
          💡 {t('tipT')} 🔊
        </Txt>
        <Txt size={18} weight="semibold">
          {tip.e} {tip[lang]}
        </Txt>
      </Pressable>
      <ReelsCard />

      <Btn
        kind="alt"
        label={t('listenToday')}
        onPress={() => say(t('easySay', { name, meals: f.meals, a: f.taken, b: f.total, walk: p.walkMin }), lang)}
        style={{ marginBottom: 16 }}
      />
      <Pressable accessibilityRole="button" onPress={() => setMode('simple')} style={styles.helper} hitSlop={8}>
        <Txt size={15} color="mute" center>
          {t('eHelper')}
        </Txt>
      </Pressable>

      <Sheet open={eatOpen} onClose={() => setEatOpen(false)}>
        <Txt size={22} weight="bold" center style={{ marginBottom: 10 }}>
          {t('eAteQ', { slot: t(SLOT_KEY[slot]) })}
        </Txt>
        {logged ? (
          <Txt size={16} color="mute" center style={{ marginBottom: 10 }}>
            ✅ {t('eAlready', { slot: t(SLOT_KEY[slot]), time: clock(logged.createdAt) })}
          </Txt>
        ) : lastNames.length ? (
          <Btn label={`🔁 ${t('eSame')}: ${lastNames.join(', ')}`} onPress={() => saveMeal(last!)} style={{ marginBottom: 10 }} />
        ) : null}
        <View style={styles.foods}>
          {options.map((id) => {
            const food = FOOD_BY_ID[id];
            const q = pick[id] ?? 0;
            const on = q > 0;
            return (
              <View key={id} style={[styles.food, { backgroundColor: on ? c.leafSoft : c.card, borderColor: on ? c.leaf : c.line }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${food.n[lang]}${on ? `, ${fmtQty(q)}` : ''}`}
                  onPress={() => setQty(id, on ? q + 1 : 1)}
                  style={{ alignItems: 'center', width: '100%' }}>
                  <Txt size={34} style={{ lineHeight: 42 }}>
                    {food.e}
                  </Txt>
                  <Txt size={16} weight="bold" center numberOfLines={2}>
                    {food.n[lang]}
                  </Txt>
                </Pressable>
                {on ? (
                  // Big − / + so older users can set "2 roti" without typing.
                  <View style={styles.stepper}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${t('less')} ${food.n[lang]}`} hitSlop={6} onPress={() => setQty(id, q - 1)} style={[styles.step, { backgroundColor: c.card, borderColor: c.leaf }]}>
                      <Txt size={20} weight="bold" color="leaf">−</Txt>
                    </Pressable>
                    <Txt size={18} weight="bold">{fmtQty(q)}</Txt>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${t('more')} ${food.n[lang]}`} hitSlop={6} onPress={() => setQty(id, q + 1)} style={[styles.step, { backgroundColor: c.leaf, borderColor: c.leaf }]}>
                      <Txt size={20} weight="bold" style={{ color: c.onLeaf }}>+</Txt>
                    </Pressable>
                  </View>
                ) : (
                  <Txt size={13} color="mute">{t('tapToAdd')}</Txt>
                )}
              </View>
            );
          })}
        </View>
        {Object.keys(pick).length ? (
          <View style={[styles.totals, { backgroundColor: heavy === 'heavy' ? c.chilliSoft : heavy === 'high' ? c.haldiSoft : c.leafSoft }]}>
            <Txt size={16} weight="bold">
              🌾 {sum.c} g {t('carbs')} · 💪 {sum.p} g {t('prot')} · 🔥 {sum.kcal} kcal
            </Txt>
            {heavy !== 'good' ? (
              <Txt size={14} color={heavy === 'heavy' ? 'chilli' : 'ink'}>
                {t(heavy === 'heavy' ? 'mealHeavy' : 'mealHigh')}
              </Txt>
            ) : null}
          </View>
        ) : null}
        <Btn label={`✓ ${t(logged ? 'eUpdate' : 'eSave')}`} disabled={!Object.keys(pick).length} onPress={() => saveMeal(pick)} style={{ marginBottom: 8, opacity: Object.keys(pick).length ? 1 : 0.5 }} />
        <Btn
          kind="alt"
          small
          label={t('eOther')}
          onPress={() => {
            setEatOpen(false);
            router.push('/meal');
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tip: { borderWidth: 1.5, borderRadius: 18, padding: 14, gap: 6, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  big: { width: '47.5%', minHeight: 190, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 4 },
  feel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderRadius: 20, paddingHorizontal: 18, minHeight: 72, marginBottom: 12 },
  helper: { paddingVertical: 10, marginBottom: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16 },
  foods: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  food: { width: '31%', minHeight: 120, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'space-between', padding: 6, gap: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  totals: { borderRadius: 14, padding: 10, marginBottom: 10, gap: 2 },
});
