# Sugar Saathi

Diabetes habit companion for India: voice-first, icon-first, Hindi and English. React Native (Expo SDK 58, TypeScript, Expo Router) for Android and iOS. Built from the clickable HTML prototype.

> Not a medical device. It supports habits and logging and never gives dosing advice.

## Run

Needs a development build (speech recognition is a native module, so Expo Go will not work).

```bash
npm install
npm run android        # expo run:android  (emulator or USB device)
npm run ios            # expo run:ios      (simulator or device)
npm test               # logic tests
npm run typecheck
```

`ios/` and `android/` are generated (Continuous Native Generation) and git-ignored. Configure native behaviour in `app.json`, not in those folders.

Store builds: `npx eas-cli@latest build --platform android` (first run `eas build:configure`).

Behind a TLS-intercepting proxy, Expo CLI may fail to reach its API. Prefix commands with `EXPO_OFFLINE=1`, or set `NODE_EXTRA_CA_CERTS` to your corporate CA.

## Full stack: database, API, admin panel

Three separate projects share this repo. The app and the admin panel only talk to the API.

| Project | Folder | Local URL |
|---|---|---|
| Mobile app (Expo) | `/` | Metro on 8081 |
| API (NestJS + Prisma + PostgreSQL) | `server/` | http://localhost:4000 (Swagger at `/docs`) |
| Admin panel for dietitians (React + Vite + Refine) | `admin/` | http://localhost:5173 |
| Database browser (Adminer) | none | http://localhost:8080 (server `db`, user, password and database are all `glucobuddy`) |

```bash
./scripts/dev-certs.sh          # only behind a TLS proxy such as Zscaler: lets containers trust its root CA
docker compose up -d            # Postgres + API + admin + Adminer; migrates and seeds demo data on first start
EXPO_OFFLINE=1 EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 npx expo start   # Android emulator (iOS simulator: http://localhost:4000)
```

**Demo logins**
- Admin: `owner@glucobuddy.local` or `dietitian1@glucobuddy.local` (also `2`, `3`), password `Admin@123`.
- App: any phone number works with code `123456` while `OTP_MODE=dev` (no SMS is sent; the code screen shows a test-mode hint). Demo patients are +91 90000 00001 to 00040; caregivers +91 91000 000NN.

**Data and tests**
- Reseed: `cd server && DATABASE_URL=postgresql://glucobuddy:glucobuddy@localhost:5432/glucobuddy npx tsx prisma/seed.ts`
- SQL dump: `scripts/db-backup.sh` writes `db/`; `scripts/db-restore.sh` loads it on another machine (see [db/README.md](db/README.md))
- Tests:
  - API: `cd server && DATABASE_URL=… npm test` (end to end against the database)
  - Admin: `cd admin && npm test && npx playwright test` (browser smoke test)

**Which data comes from where**
- The app stays offline-first: logs queue on the phone and upload when online.
- Foods, nutrition, tips, exercises, food rules, targets, diet and exercise plans, and dietitian messages come from the server.
- The bundled catalog is only the first-launch fallback.
- Without `EXPO_PUBLIC_API_URL` the app runs fully offline, as before.

**Chat with the dietitian**
- The app's `chat` screen and the admin's **Chats** page (also a tab on each patient) talk both ways, with ✓ sent / ✓✓ read.
- Online means the person used the app or admin in the last 2 minutes (`User.lastActiveAt`). Both sides poll every 4–5 s; there are no websockets yet.

**Dietitian assignment**
- New patients get the active dietitian with the fewest patients when they finish onboarding. Set `AUTO_ASSIGN=off` on the API to turn this off.
- The owner can reassign on **Patients** (select rows → 👩‍⚕️ Assign dietitian) or on a patient's profile form. The Dashboard shows **Waiting for a dietitian**.

