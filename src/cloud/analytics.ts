import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { newId } from '@/logic/ids';
import { screenName } from '@/logic/screen';
import { useApp } from '@/store/useApp';
import { api, cloudEnabled } from './client';
import { useCloud, type AppEvent, type LiveSession, type SessionOut } from './store';

/** Back within this long counts as the same visit (a quick look at WhatsApp, a call). */
const IDLE_MS = 30_000;
/** Time is saved this often while the app is open, so a killed app loses little. */
const TICK_MS = 30_000;
const MIN_VISIT_MS = 3_000;
const KEEP = 300;
const SEND_DELAY_MS = 2_000;

/** Onboarding screens, in order; "otp" is reached when the phone number is verified. */
const STEP_OF: Record<string, string> = {
  '/onboarding/lang': 'lang', '/onboarding/mode': 'mode', '/onboarding/diet': 'diet', '/onboarding/phone': 'phone', '/onboarding/setup': 'setup',
};

const appVersion = Constants.expoConfig?.version ?? '';

let sendTimer: ReturnType<typeof setTimeout> | undefined;

/** Remembers when this install first reached an onboarding step, and tells the server (no login needed). */
export function markStep(step: string) {
  const { steps } = useCloud.getState();
  if (steps[step]) return;
  useCloud.setState({ steps: { ...steps, [step]: Date.now() } });
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendInstall, SEND_DELAY_MS);
}

export async function sendInstall() {
  const { installId, steps, stepsSent } = useCloud.getState();
  const sig = Object.keys(steps).sort().join(',');
  if (!cloudEnabled || sig === stepsSent) return;
  try {
    await api('/analytics/install', { json: { id: installId, platform: Platform.OS, appVersion, lang: useApp.getState().lang, steps } });
    useCloud.setState({ stepsSent: sig });
  } catch {
    // retried at the next app start or step
  }
}

/** Records a product event (diet plan followed, video watched, exercise done); uploads with the next sync. */
export function track(name: AppEvent['name'], props: AppEvent['props'] = {}) {
  useCloud.setState((s) => ({ appEvents: [...s.appEvents, { id: newId(), name, props, at: Date.now() }].slice(-KEEP) }));
}

/** Time since the current screen came into view; null while the app is in the background. */
let since: number | null = null;

const finish = (live: LiveSession): SessionOut | null =>
  live.ms < MIN_VISIT_MS
    ? null
    : {
        id: live.id, startedAt: live.startedAt, seconds: Math.round(live.ms / 1000), platform: Platform.OS, appVersion,
        screens: Object.fromEntries(Object.entries(live.screens).map(([k, v]) => [k, Math.round(v / 1000)])),
      };

/** Adds the time since the last note to the current visit, on `screen`. */
function note(screen: string) {
  const live = useCloud.getState().live;
  if (since === null || !live) return;
  const now = Date.now();
  const dt = now - since;
  since = now;
  useCloud.setState({ live: { ...live, ms: live.ms + dt, lastAt: now, screens: { ...live.screens, [screen]: (live.screens[screen] ?? 0) + dt } } });
}

/** Foreground: continue the visit if the user was away briefly, otherwise close it and start a new one. */
function begin() {
  const now = Date.now();
  const { live, sessions } = useCloud.getState();
  since = now;
  if (live && now - live.lastAt < IDLE_MS) return;
  const done = live ? finish(live) : null;
  useCloud.setState({
    live: { id: newId(), startedAt: now, lastAt: now, ms: 0, screens: {} },
    sessions: done ? [...sessions, done].slice(-KEEP) : sessions,
  });
}

function pause(screen: string) {
  note(screen);
  since = null;
}

/** Tracks onboarding steps and time in the app (per screen), for the owner's Analytics page. */
export function useUsage() {
  const path = screenName(usePathname());
  const onboarded = useApp((s) => s.onboarded);
  const authed = useCloud((s) => s.authed);
  const screen = useRef(path);

  useEffect(() => {
    markStep('open');
    sendInstall();
    begin();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? begin() : pause(screen.current)));
    const id = setInterval(() => note(screen.current), TICK_MS);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    // Time so far belongs to the screen being left.
    note(screen.current);
    screen.current = path;
    const step = STEP_OF[path];
    if (step) markStep(step);
  }, [path]);

  useEffect(() => {
    if (onboarded) markStep('done');
  }, [onboarded]);
  useEffect(() => {
    if (authed) markStep('otp');
  }, [authed]);
}
