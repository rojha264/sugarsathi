import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Alert, Platform } from 'react-native';

import { repo } from '@/data/repo';
import { translate, type TextKey } from '@/i18n/strings';
import { allCheckups } from '@/logic/checkups';
import { weekOf } from '@/logic/day';
import { addDays, dayDate } from '@/logic/ids';
import { doseTimes, lowMeds } from '@/logic/meds';
import { checkKindFor, sugarDayIndex, upcomingSugarDays } from '@/logic/sugarPlan';
import type { Lang, Profile, Setup } from '@/types';

const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseTime(hhmm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hour = +m[1];
  const minute = +m[2];
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** After "Later" on the explanation, wait this long before explaining again. */
const ASK_AGAIN_MS = 7 * 86400_000;
const ASKED_KEY = 'notif-explained-at';
let explaining: Promise<boolean> | null = null;

/** Says why reminders matter before the system asks, so fewer people tap "Don't allow". */
function explain(lang: Lang): Promise<boolean> {
  explaining ??= new Promise<boolean>((resolve) =>
    Alert.alert(translate(lang, 'notifWhyT'), translate(lang, 'notifWhyB'), [
      { text: translate(lang, 'notifLater'), style: 'cancel', onPress: () => resolve(false) },
      { text: translate(lang, 'notifAllow'), onPress: () => resolve(true) },
    ], { cancelable: false }),
  ).finally(() => {
    explaining = null;
  });
  return explaining;
}

/** Asks once if needed (after a short explanation); true when notifications may be shown. */
async function ensurePermission(lang: Lang): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) return true;
  if (!perm.canAskAgain) return false;
  const last = Number(repo.getItem(ASKED_KEY) ?? 0);
  if (Date.now() - last < ASK_AGAIN_MS) return false;
  repo.setItem(ASKED_KEY, String(Date.now()));
  if (!(await explain(lang))) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Last schedule written, so unchanged times and language skip the native calls on each launch. */
const SIGNATURE_KEY = 'reminders-signature';

/** How many upcoming sugar-check days are scheduled ahead; refreshed each time the app opens. */
const SUGAR_AHEAD = 6;
const SUGAR_IDS = Array.from({ length: SUGAR_AHEAD }, (_, i) => `sugar-${i}`);
/** Refill and checkup nudges arrive mid-morning, when shops and clinics are open. */
const NUDGE_TIME = { hour: 10, minute: 0 };
/** Ids this function owns; anything else (walk nudges, bedtime checks) is left alone. 'daily-med' and 'daily-sugar' are from older versions. */
const OWNED = /^(daily-|sugar-|med-|refill$|checkup-)/;

/** What reminders depend on, from the main user's profile. */
export type ReminderInput = Pick<Profile, 'sugarPlan' | 'meds' | 'stock' | 'checkups'>;

const at = (day: string, tm: { hour: number; minute: number } | null) => {
  const d = dayDate(day);
  if (tm) d.setHours(tm.hour, tm.minute, 0, 0);
  return d;
};

/**
 * Daily walk reminder and one per medicine dose time; sugar checks on the days the plan asks for,
 * alternating fasting / after a meal so readings come in useful pairs; a refill nudge when tablets
 * run low; and checkup nudges when a test falls due (weekly while overdue).
 */
