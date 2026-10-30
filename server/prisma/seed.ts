/**
 * Demo database: the app's catalog (foods, nutrition, tips) plus staff, 40 patients with
 * 30 days of realistic logs, plans, family links and notifications. Deterministic: every run
 * produces the same data. `--if-empty` skips seeding when foods already exist.
 *
 * Logins: owner@glucobuddy.local / dietitian1..3@glucobuddy.local, password Admin@123.
 * Patients: +91 90000 000NN (01–40), caregivers +91 91000 000NN; OTP 123456 in dev mode.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { FOOD_BY_ID, FOODS, SWAPS } from '@/data/foods';
import { INGREDIENTS } from '@/data/nutrition/ingredients';
import { RECIPES } from '@/data/nutrition/recipes';
import { TIPS } from '@/data/tips';
import { recomputeStats } from '../src/stats/stats';
import { seedAnalytics } from './seed-analytics';
import { seedFoods } from './seed-foods';
import { seedDemoEnrollments, seedPrograms } from './seed-programs';
import { seedThalis } from './seed-thalis';

const db = new PrismaClient();
const DAY = 86400_000;
const TZ_OFFSET = 5.5 * 3600_000; // IST

// ---------- deterministic randomness ----------
let seed = 20261023;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;

/** IST calendar date `n` days before today, and a Date at HH:MM IST on it. */
const today = new Date();
const istDate = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(today.getTime() - n * DAY));
const at = (date: string, hhmm: string, jitterMin = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi) - TZ_OFFSET + between(-jitterMin, jitterMin) * 60_000);
};

