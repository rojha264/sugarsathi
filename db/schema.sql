--
-- PostgreSQL database dump
--

\restrict 8YVnKAEnHMvuAlEcssN8rVexQGHIXbslmdAvF3nriWiZlxZfwcv0mPUAgbY1b7m

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'DIETITIAN',
    'OWNER'
);


--
-- Name: Tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Tier" AS ENUM (
    'FREE',
    'BASIC',
    'PRO'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AlertSent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AlertSent" (
    "patientId" text NOT NULL,
    key text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AppEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AppEvent" (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    props jsonb DEFAULT '{}'::jsonb NOT NULL,
    at timestamp(3) without time zone NOT NULL
);


--
-- Name: AppInstall; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AppInstall" (
    id text NOT NULL,
    "userId" text,
    platform text NOT NULL,
    "appVersion" text,
    lang text,
    steps jsonb DEFAULT '{}'::jsonb NOT NULL,
    "firstSeen" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeen" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AppSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AppSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "installId" text,
    "startedAt" timestamp(3) without time zone NOT NULL,
    seconds integer NOT NULL,
    screens jsonb DEFAULT '{}'::jsonb NOT NULL,
    platform text,
    "appVersion" text
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorId" text,
    action text NOT NULL,
    entity text DEFAULT ''::text NOT NULL,
    "entityId" text DEFAULT ''::text NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CareEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CareEvent" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    kind text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    at timestamp(3) without time zone NOT NULL
);


--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "senderId" text,
    "fromStaff" boolean NOT NULL,
    text text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone
);


--
-- Name: Checkup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Checkup" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    kind text NOT NULL,
    "lastDone" text NOT NULL,
    value double precision,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Circle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Circle" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "inviteCode" text,
    "codeExpiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CircleMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CircleMember" (
    "circleId" text NOT NULL,
    "userId" text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "mutedAlerts" text[],
    lang text DEFAULT 'en'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DailyActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DailyActivity" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    date text NOT NULL,
    "walkMin" integer DEFAULT 0 NOT NULL,
    steps integer DEFAULT 0 NOT NULL,
    water integer DEFAULT 0 NOT NULL,
    score integer,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Device; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Device" (
    token text NOT NULL,
    "userId" text NOT NULL,
    platform text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DietPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DietPlan" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "dietitianId" text,
    title text NOT NULL,
    "startsOn" timestamp(3) without time zone NOT NULL,
    "endsOn" timestamp(3) without time zone,
    status text DEFAULT 'active'::text NOT NULL,
    "carbsBreakfast" integer,
    "carbsLunch" integer,
    "carbsDinner" integer,
    protein integer,
    fiber integer,
    kcal integer,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "notesHi" text DEFAULT ''::text NOT NULL,
    "titleHi" text DEFAULT ''::text NOT NULL
);


--
-- Name: DietPlanItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DietPlanItem" (
    id text NOT NULL,
    "planId" text NOT NULL,
    weekday integer,
    slot text NOT NULL,
    "foodId" text NOT NULL,
    qty double precision DEFAULT 1 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    day integer
);


--
-- Name: DietTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DietTemplate" (
    id text NOT NULL,
    title text NOT NULL,
    diet text DEFAULT 'veg'::text NOT NULL,
    kcal integer,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "notesHi" text DEFAULT ''::text NOT NULL,
    "titleHi" text DEFAULT ''::text NOT NULL
);


--
-- Name: DietTemplateItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DietTemplateItem" (
    id text NOT NULL,
    "templateId" text NOT NULL,
    weekday integer,
    slot text NOT NULL,
    "foodId" text NOT NULL,
    qty double precision DEFAULT 1 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: DietitianNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DietitianNote" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "authorId" text,
    text text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DoseLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DoseLog" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "medicationId" text NOT NULL,
    date text NOT NULL,
    status text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    amount double precision
);


