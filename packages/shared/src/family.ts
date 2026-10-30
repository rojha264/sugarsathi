/**
 * Shared by the app and the Supabase edge functions (Deno), so it must stay
 * plain TypeScript with no imports and no platform APIs.
 *
 * The patient's phone uploads a Snapshot (today) and a CareState (slower-moving
 * facts). The server turns them into alerts for caregivers.
 */

export type Lang = 'en' | 'hi';
export type DoseState = 'taken' | 'skipped' | null;

export type SnapDose = { name: string; at: string; s: DoseState };
export type SnapFood = { e: string; en: string; hi: string; q: number };
export type SnapMeal = { slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'; at: number; kind: 'meal' | 'treat' | 'drink'; foods: SnapFood[]; c: number };
export type SnapSugar = { v: number; ctx: 'fasting' | 'after' | 'random'; at: number };

/** The patient's day so far. */
export type Snapshot = {
  day: string;
  updatedAt: number;
  score: number;
  meals: SnapMeal[];
  doses: SnapDose[];
  sugar: SnapSugar[];
  walkMin: number;
  steps: number;
  water: number;
};

export type DaySummary = { date: string; score: number; sugar: number[]; medTaken: number; medTotal: number; walkMin: number };

/** Facts that change slowly: name, streak, tablets running out, overdue checkups, last week. */
export type CareState = {
  name: string;
  lang: Lang;
  streak: number;
  low: { name: string; left: number; days: number }[];
  checkupsDue: string[];
  week: DaySummary[];
};

export const ALERT_KINDS = ['sugar_alert', 'unwell_alert', 'sos_alert', 'missed_medicine', 'no_checkin', 'daily_digest'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

/** Alert vars are strings so they drop straight into notification text. */
export type Alert = { key: string; kind: AlertKind; vars: Record<string, string> };

/** Event kinds the patient's phone sends for instant alerts. */
export type EventKind = 'sugar' | 'unwell' | 'sos';

export const MISSED_AFTER_MIN = 120;
export const CHECKIN_BY = '13:00';
export const DIGEST_AT = '21:00';
/** Family is alerted on the same readings the app shows in red: keep equal to LOW / VERY_HIGH in sugar.ts. */
export const SUGAR_ALERT_LOW = 70;
export const SUGAR_ALERT_HIGH = 250;
/** Very low: the person may need someone to help them now. Keep equal to VERY_LOW in sugar.ts. */
export const SUGAR_ALERT_VERY_LOW = 54;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Date and HH:MM on the patient's clock. */
export function localNow(at: Date, tz: string): { day: string; hhmm: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}` };
}

/** True when the patient has logged anything today. */
export const hasActivity = (s: Snapshot | null, day: string) =>
  !!s && s.day === day && (s.meals.length > 0 || s.sugar.length > 0 || s.walkMin > 0 || s.water > 0 || s.doses.some((d) => d.s !== null));

/**
 * Scheduled alerts due now. `sent` holds keys already sent, so each alert goes out once.
 * Doses at the same time are grouped into one alert.
 */
export function dueAlerts(snap: Snapshot | null, state: CareState | null, now: { day: string; hhmm: string }, sent: Set<string>): Alert[] {
  const out: Alert[] = [];
  const add = (a: Alert) => {
    if (!sent.has(a.key)) out.push(a);
  };
  const name = state?.name ?? '';
  const today = snap && snap.day === now.day ? snap : null;
  const nowMin = toMin(now.hhmm);

  if (today) {
    const late = new Map<string, string[]>();
    for (const d of today.doses) {
      if (d.s === 'taken' || nowMin < toMin(d.at) + MISSED_AFTER_MIN) continue;
      late.set(d.at, [...(late.get(d.at) ?? []), d.name]);
    }
    for (const [at, names] of late) add({ key: `med:${now.day}:${at}`, kind: 'missed_medicine', vars: { name, med: names.join(', '), time: at } });
  }

  if (nowMin >= toMin(CHECKIN_BY) && !hasActivity(snap, now.day)) add({ key: `checkin:${now.day}`, kind: 'no_checkin', vars: { name } });

  if (nowMin >= toMin(DIGEST_AT)) add({ key: `digest:${now.day}`, kind: 'daily_digest', vars: digestVars(today, state, now.day) });

  return out;
}

function digestVars(s: Snapshot | null, state: CareState | null, day: string): Record<string, string> {
  const taken = s ? s.doses.filter((d) => d.s === 'taken').length : 0;
  const notes = [...(state?.low.map((l) => `💊 ${l.name} ${l.left}`) ?? []), ...(state?.checkupsDue.length ? ['🩺 ' + state.checkupsDue.join(', ')] : [])];
  return {
    name: state?.name ?? '',
    day,
    score: String(s?.score ?? 0),
    meals: String(s ? new Set(s.meals.filter((m) => m.slot !== 'snack').map((m) => m.slot)).size : 0),
    meds: `${taken}/${s?.doses.length ?? 0}`,
    walk: String(s?.walkMin ?? 0),
    sugar: s?.sugar.length ? s.sugar.map((r) => r.v).join(', ') : '–',
    water: String(s?.water ?? 0),
    notes: notes.length ? notes.join(' · ') : '–',
  };
}

/** Instant alert for an event from the patient's phone, or null when it is not alarming. */
export function eventAlert(kind: EventKind, data: Record<string, unknown>, name: string, id: string): Alert | null {
  if (kind === 'sugar') {
    const v = Number(data.v);
    if (!(v < SUGAR_ALERT_LOW || v > SUGAR_ALERT_HIGH)) return null;
    const level = v < SUGAR_ALERT_VERY_LOW ? 'veryLow' : v < SUGAR_ALERT_LOW ? 'low' : 'high';
    return { key: `ev:${id}`, kind: 'sugar_alert', vars: { name, v: String(v), level } };
  }
  if (kind === 'unwell') return { key: `ev:${id}`, kind: 'unwell_alert', vars: { name, what: String(data.what ?? '') } };
  return { key: `ev:${id}`, kind: 'sos_alert', vars: { name } };
}

const WORDS = {
  en: { veryLow: 'VERY LOW', low: 'LOW', high: 'HIGH', lowWhat: 'shaky / sweaty (low sugar signs)', highWhat: 'very thirsty / tired (high sugar signs)', dangerWhat: 'chest pain / breathless / fainting' },
  hi: { veryLow: 'बहुत कम', low: 'कम', high: 'बहुत ज़्यादा', lowWhat: 'काँपना / पसीना (शुगर कम के लक्षण)', highWhat: 'बहुत प्यास / थकान (शुगर ज़्यादा के लक्षण)', dangerWhat: 'सीने में दर्द / साँस / बेहोशी' },
} as const;

const word = (lang: Lang, k: string) => (WORDS[lang] as Record<string, string>)[k] ?? k;

/** Notification title and body for an alert, in the caregiver's language. */
export function alertText(a: Alert, lang: Lang): { title: string; body: string } {
  const v = a.vars;
  const hi = lang === 'hi';
  switch (a.kind) {
    case 'sugar_alert':
      return hi
        ? { title: `⚠️ ${v.name} की शुगर ${word(lang, v.level)}: ${v.v}`, body: v.level === 'veryLow' ? 'अभी फ़ोन कीजिए। जवाब न मिले तो किसी को पास भेजिए या 108 पर कॉल कीजिए।' : 'कृपया अभी फ़ोन करके हाल पूछिए।' }
        : { title: `⚠️ ${v.name}'s sugar is ${word(lang, v.level)}: ${v.v} mg/dL`, body: v.level === 'veryLow' ? 'Call now. If there is no answer, send someone to them or call 108.' : 'Please call and check on them now.' };
    case 'unwell_alert':
      return hi
        ? { title: `😟 ${v.name} की तबीयत ठीक नहीं`, body: `${word(lang, v.what + 'What')}। कृपया फ़ोन कीजिए।` }
        : { title: `😟 ${v.name} is not feeling well`, body: `${word(lang, v.what + 'What')}. Please call them.` };
    case 'sos_alert':
      return hi ? { title: `🚨 ${v.name} ने SOS दबाया`, body: 'तुरंत फ़ोन कीजिए।' } : { title: `🚨 ${v.name} opened SOS`, body: 'Please call them right away.' };
    case 'missed_medicine':
      return hi
        ? { title: `💊 ${v.name} की दवा बाकी`, body: `${v.time} की दवा (${v.med}) अभी दर्ज नहीं हुई।` }
        : { title: `💊 ${v.name} may have missed medicine`, body: `The ${v.time} dose (${v.med}) is not marked yet.` };
    case 'no_checkin':
      return hi
        ? { title: `👋 आज ${v.name} की कोई खबर नहीं`, body: 'आज ऐप में कुछ दर्ज नहीं हुआ। एक बार फ़ोन कर लीजिए।' }
        : { title: `👋 No update from ${v.name} today`, body: 'Nothing logged in the app yet today. Maybe give them a call.' };
    case 'daily_digest':
      return hi
        ? {
            title: `📋 ${v.name} का आज का हाल: ${v.score}/100`,
            body: `🍽️ ${v.meals}/3 भोजन · 💊 ${v.meds} · 🚶 ${v.walk} मिनट · 🩸 ${v.sugar} · 💧 ${v.water} गिलास · ${v.notes}`,
          }
        : {
            title: `📋 ${v.name}'s day: ${v.score}/100`,
            body: `🍽️ ${v.meals}/3 meals · 💊 ${v.meds} · 🚶 ${v.walk} min · 🩸 ${v.sugar} · 💧 ${v.water} glasses · ${v.notes}`,
          };
  }
}

/** Digits with India's country code for a plain 10-digit mobile number (for wa.me links). */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, '').replace(/^0+/, '');
  return d.length === 10 ? `91${d}` : d;
}

/** Caregiver alert choices: which alerts are muted, and the language they arrive in. */
export type Prefs = { off: AlertKind[]; lang: Lang };
export const DEFAULT_PREFS: Prefs = { off: [], lang: 'en' };
