import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { FOOD_BY_ID, isDrinkOnly } from '@/data/foods';
import { repo } from '@/data/repo';
import { newProfile, seed } from '@/data/seed';
import { rollover } from '@/logic/day';
import { addDays, dayDate, localDate, newId } from '@/logic/ids';
import { loggedMeal, totals, type Basket } from '@/logic/meal';
import { CONSENT_VERSION } from '@/logic/backup';
import { careFlags } from '@/logic/care';
import { afterDose, defaultMedTime, medKey } from '@/logic/meds';
import { adaptTargets, withBase, type Adapted } from '@/logic/smartTargets';
import { rememberMeal } from '@/logic/usual';
import { migrate, normalize } from './migrate';
import type { AppState, CareInfo, Checkup, DoseUnit, Lang, Med, MealKind, MedKind, SugarEvery, Targets, MealSlot, Meal, MedStatus, MedTime, Mode, Profile, Setup, SugarCtx } from '@/types';

const VITALS_KEEP = 180;
/** Typical times used when someone logs a meal or reading for an earlier day. */
const SLOT_TIME: Record<MealSlot, string> = { breakfast: '08:30', lunch: '13:30', snack: '17:00', dinner: '20:30' };
const CTX_TIME: Record<SugarCtx, string> = { fasting: '07:30', after: '15:30', random: '12:00' };
const lateTime = (today: string, daysAgo: number, hhmm: string) => {
  const d = dayDate(addDays(today, -daysAgo));
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/** Kind of a logged plate: any alcohol makes it a drink; treat items make it a treat. */
export function mealKind(ids: string[]): MealKind {
  if (ids.some((id) => FOOD_BY_ID[id]?.group === 'alcohol')) return 'drink';
  if (ids.some((id) => FOOD_BY_ID[id]?.group === 'treat')) return 'treat';
  return 'meal';
}

type Actions = {
  setLang(lang: Lang): void;
  setMode(mode: Mode): void;
  finishSetup(setup: Setup): void;
  setWhy(why: string): void;
  /** Edits settings after onboarding; keeps the main profile's name and sugar plan in step. */
  updateSetup(patch: Partial<Setup>): void;
  /** Adds or removes glasses of water today (never below 0). */
  addWater(delta: number): void;
  /** `daysAgo` > 0 logs a meal for an earlier day (kept out of today's score). */
  /** Breakfast, lunch and dinner are once a day: logging one again replaces that day's entry ('updated'). */
  addMeal(slot: MealSlot, basket: Basket, daysAgo?: number): 'added' | 'updated' | null;
  /** Saves a reading and adapts targets; returns what changed so the screen can explain it. */
  addSugar(v: number, ctx: SugarCtx, daysAgo?: number): Adapted;
  /** Removes a wrongly logged meal or reading from today (synced as a delete). */
  removeMeal(id: string): void;
  /** Removes several meals at once (old duplicate lunches etc.); every profile is checked. */
  removeMeals(ids: string[]): void;
  removeSugar(id: string): void;
  /** `amount` records what was actually taken (insulin units). */
  setMed(index: number, status: Exclude<MedStatus, null>, amount?: number): void;
  addMed(name: string, t: MedTime, dose?: { kind: MedKind; dose?: number; unit?: DoseUnit }): void;
  /** Changes a medicine's kind or prescribed dose. */
  updateMed(index: number, patch: Partial<Pick<Med, 'kind' | 'dose' | 'unit' | 'n'>>): void;
  addVital(v: { kind: 'weight'; weightKg: number } | { kind: 'bp'; sys: number; dia: number; pulse?: number }): void;
  removeVital(id: string): void;
  /** A family member's own diet, diabetes type and age group. */
  setCare(id: string, care: Partial<CareInfo>): void;
  setMedTime(index: number, at: string): void;
  removeMed(index: number): void;
  /** Tablets left for a medicine name; undefined stops tracking. */
  setStock(name: string, left: number | undefined): void;
  /** Records when a checkup was last done (YYYY-MM-DD). */
  markCheckup(id: Checkup, date: string): void;
  /** Saves a lab result for a checkup (HbA1c %). */
  setCheckupValue(id: Checkup, value: number | undefined): void;
  /** Agrees to the current consent text. */
  agreeConsent(): void;
  /** Replaces everything with a backup's data. */
  restore(state: AppState): void;
  addWalk(minutes: number, steps: number): void;
  setMySteps(steps: number): void;
  setAlcohol(id: string, on: boolean): void;
  setTargetBase(id: string, base: Targets['base'], mode: Targets['mode']): void;
  /** Changes how often a profile tests sugar; the schedule restarts from today. */
  setSugarEvery(id: string, every: SugarEvery): void;
  switchProfile(id: string): void;
  addMember(name: string, care?: CareInfo): void;
  checkDay(): void;
  restart(): void;
};

export type Store = AppState & Actions;

export const useApp = create<Store>()(
  persist(
    (set, get) => {
      /** Updates one profile; unknown ids leave state untouched. */
      const patch = (id: string, fn: (p: Profile) => Partial<Profile>) =>
        set((s) => {
          const p = s.profiles[id];
          return p ? { profiles: { ...s.profiles, [id]: { ...p, ...fn(p) } } } : s;
        });
      const patch_ = (id: string, fields: Partial<Profile>) => patch(id, () => fields);
      /** Updates the profile currently being logged for. */
      const patchCur = (fn: (p: Profile) => Partial<Profile>) => patch(get().cur, fn);

      return {
        ...seed(),

        setLang: (lang) => set({ lang }),
        setMode: (mode) => set({ mode }),

        finishSetup: (setup) =>
          set((s) => ({
            setup,
            onboarded: true,
            profiles: {
              ...s.profiles,
              me: {
                ...s.profiles.me,
                name: setup.name.trim(),
                sugarPlan: { every: setup.sugarEvery, from: s.day },
                // Morning doses start at the medicine time chosen in setup.
                meds: s.profiles.me.meds.map((m) => (m.t === 'morning' ? { ...m, at: setup.tm } : m)),
              },
            },
          })),

        setWhy: (why) => patchCur(() => ({ why: why.trim() })),

        updateSetup: (patch) => {
          const s = get();
          const setup = { ...s.setup, ...patch };
          set({ setup });
          if (patch.name !== undefined) patch_('me', { name: patch.name.trim() });
          if (patch.sugarEvery && patch.sugarEvery !== s.profiles.me.sugarPlan.every) patch_('me', { sugarPlan: { every: patch.sugarEvery, from: s.day } });
        },

        addWater: (delta) => patchCur((p) => ({ water: Math.max(0, Math.min(20, p.water + delta)) })),

        addMeal: (slot, basket, daysAgo = 0) => {
          const ids = Object.keys(basket).filter((id) => FOOD_BY_ID[id] && basket[id] > 0);
          if (!ids.length) return null;
          const t = totals(basket);
          const s = get();
          const now = daysAgo > 0 ? lateTime(s.day, daysAgo, SLOT_TIME[slot]) : Date.now();
          const kind = mealKind(ids);
          // Drinks with no food don't count as one of the day's meals.
          const onlyDrinks = ids.every((id) => isDrinkOnly(FOOD_BY_ID[id]));
          const mealSlot = onlyDrinks ? 'snack' : slot;
          const cur = s.profiles[s.cur];
          const list = daysAgo > 0 ? (cur.late?.meals ?? []) : cur.meals;
          const prev = loggedMeal(list, mealSlot, addDays(s.day, -daysAgo));
          const fields = { updatedAt: Date.now(), slot: mealSlot, kind, items: ids.map((id) => ({ id, q: basket[id] })), c: t.c, p: t.p };
          // Same id, so the server updates the row instead of adding a second lunch.
          const meal = prev ? { ...prev, ...fields } : { id: newId(), createdAt: now, ...fields };
          const put = (ms: Meal[]) => (prev ? ms.map((m) => (m.id === prev.id ? meal : m)) : [...ms, meal]);
          patchCur((p) =>
            daysAgo > 0
              ? { ...rememberMeal(p, mealSlot, basket), late: { meals: put(p.late?.meals ?? []), sugar: p.late?.sugar ?? [] } }
              : { ...rememberMeal(p, mealSlot, basket), meals: put(p.meals) },
          );
          return prev ? 'updated' : 'added';
        },

        addSugar: (v, ctx, daysAgo = 0) => {
          const s = get();
          if (daysAgo > 0) {
            // A reading for an earlier day goes into that day's history only: no target changes, no alerts.
            const at = lateTime(s.day, daysAgo, CTX_TIME[ctx]);
            const reading = { id: newId(), createdAt: at, updatedAt: Date.now(), v, ctx };
            const date = addDays(s.day, -daysAgo);
            patchCur((p) => ({
              late: { meals: p.late?.meals ?? [], sugar: [...(p.late?.sugar ?? []), reading] },
              days: p.days.map((d) => (d.date === date ? { ...d, sugar: [...d.sugar, v] } : d)),
            }));
            return { targets: s.profiles[s.cur].targets, changes: [], pair: null, paused: null };
          }
          const now = Date.now();
          const reading = { id: newId(), createdAt: now, updatedAt: now, v, ctx };
          const p = s.profiles[s.cur];
          const result = adaptTargets(p.targets, {
            setup: careFlags(s.cur, s.setup, p.care).targetSetup,
            reading,
            meals: p.meals,
            readings: p.sugar,
          });
          patchCur((cur) => ({ sugar: [...cur.sugar, reading], targets: result.targets }));
          return result;
        },

        removeMeal: (id) => patchCur((p) => ({ meals: p.meals.filter((m) => m.id !== id) })),
        removeMeals: (ids) => {
          if (!ids.length) return;
          const gone = new Set(ids);
          set((s) => ({
            profiles: Object.fromEntries(
              Object.entries(s.profiles).map(([k, p]) => [k, { ...p, meals: p.meals.filter((m) => !gone.has(m.id)), ...(p.late ? { late: { ...p.late, meals: p.late.meals.filter((m) => !gone.has(m.id)) } } : {}) }]),
            ) as typeof s.profiles,
          }));
        },
        removeSugar: (id) => patchCur((p) => ({ sugar: p.sugar.filter((r) => r.id !== id) })),

        setMed: (index, status, amount) =>
          patchCur((p) => {
            const m = p.meds[index];
            if (!m) return {};
            const next = m.s === status && amount === undefined ? null : status;
            const taken = next === 'taken' ? (amount ?? m.dose) : undefined;
            return {
              meds: p.meds.map((x, i) => (i === index ? { ...x, s: next, taken, updatedAt: Date.now() } : x)),
              stock: afterDose(p.stock, m.n, m.s, next),
            };
          }),

        addMed: (name, t, dose) => {
          const now = Date.now();
          const at = defaultMedTime(t, get().setup.tm);
          patchCur((p) => ({ meds: [...p.meds, { id: newId(), createdAt: now, updatedAt: now, n: name.trim(), t, s: null, at, ...dose }] }));
        },

        updateMed: (index, patch) => patchCur((p) => ({ meds: p.meds.map((m, i) => (i === index ? { ...m, ...patch, updatedAt: Date.now() } : m)) })),

        addVital: (v) => {
          const now = Date.now();
          patchCur((p) => ({ vitals: [...(p.vitals ?? []), { id: newId(), createdAt: now, updatedAt: now, ...v }].slice(-VITALS_KEEP) }));
        },

        removeVital: (id) => patchCur((p) => ({ vitals: (p.vitals ?? []).filter((v) => v.id !== id) })),

        setCare: (id, care) =>
          patch(id, (p) => ({ care: { ...(p.care ?? { diet: get().setup.diet, type: 'type2', age: 'senior' }), ...care } })),

        setMedTime: (index, at) =>
          patchCur((p) => ({ meds: p.meds.map((m, i) => (i === index ? { ...m, at, t: at < '15:00' ? 'morning' : 'night', updatedAt: Date.now() } : m)) })),

        removeMed: (index) => patchCur((p) => ({ meds: p.meds.filter((_, i) => i !== index) })),

        setStock: (name, left) =>
          patchCur((p) => {
            const { [medKey(name)]: _, ...rest } = p.stock;
            return { stock: left === undefined ? rest : { ...rest, [medKey(name)]: Math.max(0, Math.round(left)) } };
          }),

        markCheckup: (id, date) => patchCur((p) => ({ checkups: { ...p.checkups, [id]: date } })),
        setCheckupValue: (id, value) => patchCur((p) => ({ checkupValues: { ...p.checkupValues, [id]: value } })),

        agreeConsent: () => set((s) => ({ setup: { ...s.setup, consentAt: Date.now(), consentVer: CONSENT_VERSION } })),

        restore: (state) => {
          const s = normalize(JSON.parse(JSON.stringify(state)));
          set({ lang: s.lang, mode: s.mode, onboarded: s.onboarded, setup: s.setup, cur: s.profiles[s.cur] ? s.cur : 'me', day: s.day, profiles: s.profiles });
          get().checkDay();
        },

        addWalk: (minutes, steps) => patchCur((p) => ({ walkMin: p.walkMin + minutes, steps: p.steps + steps })),

        setMySteps: (steps) => {
          if (get().profiles.me.steps !== steps) patch('me', () => ({ steps }));
        },

        setAlcohol: (id, on) => patch(id, () => ({ alcohol: on })),

        setSugarEvery: (id, every) => {
          const day = get().day;
          patch(id, () => ({ sugarPlan: { every, from: day } }));
          if (id === 'me') set((s) => ({ setup: { ...s.setup, sugarEvery: every } }));
        },

        setTargetBase: (id, base, mode) => patch(id, (p) => ({ targets: withBase(p.targets, base, mode) })),

        switchProfile: (id) => {
          if (get().profiles[id]) set({ cur: id });
        },

        addMember: (name, care) => {
          const id = 'm' + newId();
          set((s) => ({ profiles: { ...s.profiles, [id]: { ...newProfile(id, name.trim(), '🙂', s.day), care: care ?? { diet: s.setup.diet, type: 'type2', age: 'senior' } } } }));
        },

        checkDay: () => {
          const today = localDate();
          if (get().day !== today) set((s) => rollover(s, today));
        },

        restart: () => {
          repo.clear();
          set(seed());
        },
      };
    },
    {
      name: 'glucobuddy-state',
      version: 9,
      storage: createJSONStorage(() => repo),
      migrate,
      // Also fill gaps when the version number already matches (e.g. data saved mid-upgrade).
      merge: (persisted, current) => ({ ...current, ...normalize(persisted) }),
      partialize: (s): AppState => ({
        lang: s.lang, mode: s.mode, onboarded: s.onboarded, setup: s.setup, cur: s.cur, day: s.day, profiles: s.profiles,
      }),
    },
  ),
);

export const useProfile = () => useApp((s) => s.profiles[s.cur]);

/** Food preference of whoever is being logged for (a family member keeps their own). */
/** Diabetes type of the person being logged for (pregnancy changes the sugar targets). */
export const useDiabetesType = () => useApp((s) => (s.cur === 'me' ? s.setup.type : s.profiles[s.cur]?.care?.type));
export const useDiet = () => useApp((s) => (s.cur === 'me' ? s.setup.diet : (s.profiles[s.cur]?.care?.diet ?? s.setup.diet)));