--
-- Name: Enrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Enrollment" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "templateId" text,
    status text DEFAULT 'active'::text NOT NULL,
    "startsOn" text NOT NULL,
    kcal integer DEFAULT 1500 NOT NULL,
    baseline jsonb DEFAULT '{}'::jsonb NOT NULL,
    "riskReasons" text[],
    result jsonb,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "offerShownAt" timestamp(3) without time zone,
    "convertedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Exercise; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Exercise" (
    id text NOT NULL,
    emoji text NOT NULL,
    "nameEn" text NOT NULL,
    "nameHi" text NOT NULL,
    kind text NOT NULL,
    "defaultMin" integer NOT NULL,
    intensity text NOT NULL,
    "safeFor" text[],
    "stepsEn" text NOT NULL,
    "stepsHi" text NOT NULL,
    "videoUrl" text,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    videos jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: ExercisePlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExercisePlan" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "dietitianId" text,
    title text NOT NULL,
    "startsOn" timestamp(3) without time zone NOT NULL,
    "endsOn" timestamp(3) without time zone,
    status text DEFAULT 'active'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "notesHi" text DEFAULT ''::text NOT NULL,
    "titleHi" text DEFAULT ''::text NOT NULL
);


--
-- Name: ExercisePlanItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExercisePlanItem" (
    id text NOT NULL,
    "planId" text NOT NULL,
    "exerciseId" text NOT NULL,
    weekdays integer[],
    "time" text DEFAULT ''::text NOT NULL,
    minutes integer NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    day integer
);


--
-- Name: FamilyMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FamilyMessage" (
    id text NOT NULL,
    "circleId" text NOT NULL,
    "fromId" text,
    "fromName" text DEFAULT ''::text NOT NULL,
    kind text NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone
);


--
-- Name: Food; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Food" (
    id text NOT NULL,
    emoji text NOT NULL,
    "nameEn" text NOT NULL,
    "nameHi" text NOT NULL,
    aliases text[],
    diet text NOT NULL,
    "group" text NOT NULL,
    gi text NOT NULL,
    unit text NOT NULL,
    role text NOT NULL,
    "servingG" double precision NOT NULL,
    std double precision,
    sweet boolean DEFAULT false NOT NULL,
    carbs double precision NOT NULL,
    protein double precision NOT NULL,
    fiber double precision NOT NULL,
    fat double precision NOT NULL,
    kcal double precision NOT NULL,
    manual boolean DEFAULT false NOT NULL,
    sources text[],
    "imageUrl" text,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "giSource" text DEFAULT ''::text NOT NULL,
    "giValue" integer,
    measure text DEFAULT ''::text NOT NULL,
    "refCarbs" double precision,
    "refSource" text DEFAULT ''::text NOT NULL,
    regions text[],
    "reviewStatus" text DEFAULT 'verified'::text NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedById" text,
    slots text[],
    sodium double precision DEFAULT 0 NOT NULL,
    sugar double precision DEFAULT 0 NOT NULL
);


--
-- Name: FoodPick; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoodPick" (
    "patientId" text NOT NULL,
    "foodId" text NOT NULL,
    slots text[],
    note text DEFAULT ''::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "addedById" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FoodRecipe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoodRecipe" (
    "foodId" text NOT NULL,
    "ingredientId" text NOT NULL,
    grams double precision NOT NULL
);


--
-- Name: FoodRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoodRule" (
    id text NOT NULL,
    band text NOT NULL,
    ctx text DEFAULT 'any'::text NOT NULL,
    recommend text[],
    avoid text[],
    "messageEn" text NOT NULL,
    "messageHi" text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FoodSwap; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoodSwap" (
    "fromId" text NOT NULL,
    "toId" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Ingredient" (
    id text NOT NULL,
    "nameEn" text NOT NULL,
    "nameHi" text DEFAULT ''::text NOT NULL,
    carb double precision NOT NULL,
    protein double precision NOT NULL,
    fat double precision NOT NULL,
    fiber double precision NOT NULL,
    alc double precision DEFAULT 0 NOT NULL,
    source text DEFAULT ''::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "ifctCode" text,
    sodium double precision DEFAULT 0 NOT NULL,
    sugar double precision DEFAULT 0 NOT NULL
);