// ---------- catalog ----------
const EXERCISES: Prisma.ExerciseCreateInput[] = [
  ['postmeal', '🚶', 'Walk after meals', 'खाने के बाद सैर', 'walk', 10, 'light', ['senior', 'pregnancy', 'child'], 'Walk at an easy pace for 10 minutes within 30 minutes of finishing a meal.', 'खाना खाने के 30 मिनट के अंदर 10 मिनट आराम से चलिए।'],
  ['brisk', '🚶‍♂️', 'Brisk walk', 'तेज़ चाल', 'walk', 30, 'moderate', ['child'], 'Walk fast enough to breathe harder but still talk. Wear good shoes.', 'इतना तेज़ चलिए कि साँस तेज़ हो पर बात कर सकें। अच्छे जूते पहनिए।'],
  ['stairs', '🪜', 'Stair climbing', 'सीढ़ियाँ चढ़ना', 'strength', 10, 'vigorous', [], 'Climb stairs slowly, holding the railing. Rest when needed.', 'रेलिंग पकड़कर धीरे-धीरे सीढ़ियाँ चढ़िए। ज़रूरत हो तो रुकिए।'],
  ['chairyoga', '🪑', 'Chair yoga', 'कुर्सी योग', 'chair', 15, 'light', ['senior', 'low_mobility', 'pregnancy'], 'Sit tall on a chair. Raise arms, twist gently left and right, stretch legs one by one.', 'कुर्सी पर सीधे बैठिए। हाथ ऊपर उठाइए, धीरे से दाएँ-बाएँ मुड़िए, एक-एक पैर फैलाइए।'],
  ['sitstand', '🪑', 'Sit-to-stand', 'बैठना-उठना', 'strength', 5, 'light', ['senior', 'low_mobility'], 'Stand up from a chair without using hands, then sit down slowly. Repeat 10 times.', 'बिना हाथ लगाए कुर्सी से उठिए, फिर धीरे से बैठिए। 10 बार दोहराइए।'],
  ['wallpush', '🧱', 'Wall push-ups', 'दीवार पुश-अप', 'strength', 5, 'light', ['senior', 'pregnancy'], 'Hands on a wall at shoulder height. Bend elbows to bring chest close, push back. 10–15 times.', 'कंधे की ऊँचाई पर दीवार पर हाथ रखिए। कोहनी मोड़कर पास आइए, फिर पीछे धकेलिए। 10–15 बार।'],
  ['heelraise', '🦶', 'Heel raises', 'एड़ी उठाना', 'strength', 5, 'light', ['senior', 'pregnancy'], 'Hold a chair. Rise onto your toes, hold 2 seconds, lower. 15 times.', 'कुर्सी पकड़िए। पंजों पर उठिए, 2 सेकंड रुकिए, नीचे आइए। 15 बार।'],
  ['squat', '🏋️', 'Squats', 'स्क्वैट', 'strength', 10, 'moderate', [], 'Feet shoulder-width apart, sit back as if into a chair, stand up. 3 sets of 10.', 'पैर कंधों जितने खोलिए, कुर्सी पर बैठने जैसे नीचे जाइए, उठिए। 10-10 के 3 सेट।'],
  ['band', '🎗️', 'Resistance band rows', 'बैंड रो', 'strength', 10, 'moderate', ['senior'], 'Loop a band around a door handle, pull elbows back, squeeze shoulder blades. 3 sets of 12.', 'बैंड को दरवाज़े के हैंडल में फँसाइए, कोहनी पीछे खींचिए। 12-12 के 3 सेट।'],
  ['surya', '🌞', 'Surya namaskar', 'सूर्य नमस्कार', 'yoga', 15, 'moderate', [], '12 steps in a flow with breathing. Start with 3 rounds and build up to 12.', 'साँस के साथ 12 आसनों का क्रम। 3 चक्र से शुरू करके 12 तक बढ़ाइए।'],
  ['vajrasana', '🧘', 'Vajrasana after meals', 'खाने के बाद वज्रासन', 'yoga', 5, 'light', ['pregnancy'], 'Kneel and sit back on your heels with a straight back for 5 minutes after a meal.', 'खाने के बाद 5 मिनट घुटनों के बल एड़ियों पर सीधी कमर से बैठिए।'],
  ['mandukasana', '🐸', 'Mandukasana', 'मंडूकासन', 'yoga', 5, 'light', [], 'Sit in vajrasana, press fists into the belly and bend forward gently. Hold 20 seconds.', 'वज्रासन में बैठकर मुट्ठियाँ पेट पर रखें और धीरे से आगे झुकें। 20 सेकंड रुकें।'],
  ['bhujanga', '🐍', 'Bhujangasana', 'भुजंगासन', 'yoga', 5, 'light', [], 'Lie face down, hands under shoulders, lift chest gently. Hold 15–30 seconds.', 'पेट के बल लेटिए, हाथ कंधों के नीचे, धीरे से छाती उठाइए। 15–30 सेकंड रुकिए।'],
  ['pranayama', '🌬️', 'Anulom vilom', 'अनुलोम विलोम', 'breathing', 10, 'light', ['senior', 'pregnancy', 'low_mobility'], 'Breathe in through one nostril, out through the other, slowly. Lowers stress.', 'एक नथुने से साँस लें, दूसरे से छोड़ें, धीरे-धीरे। तनाव कम होता है।'],
  ['bhramari', '🐝', 'Bhramari breathing', 'भ्रामरी', 'breathing', 5, 'light', ['senior', 'pregnancy', 'low_mobility'], 'Close ears with thumbs, hum like a bee while breathing out. 5–7 rounds.', 'अँगूठों से कान बंद करें, साँस छोड़ते हुए भौंरे जैसी आवाज़ करें। 5–7 बार।'],
  ['cycling', '🚴', 'Cycling', 'साइकिल चलाना', 'walk', 20, 'moderate', ['child'], 'Cycle at a steady pace on flat roads or a stationary bike.', 'समतल सड़क या स्टेशनरी साइकिल पर एक जैसी रफ़्तार से चलाइए।'],
  ['dance', '💃', 'Dance', 'डांस', 'walk', 15, 'moderate', ['child'], 'Dance to your favourite songs. Any movement that raises your heart rate counts.', 'अपने पसंदीदा गानों पर नाचिए। दिल की धड़कन बढ़ाने वाली हर हरकत गिनी जाती है।'],
  ['swim', '🏊', 'Swimming', 'तैराकी', 'walk', 20, 'moderate', [], 'Swim or walk in water. Easy on knees.', 'तैरिए या पानी में चलिए। घुटनों पर कम ज़ोर।'],
  ['legraise', '🦵', 'Seated leg raises', 'बैठकर पैर उठाना', 'chair', 5, 'light', ['senior', 'low_mobility', 'pregnancy'], 'Sit on a chair, straighten one leg, hold 5 seconds, lower. 10 each leg.', 'कुर्सी पर बैठकर एक पैर सीधा कीजिए, 5 सेकंड रुकिए, नीचे लाइए। हर पैर 10 बार।'],
  ['armcircle', '🙆', 'Arm circles', 'हाथ घुमाना', 'stretch', 5, 'light', ['senior', 'low_mobility', 'pregnancy'], 'Stretch arms out and make small circles forward, then backward, 30 seconds each.', 'हाथ फैलाकर छोटे गोले आगे, फिर पीछे बनाइए, 30-30 सेकंड।'],
  ['anklecircle', '🔄', 'Ankle circles (foot care)', 'टखना घुमाना (पैरों की देखभाल)', 'stretch', 3, 'light', ['senior', 'low_mobility', 'pregnancy'], 'Rotate each ankle 10 times each way. Improves blood flow to feet.', 'हर टखने को दोनों तरफ़ 10 बार घुमाइए। पैरों में खून का बहाव बढ़ता है।'],
  ['plank', '🧱', 'Plank', 'प्लैंक', 'strength', 3, 'vigorous', [], 'Hold a straight body on forearms and toes for 20–40 seconds. 3 times.', 'कोहनी और पंजों पर शरीर सीधा रखकर 20–40 सेकंड रुकिए। 3 बार।'],
  ['stretch', '🤸', 'Full body stretch', 'पूरे शरीर की स्ट्रेचिंग', 'stretch', 10, 'light', ['senior', 'pregnancy'], 'Gently stretch neck, shoulders, back, hamstrings and calves. No bouncing.', 'गर्दन, कंधे, कमर, जाँघ और पिंडली को धीरे से खींचिए। झटका मत दीजिए।'],
  ['gardening', '🌱', 'Gardening / housework', 'बागवानी / घर का काम', 'walk', 20, 'light', ['senior'], 'Sweeping, gardening and cleaning count as activity. Keep moving.', 'झाड़ू, बागवानी और सफ़ाई भी व्यायाम हैं। चलते-फिरते रहिए।'],
  ['marching', '🥁', 'Marching in place', 'एक जगह मार्च', 'walk', 10, 'light', ['senior', 'pregnancy'], 'March on the spot, lifting knees and swinging arms. Good for rainy days.', 'एक जगह खड़े होकर घुटने उठाते और हाथ हिलाते हुए मार्च कीजिए। बारिश के दिन अच्छा।'],
].map(([id, emoji, nameEn, nameHi, kind, defaultMin, intensity, safeFor, stepsEn, stepsHi], sort) => ({
  id, emoji, nameEn, nameHi, kind, defaultMin, intensity, safeFor, stepsEn, stepsHi, sort,
}) as Prisma.ExerciseCreateInput);

