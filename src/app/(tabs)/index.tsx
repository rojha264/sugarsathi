import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Thali, type ThaliTask } from '@/components/charts';
import { cloudEnabled } from '@/cloud/client';
import { CareHome } from '@/components/CareHome';
import { CareNudges } from '@/components/CareNudges';
import { CoachLinks } from '@/components/CoachLinks';
import { KickstartCard } from '@/components/KickstartCard';
import { VitalsCard } from '@/components/VitalsCard';
import { EasyHome } from '@/components/EasyHome';
import { FamilyMessages } from '@/components/FamilyMessages';
import { Screen } from '@/components/Screen';
import { Banner, Btn, Card, Chip, Field, H3, Legal, Stat, styles as ui, Txt } from '@/components/ui';
import { dateFormat } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { dayDate } from '@/logic/ids';
import { sugarStatus } from '@/logic/sugar';
import { nextSugarDay } from '@/logic/sugarPlan';
import { GuideBar } from '@/components/PlateCheck';
import { dayCarbMax as dayMax, dayTotals } from '@/logic/targets';
import { fractions, messageFor, score, streakOf } from '@/logic/score';
import { weekOf } from '@/logic/day';
import { tipFor } from '@/data/tips';
import { ReelsCard } from '@/components/ReelsCard';
import { say } from '@/native/tts';
import { useApp, useDiabetesType, useProfile } from '@/store/useApp';
import { useColors, type Colors } from '@/theme/tokens';