--
-- Name: Meal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Meal" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    slot text NOT NULL,
    kind text DEFAULT 'meal'::text NOT NULL,
    at timestamp(3) without time zone NOT NULL,
    items jsonb NOT NULL,
    carbs double precision NOT NULL,
    protein double precision NOT NULL,
    fiber double precision DEFAULT 0 NOT NULL,
    kcal double precision DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: Medication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Medication" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    name text NOT NULL,
    "time" text NOT NULL,
    stock integer,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    dose double precision,
    kind text DEFAULT 'tablet'::text NOT NULL,
    unit text
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "senderId" text,
    "titleEn" text NOT NULL,
    "titleHi" text DEFAULT ''::text NOT NULL,
    "bodyEn" text NOT NULL,
    "bodyHi" text DEFAULT ''::text NOT NULL,
    deeplink text DEFAULT '/'::text NOT NULL,
    audience jsonb NOT NULL,
    "scheduledAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentAt" timestamp(3) without time zone,
    recipients integer DEFAULT 0 NOT NULL,
    pushed integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    kind text
);


--
-- Name: NotificationReceipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationReceipt" (
    "notificationId" text NOT NULL,
    "userId" text NOT NULL,
    "readAt" timestamp(3) without time zone
);


--
-- Name: OtpRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OtpRequest" (
    id text NOT NULL,
    phone text NOT NULL,
    "codeHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Patient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Patient" (
    "userId" text NOT NULL,
    type text DEFAULT 'type2'::text NOT NULL,
    "ageGroup" text DEFAULT 'adult'::text NOT NULL,
    sex text,
    dob timestamp(3) without time zone,
    "heightCm" integer,
    "weightKg" double precision,
    diet text DEFAULT 'veg'::text NOT NULL,
    "sugarEvery" text DEFAULT 'every3'::text NOT NULL,
    "remindWalk" text DEFAULT '07:00'::text NOT NULL,
    "remindMed" text DEFAULT '08:30'::text NOT NULL,
    "remindSugar" text DEFAULT '07:30'::text NOT NULL,
    "remindAfter" text DEFAULT '14:30'::text NOT NULL,
    "consentVer" integer,
    "consentAt" timestamp(3) without time zone,
    tz text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    tier public."Tier" DEFAULT 'FREE'::public."Tier" NOT NULL,
    "tierUntil" timestamp(3) without time zone,
    "assignedDietitianId" text,
    "targetMealCarbs" integer DEFAULT 60 NOT NULL,
    "targetProtein" integer DEFAULT 60 NOT NULL,
    "targetFiber" integer DEFAULT 25 NOT NULL,
    "targetKcal" integer,
    "targetMode" text DEFAULT 'auto'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    flags text[],
    meds text DEFAULT 'none'::text NOT NULL,
    region text
);


--
-- Name: PatientStats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PatientStats" (
    "patientId" text NOT NULL,
    "lastValue" integer,
    "lastCtx" text,
    "lastAt" timestamp(3) without time zone,
    avg7 double precision,
    avg30 double precision,
    "fastingAvg7" double precision,
    "fastingAvg30" double precision,
    "afterAvg7" double precision,
    "afterAvg30" double precision,
    readings30 integer DEFAULT 0 NOT NULL,
    "inRange30" double precision,
    lows30 integer DEFAULT 0 NOT NULL,
    ea1c double precision,
    "medAdherence7" double precision,
    "walkDays7" integer DEFAULT 0 NOT NULL,
    "lastSeenAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bpDia" integer,
    "bpSys" integer,
    "vitalsAt" timestamp(3) without time zone,
    "weightKg" double precision
);


--
-- Name: ProgramDay; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProgramDay" (
    "templateId" text NOT NULL,
    day integer NOT NULL,
    "focusEn" text DEFAULT ''::text NOT NULL,
    "focusHi" text DEFAULT ''::text NOT NULL,
    "tipEn" text DEFAULT ''::text NOT NULL,
    "tipHi" text DEFAULT ''::text NOT NULL,
    "sugarCheck" text DEFAULT 'none'::text NOT NULL,
    exercises jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: ProgramMeal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProgramMeal" (
    id text NOT NULL,
    "templateId" text NOT NULL,
    day integer NOT NULL,
    slot text NOT NULL,
    "foodId" text NOT NULL,
    qty double precision DEFAULT 1 NOT NULL,
    "altGroup" text DEFAULT ''::text NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: ProgramTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProgramTemplate" (
    id text NOT NULL,
    title text NOT NULL,
    diet text NOT NULL,
    region text NOT NULL,
    risk text DEFAULT 'standard'::text NOT NULL,
    kcal integer DEFAULT 1500 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "notesHi" text DEFAULT ''::text NOT NULL,
    "titleHi" text DEFAULT ''::text NOT NULL
);