**Analytics (owner only, admin → Analytics)**
- The app reports which onboarding steps each install reached (`POST /analytics/install`, no login needed), so drop-offs before signup are counted.
- The app also records time in the foreground per screen. A break of 30 s or more starts a new visit. Visits upload with sync (`AppSession`).
- The page shows growth, DAU/WAU/MAU, stickiness, minutes per day, the funnel, weekly retention cohorts, feature use, time per screen, segments and dietitian reply times.
- Demo data: `npx tsx prisma/seed-analytics.ts --force`.
- The page also shows revenue (monthly recurring revenue, paying users, conversion, churn, money in per month), diet plan following, exercise video watching, first-week message results, and health outcomes by signup week (in range %, estimated HbA1c).

**Indian food database (`server/prisma/nutrition/`)**
- `ingredients-ifct.csv`: all 542 IFCT 2017 raw foods (ICMR-NIN), per 100 g: available carbs, protein, fat, fibre, free sugar, sodium. Built by `ifct.ts`.
- `ingredients-usda.csv`: 36 ingredients IFCT lacks (curd, sugar, salt, besan, sabudana, bread…), by USDA SR Legacy FDC id. Built by `usda.ts`.
- `dishes/*.csv`: about 470 regional home recipes, one serving each (format in `DISHES.md`).
- `build.ts` computes nutrition, validates every row and writes `build/report.md`: counts, carbs vs USDA FNDDS references (`references.csv`), and items to check.
- `prisma/seed-foods.ts` imports everything. New dishes start as **draft** and reach phones only after a dietitian verifies them (admin → Foods → Review queue).
- Rebuild: `npx tsx prisma/nutrition/build.ts && npx tsx prisma/seed-foods.ts`.

**14-day Kickstart**
- Signup asks age, sex, height, weight, HbA1c, a sugar reading, medicines, pregnancy/kidney, and home cuisine.
- The server picks a template (diet → region → medicines), scales roti/rice to the patient's calories (1200–2100 kcal), and copies it as the patient's own 14-day diet and exercise plan.
- Risky profiles (insulin, type 1, pregnancy, child, 75+, HbA1c ≥ 10, sugar ≥ 250 or < 70, kidney) wait in admin → **Kickstart** until approved.
- Results compare days 1–3 with days 12–14 (fasting, after-meal, in range, weight). HbA1c needs about 3 months, so it is not claimed.
- Templates: admin → Food & content → **14-day plans**. Rules live in `packages/shared/src/program.ts`.
- Demo data: `npx tsx prisma/seed-programs.ts` (templates) and `--demo` (sample enrolments).

**Trial → subscription (business lifecycle)**
- The free trial is the 14-day plan. Day 1 is the day a plan is shared with the patient: auto-approved at signup, approved in Kickstart, written by hand, or applied from a template. One trial per person.
- Admin → Patients has tabs: ⏳ Waiting for plan · 🆕 On trial (with "ends in N days") · ⌛ Trial ended (follow-up list) · 💰 Subscribers (with "renews in N days"). The dashboard shows trials ending in ≤ 3 days and renewals due in ≤ 7 days. Rules: `packages/shared/src/lifecycle.ts`.
- Payments are recorded by staff (UPI / cash / card / bank, amount, reference): Start subscription, Renew (starts when the current period ends) and Cancel. Each period is one `Subscription` row, so the rows double as payment history (patient page → 💳 Subscription).
- Nightly jobs:
  - An unpaid trial past day 14 closes its plan (the app shows results and the offer). A paid one becomes `converted`.
  - Expired subscriptions drop the patient to the free tier.
  - Renewal reminders go out 7 days and 1 day before the end.

**First-week messages**
- An hourly job sends a day-2 message (one version if the patient has logged nothing yet, another if they have) and a day-7 recap, only between 8 AM and 8 PM IST.
- Each goes once per patient, as an inbox notice plus a push. Copy lives in `server/src/notify/lifecycle.service.ts`.

