import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CareState, EventKind, Prefs, Snapshot } from '@shared/family';
import { repo } from '@/data/repo';
import { newId } from '@/logic/ids';

/** An elder this phone follows (keyed by their user id). */
export type Follow = { patientId: string; name: string; phone: string; status: 'pending' | 'active' | 'gone'; prefs: Prefs };
export type RemoteEvent = { id: string; kind: string; data: Record<string, unknown>; at: string };
export type Remote = { name: string; phone: string; snap: Snapshot | null; state: CareState | null; lastSeen: number | null; events: RemoteEvent[]; fetchedAt: number };

/** A cheer or reminder from family, shown on the patient's Today until dismissed. */
export type InboxMsg = { id: string; kind: 'cheer' | 'remind'; text: string; fromName: string; at: number };
/** One chat message between the patient and their dietitian. `pending` / `failed` are local-only send states. */
export type ChatMsg = { id: string; text: string; fromStaff: boolean; at: string; deliveredAt?: string | null; readAt: string | null; sender: string; pending?: boolean; failed?: boolean };
export type ChatInfo = { unread: number; dietitian: { name: string; online: boolean; lastSeen?: string | null } | null };

/** A notice from the dietitian. */
export type Notice = { id: string; readAt: string | null; sentAt: string; from: string; titleEn: string; titleHi: string; bodyEn: string; bodyHi: string; deeplink: string };