--
-- Name: Reel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Reel" (
    id text NOT NULL,
    "youtubeId" text NOT NULL,
    "titleEn" text NOT NULL,
    "titleHi" text DEFAULT ''::text NOT NULL,
    category text NOT NULL,
    lang text DEFAULT 'both'::text NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RefreshToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Segment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Segment" (
    id text NOT NULL,
    name text NOT NULL,
    filter jsonb NOT NULL,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "planId" text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "startsAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    provider text DEFAULT 'manual'::text NOT NULL,
    ref text,
    "amountInr" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text,
    note text DEFAULT ''::text NOT NULL
);


--
-- Name: SubscriptionPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubscriptionPlan" (
    id text NOT NULL,
    name text NOT NULL,
    "priceInr" integer NOT NULL,
    months integer DEFAULT 1 NOT NULL,
    features text[],
    active boolean DEFAULT true NOT NULL,
    "featuresHi" text[] DEFAULT ARRAY[]::text[],
    "nameHi" text DEFAULT ''::text NOT NULL
);


--
-- Name: SugarReading; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SugarReading" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    value integer NOT NULL,
    ctx text NOT NULL,
    at timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: Thali; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Thali" (
    id text NOT NULL,
    emoji text NOT NULL,
    "nameEn" text NOT NULL,
    "nameHi" text NOT NULL,
    diet text NOT NULL,
    slots text[],
    items jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Tip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tip" (
    id text NOT NULL,
    emoji text NOT NULL,
    en text NOT NULL,
    hi text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    phone text,
    email text,
    "passwordHash" text,
    name text DEFAULT ''::text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    lang text DEFAULT 'en'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastActiveAt" timestamp(3) without time zone
);


--
-- Name: Vital; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Vital" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    kind text NOT NULL,
    "weightKg" double precision,
    sys integer,
    dia integer,
    pulse integer,
    at timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AlertSent AlertSent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AlertSent"
    ADD CONSTRAINT "AlertSent_pkey" PRIMARY KEY ("patientId", key);


--
-- Name: AppEvent AppEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppEvent"
    ADD CONSTRAINT "AppEvent_pkey" PRIMARY KEY (id);


--
-- Name: AppInstall AppInstall_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppInstall"
    ADD CONSTRAINT "AppInstall_pkey" PRIMARY KEY (id);


--
-- Name: AppSession AppSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppSession"
    ADD CONSTRAINT "AppSession_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: CareEvent CareEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CareEvent"
    ADD CONSTRAINT "CareEvent_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: Checkup Checkup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Checkup"
    ADD CONSTRAINT "Checkup_pkey" PRIMARY KEY (id);


--
-- Name: CircleMember CircleMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CircleMember"
    ADD CONSTRAINT "CircleMember_pkey" PRIMARY KEY ("circleId", "userId");


--
-- Name: Circle Circle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Circle"
    ADD CONSTRAINT "Circle_pkey" PRIMARY KEY (id);


--
-- Name: DailyActivity DailyActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyActivity"
    ADD CONSTRAINT "DailyActivity_pkey" PRIMARY KEY (id);


--
-- Name: Device Device_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_pkey" PRIMARY KEY (token);


--
-- Name: DietPlanItem DietPlanItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietPlanItem"
    ADD CONSTRAINT "DietPlanItem_pkey" PRIMARY KEY (id);


--
-- Name: DietPlan DietPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietPlan"
    ADD CONSTRAINT "DietPlan_pkey" PRIMARY KEY (id);


--
-- Name: DietTemplateItem DietTemplateItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietTemplateItem"
    ADD CONSTRAINT "DietTemplateItem_pkey" PRIMARY KEY (id);


--
-- Name: DietTemplate DietTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietTemplate"
    ADD CONSTRAINT "DietTemplate_pkey" PRIMARY KEY (id);


--
-- Name: DietitianNote DietitianNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietitianNote"
    ADD CONSTRAINT "DietitianNote_pkey" PRIMARY KEY (id);


