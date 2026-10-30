import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Switch, View } from 'react-native';

import { ClockRing, StepRing } from '@/components/charts';
import { NumberStepper } from '@/components/NumberStepper';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, Stat, styles as ui, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { cheerFor, clock, creditMinutes, STEPS_PER_MIN, WALK_DEFAULT, WALK_MAX, WALK_MIN, WALK_PRESETS, WALK_STEP, type Cheer } from '@/logic/walk';
import { useStepSensor } from '@/native/steps';
import { say } from '@/native/tts';
import { useApp, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

const STEP_GOAL = 6000;
const KEEP_AWAKE_TAG = 'walk';

/** Minutes offered for a walk already done (logged without the timer). */
const DONE_PRESETS = [10, 15, 20, 30];

export default function WalkScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const cur = useApp((s) => s.cur);
  const mode = useApp((s) => s.mode);
  const addWalk = useApp((s) => s.addWalk);
  const sensor = useStepSensor((s) => s.available);

  const [minutes, setMinutes] = useState(WALK_DEFAULT);
  const [demo, setDemo] = useState(false);
  const [voice, setVoice] = useState(true);
  /** Deadline while running; remaining ms while paused. Deadlines keep time right after the screen locks. */
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastCheer = useRef<Cheer | null>(null);

  const unit = demo ? 1000 : 60000;
  const totalMs = minutes * unit;
  const running = endAt !== null;
  const active = running || pausedLeft !== null;
  const leftMs = running ? Math.max(0, endAt - now) : (pausedLeft ?? totalMs);
  const progress = active ? 1 - leftMs / totalMs : 0;
  const elapsedMin = (totalMs - leftMs) / unit;
  // In demo speed 1 s stands for 1 min, so show the clock in "walk time".
  const leftSec = (leftMs / unit) * 60;
  const cheer = cheerFor(progress, leftMs / unit);
  const credit = (n: number) => addWalk(n, cur === 'me' && sensor ? 0 : n * STEPS_PER_MIN);
  const reset = () => {
    setEndAt(null);
    setPausedLeft(null);
    lastCheer.current = null;
  };

  /** Walk completed: credit it and celebrate. Runs from the timer, not as an effect of rendering. */
  const onFinish = useEffectEvent(() => {
    reset();
    credit(minutes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const msg = t('walkDoneN', { n: minutes });
    toast(msg);
    if (voice) say(msg, lang);
  });

  // The clock shows seconds, so tick once a second (demo speed needs finer steps).
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const n = Date.now();
      if (n >= endAt) onFinish();
      else setNow(n);
    }, demo ? 250 : 1000);
    return () => clearInterval(id);
  }, [endAt, demo]);

  // Screen stays on while walking so the clock is visible.
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [active]);

  // Cheer at each milestone: on screen always, spoken if voice is on.
  useEffect(() => {
    if (!running || cheer === lastCheer.current) return;
    lastCheer.current = cheer;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (voice) say(t(cheer), lang);
  }, [cheer, running, voice, t, lang]);

  const start = () => {
    lastCheer.current = null;
    setNow(Date.now());
    setPausedLeft(null);
    setEndAt(Date.now() + totalMs);
  };
  const pause = () => {
    setPausedLeft(leftMs);
    setEndAt(null);
  };
  const resume = () => {
    setNow(Date.now());
    setEndAt(Date.now() + (pausedLeft ?? totalMs));
    setPausedLeft(null);
  };
  const stop = () => {
    const n = creditMinutes(elapsedMin);
    reset();
    if (n) {
      credit(n);
      toast(t('walkedEarly', { n }));
    }
  };

  const pct = Math.min(p.steps / STEP_GOAL, 1);

  return (
    <Screen title={t('walkT')} back>
      {active ? (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <ClockRing progress={progress} time={clock(leftSec)} label={running ? t('minLeft') : t('paused')} paused={!running} />
          </View>
          <Banner tone={cheer === 'cheerLast' || cheer === 'cheer75' ? 'green' : 'info'}>
            <Txt size={19} weight="bold" center accessibilityLiveRegion="polite">
              {t(cheer)}
            </Txt>
          </Banner>
          {demo ? (
            <Txt size={14} color="mute" center style={{ marginBottom: 8 }}>
              {t('demoSpeed')}
            </Txt>
          ) : null}
          <View style={[ui.row, { marginBottom: 12 }]}>
            {running ? <Btn kind="alt" label={t('pause')} onPress={pause} style={{ flex: 1 }} /> : <Btn label={t('resume')} onPress={resume} style={{ flex: 1 }} />}
            <Btn kind="alt" label={t('finishEarly')} onPress={stop} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <StepRing steps={p.steps} goal={STEP_GOAL} label={t('steps')} />
          </View>
          {cur === 'me' && sensor === false ? (
            <Txt size={14} color="mute" center style={{ marginBottom: 8 }}>
              {t('noSensor')}
            </Txt>
          ) : null}
          <Card>
            <Txt weight="semibold" center style={{ marginBottom: 8 }}>
              🚶 {t('walkTip')}
            </Txt>
            <Txt size={17} weight="bold" style={{ marginBottom: 4 }}>
              ⏱️ {t('walkFor')}
            </Txt>
            <View style={ui.chips}>
              {WALK_PRESETS.map((m) => (
                <Chip key={m} label={`${m} ${t('min')}`} on={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </View>
            <NumberStepper label={t('walkT')} value={minutes} step={WALK_STEP} min={WALK_MIN} max={WALK_MAX} unit={t('min')} onChange={setMinutes} />
            <Btn label={t('startWalkN', { n: minutes })} onPress={start} style={{ marginTop: 10 }} />
            <View style={[ui.row, { marginTop: 10 }]}>
              <Txt size={16} color="mute" style={{ flex: 1 }}>
                🔊 {t('voiceCheer')}
              </Txt>
              <Switch value={voice} onValueChange={setVoice} trackColor={{ true: c.leaf, false: c.track }} />
            </View>
            {/* Developer builds only: 1 second counts as 1 minute, for demos. */}
            {__DEV__ && mode === 'detailed' ? (
              <View style={[ui.row, { marginTop: 6 }]}>
                <Txt size={16} color="mute" style={{ flex: 1 }}>
                  {t('demoSpeedLabel')}
                </Txt>
                <Switch value={demo} onValueChange={setDemo} trackColor={{ true: c.leaf, false: c.track }} />
              </View>
            ) : null}
          </Card>
          {/* Many people walk without the phone: let them log it afterwards in one tap. */}
          <Card>
            <Txt size={17} weight="bold" style={{ marginBottom: 6 }}>
              ✅ {t('walkedAlready')}
            </Txt>
            <View style={ui.chips}>
              {DONE_PRESETS.map((m) => (
                <Chip
                  key={m}
                  label={`+ ${m} ${t('min')}`}
                  onPress={() => {
                    credit(m);
                    const msg = t('walkDoneN', { n: m });
                    toast(msg);
                    if (voice) say(msg, lang);
                  }}
                />
              ))}
            </View>
          </Card>
        </>
      )}

      <View style={ui.stats}>
        <Stat value={p.walkMin} label={t('min')} />
        <Stat value={`${Math.round(pct * 100)}%`} label={String(STEP_GOAL)} />
      </View>
    </Screen>
  );
}