function TaskCard({ bg, icon, title, status, done, warn, onPress }: { bg: keyof Colors; icon: string; title: string; status: string; done: boolean; warn?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status}`}
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={({ pressed }) => [styles.task, { backgroundColor: c[bg], opacity: pressed ? 0.85 : 1 }, warn && { borderWidth: 3, borderColor: c.chilli }]}>
      {done ? (
        <View style={[styles.check, { backgroundColor: c.leaf }]}>
          <Txt size={16} weight="heavy" style={{ color: c.onLeaf, lineHeight: 20 }}>
            ✓
          </Txt>
        </View>
      ) : null}
      <Txt size={34} style={{ lineHeight: 40 }}>
        {icon}
      </Txt>
      <View>
        <Txt size={21} weight="bold" style={{ lineHeight: 24 }}>
          {title}
        </Txt>
        <Txt size={15} color="mute">
          {status}
        </Txt>
      </View>
    </Pressable>
  );
}

function WhyCard() {
  const { t } = useT();
  const why = useApp((s) => s.profiles[s.cur].why);
  const setWhy = useApp((s) => s.setWhy);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Card>
      <H3>❤️ {t('why')}</H3>
      {draft === null ? (
        <View style={ui.row}>
          <Txt size={20} weight="semibold" style={{ flex: 1 }}>
            {why || t('whyDef')}
          </Txt>
          <Chip label={t('edit')} onPress={() => setDraft(why || t('whyDef'))} />
        </View>
      ) : (
        <View style={ui.row}>
          <Field
            autoFocus
            selectTextOnFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => {
              setWhy(draft);
              setDraft(null);
            }}
            style={{ flex: 1 }}
          />
          <Chip
            on
            label={t('save')}
            onPress={() => {
              setWhy(draft);
              setDraft(null);
            }}
          />
        </View>
      )}
    </Card>
  );
}

export default function TodayScreen() {
  const mode = useApp((s) => s.mode);
  const caregiver = useApp((s) => s.setup.type === 'care');
  if (mode === 'easy') return <EasyHome />;
  // Someone who only looks after family sees the people they follow first.
  return caregiver && cloudEnabled ? <CareHome /> : <FullToday />;
}

function FullToday() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const diabetesType = useDiabetesType();
  const cur = useApp((s) => s.cur);
  const mode = useApp((s) => s.mode);
  const switchProfile = useApp((s) => s.switchProfile);
  const today = useApp((s) => s.day);
  const f = fractions(p, today);
  const sc = score(p, today);
  const nextCheck = f.sugDue ? null : nextSugarDay(p.sugarPlan, today);
  const name = p.name || t('friend');
  const reading = p.sugar.at(-1);
  const lastSugar = reading?.v;
  // A dangerous reading must never look "done": it gets a red warning instead of a tick.
  const sugarLevel = reading ? sugarStatus(reading.v, reading.ctx, { type: diabetesType }) : null;
  const tt = dayTotals(p);
  const targets = p.targets;
  const dayCarbMax = dayMax(targets);
  const go = (s: ThaliTask) => router.push(`/${s}`);
  const addWater = useApp((s) => s.addWater);
  const [tipOffset, setTipOffset] = useState(0);
  const tip = tipFor(today, tipOffset);
  const last = p.days.at(-1);
  const graceThisWeek = !!last?.grace && weekOf(last.date) === weekOf(today);
  // Spoken summary for people who prefer listening to reading.
  const left = [
    f.meals < 3 && t('eat'),
    f.walk < 1 && t('walk'),
    f.med < 1 && t('med'),
    f.sugDue && !p.sugar.length && t('sug'),
  ].filter(Boolean) as string[];
  const summary = t('todaySay', { name, sc, left: left.length ? t('todayLeft', { list: left.join(', ') }) : t('todayDone') });

  return (
    <Screen title={`${t('hi')}, ${name}`} settings>
      <FamilyMessages />
      {cur !== 'me' ? (
        <Banner tone="info" style={[ui.row, { flexWrap: 'wrap' }]}>
          <Txt size={16} weight="semibold" style={{ flex: 1 }}>
            {t('logFor', { n: name })}
          </Txt>
          <Chip label={t('switchBack')} onPress={() => switchProfile('me')} style={{ minHeight: 40 }} />
        </Banner>
      ) : null}

      <View style={{ alignItems: 'center', paddingTop: 6 }}>
        <Thali fracs={[f.eat, f.walk, f.med, f.sug]} score={sc} label={t('score')} onPress={go} />
        <View style={[styles.flame, { backgroundColor: c.haldiSoft }]}>
          <Txt weight="bold">🔥 {t('streak', { n: streakOf(p, today) })}</Txt>
        </View>
        <Txt size={16} color="mute" center style={{ marginBottom: 8 }}>
          {t(messageFor(sc))}
        </Txt>
        <Chip label={t('listenToday')} onPress={() => say(summary, lang)} style={{ marginBottom: 10 }} />
      </View>

      {graceThisWeek ? (
        <Banner tone="green">
          <Txt size={16} weight="semibold">
            {t('graceUsed')}
          </Txt>
        </Banner>
      ) : null}

      <CareNudges />
      <KickstartCard />
      <CoachLinks />
      <VitalsCard />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/feel')}
        style={({ pressed }) => [styles.feel, { borderColor: c.chilli, backgroundColor: c.chilliSoft, opacity: pressed ? 0.85 : 1 }]}>
        <Txt size={19} weight="bold">
          {t('feelQ')}
        </Txt>
        <Txt size={22}>›</Txt>
      </Pressable>

      <View style={styles.grid}>
        <TaskCard bg="haldiSoft" icon="🍽️" title={t('eat')} status={t('mealsOf', { n: f.meals })} done={f.meals >= 3} onPress={() => go('meal')} />
        <TaskCard bg="skySoft" icon="🚶" title={t('walk')} status={t('minDone', { n: p.walkMin })} done={f.walk >= 1} onPress={() => go('walk')} />
        <TaskCard bg="leafSoft" icon="💊" title={t('med')} status={t('medsOf', { a: f.taken, b: f.total })} done={f.med >= 1} onPress={() => go('medicine')} />
        <TaskCard bg="plumSoft" icon="🩸" title={t('sug')} status={lastSugar ? `${sugarLevel?.l === 'r' ? '⚠️ ' : ''}${t('lastSug', { v: lastSugar })}${sugarLevel?.l === 'r' ? ` · ${t(sugarLevel.k)}` : ''}` : f.sugDue ? t('sugDue') : nextCheck ? t('sugNext', { d: dateFormat(lang, { weekday: 'short', day: 'numeric' }).format(dayDate(nextCheck)) }) : t('sugOff')} done={!!lastSugar && sugarLevel?.l !== 'r'} warn={sugarLevel?.l === 'r'} onPress={() => go('sugar')} />
      </View>

      {mode === 'detailed' ? (
        <View style={ui.stats}>
          <Stat value={`${tt.c} g`} label={t('carbs')} />
          <Stat value={`${tt.p} g`} label={t('prot')} />
          <Stat value={p.steps} label={t('stepsShort')} />
        </View>
      ) : null}

      {p.meals.length ? (
        <Card>
          <Txt size={19} weight="bold" style={{ marginBottom: 8 }}>
            🍽️ {t('todayFood')}
          </Txt>
          <GuideBar value={tt.c} min={0} max={dayCarbMax} scaleMax={dayCarbMax * 1.3} label={`🍚 ${t('carbs')} · ${t('ofTarget', { v: tt.c, t: dayCarbMax })}`} />
          <GuideBar value={tt.p} min={targets.protein} max={targets.protein * 3} scaleMax={targets.protein * 1.5} label={`💪 ${t('prot')} · ${t('ofTarget', { v: tt.p, t: targets.protein })}`} />
          <GuideBar value={tt.fiber} min={targets.fiber} max={targets.fiber * 3} scaleMax={targets.fiber * 1.5} label={`🥗 ${t('fiber')} · ${t('ofTarget', { v: tt.fiber, t: targets.fiber })}`} />
          {mode === 'detailed' ? (
            <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
              {tt.kcal} {t('kcal')} · {t('fat')} {tt.fat} g
            </Txt>
          ) : null}
          <Btn small kind="alt" label={t('myTargets')} onPress={() => router.push('/targets')} />
        </Card>
      ) : (
        <Btn small kind="alt" label={t('myTargets')} onPress={() => router.push('/targets')} style={{ marginBottom: 12 }} />
      )}

      <Card>
        <View style={ui.row}>
          <Txt size={19} weight="bold" style={{ flex: 1 }}>
            💧 {t('waterT')} · {t('waterOf', { n: p.water })}
          </Txt>
        </View>
        <View style={[ui.row, { marginTop: 8 }]}>
          <Txt size={26} style={{ flex: 1, letterSpacing: 2 }} accessibilityLabel={t('waterOf', { n: p.water })}>
            {'🥛'.repeat(Math.min(p.water, 8))}
            {'○'.repeat(Math.max(0, 8 - p.water))}
          </Txt>
        </View>
        <View style={[ui.row, { marginTop: 8 }]}>
          <Btn small kind="alt" label="−" onPress={() => addWater(-1)} style={{ flex: 1 }} />
          <Btn small label="+ 🥛" onPress={() => addWater(1)} style={{ flex: 2 }} />
        </View>
      </Card>

      <Card>
        <View style={ui.row}>
          <Txt size={19} weight="bold" style={{ flex: 1 }}>
            💡 {t('tipT')}
          </Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={t('listen')} onPress={() => say(tip[lang], lang)} hitSlop={8}>
            <Txt size={26}>🔊</Txt>
          </Pressable>
        </View>
        <Txt size={18} weight="semibold" style={{ marginVertical: 6 }}>
          {tip.e} {tip[lang]}
        </Txt>
        <Chip label={t('tipNext')} onPress={() => setTipOffset((o) => o + 1)} style={{ alignSelf: 'flex-start' }} />
      </Card>

      <ReelsCard />
      <WhyCard key={cur} />
      <Legal />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  task: { width: '47.8%', flexGrow: 1, borderRadius: 20, padding: 12, minHeight: 116, justifyContent: 'space-between' },
  check: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  feel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12 },
  flame: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14, marginTop: 2, marginBottom: 6 },
});