--
-- Name: DoseLog DoseLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DoseLog"
    ADD CONSTRAINT "DoseLog_pkey" PRIMARY KEY (id);


--
-- Name: Enrollment Enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_pkey" PRIMARY KEY (id);


--
-- Name: ExercisePlanItem ExercisePlanItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExercisePlanItem"
    ADD CONSTRAINT "ExercisePlanItem_pkey" PRIMARY KEY (id);


--
-- Name: ExercisePlan ExercisePlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExercisePlan"
    ADD CONSTRAINT "ExercisePlan_pkey" PRIMARY KEY (id);


--
-- Name: Exercise Exercise_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Exercise"
    ADD CONSTRAINT "Exercise_pkey" PRIMARY KEY (id);


--
-- Name: FamilyMessage FamilyMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FamilyMessage"
    ADD CONSTRAINT "FamilyMessage_pkey" PRIMARY KEY (id);


--
-- Name: FoodPick FoodPick_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodPick"
    ADD CONSTRAINT "FoodPick_pkey" PRIMARY KEY ("patientId", "foodId");


--
-- Name: FoodRecipe FoodRecipe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodRecipe"
    ADD CONSTRAINT "FoodRecipe_pkey" PRIMARY KEY ("foodId", "ingredientId");


--
-- Name: FoodRule FoodRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodRule"
    ADD CONSTRAINT "FoodRule_pkey" PRIMARY KEY (id);


--
-- Name: FoodSwap FoodSwap_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodSwap"
    ADD CONSTRAINT "FoodSwap_pkey" PRIMARY KEY ("fromId");


--
-- Name: Food Food_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Food"
    ADD CONSTRAINT "Food_pkey" PRIMARY KEY (id);


--
-- Name: Ingredient Ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ingredient"
    ADD CONSTRAINT "Ingredient_pkey" PRIMARY KEY (id);


--
-- Name: Meal Meal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Meal"
    ADD CONSTRAINT "Meal_pkey" PRIMARY KEY (id);


--
-- Name: Medication Medication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Medication"
    ADD CONSTRAINT "Medication_pkey" PRIMARY KEY (id);


--
-- Name: NotificationReceipt NotificationReceipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationReceipt"
    ADD CONSTRAINT "NotificationReceipt_pkey" PRIMARY KEY ("notificationId", "userId");


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OtpRequest OtpRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OtpRequest"
    ADD CONSTRAINT "OtpRequest_pkey" PRIMARY KEY (id);


--
-- Name: PatientStats PatientStats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatientStats"
    ADD CONSTRAINT "PatientStats_pkey" PRIMARY KEY ("patientId");


--
-- Name: Patient Patient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Patient"
    ADD CONSTRAINT "Patient_pkey" PRIMARY KEY ("userId");


--
-- Name: ProgramDay ProgramDay_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramDay"
    ADD CONSTRAINT "ProgramDay_pkey" PRIMARY KEY ("templateId", day);


--
-- Name: ProgramMeal ProgramMeal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramMeal"
    ADD CONSTRAINT "ProgramMeal_pkey" PRIMARY KEY (id);


--
-- Name: ProgramTemplate ProgramTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramTemplate"
    ADD CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Reel Reel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reel"
    ADD CONSTRAINT "Reel_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: Segment Segment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Segment"
    ADD CONSTRAINT "Segment_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionPlan SubscriptionPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: SugarReading SugarReading_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SugarReading"
    ADD CONSTRAINT "SugarReading_pkey" PRIMARY KEY (id);


--
-- Name: Thali Thali_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Thali"
    ADD CONSTRAINT "Thali_pkey" PRIMARY KEY (id);


--
-- Name: Tip Tip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tip"
    ADD CONSTRAINT "Tip_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Vital Vital_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vital"
    ADD CONSTRAINT "Vital_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AppEvent_name_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AppEvent_name_at_idx" ON public."AppEvent" USING btree (name, at);


--
-- Name: AppEvent_userId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AppEvent_userId_at_idx" ON public."AppEvent" USING btree ("userId", at);


--
-- Name: AppInstall_firstSeen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AppInstall_firstSeen_idx" ON public."AppInstall" USING btree ("firstSeen");


--
-- Name: AppSession_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AppSession_startedAt_idx" ON public."AppSession" USING btree ("startedAt");


