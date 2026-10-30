import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { EventKind } from '@shared/family';
import { newId } from '@/logic/ids';
import { duplicateMeals } from '@/logic/meal';
import type { ServerReel } from '@/logic/reels';
import { medKey } from '@/logic/meds';
import { score } from '@/logic/score';
import { registerPush } from '@/native/push';
import { useApp } from '@/store/useApp';
import { setCrashUser } from '@/native/crash';
import { mergeCatalog, type Exercise, type FoodRule, type ServerFood, type ServerThali, type ServerTip } from './catalog';
import { api, getSession, signedIn } from './client';
import { refreshFollowing } from './link';
import { emptyOutbox, useCloud, type DietPlan, type ExercisePlan, type FoodPick, type Notice, type ProgramSummary, type Outbox } from './store';

const FLUSH_DELAY_MS = 3000;
const POLL_MS = 60 * 1000;

const sig = (v: unknown) => JSON.stringify(v);

/**
 * Turns the main user's local state into upload rows. Every row is keyed; only rows whose
 * fingerprint differs from what the server already has go into the outbox. Runs on every change,
 * so meals and readings are queued before the nightly rollover clears them from "today".
 */
export function queue() {
  if (!signedIn()) return;
  const s = useApp.getState();
  if (!s.onboarded) return;
  const me = s.profiles.me;
  const { sent, outbox } = useCloud.getState();
  const next: Outbox = { ...emptyOutbox(), ...structuredCopy(outbox) };
  const seen = new Set<string>();
  const put = <K extends keyof Outbox>(kind: K, key: string, row: Outbox[K][string]) => {
    const k = `${kind}:${key}`;
    seen.add(k);
    if (sent[k] !== sig(row)) (next[kind] as Record<string, unknown>)[key] = row;
  };

  for (const m of [...me.meals, ...(me.late?.meals ?? [])]) put('meals', m.id, { id: m.id, slot: m.slot, kind: m.kind ?? 'meal', at: m.createdAt, items: m.items, updatedAt: m.updatedAt });
  for (const r of [...me.sugar, ...(me.late?.sugar ?? [])]) put('readings', r.id, { id: r.id, v: r.v, ctx: r.ctx, at: r.createdAt, updatedAt: r.updatedAt });
  for (const v of me.vitals ?? []) put('vitals', v.id, { ...(v.kind === 'weight' ? { kind: 'weight', weightKg: v.weightKg } : { kind: 'bp', sys: v.sys, dia: v.dia, pulse: v.pulse }), id: v.id, at: v.createdAt, updatedAt: v.updatedAt });
  for (const m of me.meds) {
    put('meds', m.id, { id: m.id, name: m.n, time: m.at, kind: m.kind ?? 'tablet', dose: m.dose ?? null, unit: m.unit ?? null, stock: me.stock[medKey(m.n)] ?? null });
    put('doses', `${m.id}:${s.day}`, { medId: m.id, date: s.day, status: m.s, amount: m.s === 'taken' ? (m.taken ?? m.dose ?? null) : null });
  }
  // Medicines removed on the phone are deleted on the server too.
  for (const k of Object.keys(sent)) {
    if (!k.startsWith('meds:') || seen.has(k)) continue;
    const id = k.slice(5);
    next.meds[id] = { id, name: '', time: '00:00', stock: null, deleted: true };
  }
  put('activity', s.day, { date: s.day, walkMin: me.walkMin, steps: me.steps, water: me.water, score: score(me, s.day) });
  for (const [kind, lastDone] of Object.entries(me.checkups)) if (lastDone) put('checkups', kind, { kind, lastDone, value: me.checkupValues?.[kind as keyof typeof me.checkups] ?? null });

  // Forget fingerprints of past rows that are no longer on the phone (they are on the server).
  const keep = Object.fromEntries(Object.entries(sent).filter(([k]) => seen.has(k) || k.startsWith('meds:') || k.startsWith('vitals:')));
  useCloud.setState({ outbox: next, sent: keep });
}

const structuredCopy = (o: Outbox): Outbox => JSON.parse(JSON.stringify(o));
const isEmpty = (o: Outbox) => Object.values(o).every((v) => !Object.keys(v).length);

let flushing: Promise<void> | null = null;

