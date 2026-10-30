import { Pedometer } from 'expo-sensors';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { useApp } from '@/store/useApp';

/** null = not checked yet. */
export const useStepSensor = create<{ available: boolean | null }>(() => ({ available: null }));
const setAvailable = (available: boolean) => useStepSensor.setState({ available });

/**
 * Keeps the "me" profile's step count in sync with the phone's pedometer.
 * iOS can read today's total from CoreMotion history. Android's sensor only
 * reports steps since we subscribed, so we add them on top of the stored count.
 * (Health Connect / HealthKit integration comes later.)
 */
/** Step counts are saved at most this often (each save rewrites stored state). */
const SAVE_EVERY_MS = 15000;

export function useStepSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let sub: { remove(): void } | null = null;
    let appSub: { remove(): void } | null = null;
    let cancelled = false;
    // Live steps = base + steps reported since we subscribed.
    let base = useApp.getState().profiles.me.steps;
    let watched = 0;
    let day = useApp.getState().day;
    let latest = base;
    let savedAt = 0;

    const save = (force = false) => {
      if (!force && Date.now() - savedAt < SAVE_EVERY_MS) return;
      savedAt = Date.now();
      useApp.getState().setMySteps(latest);
    };

    // iOS keeps a step history, so today's total can be re-read exactly.
    const readToday = async () => {
      if (Platform.OS !== 'ios') return;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      try {
        const r = await Pedometer.getStepCountAsync(start, new Date());
        // History is already for today, so the watcher must not treat the next event as a new day.
        day = useApp.getState().day;
        base = r.steps - watched;
        latest = r.steps;
        save(true);
      } catch {
        // History unavailable; live updates still apply.
      }
    };

    (async () => {
      try {
        const ok = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(ok);
        if (!ok) return;
        const perm = await Pedometer.requestPermissionsAsync();
        if (cancelled || !perm.granted) return setAvailable(false);

        await readToday();
        sub = Pedometer.watchStepCount((r) => {
          watched = r.steps;
          const st = useApp.getState();
          if (st.day !== day) {
            // Day rolled over while watching: restart counting from zero.
            day = st.day;
            base = -r.steps;
          }
          latest = Math.max(0, base + r.steps);
          save();
        });
        appSub = AppState.addEventListener('change', (s) => {
          if (s === 'active') readToday();
          else save(true);
        });
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      // Skip the final save after Restart (onboarding reset), or old steps land in the fresh profile.
      if (useApp.getState().onboarded) save(true);
      sub?.remove();
      appSub?.remove();
    };
  }, [enabled]);
}