/** `day` 1–14 for the 14-day programme; otherwise `weekday` (null = every day). */
export type PlanFood = { id: string; weekday: number | null; day?: number | null; slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'; foodId: string; qty: number; note: string };
export type DietPlan = {
  id: string; title: string; titleHi?: string; notes: string; notesHi?: string; startsOn: string; dietitian: { name: string } | null;
  carbsBreakfast: number | null; carbsLunch: number | null; carbsDinner: number | null; protein: number | null; fiber: number | null; kcal: number | null; items: PlanFood[];
};
export type ExercisePlan = { id: string; title: string; titleHi?: string; notes: string; notesHi?: string; startsOn: string; items: { id: string; exerciseId: string; weekdays: number[]; day?: number | null; time: string; minutes: number; note: string }[] };

/** Rows waiting to upload, keyed so a later change replaces an earlier one. Shapes match POST /sync/push. */
export type Outbox = {
  meals: Record<string, { id: string; slot: string; kind: string; at: number; items: { id: string; q: number }[]; updatedAt: number; deleted?: boolean }>;
  readings: Record<string, { id: string; v: number; ctx: string; at: number; updatedAt: number; deleted?: boolean }>;
  meds: Record<string, { id: string; name: string; time: string; kind?: string; dose?: number | null; unit?: string | null; stock: number | null; deleted?: boolean }>;
  doses: Record<string, { medId: string; date: string; status: 'taken' | 'skipped' | null; amount?: number | null }>;
  vitals: Record<string, { id: string; kind: 'weight' | 'bp'; weightKg?: number; sys?: number; dia?: number; pulse?: number; at: number; updatedAt: number; deleted?: boolean }>;
  activity: Record<string, { date: string; walkMin: number; steps: number; water: number; score: number }>;
  events: Record<string, { id: string; kind: EventKind; data: Record<string, unknown>; at: number }>;
  checkups: Record<string, { kind: string; lastDone: string; value?: number | null }>;
};
export const emptyOutbox = (): Outbox => ({ meals: {}, readings: {}, meds: {}, doses: {}, vitals: {}, activity: {}, events: {}, checkups: {} });

/** The 14-day Kickstart as sync sends it; details come from GET /me/program. */
export type ProgramSummary = { status: 'pending_review' | 'active' | 'completed' | 'dropped' | 'converted'; startsOn: string; title: string };
export type ProgramResult = {
  fastingBefore: number | null; fastingAfter: number | null; afterMealBefore: number | null; afterMealAfter: number | null;
  inRangeBefore: number | null; inRangeAfter: number | null; weightBefore: number | null; weightAfter: number | null; daysFollowed: number; improved: boolean;
};
export type ProgramDetail = {
  enrollment: { id: string; status: ProgramSummary['status']; startsOn: string; day: number; kcal: number; title: string; offerShownAt: string | null } | null;
  days?: { day: number; focusEn: string; focusHi: string; tipEn: string; tipHi: string; sugarCheck: 'none' | 'fasting' | 'after_meal' }[];
  result?: ProgramResult | null;
  offer?: { id: string; name: string; nameHi?: string; priceInr: number; months: number; features: string[]; featuresHi?: string[] }[];
};
/** A food the dietitian recommends ("For you"). */
export type FoodPick = { foodId: string; slots: string[]; note: string };
/** A finished app visit waiting to upload (shape of POST /sync/push `sessions`). */
export type SessionOut = { id: string; startedAt: number; seconds: number; screens: Record<string, number>; platform: string; appVersion: string };
/** A product event waiting to upload (POST /sync/push `appEvents`). */
export type AppEvent = { id: string; name: 'plan_ate' | 'video_play' | 'exercise_done' | 'reel_view' | 'reel_save' | 'reel_share' | 'invite_share'; props: Record<string, string | number>; at: number };
/** The visit in progress; times in ms. */
export type LiveSession = { id: string; startedAt: number; lastAt: number; ms: number; screens: Record<string, number> };

type CloudState = {
  /** Patient side: this phone shares its day (circle id from the API). */
  circleId: string | null;
  code: { value: string; expires: number } | null;
  /** Caregiver side. */
  following: Follow[];
  /** Last data seen for each followed elder, so their day shows instantly and offline. */
  remote: Record<string, Remote>;
  myName: string;
  inbox: InboxMsg[];
  /** Patient side: family asking to follow, waiting for Allow / No. */
  requests: { userId: string; name: string }[];
  notices: Notice[];
  plans: { diet: DietPlan | null; exercise: ExercisePlan | null };
  dietitian: string | null;
  tier: string;
  outbox: Outbox;
  /** Fingerprint of what the server already has, per row key; unchanged rows are not resent. */
  sent: Record<string, string>;
  lastPull: number;
  /** Fingerprints of profile / targets last exchanged, to avoid loops. */
  profileSig: string;
  targetsSig: string;
  /** The user chose to use the app without an account for now. */
  skipLogin: boolean;
  /** Mirrors the login session so screens and sync react to sign-in / sign-out. */
  authed: boolean;
  /** Exercise plan items finished, per date. */
  exDone: Record<string, string[]>;
  chat: ChatInfo;
  /** "For you" foods the dietitian chose; `slots` empty = any meal. */
  picks: FoodPick[];
  program: ProgramSummary | null;
  programDetail: ProgramDetail | null;
  /** Planned food swapped for today: `${date}:${planItemId}` → food id. */
  planSwaps: Record<string, string>;
  /** Last messages, so the conversation shows instantly and offline. */
  chatMessages: ChatMsg[];
  /** This install, for the onboarding funnel; kept across sign-out. */
  installId: string;
  /** Onboarding step -> first time reached (ms), and which of them the server has. */
  steps: Record<string, number>;
  stepsSent: string;
  live: LiveSession | null;
  sessions: SessionOut[];
  appEvents: AppEvent[];
};

const empty = (): CloudState => ({
  circleId: null, code: null, following: [], remote: {}, myName: '', inbox: [], requests: [], notices: [],
  plans: { diet: null, exercise: null }, dietitian: null, tier: 'FREE', outbox: emptyOutbox(), sent: {}, lastPull: 0, profileSig: '', targetsSig: '', skipLogin: false, authed: false, exDone: {}, chat: { unread: 0, dietitian: null }, chatMessages: [], picks: [], program: null, programDetail: null, planSwaps: {},
  installId: newId(), steps: {}, stepsSent: '', live: null, sessions: [], appEvents: [],
});

export const useCloud = create<CloudState>()(
  persist(empty, {
    name: 'glucobuddy-cloud',
    version: 2,
    storage: createJSONStorage(() => repo),
    // v1 (Supabase) data has nothing worth keeping: start clean.
    migrate: () => empty(),
  }),
);

export const resetCloud = () => {
  // Visits not yet uploaded belonged to the account that signed out, so they go too.
  const { skipLogin, installId, steps, stepsSent, live } = useCloud.getState();
  useCloud.setState({ ...empty(), skipLogin, installId, steps, stepsSent, live });
};

export const useSignedIn = () => useCloud((s) => s.authed);