/** Uploads the outbox; rows changed while uploading stay queued for the next try. */
export function flush(): Promise<void> {
  if (!signedIn()) return Promise.resolve();
  flushing ??= (async () => {
    const { outbox, sessions, appEvents, installId } = useCloud.getState();
    if (isEmpty(outbox) && !sessions.length && !appEvents.length) return;
    const batch = structuredCopy(outbox);
    try {
      await api('/sync/push', {
        json: {
          meals: Object.values(batch.meals), readings: Object.values(batch.readings), meds: Object.values(batch.meds), vitals: Object.values(batch.vitals ?? {}),
          doses: Object.values(batch.doses), activity: Object.values(batch.activity), events: Object.values(batch.events), checkups: Object.values(batch.checkups),
          sessions, appEvents, installId,
        },
      });
    } catch {
      return; // offline or server error: keep everything for the next attempt
    }
    useCloud.setState((c) => {
      const out = structuredCopy(c.outbox);
      const sent = { ...c.sent };
      for (const kind of Object.keys(batch) as (keyof Outbox)[]) {
        for (const [key, row] of Object.entries(batch[kind])) {
          const now = (out[kind] as Record<string, unknown>)[key];
          if (sig(now) !== sig(row)) continue;
          delete (out[kind] as Record<string, unknown>)[key];
          if (kind === 'meds' && (row as { deleted?: boolean }).deleted) delete sent[`meds:${key}`];
          else if (kind !== 'events') sent[`${kind}:${key}`] = sig(row);
        }
      }
      const uploaded = new Set([...sessions, ...appEvents].map((x) => x.id));
      return { outbox: out, sent, sessions: c.sessions.filter((x) => !uploaded.has(x.id)), appEvents: c.appEvents.filter((x) => !uploaded.has(x.id)) };
    });
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Sends profile answers (name, type, diet, reminders…) when they change. */
async function pushProfile() {
  const { setup, lang } = useApp.getState();
  const body = {
    name: setup.name.trim(), lang, type: setup.type, ageGroup: setup.age, diet: setup.diet, sugarEvery: setup.sugarEvery,
    remindWalk: setup.tw, remindMed: setup.tm, remindSugar: setup.ts, remindAfter: setup.ta, ...(setup.consentVer ? { consentVer: setup.consentVer } : {}),
    // Signup baseline for the 14-day plan.
    ...(setup.sex ? { sex: setup.sex } : {}), ...(setup.birthYear ? { birthYear: setup.birthYear } : {}), ...(setup.heightCm ? { heightCm: setup.heightCm } : {}),
    ...(setup.weightKg ? { weightKg: setup.weightKg } : {}), ...(setup.region ? { region: setup.region } : {}), ...(setup.meds ? { meds: setup.meds } : {}), ...(setup.flags ? { flags: setup.flags } : {}),
  };
  if (sig(body) === useCloud.getState().profileSig) return;
  try {
    await api('/me', { method: 'PATCH', json: body });
    useCloud.setState({ profileSig: sig(body) });
  } catch {
    // retried on the next sync
  }
}

type Pull = {
  serverTime: number;
  catalog: { foods: ServerFood[]; tips: ServerTip[]; exercises: Exercise[]; rules: FoodRule[]; swaps: { fromId: string; toId: string }[]; thalis?: ServerThali[]; reels?: ServerReel[]; ingredients: unknown[] };
  me: { name: string; patient: { targetMealCarbs: number; targetProtein: number; targetFiber: number; targetMode: string; tier: string; assignedDietitian: { name: string } | null } | null };
  plans: { diet: DietPlan | null; exercise: ExercisePlan | null };
  inbox: Notice[];
  chat: { unread: number; dietitian: { name: string; online: boolean } | null };
  picks?: FoodPick[];
  program?: ProgramSummary | null;
  family: { circleId: string; requests: { userId: string; name: string }[]; messages: { id: string; kind: 'cheer' | 'remind'; text: string; fromName: string; at: string }[] } | null;
};

/** Brings down what the dietitian and the server changed: catalog, targets, plans, notices, family. */
export async function pull() {
  if (!signedIn()) return;
  let r: Pull;
  try {
    r = await api<Pull>(`/sync/pull?since=${useCloud.getState().lastPull}`);
  } catch {
    return;
  }
  mergeCatalog(r.catalog);
  const app = useApp.getState();
  const p = r.me.patient;
  if (p) {
    const base = { meal: p.targetMealCarbs, protein: p.targetProtein, fiber: p.targetFiber };
    const mode = p.targetMode === 'dietitian' ? 'doctor' : 'auto';
    const targetsSig = sig({ base, mode });
    if (targetsSig !== useCloud.getState().targetsSig) {
      // The dietitian's numbers become the base the smart targets work from.
      app.setTargetBase('me', base, mode);
      useCloud.setState({ targetsSig });
    }
  }
  if (r.me.name && !app.setup.name.trim()) app.updateSetup({ name: r.me.name });
  useCloud.setState({
    lastPull: r.serverTime,
    plans: r.plans,
    notices: r.inbox,
    dietitian: p?.assignedDietitian?.name ?? null,
    chat: { ...useCloud.getState().chat, ...r.chat },
    ...(r.picks ? { picks: r.picks } : {}),
    ...(r.program !== undefined ? { program: r.program } : {}),
    tier: p?.tier ?? 'FREE',
    circleId: r.family?.circleId ?? null,
    requests: r.family?.requests ?? [],
    inbox: (r.family?.messages ?? []).map((m) => ({ id: m.id, kind: m.kind, text: m.text, fromName: m.fromName, at: Date.parse(m.at) })),
  });
}

/** Instant alert for family and the dietitian (red sugar, unwell, SOS). Only the main user's own logs are shared. */
export function cloudEvent(kind: EventKind, data: Record<string, unknown> = {}) {
  if (!signedIn() || useApp.getState().cur !== 'me') return;
  const id = newId();
  useCloud.setState((c) => ({ outbox: { ...c.outbox, events: { ...c.outbox.events, [id]: { id, kind, data, at: Date.now() } } } }));
  flush();
}

/** Tells the server a meal or reading was removed on the phone (the server keeps it as deleted). */
export function cloudDelete(kind: 'meals' | 'readings' | 'vitals', id: string) {
  if (!signedIn() || useApp.getState().cur !== 'me') return;
  const me = useApp.getState().profiles.me;
  const now = Date.now();
  useCloud.setState((c) => {
    const outbox = structuredCopy(c.outbox);
    if (kind === 'meals') {
      const m = me.meals.find((x) => x.id === id);
      if (!m) return {};
      outbox.meals[id] = { id, slot: m.slot, kind: m.kind ?? 'meal', at: m.createdAt, items: m.items, updatedAt: now, deleted: true };
    } else if (kind === 'vitals') {
      const v = (me.vitals ?? []).find((x) => x.id === id);
      if (!v) return {};
      outbox.vitals = outbox.vitals ?? {};
      outbox.vitals[id] = { ...(v.kind === 'weight' ? { kind: 'weight' as const, weightKg: v.weightKg } : { kind: 'bp' as const, sys: v.sys, dia: v.dia }), id, at: v.createdAt, updatedAt: now, deleted: true };
    } else {
      const r = me.sugar.find((x) => x.id === id);
      if (!r) return {};
      outbox.readings[id] = { id, v: r.v, ctx: r.ctx, at: r.createdAt, updatedAt: now, deleted: true };
    }
    return { outbox };
  });
}

/**
 * Older app versions let a patient log lunch (or breakfast / dinner) several times a day.
 * Keeps the latest one per day and removes the rest, on the phone and on the server.
 */
export function tidyMeals() {
  const { profiles } = useApp.getState();
  const ids = Object.values(profiles).flatMap((p) => duplicateMeals([...p.meals, ...(p.late?.meals ?? [])]));
  if (!ids.length) return;
  for (const id of ids) cloudDelete('meals', id);
  useApp.getState().removeMeals(ids);
}

/** A full round: profile, outbox, then pull (also caregivers' follow list). */
export async function syncNow() {
  queue();
  await pushProfile();
  await flush();
  await pull();
  await refreshFollowing().catch(() => {});
}

/** Keeps the phone and the server in step while signed in. */
export function useCloudSync(enabled: boolean) {
  const authed = useCloud((s) => s.authed);
  useEffect(() => {
    // The stored session survives restarts; mirror it into the store once.
    if (signedIn() !== authed) useCloud.setState({ authed: signedIn() });
  }, [authed]);
  useEffect(() => {
    if (!enabled || !authed) return;
    const uid = getSession()?.user.id;
    if (uid) registerPush(uid);
    setCrashUser(uid ?? null);
    syncNow();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useApp.subscribe((s, prev) => {
      if (s.profiles.me === prev.profiles.me && s.setup === prev.setup && s.lang === prev.lang && s.day === prev.day) return;
      queue();
      clearTimeout(timer);
      timer = setTimeout(() => {
        pushProfile();
        flush();
      }, FLUSH_DELAY_MS);
    });
    const sub = AppState.addEventListener('change', (st) => st === 'active' && syncNow());
    const poll = setInterval(syncNow, POLL_MS);
    return () => {
      clearTimeout(timer);
      unsub();
      sub.remove();
      clearInterval(poll);
    };
  }, [enabled, authed]);
}