export async function scheduleReminders(setup: Setup, lang: Lang, me: ReminderInput, today: string): Promise<boolean> {
  const plan = me.sugarPlan;
  const sugarDays = upcomingSugarDays(plan, today, SUGAR_AHEAD);
  const doses = doseTimes(me.meds);
  const low = lowMeds(me.meds, me.stock);
  // Overdue checkups repeat on the next Monday, so opening the app daily does not keep pushing them back.
  const nextWeek = addDays('2024-01-01', (weekOf(today) + 1) * 7);
  const checkups = allCheckups(me.checkups, today)
    .filter((c) => c.due)
    .map((c) => ({ id: c.id, day: c.state === 'due' ? nextWeek : c.due! }));
  const signature = JSON.stringify([setup.tw, setup.ts, setup.ta, lang, plan.every, sugarDays, doses, low.map((l) => l.name), checkups]);
  try {
    if (!(await ensurePermission(lang))) return false;
    if (repo.getItem(SIGNATURE_KEY) === signature) return true;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: translate(lang, 'rem'),
        importance: AndroidImportance.HIGH,
      });
    }
    type Item = { id: string; title: string; body: string; route: string; trigger: Notifications.NotificationTriggerInput };
    const daily = (hhmm: string) => {
      const tm = parseTime(hhmm);
      return tm ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: tm.hour, minute: tm.minute, channelId: CHANNEL } as const : null;
    };
    const once = (date: Date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL }) as const;
    const now = Date.now();
    const items: (Item | null)[] = [];

    const walk = daily(setup.tw);
    items.push(walk && { id: 'daily-walk', title: translate(lang, 'nWalk'), body: translate(lang, 'nBody'), route: '/walk', trigger: walk });
    for (const d of doses) {
      const trig = daily(d.at);
      items.push(trig && { id: `med-${d.at}`, title: translate(lang, 'nMed'), body: d.names.join(' · '), route: '/medicine', trigger: trig });
    }
    sugarDays.forEach((day, i) => {
      const kind = checkKindFor(sugarDayIndex(plan, day));
      const when = at(day, parseTime(kind === 'fasting' ? setup.ts : setup.ta));
      if (when.getTime() <= now) return;
      items.push({
        id: SUGAR_IDS[i],
        title: translate(lang, kind === 'fasting' ? 'nSugFast' : 'nSugAfter'),
        body: translate(lang, kind === 'fasting' ? 'nSugFastB' : 'nSugAfterB'),
        route: '/sugar',
        trigger: once(when),
      });
    });
    if (low.length) {
      items.push({
        id: 'refill',
        title: translate(lang, 'nRefill'),
        body: low.map((l) => translate(lang, 'refillLeft', { name: l.name, n: l.left })).join(' · '),
        route: '/medicine',
        trigger: once(at(addDays(today, 1), NUDGE_TIME)),
      });
    }
    for (const c of checkups) {
      const when = at(c.day, NUDGE_TIME);
      if (when.getTime() <= now) continue;
      items.push({ id: `checkup-${c.id}`, title: translate(lang, 'nCheckup'), body: translate(lang, `ck_${c.id}`), route: '/checkups', trigger: once(when) });
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => OWNED.test(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    await Promise.all(
      items.filter((it) => it !== null).map((it) =>
        Notifications.scheduleNotificationAsync({
          identifier: it.id,
          content: { title: it.title, body: it.body, data: { route: it.route } },
          trigger: it.trigger,
        }),
      ),
    );
    repo.setItem(SIGNATURE_KEY, signature);
    return true;
  } catch {
    return false;
  }
}

/** One-off notification after `seconds` that opens `route` when tapped. */
async function scheduleOnce(lang: Lang, title: TextKey, body: TextKey, route: string, seconds: number): Promise<boolean> {
  try {
    if (!(await ensurePermission(lang))) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title: translate(lang, title), body: translate(lang, body), data: { route } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: CHANNEL },
    });
    return true;
  } catch {
    return false;
  }
}

/** "Walk now" nudge after a meal. */
export const scheduleWalkNudge = (lang: Lang, minutes = 15) => scheduleOnce(lang, 'nWalk', 'nWalkMeal', '/walk', minutes * 60);

/** Sugar check, e.g. before bed after a drink. */
export const scheduleSugarCheck = (lang: Lang, hours = 3) => scheduleOnce(lang, 'nCheckT', 'nCheckB', '/sugar', hours * 3600);

/** Removes every scheduled reminder and forgets the last schedule (used by Restart). */
export async function cancelAllReminders(): Promise<void> {
  repo.removeItem(SIGNATURE_KEY);
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
