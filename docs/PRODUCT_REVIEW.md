# 🧭 Sugar Saathi product review

**A product, design and business review of Sugar Saathi, the diabetes companion for Indian patients: what is strong, what was fixed this round, and what to build next to grow it into a startup.**

| Reviewed | Scope | Lenses |
|---|---|---|
| 27 Oct 2026 | Patient app, admin panel, API | Product manager · UI/UX lead · business head |

> [!NOTE]
> Scores below are judgement calls from reading the code and using the app, not user research. Validate the top items with 10–15 real patients (especially people over 55 and Hindi-first users) before large bets.

---

## 📊 Scorecard

| | Area | Score | In one line |
|:-:|---|:-:|---|
| 🩺 | **Clinical safety** | 8 / 10 | Offline emergency steps, never suggests insulin doses; pregnancy and very-low gaps now fixed |
| 👵 | **Ease of use** | 8 / 10 | Easy mode, voice, big buttons; onboarding is still 6–8 screens |
| 🗣️ | **Hindi + English** | 9 / 10 | App and server content now bilingual end to end |
| 🔁 | **Retention** | 6 / 10 | Streaks, reminders, day 2/7/14/30 and win-back messages; no community yet |
| 🎬 | **Education** | 6 / 10 | New Learn tab (reels); needs a content team feeding it weekly |
| 💰 | **Monetization** | 3 / 10 | Plans exist but payment is manual (staff record UPI); no in-app checkout |
| 📣 | **Growth** | 4 / 10 | WhatsApp sharing and invites; no referral rewards or attribution |
| 🧑‍⚕️ | **Dietitian tools** | 8 / 10 | Plans, 14-day Kickstart, chat, analytics, bilingual content editors |
| 🔌 | **Integrations** | 2 / 10 | No glucometer, Health Connect / HealthKit, or lab-report upload |

---

## 💪 What is already strong

- **Built for the real user.** Hindi-first, voice logging, Easy mode with four big buttons, read-aloud. Few Indian apps do this well.
- **Works offline.** Logging, reminders and the emergency guide work without the internet or even an account.
- **Human in the loop.** A real dietitian with plans, chat and a 14-day Kickstart is the product's moat and the reason people will pay.
- **Safety-minded.** Hypo and hyper guides offline, family alerts, never suggests insulin doses, a consent and data-export flow for India's data protection law (the DPDP Act).
- **Business plumbing.** Trial → subscriber stages, revenue and retention analytics, and staff roles are already in the admin panel.

---

## ✅ Fixed in this round

| | Gap found | What changed |
|:-:|---|---|
| 🤰 | Pregnancy (GDM) used normal targets: fasting 120 showed green | GDM targets: fasting ≤ 95, 2 h after a meal ≤ 120 (DIPSI) |
| 🆘 | No separate "very low" level | Below 54 mg/dL: urgent spoken warning and the emergency steps open by themselves |
| 👨‍👩‍👧 | Family alert only above 300, app showed red above 250 | Family is alerted on the same readings the app shows in red, plus "very low" |
| 🎬 | No learning content except exercise videos | **Reels**: a Learn tab with short YouTube videos curated in admin (below) |
| 📬 | Chat badge counted notices but opened chat; inbox was hidden | Separate **Messages** button with its own count |
| 🧹 | "Restart demo" (wipes everything) sat on the Family tab | Moved to **Settings → Danger zone**, asks twice, renamed |
| 🚶 | Walks without the phone could not be logged | "Already walked? +10 / 15 / 20 / 30 min" |
| 🔔 | The system asked for notifications with no explanation | A short reason in the user's language first, then the system prompt; asks again a week later at most |
| 🔢 | Onboarding said "Step 1 of 3" on screen 5 | One step bar counts every screen consistently |
| 💡 | Easy mode had no daily tip | Tip card (tap to hear it) plus the reels card on both home screens |
| 🏅 | Only 3 badges, none after 30 days | 9 badges, from a first sugar check up to 100 days, with a "next badge" goal |
| 💌 | Silence after day 9 | Day 14 and day 30 messages, and "We miss you" after 3 quiet days (at most every 14 days) |
| 📤 | No way to invite anyone | "Invite a friend" on WhatsApp in Settings and on the results screen |
| ⭐ | No store rating prompt | Asked once, after a good week, never after a worrying reading |
| 🧪 | Demo-speed switch visible to real users | Developer builds only |
| ♿ | Small "⋯" target, English screen-reader labels, results flashed "not yet" while loading | 44 px targets, translated labels, a loading state |

---

## 🎬 Reels: the Learn tab

**How it works**
1. Staff open **admin → Food & content → Reels** and paste any YouTube or Shorts link.
2. They give it a title in English and Hindi, a category (Learn, Recipes, Exercise, Myths & facts, Real stories) and the language spoken. Optionally they mark it featured or tell patients now.
3. Phones get it on their next sync. Patients swipe up through videos, save with ❤️ and share on WhatsApp.
4. Admin → Analytics shows views, watch time, saves and shares, plus the top reels.

**Built to YouTube's embed rules and for Indian phones**
- Only the reel on screen loads, so scrolling stays smooth on cheap phones.
- On mobile data, videos wait for a tap instead of autoplaying, which saves the user's data.
- Nothing is drawn over the player, and the app identifies itself to YouTube as `com.sugarsaathi.app`.

> [!TIP]
> **Content plan for launch: 30 reels before go-live, then 3 new ones a week.**
> - About half in Hindi.
> - Mix: 10 Learn, 8 Recipes (Indian, low-GI), 6 Exercise, 4 Myths, 2 Real stories.
> - Best source: **your own dietitians filming 60-second Shorts on your own YouTube channel.** This builds the brand, the same video works on Instagram, and you never depend on someone else's video staying online.