const RULES: Prisma.FoodRuleCreateInput[] = [
  { band: 'low', ctx: 'any', recommend: ['juice', 'sweet', 'fruit'], avoid: [], messageEn: 'Sugar is low. Take 15 g fast sugar now (half glass juice or 3 glucose tablets), recheck in 15 minutes.', messageHi: 'शुगर कम है। अभी 15 ग्राम तेज़ शक्कर लीजिए (आधा गिलास जूस या 3 ग्लूकोज़ गोली), 15 मिनट बाद फिर जाँचिए।' },
  { band: 'normal', ctx: 'fasting', recommend: ['idli', 'poha', 'sprouts', 'omelette', 'upma'], avoid: ['paratha', 'puri', 'jalebi'], messageEn: 'Good fasting sugar. Keep breakfast balanced: protein plus a small grain portion.', messageHi: 'खाली पेट शुगर ठीक है। नाश्ता संतुलित रखिए: प्रोटीन और थोड़ा अनाज।' },
  { band: 'high', ctx: 'fasting', recommend: ['sprouts', 'omelette', 'besan', 'methi', 'salad'], avoid: ['poha', 'paratha', 'chai', 'rice'], messageEn: 'Fasting sugar is high. Choose a high-protein breakfast, skip sugar in tea, and walk 10 minutes after eating.', messageHi: 'खाली पेट शुगर ज़्यादा है। प्रोटीन वाला नाश्ता लीजिए, चाय में चीनी मत डालिए और खाने के बाद 10 मिनट चलिए।' },
  { band: 'very_high', ctx: 'any', recommend: ['salad', 'cucumber', 'dal', 'paneer'], avoid: ['rice', 'sweet', 'juice', 'colddrink', 'puri'], messageEn: 'Sugar is very high. Drink water, avoid sweets and rice today, take your medicine and recheck in 2 hours. Call your doctor if it stays above 300.', messageHi: 'शुगर बहुत ज़्यादा है। पानी पीजिए, आज मीठा और चावल मत लीजिए, दवा लीजिए और 2 घंटे बाद फिर जाँचिए। 300 से ऊपर रहे तो डॉक्टर को फ़ोन कीजिए।' },
  { band: 'normal', ctx: 'after', recommend: ['roti', 'dal', 'sabzi', 'salad'], avoid: [], messageEn: 'After-meal sugar is in range. This plate works for you.', messageHi: 'खाने के बाद शुगर ठीक है। यह थाली आपके लिए सही है।' },
  { band: 'high', ctx: 'after', recommend: ['salad', 'jowar', 'bajra', 'moongdal', 'chaas'], avoid: ['rice', 'naan', 'pulao', 'sweet'], messageEn: 'After-meal sugar went high. Next time eat salad first, swap rice for millet roti, and walk 10 minutes after the meal.', messageHi: 'खाने के बाद शुगर बढ़ गई। अगली बार पहले सलाद खाइए, चावल की जगह ज्वार/बाजरा रोटी, और खाने के बाद 10 मिनट चलिए।' },
  { band: 'normal', ctx: 'any', recommend: ['fruit', 'makhana', 'chana', 'peanuts'], avoid: ['samosa', 'namkeen'], messageEn: 'For snacks choose roasted chana, makhana or one whole fruit.', messageHi: 'नाश्ते में भुने चने, मखाना या एक पूरा फल चुनिए।' },
  { band: 'high', ctx: 'any', recommend: ['cucumber', 'soup', 'chaas', 'sprouts'], avoid: ['chai', 'colddrink', 'samosa'], messageEn: 'Sugar is above target. Choose a light, high-fiber snack and drink water.', messageHi: 'शुगर लक्ष्य से ऊपर है। हल्का, फाइबर वाला नाश्ता लीजिए और पानी पीजिए।' },
].map((r) => ({ ...r, recommend: r.recommend.filter((id) => FOOD_BY_ID[id]), avoid: r.avoid.filter((id) => FOOD_BY_ID[id]) }));

// ---------- people ----------
const NAMES = [
  'Ramesh Gupta', 'Sunita Devi', 'Mohan Lal', 'Kamla Sharma', 'Anil Kumar', 'Geeta Rani', 'Suresh Yadav', 'Lakshmi Iyer',
  'Rajesh Singh', 'Pushpa Verma', 'Vijay Patel', 'Asha Kulkarni', 'Prakash Joshi', 'Savitri Bai', 'Harish Mehta', 'Usha Nair',
  'Dinesh Chauhan', 'Meena Kumari', 'Gopal Das', 'Shanti Mishra', 'Arjun Reddy', 'Kavita Saxena', 'Naresh Tiwari', 'Rekha Pillai',
  'Sanjay Dubey', 'Nirmala Joshi', 'Ashok Bansal', 'Radha Krishnan', 'Manoj Pandey', 'Sarla Agarwal', 'Rohit Malhotra', 'Neha Kapoor',
  'Imran Khan', 'Fatima Begum', 'Joseph Thomas', 'Mary George', 'Harpreet Kaur', 'Gurdeep Singh', 'Ananya Das', 'Kabir Sen',
];

type Profile = 'controlled' | 'highFasting' | 'spikes' | 'lowProne' | 'poor' | 'pre' | 'gdm';
const PROFILE: Record<Profile, { fast: [number, number]; after: [number, number]; adherence: number; walk: [number, number]; lowChance: number }> = {
  controlled: { fast: [92, 128], after: [125, 165], adherence: 0.95, walk: [20, 45], lowChance: 0.01 },
  highFasting: { fast: [170, 240], after: [210, 285], adherence: 0.8, walk: [0, 20], lowChance: 0 },
  spikes: { fast: [105, 135], after: [195, 265], adherence: 0.85, walk: [5, 20], lowChance: 0 },
  lowProne: { fast: [72, 115], after: [110, 170], adherence: 0.9, walk: [15, 35], lowChance: 0.12 },
  poor: { fast: [150, 290], after: [190, 330], adherence: 0.45, walk: [0, 10], lowChance: 0.02 },
  pre: { fast: [100, 124], after: [140, 185], adherence: 1, walk: [10, 30], lowChance: 0 },
  gdm: { fast: [82, 102], after: [108, 145], adherence: 0.95, walk: [15, 30], lowChance: 0.02 },
};

