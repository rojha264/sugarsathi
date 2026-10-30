export type Lang = 'en' | 'hi';
/** 'easy' = four giant buttons for people who find the full app too much. */
export type Mode = 'easy' | 'simple' | 'detailed';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type SugarCtx = 'fasting' | 'after' | 'random';
export type MedTime = 'morning' | 'night';
export type MedStatus = 'taken' | 'skipped' | null;
export type Diet = 'veg' | 'egg' | 'nonveg';
export type SugarEvery = 'daily' | 'every3' | 'twiceWeek' | 'weekly' | 'fortnight' | 'off';
/** How often to test sugar, counted from `from` (YYYY-MM-DD). */
export type SugarPlan = { every: SugarEvery; from: string };

/** Every log row carries sync metadata so a backend can upsert it later. */
export type Synced = { id: string; createdAt: number; updatedAt: number };

export type MealItem = { id: string; q: number };
export type MealKind = 'meal' | 'treat' | 'drink';
export type Meal = Synced & { slot: MealSlot; items: MealItem[]; c: number; p: number; kind?: MealKind };
export type SugarReading = Synced & { v: number; ctx: SugarCtx };
export type MedKind = 'tablet' | 'insulin' | 'syrup' | 'other';
export type DoseUnit = 'tab' | 'mg' | 'units' | 'ml';
/**
 * `at` is the dose's reminder time, HH:MM. `dose` + `unit` is the prescribed amount (e.g. 500 mg, 14 units);
 * `taken` is what was actually taken today when it can vary (insulin).
 */
export type Med = Synced & { n: string; t: MedTime; s: MedStatus; at: string; kind?: MedKind; dose?: number; unit?: DoseUnit; taken?: number };

/** Weight or blood pressure, kept as history (not cleared at midnight). */
export type Vital = Synced & ({ kind: 'weight'; weightKg: number } | { kind: 'bp'; sys: number; dia: number; pulse?: number });

/** Who a family profile is, so their food choices, targets and safety rules fit them (not the phone owner). */
export type CareInfo = { diet: Diet; type: DiabetesType; age: AgeGroup };

/** Regular tests a person with diabetes should not miss. */
export type Checkup = 'a1c' | 'eye' | 'foot' | 'kidney';

/** A closed-out past day. */
export type DayRecord = {
  date: string;
  score: number;
  walkMin: number;
  medTaken: number;
  medTotal: number;
  sugar: number[];
  /** Standard alcoholic drinks. */
  drinks?: number;
  /** Treat / cheat meals. */
  treats?: number;
  /** Glasses of water. */
  water?: number;
  /** The weekly grace day was used, so a low score did not break the streak. */
  grace?: boolean;
};

export type MainSlot = 'breakfast' | 'lunch' | 'dinner';

export type AdjustReason =
  | 'rHighAfter' | 'rHighRise' | 'rGoodPairs' | 'rFastingHigh' | 'rFastingOk' | 'rLowSeen' | 'rCarbsCut' | 'rCarbsBack';

/** One automatic change to a target, kept so the app can say why. */
export type Adjustment = {
  at: number;
  field: MainSlot | 'protein' | 'fiber';
  from: number;
  to: number;
  reason: AdjustReason;
  vars: { after?: number; before?: number; rise?: number; avg?: number };
};

/**
 * Carb / protein / fiber targets. `base` is the doctor's (or default) value;
 * in auto mode `slot`, `protein` and `fiber` adapt to paired sugar readings, within safe bounds.
 */
export type Targets = {
  mode: 'auto' | 'doctor';
  base: { meal: number; protein: number; fiber: number };
  /** Current carb guide per main meal, g. */
  slot: Record<MainSlot, number>;
  protein: number;
  fiber: number;
  /** Good pairs in a row per meal, for relaxing. */
  good: Record<MainSlot, number>;
  /** Last 3 fasting readings. */
  fastHist: number[];
  fastHigh: boolean;
  lastLowAt?: number;
  log: Adjustment[];
};