--
-- Name: AppSession_userId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AppSession_userId_startedAt_idx" ON public."AppSession" USING btree ("userId", "startedAt");


--
-- Name: AuditLog_actorId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorId_at_idx" ON public."AuditLog" USING btree ("actorId", at);


--
-- Name: CareEvent_patientId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CareEvent_patientId_at_idx" ON public."CareEvent" USING btree ("patientId", at);


--
-- Name: ChatMessage_patientId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatMessage_patientId_createdAt_idx" ON public."ChatMessage" USING btree ("patientId", "createdAt");


--
-- Name: CircleMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CircleMember_userId_idx" ON public."CircleMember" USING btree ("userId");


--
-- Name: Circle_inviteCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Circle_inviteCode_key" ON public."Circle" USING btree ("inviteCode");


--
-- Name: Circle_patientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Circle_patientId_key" ON public."Circle" USING btree ("patientId");


--
-- Name: DailyActivity_patientId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DailyActivity_patientId_date_idx" ON public."DailyActivity" USING btree ("patientId", date);


--
-- Name: DietPlan_patientId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DietPlan_patientId_status_idx" ON public."DietPlan" USING btree ("patientId", status);


--
-- Name: DoseLog_patientId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DoseLog_patientId_date_idx" ON public."DoseLog" USING btree ("patientId", date);


--
-- Name: Enrollment_patientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Enrollment_patientId_idx" ON public."Enrollment" USING btree ("patientId");


--
-- Name: Enrollment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Enrollment_status_idx" ON public."Enrollment" USING btree (status);


--
-- Name: ExercisePlan_patientId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExercisePlan_patientId_status_idx" ON public."ExercisePlan" USING btree ("patientId", status);


--
-- Name: Meal_patientId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Meal_patientId_at_idx" ON public."Meal" USING btree ("patientId", at);


--
-- Name: NotificationReceipt_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationReceipt_userId_idx" ON public."NotificationReceipt" USING btree ("userId");


--
-- Name: OtpRequest_phone_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OtpRequest_phone_createdAt_idx" ON public."OtpRequest" USING btree (phone, "createdAt");


--
-- Name: PatientStats_afterAvg7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PatientStats_afterAvg7_idx" ON public."PatientStats" USING btree ("afterAvg7");


--
-- Name: PatientStats_avg7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PatientStats_avg7_idx" ON public."PatientStats" USING btree (avg7);


--
-- Name: PatientStats_fastingAvg7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PatientStats_fastingAvg7_idx" ON public."PatientStats" USING btree ("fastingAvg7");


--
-- Name: Patient_assignedDietitianId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Patient_assignedDietitianId_idx" ON public."Patient" USING btree ("assignedDietitianId");


--
-- Name: ProgramMeal_templateId_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProgramMeal_templateId_day_idx" ON public."ProgramMeal" USING btree ("templateId", day);


--
-- Name: Reel_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Reel_updatedAt_idx" ON public."Reel" USING btree ("updatedAt");


--
-- Name: RefreshToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: Subscription_patientId_endsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_patientId_endsAt_idx" ON public."Subscription" USING btree ("patientId", "endsAt");


--
-- Name: SugarReading_patientId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SugarReading_patientId_at_idx" ON public."SugarReading" USING btree ("patientId", at);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: Vital_patientId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vital_patientId_at_idx" ON public."Vital" USING btree ("patientId", at);