**Crash reporting (Sentry)**
- Off unless DSNs are set: `SENTRY_DSN` (API), `VITE_SENTRY_DSN` (admin), `EXPO_PUBLIC_SENTRY_DSN` (app).
- No personal data is sent; app users are identified only by internal id.
- The app needs a new development or store build to include Sentry's native code. Release builds upload source maps when `SENTRY_AUTH_TOKEN` is set.

**SMS and push**
- Real SMS: set `OTP_MODE=msg91` with `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`. A DLT-registered template is needed in India. Dev mode (fixed code `DEV_OTP_CODE`, default 123456) is refused when `NODE_ENV=production`.
- Push: needs `eas init` and Firebase credentials. Without them, notifications still appear in the app's Messages screen.

## Screens

| Route | Screen |
|---|---|
| `onboarding/lang`, `mode`, `setup` | Language (spoken hello), Simple/Detailed mode, profile and reminder times |
| `(tabs)/index` | Today: thali score ring, streak, 4 task cards, "your why" card |
| `meal` | Mic, veg/egg/non-veg filter, food tabs (Eat first, Roti & Rice, Dal & Sabzi, Protein, Drinks & Sweets), plate coach |
| `sugar` | Number pad, fasting/after/random, green/amber/red result, emergency link |
| `walk` | Step ring, 10-minute walk timer |
| `medicine` | Taken/skipped, add medicine |
| `(tabs)/progress` | 7-day score chart, streak, badges |
| `(tabs)/family` | Caregiver mode: switch profile, add member |
| `(tabs)/report` | Weekly summary, WhatsApp share, PDF share |
| `emergency` | Offline low/high sugar steps, call 108/112 |

## Code map

- `src/logic/` pure, tested rules: score (meals 30, walk 25, medicine 25, sugar 20), sugar bands, meal verdict, voice parser, day rollover, weekly report.
- `src/logic/coach.ts` plate coach. Reads the plate and the last sugar reading (within 3 h) and returns up to 3 one-tap fixes: eat fiber first, smaller grain portion, add protein, walk reminder, lower-spike swap. Below 70 it only says "treat low sugar first" (no fiber); above 250 it leads with the emergency guide.
- `src/store/useApp.ts` Zustand store, persisted to MMKV through `src/data/repo.ts`.
- `src/native/` speech-to-text, text-to-speech, pedometer, reminders, PDF/WhatsApp/phone.
- `src/i18n/strings.ts` all copy in English and Hindi. Add a language by adding a dictionary of the same shape.
- `src/theme/tokens.ts` colours from the prototype, light and dark.

## Nutrition data

About 135 Indian foods. Each one's carbs, protein, fibre, fat and kcal are calculated from a standard home recipe, using IFCT 2017 (ICMR-NIN) raw-ingredient values, plus USDA for drinks and packaged foods. See [src/data/nutrition/SOURCES.md](src/data/nutrition/SOURCES.md). The app also has a plate-method check (½ veg, ¼ protein, ¼ grain), a per-meal carb guide (45–60 g), and daily protein and fibre targets that can be edited on the Family tab.

## Real vs mock

Real: scoring, streaks and daily rollover, local storage, speech recognition (hi-IN / en-IN), spoken feedback, phone step counter, daily local reminders, PDF and WhatsApp sharing, phone dialler.

Mock / sample: seeded family members (Papa, Maa) and their past week. "Restart demo" on the Family tab resets everything.

Known limits:
- Android step count only grows while the app is running (expo-sensors has no step history on Android). Health Connect / HealthKit is the next step.
- When voice is unavailable (permission denied, simulator without a recogniser), the meal screen falls back to the demo phrase "2 roti, 1 dal, 1 sabzi".
- Sync is last-write-wins per row (each log keeps the app's own `id`), so editing the same log on two phones at once keeps the later one.

## Before real users

Have a doctor review the sugar ranges (`src/logic/sugar.ts`) and the emergency steps, and a dietitian replace the sample food values (`src/data/foods.ts`).