export type Profile = {
  id: string;
  name: string;
  av: string;
  role: 'me' | 'fam';
  why: string;
  /** Consecutive past days with score >= 60 (today not included). */
  streak: number;
  /** Past days, oldest first, capped at 30. */
  days: DayRecord[];
  meals: Meal[];
  sugar: SugarReading[];
  walkMin: number;
  steps: number;
  meds: Med[];
  /** Opted in to the safer-drinking guide. */
  alcohol: boolean;
  /** How often each food was logged, for the "Often" row. */
  freq: Record<string, number>;
  /** Per meal time: how often each food was logged, for "For you" suggestions. */
  slotFreq: Partial<Record<MealSlot, Record<string, number>>>;
  /** The last plate saved at each meal time, for "Same as last time". */
  lastMeal: Partial<Record<MealSlot, Record<string, number>>>;
  targets: Targets;
  sugarPlan: SugarPlan;
  /** Glasses of water today. */
  water: number;
  /** Week number when the grace day was last used (one per week). */
  graceWeek?: number;
  /** Tablets left, keyed by medicine name (see `medKey`); untracked names are absent. */
  stock: Record<string, number>;
  /** Date (YYYY-MM-DD) each checkup was last done. */
  checkups: Partial<Record<Checkup, string>>;
  /** Lab results entered with a checkup, e.g. HbA1c % (shown to the dietitian). */
  checkupValues?: Partial<Record<Checkup, number>>;
  /** Weight and blood pressure history, newest last (last 180 kept). */
  vitals?: Vital[];
  /** Meals and readings logged later for an earlier day ("I forgot yesterday's dinner"); kept out of today's score. */
  late?: { meals: Meal[]; sugar: SugarReading[] };
  /** Family profiles only: their own diet, diabetes type and age group. */
  care?: CareInfo;
};

export type DiabetesType = 'type2' | 'type1' | 'gdm' | 'pre' | 'care';
export type AgeGroup = 'child' | 'adult' | 'senior';
export type Goal = 'g1' | 'g2' | 'g3';

export type Setup = {
  name: string;
  type: DiabetesType;
  age: AgeGroup;
  goal: Goal;
  diet: Diet;
  /** How often the main user plans to test sugar. */
  sugarEvery: SugarEvery;
  /** Reminder times as HH:MM. */
  tw: string;
  tm: string;
  ts: string;
  /** After-meal sugar check time, HH:MM. */
  ta: string;
  /** Bigger text for older eyes. */
  textSize: TextSize;
  /** Family member to alert on a very low or high reading. */
  caregiver: { name: string; phone: string };
  /** When the user agreed to the disclaimer and data notice. */
  consentAt?: number;
  /** Which consent text was agreed to; an older one is asked again. */
  consentVer?: number;
  /** Signup baseline for the 14-day programme (asked once, editable in Settings). */
  birthYear?: number;
  sex?: Sex;
  heightCm?: number;
  weightKg?: number;
  meds?: Meds;
  flags?: RiskFlag[];
  region?: Region;
  /** Sugar entered at signup; logged as a reading when setup finishes. */
  /** @deprecated older onboarding kept one reading; use firstReadings. */
  firstReading?: { v: number; ctx: SugarCtx } | null;
  /** Readings typed at signup, one per kind (fasting / after a meal / any time); saved as real readings at the end. */
  firstReadings?: { v: number; ctx: SugarCtx }[] | null;
};

export type Sex = 'male' | 'female' | 'other';
export type Meds = 'none' | 'tablets' | 'insulin';
export type RiskFlag = 'pregnant' | 'kidney';
export type Region = 'north' | 'south' | 'east' | 'west' | 'northeast';

export type TextSize = 'normal' | 'large' | 'xl';

export type AppState = {
  lang: Lang;
  mode: Mode;
  onboarded: boolean;
  setup: Setup;
  cur: string;
  /** Local date (YYYY-MM-DD) the "today" fields belong to. */
  day: string;
  profiles: Record<string, Profile>;
};