--
-- Name: AppEvent AppEvent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppEvent"
    ADD CONSTRAINT "AppEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AppInstall AppInstall_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppInstall"
    ADD CONSTRAINT "AppInstall_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AppSession AppSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppSession"
    ADD CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CareEvent CareEvent_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CareEvent"
    ADD CONSTRAINT "CareEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Checkup Checkup_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Checkup"
    ADD CONSTRAINT "Checkup_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CircleMember CircleMember_circleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CircleMember"
    ADD CONSTRAINT "CircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES public."Circle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CircleMember CircleMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CircleMember"
    ADD CONSTRAINT "CircleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Circle Circle_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Circle"
    ADD CONSTRAINT "Circle_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DailyActivity DailyActivity_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyActivity"
    ADD CONSTRAINT "DailyActivity_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Device Device_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DietPlanItem DietPlanItem_foodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietPlanItem"
    ADD CONSTRAINT "DietPlanItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DietPlanItem DietPlanItem_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietPlanItem"
    ADD CONSTRAINT "DietPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."DietPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DietPlan DietPlan_dietitianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietPlan"
    ADD CONSTRAINT "DietPlan_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DietPlan DietPlan_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietPlan"
    ADD CONSTRAINT "DietPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DietTemplateItem DietTemplateItem_foodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietTemplateItem"
    ADD CONSTRAINT "DietTemplateItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DietTemplateItem DietTemplateItem_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietTemplateItem"
    ADD CONSTRAINT "DietTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."DietTemplate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DietitianNote DietitianNote_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietitianNote"
    ADD CONSTRAINT "DietitianNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DietitianNote DietitianNote_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DietitianNote"
    ADD CONSTRAINT "DietitianNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoseLog DoseLog_medicationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DoseLog"
    ADD CONSTRAINT "DoseLog_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES public."Medication"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DoseLog DoseLog_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DoseLog"
    ADD CONSTRAINT "DoseLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Enrollment Enrollment_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Enrollment Enrollment_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."ProgramTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ExercisePlanItem ExercisePlanItem_exerciseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExercisePlanItem"
    ADD CONSTRAINT "ExercisePlanItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES public."Exercise"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExercisePlanItem ExercisePlanItem_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExercisePlanItem"
    ADD CONSTRAINT "ExercisePlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."ExercisePlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExercisePlan ExercisePlan_dietitianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExercisePlan"
    ADD CONSTRAINT "ExercisePlan_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ExercisePlan ExercisePlan_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExercisePlan"
    ADD CONSTRAINT "ExercisePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FamilyMessage FamilyMessage_circleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FamilyMessage"
    ADD CONSTRAINT "FamilyMessage_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES public."Circle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FamilyMessage FamilyMessage_fromId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FamilyMessage"
    ADD CONSTRAINT "FamilyMessage_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FoodPick FoodPick_addedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodPick"
    ADD CONSTRAINT "FoodPick_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FoodPick FoodPick_foodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodPick"
    ADD CONSTRAINT "FoodPick_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodPick FoodPick_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodPick"
    ADD CONSTRAINT "FoodPick_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodRecipe FoodRecipe_foodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodRecipe"
    ADD CONSTRAINT "FoodRecipe_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodRecipe FoodRecipe_ingredientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodRecipe"
    ADD CONSTRAINT "FoodRecipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES public."Ingredient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FoodSwap FoodSwap_fromId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodSwap"
    ADD CONSTRAINT "FoodSwap_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodSwap FoodSwap_toId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodSwap"
    ADD CONSTRAINT "FoodSwap_toId_fkey" FOREIGN KEY ("toId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Meal Meal_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Meal"
    ADD CONSTRAINT "Meal_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Medication Medication_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Medication"
    ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationReceipt NotificationReceipt_notificationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationReceipt"
    ADD CONSTRAINT "NotificationReceipt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES public."Notification"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationReceipt NotificationReceipt_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationReceipt"
    ADD CONSTRAINT "NotificationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PatientStats PatientStats_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatientStats"
    ADD CONSTRAINT "PatientStats_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Patient Patient_assignedDietitianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Patient"
    ADD CONSTRAINT "Patient_assignedDietitianId_fkey" FOREIGN KEY ("assignedDietitianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Patient Patient_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Patient"
    ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProgramDay ProgramDay_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramDay"
    ADD CONSTRAINT "ProgramDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."ProgramTemplate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProgramMeal ProgramMeal_foodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramMeal"
    ADD CONSTRAINT "ProgramMeal_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES public."Food"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramMeal ProgramMeal_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramMeal"
    ADD CONSTRAINT "ProgramMeal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."ProgramTemplate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."SubscriptionPlan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SugarReading SugarReading_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SugarReading"
    ADD CONSTRAINT "SugarReading_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Vital Vital_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vital"
    ADD CONSTRAINT "Vital_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"("userId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8YVnKAEnHMvuAlEcssN8rVexQGHIXbslmdAvF3nriWiZlxZfwcv0mPUAgbY1b7m