const MEALS: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', { diet: 'veg' | 'egg' | 'nonveg'; items: [string, number][] }[]> = {
  breakfast: [
    { diet: 'veg', items: [['poha', 1], ['chai', 1]] },
    { diet: 'veg', items: [['idli', 3], ['sambar', 1]] },
    { diet: 'veg', items: [['roti', 2], ['sabzi', 1]] },
    { diet: 'veg', items: [['upma', 1], ['chai', 1]] },
    { diet: 'veg', items: [['paratha', 2], ['curd', 1]] },
    { diet: 'veg', items: [['dosa', 2], ['chutney', 1]] },
    { diet: 'veg', items: [['sprouts', 1], ['roti', 1]] },
    { diet: 'egg', items: [['omelette', 1], ['roti', 1]] },
    { diet: 'egg', items: [['bhurji', 1], ['roti', 2]] },
  ],
  lunch: [
    { diet: 'veg', items: [['salad', 1], ['roti', 2], ['dal', 1], ['sabzi', 1]] },
    { diet: 'veg', items: [['rice', 1], ['dal', 1], ['sabzi', 1]] },
    { diet: 'veg', items: [['roti', 2], ['chole', 1], ['salad', 1]] },
    { diet: 'veg', items: [['rice', 2], ['sambar', 1], ['cabbage', 1]] },
    { diet: 'veg', items: [['roti', 3], ['palakpaneer', 1]] },
    { diet: 'veg', items: [['rice', 1], ['kadhi', 1], ['aloo', 1]] },
    { diet: 'nonveg', items: [['roti', 2], ['chicken', 1], ['salad', 1]] },
    { diet: 'nonveg', items: [['rice', 1], ['fish', 1]] },
    { diet: 'egg', items: [['rice', 1], ['eggcurry', 1]] },
  ],
  dinner: [
    { diet: 'veg', items: [['roti', 2], ['dal', 1], ['lauki', 1]] },
    { diet: 'veg', items: [['khichdi', 1], ['curd', 1]] },
    { diet: 'veg', items: [['roti', 2], ['mixveg', 1], ['raita', 1]] },
    { diet: 'veg', items: [['jowar', 2], ['dal', 1], ['bhindi', 1]] },
    { diet: 'veg', items: [['rice', 1], ['rajma' in FOOD_BY_ID ? 'rajma' : 'chole', 1]] },
    { diet: 'nonveg', items: [['roti', 2], ['mutton', 1]] },
    { diet: 'nonveg', items: [['roti', 2], ['tandoori', 1], ['salad', 1]] },
  ],
  snack: [
    { diet: 'veg', items: [['chai', 1], ['namkeen', 1]] },
    { diet: 'veg', items: [['fruit', 1]] },
    { diet: 'veg', items: [['chana', 1]] },
    { diet: 'veg', items: [['makhana', 1], ['chai', 1]] },
    { diet: 'veg', items: [['samosa', 1], ['chai', 1]] },
  ],
};
const RANK = { veg: 0, egg: 1, nonveg: 2 } as const;

function totals(items: [string, number][]) {
  let c = 0, p = 0, f = 0, kcal = 0;
  for (const [id, q] of items) {
    const food = FOOD_BY_ID[id];
    if (!food) continue;
    c += food.c * q;
    p += food.p * q;
    f += food.f * q;
    kcal += food.kcal * q;
  }
  return { carbs: Math.round(c), protein: Math.round(p), fiber: Math.round(f), kcal: Math.round(kcal) };
}

