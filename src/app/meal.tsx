import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { kindsFor } from '@shared/diet';
import { searchRank } from '@shared/search';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useCloud, type FoodPick } from '@/cloud/store';
import { CoachCard } from '@/components/CoachCard';
import { FoodGrid, fmtQty } from '@/components/FoodGrid';
import { GuideBar, PlateCheck } from '@/components/PlateCheck';
import { PortionSheet } from '@/components/PortionSheet';
import { Screen } from '@/components/Screen';
import { Suggestions } from '@/components/Suggestions';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, ChipRow, Field, Legal, Stat, styles as ui, SUGAR_TONE, Txt } from '@/components/ui';
import { DIET_MARK, VegMark } from '@/components/VegMark';
import { DayChips } from '@/components/DayChips';
import { DietSheet } from '@/components/DietPicker';
import { ThaliPicker } from '@/components/ThaliPicker';
import { TodayLog } from '@/components/TodayLog';
import { allowed, FOOD_BY_ID, FOODS, matchesDiet, suggestDiet, type DietFilter, type Food, type FoodGroup } from '@/data/foods';
import { THALIS } from '@/data/thalis';
import { dateFormat, type TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { chaknaFor, hasAlcohol, hasHypoMeds, type DrinkContext } from '@/logic/alcohol';
import { applyTip, coach, recentSugar, type TipAction, type Vars } from '@/logic/coach';
import { addDays } from '@/logic/ids';
import { addToBasket, basketOf, defaultSlot, loggedMeal, MAX_QTY, removeFromBasket, totals, type Basket } from '@/logic/meal';
import { suggestFor } from '@/logic/usual';
import { plateCheck } from '@/logic/plate';
import { careFlags } from '@/logic/care';
import { sugarStatus } from '@/logic/sugar';
import { dayTotals, isLowered, lastChangeFor, mealGuide } from '@/logic/targets';
import { useTargetsText } from '@/i18n/targetsText';
import { parseFoods } from '@/logic/voice';
import { scheduleSugarCheck, scheduleWalkNudge } from '@/native/reminders';
import { say } from '@/native/tts';
import { useVoiceLog } from '@/native/voice';
import { useApp, useDiabetesType, useDiet, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import type { MealSlot } from '@/types';

const ATE_RECENTLY_MS = 2 * 3600 * 1000;

const NO_PICKS: FoodPick[] = [];

type Tab = 'mine' | 'starter' | 'grain' | 'dalsabzi' | 'protein' | 'snack' | 'more' | 'treat' | 'drinks';
const TABS: { id: Tab; label: TextKey; groups: FoodGroup[] }[] = [
  // Filled from the user's own history, not a food group.
  { id: 'mine', label: 'gMine', groups: [] },
  { id: 'starter', label: 'gStarter', groups: ['starter'] },
  { id: 'grain', label: 'gGrain', groups: ['grain'] },
  { id: 'dalsabzi', label: 'gDal', groups: ['dalsabzi'] },
  { id: 'protein', label: 'gProtein', groups: ['protein'] },
  { id: 'snack', label: 'gSnack', groups: ['snack'] },
  { id: 'more', label: 'gSweetDrink', groups: ['sweet', 'drink'] },
  { id: 'treat', label: 'gTreat', groups: ['treat'] },
  { id: 'drinks', label: 'gAlcohol', groups: ['alcohol'] },
];

/** Hindi name, English name and Hinglish keywords: "roti", "रोटी" and "chawal" / "chaval" all find the food. */
const searchFields = (f: Food) => [f.n.en, f.n.hi, ...f.kw];
/** How many suggestions show under the search box while typing. */
const SUGGEST = 6;

const DIET_TITLE = { veg: 'dietVegT', egg: 'dietEggT', nonveg: 'dietNonvegT' } as const;

export default function MealScreen() {
  const { t, lang } = useT();
  const tt2 = useTargetsText();
  const c = useColors();
  const p = useProfile();
  const cur = useApp((s) => s.cur);
  const mode = useApp((s) => s.mode);
  const setup = useApp((s) => s.setup);
  const addMeal = useApp((s) => s.addMeal);
  const setAlcohol = useApp((s) => s.setAlcohol);

  const diabetesType = useDiabetesType();
  const recent = recentSugar(p.sugar);
  const recentStatus = recent ? sugarStatus(recent.v, recent.ctx, { type: diabetesType }) : null;
  const recentHigh = !!recentStatus && recentStatus.l !== 'g';
  const hypoMeds = hasHypoMeds(p.meds.map((m) => m.n));
  const day = dayTotals(p);
  // Only the main user has an age group and diabetes type on file.
  const care = careFlags(cur, setup, p.care);
  const notSafe = care.drinkNotSafe;
  const showDrinks = p.alcohol && !notSafe;

  const [slot, setSlot] = useState<MealSlot>(() => defaultSlot());
  const [items, setItems] = useState<Basket>({});
  const personDiet = useDiet();
  const setCare = useApp((s) => s.setCare);
  const [daysAgo, setDaysAgo] = useState(0);
  const today = useApp((s) => s.day);
  // Breakfast, lunch and dinner are once a day: if this one is already saved, the screen edits it.
  const logged = loggedMeal(daysAgo ? (p.late?.meals ?? []) : p.meals, slot, addDays(today, -daysAgo));
  const [editing, setEditing] = useState<string | null>(null);
  if ((logged?.id ?? null) !== editing) {
    setEditing(logged?.id ?? null);
    // Load the saved meal to edit; moving away from it must not carry its foods into dinner.
    if (logged) setItems(basketOf(logged));
    else if (editing) setItems({});
  }
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [dietOpen, setDietOpen] = useState(false);
  const updateSetup = useApp((s) => s.updateSetup);
  const kinds = kindsFor(personDiet);
  // Suggestions follow what the person eats (or is browsing right now).
  const diet = suggestDiet(dietFilter, personDiet);
  // Egg and non-veg show every matching dish at once, so category tabs are not needed.
  const onlyKind = dietFilter === 'egg' || dietFilter === 'nonveg';
  // The dietitian's "For you" foods belong to the signed-in patient, not to family members tracked on this phone.
  const allPicks = useCloud((s) => s.picks);
  const dietitian = useCloud((s) => s.dietitian);
  const picks = cur === 'me' ? allPicks : NO_PICKS;
  const pickedFor = (sl: MealSlot) => picks.filter((pk) => (!pk.slots.length || pk.slots.includes(sl)) && FOOD_BY_ID[pk.foodId] && allowed(FOOD_BY_ID[pk.foodId], personDiet));
  // Open on "For you" when the dietitian picked foods or there are usual ones; high sugar opens "Eat first" instead.
  const [tab, setTab] = useState<Tab>(() => (recentHigh ? 'starter' : pickedFor(slot).length || suggestFor(p, slot, () => true).length ? 'mine' : 'grain'));
  const [query, setQuery] = useState('');
  const [sizeFor, setSizeFor] = useState<string | null>(null);
  const [walkNudge, setWalkNudge] = useState(false);
  const [checkNudge, setCheckNudge] = useState(true);
  const [warned, setWarned] = useState(false);
  // "Ate recently" is judged from when the screen opened, so renders stay pure.
  const [openedAt] = useState(() => Date.now());

  const name = (id?: string) => (id ? (FOOD_BY_ID[id]?.n[lang] ?? id) : '');
  const tx = (key: TextKey, v: Vars) => t(key, { ...v, food: name(v.food), to: name(v.to) } as Record<string, string | number>);
  const visible = (f: Food) => matchesDiet(f, dietFilter, personDiet) && ((f.group !== 'alcohol' && f.group !== 'mixer') || showDrinks);

  const setQty = (id: string, q: number) =>
    setItems((cur) => {
      const next = { ...cur };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, MAX_QTY);
      return next;
    });
  // Voice adds to what is already on the plate, never replaces it.
  const merge = (found: Basket) => setItems((cur) => addToBasket(cur, found));

  /** Alcohol gets a warning the first time; logging it is still the user's choice. */
  const withDrinkWarning = (ids: string[], then: () => void) => {
    if (warned || !ids.some((id) => FOOD_BY_ID[id]?.group === 'alcohol')) return then();
    const lines = [t('alcWarnB')];
    if (recent) lines.unshift(t('alcWarnSugar', { v: recent.v }));
    if (hypoMeds) lines.push(t('alcWarnMeds'));
    Alert.alert(t('alcWarnT'), lines.join('\n\n'), [
      { text: t('bSkip'), style: 'cancel' },
      {
        text: t('bGuide'),
        onPress: () => {
          setWarned(true);
          setTab('drinks');
          then();
        },
      },
    ]);
  };

  const add = (id: string) => withDrinkWarning([id], () => setQty(id, (items[id] ?? 0) + 1));
  const sub = (id: string) => setQty(id, (items[id] ?? 0) - 1);

  const voice = useVoiceLog(lang, {
    onText: (text) => {
      const found = Object.fromEntries(Object.entries(parseFoods(text)).filter(([id]) => visible(FOOD_BY_ID[id])));
      if (Object.keys(found).length) {
        withDrinkWarning(Object.keys(found), () => merge(found));
        toast(t('heard', { s: text }));
      } else toast(t('notUnderstood'));
    },
    onUnavailable: () => {
      // Never invent food: just say voice is off and let them tap.
      toast(t('micOff'));
    },
  });

  const drinkCtx: DrinkContext = {
    drinksToday: day.std,
    ateRecently: p.meals.some((m) => m.kind !== 'drink' && openedAt - m.createdAt < ATE_RECENTLY_MS),
    senior: care.senior,
    notSafe,
    hypoMeds,
  };

  const tt = totals(items);
  const drinking = hasAlcohol(items);
  const targets = p.targets;
  const guide = mealGuide(targets, slot);
  const mealMax = guide.max;
  const advice = coach({ basket: items, recent, diet, drink: drinkCtx, mealMax, mealMin: slot === 'snack' ? guide.max : guide.min });
  const lastChange = slot === 'snack' ? undefined : lastChangeFor(targets, slot);
  const lowered = slot !== 'snack' && isLowered(targets, slot);
  const slotName = tt2.fieldName(slot);
  const plateResult = drinking ? null : plateCheck(items);
  const headline = tx(advice.headline.key, advice.headline.vars);
  const tipTexts = advice.tips.map((tip) => tx(tip.key, tip.vars));

  // Simple mode reads a high-risk warning aloud once each time it changes.
  const spoken = useRef<string | null>(null);
  const speak = mode === 'simple' && advice.risk === 'high' && Object.keys(items).length ? headline : null;
  useEffect(() => {
    if (speak && speak !== spoken.current) say(speak, lang);
    spoken.current = speak;
  }, [speak, lang]);

  const doAction = (a: TipAction) => {
    if (a.type === 'emergency') return router.push('/emergency');
    if (a.type === 'walk') return setWalkNudge((w) => !w);
    if (a.type === 'check') return setCheckNudge((w) => !w);
    if (a.type === 'info') return;
    setItems((cur) => applyTip(cur, a));
  };

  const labelFor = (a: TipAction): string | null => {
    if (a.type === 'add') return t('bAdd', { food: name(a.food) });
    if (a.type === 'portion') return t('bMake', { n: a.n });
    if (a.type === 'swap') return a.to === 'water' ? t('bWater') : `🔁 ${name(a.to)}`;
    if (a.type === 'walk') return walkNudge ? t('bReminded') : t('bRemind');
    if (a.type === 'check') return checkNudge ? t('bChecked') : t('bCheck');
    if (a.type === 'emergency') return t('openEm');
    return null;
  };

  const ago = (m: number) => (m < 2 ? t('justNow') : m < 60 ? t('minsAgo', { n: m }) : t('hrsAgo', { n: Math.round(m / 60) }));
  const q = query.trim().toLowerCase();
  // Drinks tab is always discoverable; the guide itself stays opt-in.
  const drinksLocked = !q && !onlyKind && tab === 'drinks' && !showDrinks;
  const groups = (TABS.find((x) => x.id === tab) ?? TABS[2]).groups;
  const picked = pickedFor(slot).filter((pk) => visible(FOOD_BY_ID[pk.foodId]));
  const pickedIds = new Set(picked.map((pk) => pk.foodId));
  // Usual foods below the dietitian's picks, without repeating them.
  const mine = suggestFor(p, slot, (id) => !!FOOD_BY_ID[id] && visible(FOOD_BY_ID[id]) && !pickedIds.has(id)).map((id) => FOOD_BY_ID[id]);
  const showPicks = !q && !onlyKind && tab === 'mine' && picked.length > 0;
  const shown = q
    ? searchRank(FOODS.filter(visible), query, searchFields)
    : onlyKind
      ? FOODS.filter((f) => visible(f) && f.group !== 'alcohol' && f.group !== 'mixer')
      : tab === 'mine'
      ? mine
      : FOODS.filter((f) => groups.includes(f.group) && visible(f));
  const last = p.lastMeal[slot];
  const lastIds = last ? Object.keys(last).filter((id) => FOOD_BY_ID[id] && visible(FOOD_BY_ID[id])) : [];
  // Plates that suit this meal come first (idli for breakfast, thali for lunch); the rest stay one tap away.
  const thalis = THALIS.filter((th) =>
    dietFilter === 'all' ? Object.keys(th.items).every((id) => allowed(FOOD_BY_ID[id], personDiet)) : th.diet === dietFilter,
  ).sort((a, b) => Number(!a.slots.includes(slot)) - Number(!b.slots.includes(slot)));
  const plate = Object.keys(items).filter((id) => FOOD_BY_ID[id]);

  const grid = (foods: Food[]) => (
    <FoodGrid foods={foods} items={items} lang={lang} sizeLabel={t('moreSize')} onAdd={add} onSub={sub} onSize={setSizeFor} />
  );

  return (
    <Screen title={t('mealT')} back>
      <DayChips value={daysAgo} onChange={setDaysAgo} />
      <ChipRow<MealSlot> value={slot} options={['breakfast', 'lunch', 'dinner', 'snack']} onChange={setSlot} label={tt2.fieldName} />
      {logged ? (
        <Banner tone="info">
          <Txt size={15}>✅ {t('eAlready', { slot: slotName, time: dateFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(new Date(logged.createdAt)) })}</Txt>
        </Banner>
      ) : null}

      {plate.length ? (
        <Card style={{ borderColor: c.leaf, borderWidth: 2 }}>
          <Txt size={17} weight="bold" style={{ marginBottom: 6 }}>
            🍽️ {t('plate')} · {tt.c} g {t('carbs')}
          </Txt>
          <View style={ui.chips}>
            {plate.map((id) => (
              <Chip key={id} label={`${FOOD_BY_ID[id].e} ${name(id)} ×${fmtQty(items[id])}  ⋯`} onPress={() => setSizeFor(id)} style={{ minHeight: 40 }} />
            ))}
          </View>
        </Card>
      ) : lastIds.length && !logged ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setItems((cur) => addToBasket(cur, Object.fromEntries(lastIds.map((id) => [id, last![id]]))))}
          style={[styles.repeat, { borderColor: c.leaf, backgroundColor: c.leafSoft }]}>
          <Txt size={17} weight="bold">
            ↺ {t('repeatLast', { slot: slotName })}
          </Txt>
          <Txt size={15} color="mute" numberOfLines={2}>
            {lastIds.map((id) => `${FOOD_BY_ID[id].e} ${name(id)} ×${fmtQty(last![id])}`).join(' · ')}
          </Txt>
        </Pressable>
      ) : null}

      <Banner tone={lowered ? 'amber' : 'green'}>
        <Txt size={16} weight="bold">
          {t('mealStrip', { slot: slotName, g: guide.max })}
        </Txt>
        {lowered && lastChange ? (
          <Txt size={14} color="mute">
            {t('lowered', { why: tt2.reason(lastChange) })}
          </Txt>
        ) : null}
        <Txt size={14} color="mute">
          {t('protLeft', { n: Math.max(0, targets.protein - day.p - tt.p) })} · {t('fiberLeft', { n: Math.max(0, targets.fiber - day.fiber - tt.fiber) })}
        </Txt>
      </Banner>

      {recent ? (
        <Banner tone={SUGAR_TONE[recentStatus!.l]}>
          <Txt weight="bold">🩸 {t('sugNow', { v: recent.v, ctx: t(recent.ctx), ago: ago(recent.minsAgo) })}</Txt>
        </Banner>
      ) : (
        <Pressable accessibilityRole="link" onPress={() => router.push('/sugar')} style={{ marginBottom: 10 }}>
          <Txt size={16} weight="semibold" color="sky" center>
            {t('checkFirst')}
          </Txt>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('speak')}
        onPress={() => (voice.live ? voice.stop() : voice.start())}
        style={[styles.mic, { backgroundColor: voice.live ? c.chilli : c.leaf }]}>
        <Txt size={42} style={{ lineHeight: 52 }}>
          🎤
        </Txt>
      </Pressable>
      <Txt size={16} color="mute" center style={{ marginBottom: 8 }}>
        {voice.live ? t('listening') : t('speak')}
      </Txt>

      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={'🔍 ' + t('search')}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{ marginBottom: q ? 0 : 10 }}
      />
      {q ? (
        // Autocomplete: best matches as you type, one tap adds to the plate.
        <Suggestions
          items={shown.slice(0, SUGGEST).map((f) => ({ key: f.id, icon: f.e, title: f.n[lang], sub: `${f.n[lang === 'hi' ? 'en' : 'hi']} · 🌾 ${Math.round(f.c)} g` }))}
          empty={t('noMatch')}
          onPick={(id) => {
            add(id);
            setQuery('');
            toast(`✅ ${FOOD_BY_ID[id].e} ${FOOD_BY_ID[id].n[lang]}`);
          }}
        />
      ) : null}

      {/* Only the kinds of food this person eats; a vegetarian never sees egg or meat dishes. */}
      <Pressable accessibilityRole="button" onPress={() => setDietOpen(true)} style={[ui.row, { marginBottom: 8 }]} hitSlop={6}>
        <VegMark diet={personDiet} size={16} />
        <Txt size={15} weight="semibold" style={{ flex: 1 }}>
          {t('dietShowing', { d: t(DIET_TITLE[personDiet]) })}
        </Txt>
        <Txt size={15} weight="bold" color="leaf">
          {t('dietChange')} ›
        </Txt>
      </Pressable>
      {kinds.length > 1 ? (
        <ChipRow<DietFilter>
          value={dietFilter}
          options={['all', ...kinds]}
          onChange={setDietFilter}
          label={(d) => (d === 'all' ? `🍽️ ${t('dAll')}` : `${DIET_MARK[d]} ${t(d)}`)}
        />
      ) : null}
      <DietSheet
        open={dietOpen}
        value={personDiet}
        onClose={() => setDietOpen(false)}
        onChange={(d) => {
          if (cur === 'me') updateSetup({ diet: d });
          else setCare(cur, { diet: d });
          setDietFilter('all');
          toast(t('dietSaved', { d: t(DIET_TITLE[d]) }));
        }}
      />

      {!q ? (
        <>
          {thalis.length ? (
            <ThaliPicker
              thalis={thalis}
              items={items}
              onToggle={(th, on) => {
                setItems((cur) => (on ? addToBasket(cur, th.items) : removeFromBasket(cur, th.items)));
                toast(t(on ? 'thaliAdded' : 'thaliRemoved', { n: th.n[lang] }));
              }}
            />
          ) : null}
          {/* Categories wrap so every one is visible; hidden when egg / non-veg already lists every dish. */}
          {onlyKind ? null : (
            <View style={ui.chips}>
              {TABS.map((x) => (
                <Chip key={x.id} label={t(x.label)} on={tab === x.id} tone={x.id === 'drinks' ? 'chilli' : 'leaf'} onPress={() => setTab(x.id)} />
              ))}
            </View>
          )}
        </>
      ) : null}

      {drinksLocked ? (
        <Card>
          <Txt weight="bold" style={{ marginBottom: 4 }}>
            {p.name ? t('alcShow', { n: p.name }) : t('alcShowMe')}
          </Txt>
          <Txt size={15} color="mute" style={{ marginBottom: 10 }}>
            {t('alcShowSub')} {t('alcWarnB')}
          </Txt>
          {notSafe ? (
            <Txt weight="semibold">🚫 {t('alcNo')}</Txt>
          ) : (
            <Btn small label={t('alcOn')} onPress={() => setAlcohol(cur, true)} />
          )}
        </Card>
      ) : showPicks ? (
        <>
          <Card style={{ borderColor: c.leaf, borderWidth: 2 }}>
            <Txt size={16} weight="bold">
              👩‍⚕️ {dietitian ? t('pickedBy', { n: dietitian }) : t('pickedByYours')}
            </Txt>
            <Txt size={14} color="mute" style={{ marginBottom: 8 }}>
              {t('pickedSub')}
            </Txt>
            {grid(picked.map((pk) => FOOD_BY_ID[pk.foodId]))}
            {picked
              .filter((pk) => pk.note)
              .map((pk) => (
                <Txt key={pk.foodId} size={14} style={{ marginTop: 4 }}>
                  {FOOD_BY_ID[pk.foodId].e} <Txt size={14} weight="bold">{FOOD_BY_ID[pk.foodId].n[lang]}:</Txt> {pk.note}
                </Txt>
              ))}
          </Card>
          {mine.length ? (
            <>
              <Txt size={16} weight="bold" style={{ marginTop: 4, marginBottom: 6 }}>
                {t('yourUsual')}
              </Txt>
              {grid(mine)}
            </>
          ) : null}
        </>
      ) : shown.length ? grid(shown) : (
        <Txt size={16} color="mute" center style={{ marginVertical: 12 }}>
          {!q && tab === 'mine' ? t('noMine') : t('noMatch')}
        </Txt>
      )}

      {!q && !onlyKind && tab === 'drinks' && showDrinks ? (
        <>
          <Txt weight="bold" style={{ marginBottom: 6 }}>
            🫧 {t('mixWith')}
          </Txt>
          {grid(FOODS.filter((f) => f.group === 'mixer'))}
          <Txt weight="bold" style={{ marginBottom: 6 }}>
            🍢 {t('eatWith')}
          </Txt>
          {grid(chaknaFor(diet).map((id) => FOOD_BY_ID[id]).filter((f) => visible(f)))}
        </>
      ) : null}

      <Card>
        <View style={ui.stats}>
          <Stat value={`${tt.c} g`} label={t('carbs')} />
          <Stat value={`${tt.p} g`} label={t('prot')} />
          <Stat value={`${tt.fiber} g`} label={t('fiber')} />
        </View>
        {mode === 'detailed' ? (
          <View style={ui.stats}>
            <Stat value={tt.kcal} label={t('kcal')} />
            <Stat value={`${tt.fat} g`} label={t('fat')} />
            <Stat value={tt.gl} label={t('gl')} />
          </View>
        ) : null}
        {plate.length && !drinking ? (
          <>
            {tt.c > mealMax ? (
              <Banner tone="red">
                <Txt size={16} weight="bold">
                  ⚠️ {t('overGuide', { c: tt.c, slot: slotName, g: mealMax })}
                </Txt>
              </Banner>
            ) : null}
            <GuideBar
              value={tt.c}
              min={guide.min}
              max={mealMax}
              scaleMax={Math.max(mealMax * 1.6, tt.c)}
              label={t('mealGuide', { c: tt.c, a: guide.min, b: mealMax })}
            />
          </>
        ) : null}
        {plateResult ? <PlateCheck check={plateResult} /> : null}

        <CoachCard
          advice={advice}
          headline={headline}
          tipTexts={tipTexts}
          note={t('coachNote')}
          listenLabel={t('listen')}
          labelFor={labelFor}
          isOn={(a) => (a.type === 'walk' ? walkNudge : a.type === 'check' ? checkNudge : true)}
          onAction={doAction}
          onListen={() => say([headline, ...tipTexts].join('. '), lang)}
          extra={(tip) => (tip.id === 'first' && tab !== 'starter' ? <Chip label={t('bMore')} onPress={() => setTab('starter')} /> : null)}
        />
      </Card>

      <Btn
        label={logged ? t('eUpdate') : t('saveMeal')}
        onPress={() => {
          if (!plate.length) return toast(t('addOne'));
          const result = addMeal(slot, items, daysAgo);
          // Nudges only make sense for a meal eaten just now.
          if (walkNudge && !daysAgo) scheduleWalkNudge(lang);
          if (drinking && checkNudge && !daysAgo) scheduleSugarCheck(lang, 3);
          toast('✅ ' + (result === 'updated' ? t('eAteUpdated', { slot: slotName }) : daysAgo ? t('dayLateSaved') : t('saved')));
          router.back();
        }}
      />
      <Banner tone="info" style={{ marginTop: 10 }}>
        <Txt size={14} color="mute">
          {t('sampleNote')}
        </Txt>
      </Banner>
      <TodayLog kind="meals" />
      <Legal />

      <PortionSheet
        foodId={sizeFor}
        current={sizeFor ? (items[sizeFor] ?? 0) : 0}
        onClose={() => setSizeFor(null)}
        onPick={(mult) => {
          const id = sizeFor!;
          setSizeFor(null);
          withDrinkWarning([id], () => setQty(id, mult));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mic: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 6 },
  repeat: { borderWidth: 2, borderRadius: 18, padding: 12, marginBottom: 12, gap: 2 },
});
