import * as Haptics from 'expo-haptics';
import { useEffect, useEffectEvent, useState } from 'react';
import { View } from 'react-native';

import { track } from '@/cloud/analytics';
import { itemsFor, planDayToday } from '@/logic/program';
import { exerciseById } from '@/cloud/catalog';
import { useCloud } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, H3, Legal, styles as ui, Txt } from '@/components/ui';
import { VideoList } from '@/components/VideoSheet';
import { useT } from '@/i18n/useT';
import { dayDate } from '@/logic/ids';
import { say } from '@/native/tts';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

const NONE: string[] = [];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Today's exercises from the dietitian, with spoken steps and a timer; finished minutes count as activity. */
export default function ExerciseScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const today = useApp((s) => s.day);
  const addWalk = useApp((s) => s.addWalk);
  const plan = useCloud((s) => s.plans.exercise);
  // Select the stored array itself; a fresh `[]` from the selector would re-render forever.
  const doneToday = useCloud((s) => s.exDone[today]);
  const done = doneToday ?? NONE;
  const [running, setRunning] = useState<{ id: string; left: number; minutes: number } | null>(null);
  const weekday = dayDate(today).getDay();
  // 14-day programme plans go by day number (gentle progression); other plans by weekday.
  const pday = plan?.startsOn ? planDayToday(plan, today) : null;
  const items = itemsFor(plan?.items ?? [], pday, weekday).filter((i) => exerciseById(i.exerciseId));

  // Finishing credits the minutes as activity and ticks the item off for today.
  const finish = useEffectEvent((r: NonNullable<typeof running>) => {
    addWalk(r.minutes, 0);
    track('exercise_done', { exerciseId: items.find((i) => i.id === r.id)?.exerciseId ?? '', minutes: r.minutes });
    useCloud.setState((s) => ({ exDone: { [today]: [...(s.exDone[today] ?? []), r.id] } }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const msg = t('exDoneMsg');
    toast(msg);
    say(msg, lang);
    setRunning(null);
  });

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => (running.left <= 1 ? finish(running) : setRunning({ ...running, left: running.left - 1 })), 1000);
    return () => clearTimeout(id);
  }, [running]);

  if (!items.length) {
    return (
      <Screen title={t('exT')} back>
        <Card>
          <Txt size={40} center>🏃</Txt>
          <H3>{t('exNoneT')}</H3>
          <Txt size={16} color="mute">
            {t('exNoneB')}
          </Txt>
        </Card>
        <Legal />
      </Screen>
    );
  }

  return (
    <Screen title={t('exT')} back>
      <Txt size={16} color="mute" style={{ marginBottom: 10 }}>
        {t('exProgress', { a: done.length, b: items.length })}
      </Txt>
      {items.map((i) => {
        const e = exerciseById(i.exerciseId)!;
        const isDone = done.includes(i.id);
        const steps = lang === 'hi' ? e.stepsHi : e.stepsEn;
        const isRunning = running?.id === i.id;
        return (
          <Card key={i.id} style={isDone ? { borderColor: c.leaf, borderWidth: 2 } : undefined}>
            <View style={ui.row}>
              <Txt size={34}>{e.emoji}</Txt>
              <View style={{ flex: 1 }}>
                <Txt size={20} weight="bold">
                  {lang === 'hi' ? e.nameHi : e.nameEn}
                </Txt>
                <Txt size={15} color="mute">
                  {i.minutes} {t('min')}
                  {i.time ? ` · ⏰ ${i.time}` : ''}
                </Txt>
              </View>
              <Chip label="🔊" onPress={() => say(steps, lang)} />
            </View>
            <Txt size={16} style={{ marginVertical: 8 }}>
              {steps}
            </Txt>
            <VideoList videos={e.videos ?? []} title={lang === 'hi' ? e.nameHi : e.nameEn} />
            {i.note ? (
              <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
                📝 {i.note}
              </Txt>
            ) : null}
            {isDone ? (
              <Banner tone="green" style={{ marginBottom: 0 }}>
                <Txt weight="bold">✓ {t('exDoneTag')}</Txt>
              </Banner>
            ) : isRunning ? (
              <View style={ui.row}>
                <Txt size={40} weight="heavy" style={{ flex: 1, color: c.leaf }}>
                  {mmss(running.left)}
                </Txt>
                <Btn small kind="alt" label={t('exStop')} onPress={() => setRunning(null)} />
              </View>
            ) : (
              <Btn label={`▶ ${t('exStart')}`} disabled={!!running} onPress={() => { say(steps, lang); setRunning({ id: i.id, left: i.minutes * 60, minutes: i.minutes }); }} />
            )}
          </Card>
        );
      })}
      <Legal />
    </Screen>
  );
}