// ---------- templates ----------
type Item = { slot: string; foodId: string; qty: number; note?: string };
const TEMPLATES: { title: string; titleHi: string; diet: string; kcal: number; notes: string; notesHi: string; items: Item[] }[] = [
  {
    title: 'Veg diabetic 1500 kcal', titleHi: 'शाकाहारी डायबिटीज़ प्लान 1500 kcal', diet: 'veg', kcal: 1500, notes: 'Plate method: half vegetables, quarter protein, quarter grain. Eat salad first.', notesHi: 'थाली का नियम: आधी सब्ज़ी, एक-चौथाई प्रोटीन, एक-चौथाई अनाज। पहले सलाद खाइए।',
    items: [
      { slot: 'breakfast', foodId: 'methi', qty: 1, note: 'On waking' },
      { slot: 'breakfast', foodId: 'idli', qty: 2 },
      { slot: 'breakfast', foodId: 'sambar', qty: 1 },
      { slot: 'lunch', foodId: 'salad', qty: 1, note: 'Eat first' },
      { slot: 'lunch', foodId: 'jowar', qty: 2 },
      { slot: 'lunch', foodId: 'dal', qty: 1 },
      { slot: 'lunch', foodId: 'sabzi', qty: 1 },
      { slot: 'snack', foodId: 'chana', qty: 1 },
      { slot: 'dinner', foodId: 'soup', qty: 1 },
      { slot: 'dinner', foodId: 'roti', qty: 2 },
      { slot: 'dinner', foodId: 'palakpaneer', qty: 1 },
    ],
  },
  {
    title: 'Veg diabetic 1800 kcal', titleHi: 'शाकाहारी डायबिटीज़ प्लान 1800 kcal', diet: 'veg', kcal: 1800, notes: 'For active adults. Keep rice to one katori at lunch only.', notesHi: 'सक्रिय लोगों के लिए। चावल सिर्फ़ दोपहर में, एक कटोरी।',
    items: [
      { slot: 'breakfast', foodId: 'sprouts', qty: 1 },
      { slot: 'breakfast', foodId: 'roti', qty: 2 },
      { slot: 'breakfast', foodId: 'curd', qty: 1 },
      { slot: 'lunch', foodId: 'salad', qty: 1, note: 'Eat first' },
      { slot: 'lunch', foodId: 'rice', qty: 1 },
      { slot: 'lunch', foodId: 'dal', qty: 1 },
      { slot: 'lunch', foodId: 'mixveg', qty: 1 },
      { slot: 'snack', foodId: 'fruit', qty: 1 },
      { slot: 'snack', foodId: 'makhana', qty: 1 },
      { slot: 'dinner', foodId: 'roti', qty: 2 },
      { slot: 'dinner', foodId: 'moongdal', qty: 1 },
      { slot: 'dinner', foodId: 'bhindi', qty: 1 },
    ],
  },
  {
    title: 'Non-veg diabetic 1500 kcal', titleHi: 'मांसाहारी डायबिटीज़ प्लान 1500 kcal', diet: 'nonveg', kcal: 1500, notes: 'Grilled, not fried. Fish twice a week.', notesHi: 'तला हुआ नहीं, भुना या ग्रिल किया हुआ। हफ़्ते में दो बार मछली।',
    items: [
      { slot: 'breakfast', foodId: 'omelette', qty: 1 },
      { slot: 'breakfast', foodId: 'roti', qty: 1 },
      { slot: 'lunch', foodId: 'salad', qty: 1, note: 'Eat first' },
      { slot: 'lunch', foodId: 'roti', qty: 2 },
      { slot: 'lunch', foodId: 'chicken', qty: 1 },
      { slot: 'snack', foodId: 'peanuts', qty: 1 },
      { slot: 'dinner', foodId: 'soup', qty: 1 },
      { slot: 'dinner', foodId: 'fish', qty: 1 },
      { slot: 'dinner', foodId: 'cabbage', qty: 1 },
    ],
  },
  {
    title: 'Non-veg diabetic 1800 kcal', titleHi: 'मांसाहारी डायबिटीज़ प्लान 1800 kcal', diet: 'nonveg', kcal: 1800, notes: 'Lean protein at every meal; millet roti preferred.', notesHi: 'हर खाने में कम चर्बी वाला प्रोटीन; बाजरा/ज्वार की रोटी बेहतर।',
    items: [
      { slot: 'breakfast', foodId: 'bhurji', qty: 1 },
      { slot: 'breakfast', foodId: 'roti', qty: 2 },
      { slot: 'lunch', foodId: 'salad', qty: 1, note: 'Eat first' },
      { slot: 'lunch', foodId: 'brownrice', qty: 1 },
      { slot: 'lunch', foodId: 'fish', qty: 1 },
      { slot: 'lunch', foodId: 'dal', qty: 1 },
      { slot: 'snack', foodId: 'egg', qty: 1 },
      { slot: 'snack', foodId: 'fruit', qty: 1 },
      { slot: 'dinner', foodId: 'bajra', qty: 2 },
      { slot: 'dinner', foodId: 'tandoori', qty: 1 },
      { slot: 'dinner', foodId: 'mixveg', qty: 1 },
    ],
  },
];
const EX_TEMPLATES: { title: string; titleHi: string; items: { exerciseId: string; minutes: number; time: string; weekdays: number[] }[] }[] = [
  { title: 'Gentle senior routine', titleHi: 'बुज़ुर्गों के लिए हल्का व्यायाम', items: [
    { exerciseId: 'postmeal', minutes: 10, time: '13:45', weekdays: [] },
    { exerciseId: 'chairyoga', minutes: 15, time: '07:30', weekdays: [1, 3, 5] },
    { exerciseId: 'sitstand', minutes: 5, time: '17:00', weekdays: [] },
    { exerciseId: 'pranayama', minutes: 10, time: '07:00', weekdays: [] },
    { exerciseId: 'anklecircle', minutes: 3, time: '21:00', weekdays: [] },
  ] },
  { title: 'Active adult routine', titleHi: 'सक्रिय लोगों के लिए व्यायाम', items: [
    { exerciseId: 'brisk', minutes: 30, time: '06:30', weekdays: [1, 2, 3, 4, 5] },
    { exerciseId: 'postmeal', minutes: 10, time: '20:45', weekdays: [] },
    { exerciseId: 'squat', minutes: 10, time: '18:00', weekdays: [1, 3, 5] },
    { exerciseId: 'surya', minutes: 15, time: '06:30', weekdays: [0, 6] },
  ] },
];

/**
 * `--production`: only the real catalog (foods, thalis, 14-day plans, templates, tips, exercises,
 * subscription plans) and one owner login from OWNER_EMAIL / OWNER_PASSWORD. No demo patients or staff.
 * Never clears data: it does nothing once foods exist.
 */
const PRODUCTION = process.argv.includes('--production');

