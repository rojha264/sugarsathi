import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { programDay } from '@shared/program';
import { fetchProgram } from '@/cloud/program';
import { useCloud, useSignedIn } from '@/cloud/store';
import { useT } from '@/i18n/useT';
import { useApp, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import { Banner, Txt } from './ui';

const NONE: string[] = [];

/**
 * Home card for the 14-day Kickstart: "Day 5 of 14", today's focus and three tasks (meals,
 * exercise, sugar check). Before the start it says when it begins; afterwards it opens the results.
 */
export function KickstartCard() {
  const { t, lang } = useT();
  const c = useColors();
  const authed = useSignedIn();
  const program = useCloud((s) => s.program);
  const detail = useCloud((s) => s.programDetail);
  const today = useApp((s) => s.day);
  const exDone = useCloud((s) => s.exDone[today]) ?? NONE;
  const p = useProfile();
  const status = program?.status;
  useEffect(() => {
    if (authed && status && status !== 'converted') fetchProgram();
  }, [authed, status, today]);
  if (!authed || !program || program.status === 'converted' || program.status === 'dropped' || useApp.getState().cur !== 'me') return null;

  if (program.status === 'pending_review') {
    return (
      <Banner tone="amber">
        <Txt weight="bold">👩‍⚕️ {t('kickPending')}</Txt>
      </Banner>
    );
  }
  const day = programDay(program.startsOn, today);
  const done = program.status === 'completed' || day > 14;
  const info = detail?.days?.find((d) => d.day === day);
  const mealsDone = p.meals.length >= 2;
  const sugarDue = info?.sugarCheck && info.sugarCheck !== 'none';
  const sugarDone = sugarDue && p.sugar.some((r) => (info?.sugarCheck === 'fasting' ? r.ctx === 'fasting' : r.ctx === 'after'));
  const task = (ok: boolean, label: string) => (
    <Txt size={15} weight="semibold" color={ok ? 'leaf' : 'ink'}>
      {ok ? '✅' : '⬜'} {label}
    </Txt>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(done ? '/results' : '/plan')}
      style={{ backgroundColor: c.card, borderColor: c.leaf, borderWidth: 2, borderRadius: 20, padding: 14, marginBottom: 12 }}>
      {day <= 0 ? (
        <>
          <Txt size={18} weight="bold">🚀 {t('kickTomorrow')}</Txt>
          <Txt size={15} color="mute">{t('kickTomorrowSub')}</Txt>
        </>
      ) : done ? (
        <>
          <Txt size={18} weight="bold">🎉 {t('kickDone')}</Txt>
          <Txt size={15} weight="bold" color="leaf">📊 {t('kickSeeResults')} ›</Txt>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt size={14} weight="bold" color="leaf">
              🚀 {t('kickDayOf', { n: day })}
            </Txt>
            {day === 7 ? <Txt size={14} weight="bold">🎉 {t('kickHalfway')}</Txt> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 3, marginVertical: 6 }}>
            {Array.from({ length: 14 }, (_, k) => (
              <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k < day ? c.leaf : c.line }} />
            ))}
          </View>
          {info ? (
            <Txt size={18} weight="bold" style={{ marginBottom: 4 }}>
              {lang === 'hi' ? info.focusHi : info.focusEn}
            </Txt>
          ) : null}
          {task(mealsDone, t('kickTaskMeals'))}
          {task(exDone.length > 0, t('kickTaskExercise'))}
          {sugarDue ? task(!!sugarDone, t(info?.sugarCheck === 'fasting' ? 'kickCheckFasting' : 'kickCheckAfter')) : null}
        </>
      )}
    </Pressable>
  );
}