> [!WARNING]
> Only use videos whose owners allow embedding, from credible sources (doctors, hospitals, registered dietitians). A wrong medical claim in a reel is a reputational risk, so have a clinician sign off every video.

---

## 🧭 Roadmap

| | When | What | Why it matters |
|:-:|---|---|---|
| 💳 | **Now** | In-app UPI checkout (Razorpay / Cashfree) for the ₹299 / ₹799 plans | Today a payment needs a staff member; every manual step loses buyers |
| 🎁 | **Now** | Referral rewards: invite code, "1 month free for both" | WhatsApp sharing is the cheapest growth channel in India |
| 🩸 | **Now** | Lab-report photo upload (HbA1c, lipids, kidney) for the dietitian | Patients already carry paper reports; it saves typing and builds trust |
| ⌚ | **Next** | Health Connect (Android) and HealthKit (iOS) for steps | Accurate walks without the app open |
| 📶 | **Next** | Bluetooth glucometers (Accu-Chek, Dr Morepen, OneTouch) | No typing errors; a big differentiator for elders |
| 🗣️ | **Next** | Tamil, Telugu, Bengali, Marathi | Opens South and East India (the text system already supports more languages) |
| 🤖 | **Next** | WhatsApp bot: log sugar by sending a number, get the weekly report | Reaches people who will not open an app daily |
| 🪔 | **Next** | Festival and fasting modes (Navratri, Ramzan, Karva Chauth) | Peak risk days for lows; a strong content and marketing hook |
| 👥 | **Later** | Moderated community groups by city and language | Peer support lifts retention; needs moderators |
| 🏥 | **Later** | Doctor portal and ABHA (Ayushman Bharat health ID) record sharing | Doctors recommend apps that make their job easier |
| 🏢 | **Later** | B2B: clinics, pharmacies, insurers, employers | Lower acquisition cost and bulk revenue |

---

## 🚀 Growth playbook

- **Content first.** Post the same 60-second reels on Instagram, YouTube Shorts and Facebook with "Free on Sugar Saathi". In-app reels and social reels feed each other.
- **Dietitian and doctor referral.** Give partner diabetologists a QR code for their clinic. The patient scans it, the dietitian sees the doctor's name, and the doctor gets a monthly summary of their patients.
- **Pharmacy counter.** A QR standee near glucometer strips: "Free 14-day sugar plan in Hindi".
- **Family angle.** Market to adult children ("Look after Papa's sugar from Bangalore"). The family-alert feature is the hook.
- **Festival campaigns.** Diwali sweets, Navratri fasting and the summer mango season, each with a timely reel and a push notification.
- **WhatsApp communities.** A city or language group run by a dietitian, linking into the app.

---

## 💰 Monetization

| Plan | Price | What the patient gets |
|---|---|---|
| Free | ₹0 | Logging, reminders, reports, reels, family alerts |
| Diet plan | ₹299 / month | Personal plan, monthly dietitian review, exercise plan |
| Plan + coaching | ₹799 / month | Weekly review and chat support |

**Ideas to test:**
- A **3-month plan at ₹749**. Diabetes care is long; quarterly plans churn less.
- A **family plan** covering two parents.
- **B2B per-member pricing** for clinics and employers.

Keep the free tier generous: it is the acquisition engine.

---

## 📈 KPIs to watch weekly

| | Metric | Healthy target (early stage) | Where |
|:-:|---|---|---|
| 🚪 | Onboarding completion | ≥ 70% of installs | Admin → Analytics → funnel |
| 🔁 | D1 / D7 / D30 retention | 50% / 30% / 18% | Analytics → retention cohorts |
| 🩸 | Weekly active loggers | ≥ 40% of users log 3+ days a week | Analytics |
| 🎬 | Reel viewers | ≥ 25% of weekly users | Analytics → Reels |
| 🚀 | Kickstart completion | ≥ 50% reach day 14 | Analytics → Kickstart funnel |
| 💰 | Trial → paid | 8–15% | Revenue |
| 📉 | Monthly churn (paid) | < 8% | Revenue |
| 🩺 | Patients more often in range | Rising week on week | Outcomes by signup week |

---

## 🚧 Risks

- **Clinical.** Sugar thresholds, smart targets and every reel need sign-off from a doctor and a dietitian before launch. Keep the "not a medical device" wording.
- **Payments on iOS.** One-to-one dietitian services may use UPI. Selling app-only features would need Apple In-App Purchase.
- **Data.** Health data is sensitive personal data under the DPDP Act. Keep consent, export and delete working, and appoint a grievance officer.
- **Ops load.** Every paying user costs dietitian time. Track minutes per patient so price and staffing grow together.

<details>
<summary><b>🔎 Where the changes live (for engineers)</b></summary>

<br>

| Change | Files |
|---|---|
| Sugar levels, GDM, very low | `packages/shared/src/sugar.ts`, `packages/shared/src/family.ts`, `src/app/sugar.tsx` |
| Reels | `packages/shared/src/reels.ts`, `server/src/catalog/reels.controller.ts`, `admin/src/pages/Reels.tsx`, `src/app/(tabs)/reels.tsx`, `src/components/ReelPlayer.tsx`, `src/components/ReelsCard.tsx` |
| Retention messages | `server/src/notify/lifecycle.service.ts` |
| Badges, rating prompt | `src/logic/badges.ts`, `src/native/review.ts` |
| UX fixes | `src/components/CoachLinks.tsx`, `src/app/settings.tsx`, `src/app/walk.tsx`, `src/native/reminders.ts`, `src/components/StepHeader.tsx` |

</details>