async function main() {
  if ((PRODUCTION || process.argv.includes('--if-empty')) && (await db.food.count()) > 0) {
    console.log('Database already seeded; skipping.');
    return;
  }

  console.log(PRODUCTION ? 'Production catalog…' : 'Clearing…');
  // Order matters for foreign keys. Production never deletes anything.
  for (const t of PRODUCTION ? [] : [
    'auditLog', 'thali', 'enrollment', 'programMeal', 'programDay', 'programTemplate', 'dietitianNote', 'subscription', 'subscriptionPlan', 'alertSent', 'segment', 'notificationReceipt', 'notification', 'device',
    'familyMessage', 'circleMember', 'circle', 'patientStats', 'checkup', 'careEvent', 'dailyActivity', 'doseLog', 'medication',
    'sugarReading', 'meal', 'exercisePlanItem', 'exercisePlan', 'dietTemplateItem', 'dietTemplate', 'dietPlanItem', 'dietPlan',
    'foodRule', 'tip', 'exercise', 'foodSwap', 'foodRecipe', 'food', 'ingredient', 'patient', 'refreshToken', 'otpRequest', 'user',
  ] as const) {
    await (db[t] as unknown as { deleteMany(): Promise<unknown> }).deleteMany();
  }

  console.log('Catalog…');
  await db.ingredient.createMany({
    data: Object.entries(INGREDIENTS).map(([id, i]) => ({
      id, nameEn: i.src.replace(/^(IFCT \S+|USDA[^,]*,?|Label[^,]*,?)\s*/, '') || id, nameHi: '', carb: i.carb, protein: i.protein, fat: i.fat, fiber: i.fiber, alc: i.alc ?? 0, source: i.src,
    })),
  });
  await db.food.createMany({
    data: FOODS.map((f, sort) => ({
      id: f.id, emoji: f.e, nameEn: f.n.en, nameHi: f.n.hi, aliases: f.kw, diet: f.diet, group: f.group, gi: f.gi, unit: f.unit, role: f.role,
      servingG: f.g, std: f.std ?? null, sweet: !!f.sweet, carbs: f.c, protein: f.p, fiber: f.f, fat: f.fat, kcal: f.kcal, sources: f.src, sort,
    })),
  });
  await db.foodRecipe.createMany({
    data: Object.entries(RECIPES).flatMap(([foodId, r]) =>
      FOOD_BY_ID[foodId] ? Object.entries(r.i).map(([ingredientId, grams]) => ({ foodId, ingredientId, grams: grams as number })) : [],
    ),
  });
  await db.foodSwap.createMany({ data: Object.entries(SWAPS).filter(([a, b]) => FOOD_BY_ID[a] && FOOD_BY_ID[b]).map(([fromId, toId]) => ({ fromId, toId })) });
  await db.tip.createMany({ data: TIPS.map((t, sort) => ({ emoji: t.e, en: t.en, hi: t.hi, sort })) });
  for (const e of EXERCISES) await db.exercise.create({ data: e });
  for (const r of RULES) await db.foodRule.create({ data: r });
  await db.subscriptionPlan.createMany({
    data: [
      { id: 'free', name: 'Free', nameHi: 'मुफ़्त', priceInr: 0, months: 1, features: ['Daily logging', 'Smart targets', 'Family sharing'], featuresHi: ['रोज़ का रिकॉर्ड', 'स्मार्ट लक्ष्य', 'परिवार के साथ शेयर'] },
      { id: 'basic', name: 'Diet plan', nameHi: 'डाइट प्लान', priceInr: 299, months: 1, features: ['Personal diet plan', 'Monthly dietitian review', 'Exercise plan'], featuresHi: ['आपका अपना डाइट प्लान', 'हर महीने डाइटीशियन से जाँच', 'व्यायाम प्लान'] },
      { id: 'pro', name: 'Diet plan + coaching', nameHi: 'डाइट प्लान + कोचिंग', priceInr: 799, months: 1, features: ['Everything in Diet plan', 'Weekly dietitian review', 'Chat support'], featuresHi: ['डाइट प्लान की सारी सुविधाएँ', 'हर हफ़्ते डाइटीशियन से जाँच', 'चैट पर मदद'] },
    ],
  });

  console.log('Staff…');
  if (PRODUCTION) {
    const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const password = process.env.OWNER_PASSWORD ?? '';
    if (!email || password.length < 12) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD (12+ characters) for the first owner login.');
    await db.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10), name: process.env.OWNER_NAME || 'Owner', role: 'OWNER' } });
  }
  const hash = await bcrypt.hash('Admin@123', 10);
  const owner = PRODUCTION ? null! : await db.user.create({ data: { email: 'owner@glucobuddy.local', passwordHash: hash, name: 'Priya Owner', role: 'OWNER' } });
  const dietitians = PRODUCTION
    ? []
    : await Promise.all(
        ['Dr. Anjali Sharma', 'Rahul Verma', 'Meera Iyer'].map((name, i) =>
          db.user.create({ data: { email: `dietitian${i + 1}@glucobuddy.local`, passwordHash: hash, name, role: 'DIETITIAN' } }),
        ),
      );

  console.log('Templates…');
  const templates = [];
  for (const t of TEMPLATES) {
    templates.push(
      await db.dietTemplate.create({
        data: { title: t.title, titleHi: t.titleHi, diet: t.diet, kcal: t.kcal, notes: t.notes, notesHi: t.notesHi, items: { create: t.items.filter((i) => FOOD_BY_ID[i.foodId]).map((i, sort) => ({ ...i, note: i.note ?? '', sort })) } },
      }),
    );
  }

  // Demo patients, segments and notices (local development only).
  if (!PRODUCTION) {
    console.log('Patients (40 × 30 days)…');
    const profiles: Profile[] = ['controlled', 'highFasting', 'spikes', 'lowProne', 'poor', 'controlled', 'highFasting', 'spikes', 'pre', 'gdm'];
    for (let n = 0; n < NAMES.length; n++) {
      const prof = profiles[n % profiles.length];
      const P = PROFILE[prof];
      const type = prof === 'pre' ? 'pre' : prof === 'gdm' ? 'gdm' : n % 9 === 4 ? 'type1' : 'type2';
      const ageGroup = prof === 'gdm' ? 'adult' : n % 3 === 0 ? 'senior' : 'adult';
      const diet = (['veg', 'veg', 'egg', 'nonveg'] as const)[n % 4];
      const lang = n % 2 === 0 ? 'hi' : 'en';
      const dietitian = n < 36 ? dietitians[n % 3] : null;
      const tier = n % 5 === 0 ? 'PRO' : n % 3 === 0 ? 'BASIC' : 'FREE';
      const phone = `+9190000000${String(n + 1).padStart(2, '0')}`;
      const sugarEvery = type === 'type1' || type === 'gdm' ? 'daily' : type === 'pre' ? 'weekly' : 'every3';
      const user = await db.user.create({
        data: {
          phone, name: NAMES[n], lang, role: 'USER', createdAt: new Date(today.getTime() - 45 * DAY),
          patient: {
            create: {
              type, ageGroup, diet, sugarEvery, tier, sex: n % 2 ? 'female' : 'male', heightCm: between(150, 178), weightKg: between(55, 92),
              assignedDietitianId: dietitian?.id, consentVer: 1, consentAt: new Date(today.getTime() - 45 * DAY),
              targetMealCarbs: ageGroup === 'senior' ? 50 : 60, tierUntil: tier === 'FREE' ? null : new Date(today.getTime() + 20 * DAY),
            },
          },
        },
      });
      const pid = user.id;

      const medDefs: [string, string][] =
        type === 'pre' ? [] : type === 'type1' ? [['Insulin Glargine 14u', '22:00'], ['Insulin Aspart 6u', '08:00']] : type === 'gdm' ? [['Metformin 500', '08:30']]
        : prof === 'spikes' || prof === 'poor' ? [['Metformin 500', '08:30'], ['Glimepiride 1mg', '08:00'], ['Metformin 500', '21:00']] : [['Metformin 500', '08:30'], ['Metformin 500', '21:00']];
      const meds = medDefs.map(([name, time], i) => ({ id: `${pid}-med-${i}`, patientId: pid, name, time, stock: between(4, 50), updatedAt: today }));
      if (meds.length) await db.medication.createMany({ data: meds });

      const mealsRows: Prisma.MealCreateManyInput[] = [];
      const readingRows: Prisma.SugarReadingCreateManyInput[] = [];
      const doseRows: Prisma.DoseLogCreateManyInput[] = [];
      const actRows: Prisma.DailyActivityCreateManyInput[] = [];
      const eventRows: Prisma.CareEventCreateManyInput[] = [];
      const every = sugarEvery === 'daily' ? 1 : sugarEvery === 'weekly' ? 7 : 3;
      const nowHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(today));
      let id = 0;

      for (let d = 29; d >= 0; d--) {
        const date = istDate(d);
        const isToday = d === 0;
        const active = prof !== 'poor' || chance(0.7);
        if (!active) continue;
        const slots: [keyof typeof MEALS, string][] = [['breakfast', '08:45'], ['lunch', '13:30'], ['snack', '17:15'], ['dinner', '20:30']];
        for (const [slot, time] of slots) {
          if (isToday && Number(time.slice(0, 2)) > nowHour) continue;
          if (slot === 'snack' && !chance(0.5)) continue;
          if (prof === 'poor' && slot !== 'snack' && !chance(0.8)) continue;
          const options = MEALS[slot].filter((m) => RANK[m.diet] <= RANK[diet]);
          const choice = prof === 'poor' && slot === 'snack' ? MEALS.snack[4] : pick(options);
          const items = choice.items.filter(([fid]) => FOOD_BY_ID[fid]);
          mealsRows.push({ id: `${pid}-meal-${id++}`, patientId: pid, slot, kind: 'meal', at: at(date, time, 25), items: items.map(([fid, q]) => ({ id: fid, q })), ...totals(items), updatedAt: at(date, time) });
        }
        // Readings on testing days: fasting, plus after-meal on alternate testing days (daily for type 1 / GDM).
        if ((29 - d) % every === 0 && chance(prof === 'poor' ? 0.5 : 0.95)) {
          const fast = chance(P.lowChance) ? between(52, 68) : between(...P.fast);
          readingRows.push({ id: `${pid}-r-${id++}`, patientId: pid, value: fast, ctx: 'fasting', at: at(date, '07:30', 20), updatedAt: at(date, '07:30') });
          if (fast < 70) eventRows.push({ id: `${pid}-ev-${id++}`, patientId: pid, kind: 'sugar', data: { v: fast, ctx: 'fasting' }, at: at(date, '07:31') });
          if ((every === 1 || ((29 - d) / every) % 2 === 1) && (!isToday || nowHour >= 16)) {
            const after = chance(P.lowChance / 2) ? between(58, 69) : between(...P.after);
            readingRows.push({ id: `${pid}-r-${id++}`, patientId: pid, value: after, ctx: 'after', at: at(date, '15:30', 20), updatedAt: at(date, '15:30') });
            if (after > 300) eventRows.push({ id: `${pid}-ev-${id++}`, patientId: pid, kind: 'sugar', data: { v: after, ctx: 'after' }, at: at(date, '15:31') });
          }
        }
        if (prof === 'poor' && chance(0.06)) eventRows.push({ id: `${pid}-ev-${id++}`, patientId: pid, kind: 'unwell', data: { what: 'high' }, at: at(date, '19:00', 60) });
        for (const m of meds) {
          if (isToday && Number(m.time.slice(0, 2)) > nowHour) continue;
          doseRows.push({ id: `${m.id}:${date}`, patientId: pid, medicationId: m.id, date, status: chance(P.adherence) ? 'taken' : 'skipped', updatedAt: at(date, m.time, 30) });
        }
        const walkMin = between(...P.walk);
        actRows.push({
          id: `${pid}:${date}`, patientId: pid, date, walkMin, steps: walkMin * 110 + between(1500, 3500), water: between(3, 9),
          score: Math.min(100, Math.round(20 + walkMin + P.adherence * 25 + (prof === 'poor' ? 0 : 15))), updatedAt: at(date, isToday ? '11:00' : '21:30'),
        });
      }
      await db.meal.createMany({ data: mealsRows });
      await db.sugarReading.createMany({ data: readingRows });
      await db.doseLog.createMany({ data: doseRows });
      await db.dailyActivity.createMany({ data: actRows });
      await db.careEvent.createMany({ data: eventRows });
      const fastAvg = readingRows.length ? readingRows.reduce((a, r) => a + r.value, 0) / readingRows.length : 140;
      await db.checkup.createMany({
        data: [
          { id: `${pid}:a1c`, patientId: pid, kind: 'a1c', lastDone: istDate(between(20, 140)), value: Math.round(((fastAvg + 46.7) / 28.7) * 10) / 10, updatedAt: today },
          ...(chance(0.6) ? [{ id: `${pid}:eye`, patientId: pid, kind: 'eye', lastDone: istDate(between(60, 500)), updatedAt: today }] : []),
        ],
      });

      // Plans for the first 15 assigned patients.
      if (dietitian && n < 15) {
        const tpl = templates.find((t) => t.diet === (diet === 'nonveg' ? 'nonveg' : 'veg') && t.kcal === (ageGroup === 'senior' ? 1500 : 1800))!;
        const items = await db.dietTemplateItem.findMany({ where: { templateId: tpl.id } });
        await db.dietPlan.create({
          data: {
            patientId: pid, dietitianId: dietitian.id, title: tpl.title, titleHi: tpl.titleHi, startsOn: new Date(today.getTime() - 10 * DAY), status: 'active',
            // Carb targets follow the template's calories (about 45 % of energy from carbs).
            ...(tpl.kcal === 1500 ? { carbsBreakfast: 45, carbsLunch: 55, carbsDinner: 45, protein: 60 } : { carbsBreakfast: 65, carbsLunch: 75, carbsDinner: 60, protein: 70 }),
            fiber: 30, kcal: tpl.kcal ?? undefined, notes: tpl.notes, notesHi: tpl.notesHi,
            items: { create: items.map(({ weekday, slot, foodId, qty, note, sort }) => ({ weekday, slot, foodId, qty, note, sort })) },
          },
        });
        const ex = EX_TEMPLATES[ageGroup === 'senior' ? 0 : 1];
        await db.exercisePlan.create({
          data: { patientId: pid, dietitianId: dietitian.id, title: ex.title, titleHi: ex.titleHi, startsOn: new Date(today.getTime() - 10 * DAY), items: { create: ex.items.map((i, sort) => ({ ...i, sort })) } },
        });
        await db.dietitianNote.create({ data: { patientId: pid, authorId: dietitian.id, text: `Started ${tpl.title}. Review fasting trend in 2 weeks.`, createdAt: new Date(today.getTime() - 10 * DAY) } });
      }
      if (tier !== 'FREE') {
        await db.subscription.create({ data: { patientId: pid, planId: tier === 'PRO' ? 'pro' : 'basic', startsAt: new Date(today.getTime() - 10 * DAY), endsAt: new Date(today.getTime() + 20 * DAY) } });
      }
      // Family: every 6th patient has a grandchild following them.
      if (n % 6 === 0) {
        const cg = await db.user.create({ data: { phone: `+9191000000${String(n + 1).padStart(2, '0')}`, name: `${NAMES[n].split(' ')[0]}'s grandchild`, role: 'USER', patient: { create: { type: 'care' } } } });
        await db.circle.create({ data: { patientId: pid, members: { create: { userId: cg.id, name: cg.name, status: 'active', lang } } } });
      }
      await recomputeStats(db, pid, today);
    }

    console.log('Segments and notifications…');
    await db.segment.createMany({
      data: [
        { name: 'High fasting (7-day avg > 180)', filter: { ctx: 'fasting', days: 7, sugarMin: 180 }, createdBy: owner.id },
        { name: 'After-meal spikes (> 200)', filter: { ctx: 'after', days: 7, sugarMin: 200 }, createdBy: owner.id },
        { name: 'Well controlled (fasting 80–130)', filter: { ctx: 'fasting', days: 30, sugarMin: 80, sugarMax: 130 }, createdBy: owner.id },
      ],
    });
    const all = await db.user.findMany({ where: { role: 'USER', patient: { type: { not: 'care' } } }, select: { id: true } });
    const notices = [
      { titleEn: 'Monsoon foot care', titleHi: 'बारिश में पैरों की देखभाल', bodyEn: 'Keep feet dry and check between toes every day.', bodyHi: 'पैर सूखे रखिए और रोज़ उँगलियों के बीच देखिए।', days: 12 },
      { titleEn: 'Check your fasting sugar tomorrow', titleHi: 'कल खाली पेट शुगर जाँचिए', bodyEn: 'Before tea or breakfast. It helps us adjust your plan.', bodyHi: 'चाय या नाश्ते से पहले। इससे आपका प्लान ठीक करने में मदद मिलेगी।', days: 5 },
      { titleEn: 'Festival tip', titleHi: 'त्योहार की सलाह', bodyEn: 'One small sweet after a meal, then a 10-minute walk.', bodyHi: 'खाने के बाद एक छोटी मिठाई, फिर 10 मिनट की सैर।', days: 2 },
    ];
    for (const nt of notices) {
      const sent = new Date(today.getTime() - nt.days * DAY);
      await db.notification.create({
        data: {
          senderId: dietitians[0].id, titleEn: nt.titleEn, titleHi: nt.titleHi, bodyEn: nt.bodyEn, bodyHi: nt.bodyHi, audience: { all: true },
          scheduledAt: sent, sentAt: sent, recipients: all.length, pushed: 0,
          receipts: { create: all.map((u, i) => ({ userId: u.id, readAt: i % 3 ? sent : null })) },
        },
      });
    }
  }

  await seedFoods(db);
  await seedThalis(db);
  await seedPrograms(db);
  if (PRODUCTION) {
    console.log(`Done (production): ${FOODS.length} foods, ${EXERCISES.length} exercises, owner ${process.env.OWNER_EMAIL}.`);
    return;
  }
  await seedDemoEnrollments(db);
  await seedAnalytics(db, true);
  console.log(`Done: ${FOODS.length} foods, ${EXERCISES.length} exercises, ${NAMES.length} patients.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
