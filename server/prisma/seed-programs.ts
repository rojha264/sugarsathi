/**
 * Seven starter 14-day Kickstart templates (draft content for the dietitian to finalise in the admin
 * panel). Built only from verified catalog foods so they work today; meals rotate so no day repeats
 * the day before. Skipped once any template exists.  npx tsx prisma/seed-programs.ts
 */
import { PrismaClient } from '@prisma/client';
import { portionNote, PROGRAM_TITLE } from '@shared/program';

type Item = [foodId: string, qty: number];
type Pools = { breakfast: Item[][]; lunchBase: Item[]; lunchMain: string[]; dinnerBase: Item[]; dinnerMain: string[]; sabzi: string[] };

const SNACKS: Item[][] = [[['chana', 1]], [['fruit', 1]], [['sprouts', 1]], [['makhana', 1]], [['peanuts', 1]], [['chaas', 1]], [['fruit', 1]]];
/** Bedtime snack for the hypo-safe plan: a little protein + slow carbs overnight. */
const BEDTIME: Item[] = [['curd', 1]];

const POOLS: Record<string, Pools> = {
  north: {
    breakfast: [[['poha', 1], ['chains', 1]], [['paratha', 1], ['curd', 1]], [['upma', 1], ['chains', 1]], [['sprouts', 1], ['roti', 1], ['chains', 1]], [['thepla', 2], ['curd', 1]], [['idli', 3], ['sambar', 1]], [['alooparatha', 1], ['curd', 1]]],
    lunchBase: [['salad', 1], ['roti', 2]], lunchMain: ['dal', 'moongdal', 'chole', 'kadhi', 'chanadal', 'dal', 'moongdal'],
    dinnerBase: [['roti', 2]], dinnerMain: ['palakpaneer', 'moongdal', 'matarpaneer', 'soya', 'dal', 'kadhi', 'mixveg'],
    sabzi: ['lauki', 'bhindi', 'aloogobhi', 'cabbage', 'tinda', 'mixveg', 'palak', 'baingan', 'karela', 'kaddu'],
  },
  south: {
    breakfast: [[['idli', 3], ['sambar', 1], ['chutney', 1]], [['dosa', 2], ['sambar', 1]], [['upma', 1], ['chutney', 1]], [['pongal', 1], ['sambar', 1]], [['uttapam', 1], ['chutney', 1]], [['appam', 2], ['mixveg', 1]], [['poha', 1], ['chains', 1]]],
    lunchBase: [['salad', 1], ['rice', 1]], lunchMain: ['sambar', 'dal', 'rasam', 'sambar', 'moongdal', 'sambar', 'rasam'],
    dinnerBase: [['roti', 2]], dinnerMain: ['mixveg', 'dal', 'sambar', 'palak', 'moongdal', 'mixveg', 'dal'],
    sabzi: ['cabbage', 'bhindi', 'mixveg', 'palak', 'kaddu', 'baingan', 'lauki', 'karela'],
  },
  west: {
    breakfast: [[['poha', 1], ['chains', 1]], [['thepla', 2], ['curd', 1]], [['upma', 1], ['chains', 1]], [['dhokla', 1], ['chains', 1]], [['sprouts', 1], ['bhakri', 1]], [['thepla', 2], ['chains', 1]], [['poha', 1], ['curd', 1]]],
    lunchBase: [['salad', 1], ['roti', 2]], lunchMain: ['dal', 'kadhi', 'moongdal', 'chole', 'dal', 'kadhi', 'chanadal'],
    dinnerBase: [['bhakri', 1]], dinnerMain: ['moongdal', 'mixveg', 'dal', 'kadhi', 'soya', 'moongdal', 'mixveg'],
    sabzi: ['bhindi', 'lauki', 'baingan', 'cabbage', 'tinda', 'mixveg', 'kaddu', 'palak'],
  },
  east: {
    breakfast: [[['poha', 1], ['chains', 1]], [['roti', 2], ['sabzi', 1]], [['upma', 1], ['chains', 1]], [['sprouts', 1], ['fruit', 1]], [['idli', 3], ['sambar', 1]], [['poha', 1], ['curd', 1]], [['roti', 2], ['mixveg', 1]]],
    lunchBase: [['salad', 1], ['rice', 1]], lunchMain: ['moongdal', 'dal', 'chanadal', 'moongdal', 'dal', 'kadhi', 'moongdal'],
    dinnerBase: [['roti', 2]], dinnerMain: ['dal', 'mixveg', 'moongdal', 'palak', 'dal', 'soya', 'mixveg'],
    sabzi: ['kaddu', 'mixveg', 'palak', 'lauki', 'cabbage', 'baingan', 'bhindi', 'karela'],
  },
};
const NONVEG_DINNER = ['chicken', 'eggcurry', 'fish', 'chicken', 'eggcurry', 'fish', 'chicken'];

const TEMPLATES = [
  { id: 'veg-north', title: 'Veg · North Indian', titleHi: 'शाकाहारी · उत्तर भारतीय', diet: 'veg', region: 'north', risk: 'standard' },
  { id: 'veg-south', title: 'Veg · South Indian', titleHi: 'शाकाहारी · दक्षिण भारतीय', diet: 'veg', region: 'south', risk: 'standard' },
  { id: 'veg-west', title: 'Veg · West Indian', titleHi: 'शाकाहारी · पश्चिम भारतीय', diet: 'veg', region: 'west', risk: 'standard' },
  { id: 'veg-east', title: 'Veg · East Indian', titleHi: 'शाकाहारी · पूर्व भारतीय', diet: 'veg', region: 'east', risk: 'standard' },
  { id: 'nonveg-north', title: 'Non-veg · North Indian', titleHi: 'मांसाहारी · उत्तर भारतीय', diet: 'nonveg', region: 'north', risk: 'standard' },
  { id: 'nonveg-south', title: 'Non-veg · South Indian', titleHi: 'मांसाहारी · दक्षिण भारतीय', diet: 'nonveg', region: 'south', risk: 'standard' },
  { id: 'veg-north-safe', title: 'Veg · North Indian · steady carbs (on tablets)', titleHi: 'शाकाहारी · उत्तर भारतीय · हर खाने में बराबर कार्ब्स (शुगर की गोली वालों के लिए)', diet: 'veg', region: 'north', risk: 'hypo_safe' },
];

/** What the patient reads under the plan title (English / Hindi). */
const NOTES = {
  standard: ['Eat at regular times. Fill half the plate with vegetables, a quarter with dal or protein, a quarter with roti or rice.', 'रोज़ एक ही समय पर खाइए। आधी थाली सब्ज़ी, एक-चौथाई दाल या प्रोटीन, एक-चौथाई रोटी या चावल।'],
  hypo_safe: ['Steady carbs at every meal and a bedtime snack, to avoid lows on sugar tablets. Do not skip meals.', 'हर खाने में बराबर कार्ब्स और सोने से पहले हल्का नाश्ता, ताकि शुगर की गोली से शुगर बहुत कम न हो। कोई खाना न छोड़ें।'],
} as const;
/** Earlier seeds showed this staff note to patients; it is replaced by NOTES.standard. */
const OLD_DRAFT_NOTE = 'Draft starter plan: review portions and dishes before use.';

/**
 * Adds the Hindi title and notes to the starter templates and to patients' 14-day plans copied before
 * plans had Hindi text. Only fills empty Hindi fields, so a dietitian's own edits are kept.
 */
export async function fillProgramHindi(db: PrismaClient) {
  for (const t of TEMPLATES) {
    const [en, hi] = NOTES[t.risk as keyof typeof NOTES];
    const row = await db.programTemplate.findUnique({ where: { id: t.id } });
    if (!row) continue;
    const notes = row.notes === OLD_DRAFT_NOTE ? en : row.notes;
    await db.programTemplate.update({ where: { id: t.id }, data: { notes, ...(row.titleHi ? {} : { titleHi: t.titleHi }), ...(row.notesHi || notes !== en ? {} : { notesHi: hi }) } });
  }
  const plans = await db.dietPlan.findMany({ where: { title: { startsWith: '🚀' }, titleHi: '' }, select: { id: true, patientId: true, kcal: true } });
  for (const p of plans) {
    const e = await db.enrollment.findFirst({ where: { patientId: p.patientId }, orderBy: { createdAt: 'desc' }, include: { template: true } });
    if (!e?.template) continue;
    const t = e.template;
    const portion = portionNote(p.kcal ?? e.kcal);
    await db.dietPlan.update({
      where: { id: p.id },
      data: { titleHi: `${PROGRAM_TITLE.hi}: ${t.titleHi || t.title}`, notes: `${t.notes}\n${portion.en}`.trim(), notesHi: `${t.notesHi || t.notes}\n${portion.hi}`.trim() },
    });
    await db.exercisePlan.updateMany({ where: { patientId: p.patientId, title: { startsWith: '🚀' }, titleHi: '' }, data: { titleHi: `${PROGRAM_TITLE.hi}: ${t.titleHi || t.title}` } });
  }
  return plans.length;
}

/** Daily focus and tip (English / Hindi) and which sugar check: fasting on days 1, 3, 12, 14; after a meal on 2, 13. */
export const DAYS = [
  { focus: ['Plate order', 'थाली का क्रम'], tip: ['Eat salad and sabzi first, dal next, roti or rice last. Same food, smaller spike.', 'पहले सलाद और सब्ज़ी, फिर दाल, आख़िर में रोटी या चावल। वही खाना, कम शुगर।'], check: 'fasting' },
  { focus: ['Walk after meals', 'खाने के बाद सैर'], tip: ['A 10-minute walk after lunch and dinner lowers after-meal sugar.', 'दोपहर और रात के खाने के बाद 10 मिनट टहलने से शुगर कम बढ़ती है।'], check: 'after_meal' },
  { focus: ['Know your number', 'अपना नंबर जानिए'], tip: ['Check fasting sugar before tea, after 8 hours without food.', 'सुबह चाय से पहले, 8 घंटे बिना कुछ खाए, खाली पेट शुगर जाँचिए।'], check: 'fasting' },
  { focus: ['Water first', 'पहले पानी'], tip: ['Sweet drinks and juice raise sugar fast. Water, chaas or lemon water instead.', 'मीठे पेय और जूस से शुगर तेज़ी से बढ़ती है। पानी, छाछ या नींबू पानी लीजिए।'], check: 'none' },
  { focus: ['Protein at breakfast', 'नाश्ते में प्रोटीन'], tip: ['Add curd, sprouts, paneer or an egg to breakfast so you stay full till lunch.', 'नाश्ते में दही, अंकुरित, पनीर या अंडा जोड़िए, ताकि दोपहर तक भूख न लगे।'], check: 'after_meal' },
  { focus: ['Smaller roti/rice', 'रोटी/चावल थोड़ा कम'], tip: ['Fill half the plate with vegetables; keep roti or rice to a quarter.', 'आधी थाली सब्ज़ी से भरिए; रोटी या चावल एक-चौथाई रखिए।'], check: 'none' },
  { focus: ['Halfway!', 'आधा सफ़र!'], tip: ['One week done. Look at your progress and keep the habits that felt easy.', 'एक हफ़्ता पूरा। अपनी प्रगति देखिए और जो आदतें आसान लगीं उन्हें जारी रखिए।'], check: 'fasting' },
  { focus: ['Sleep well', 'अच्छी नींद'], tip: ['7–8 hours of sleep helps morning sugar. Dinner 2–3 hours before bed.', '7–8 घंटे की नींद सुबह की शुगर में मदद करती है। सोने से 2–3 घंटे पहले खाना खाइए।'], check: 'none' },
  { focus: ['Smart snacks', 'समझदार नाश्ता'], tip: ['Roasted chana, a fruit or a handful of peanuts beat biscuits and namkeen.', 'भुना चना, एक फल या मुट्ठी भर मूंगफली बिस्कुट और नमकीन से बेहतर हैं।'], check: 'none' },
  { focus: ['Medicine on time', 'दवा समय पर'], tip: ['Take your medicine at the same time daily, and mark it in the app.', 'दवा रोज़ एक ही समय पर लीजिए और ऐप में दर्ज कीजिए।'], check: 'after_meal' },
  { focus: ['Festivals & outings', 'त्योहार और बाहर का खाना'], tip: ['Eating out? Start with salad or soup, share the sweet, walk after.', 'बाहर खा रहे हैं? सलाद या सूप से शुरू करें, मिठाई बाँटें, बाद में टहलें।'], check: 'none' },
  { focus: ['Measure again', 'फिर से जाँचिए'], tip: ['Check fasting sugar today and tomorrow, to compare with your first days.', 'आज और कल खाली पेट शुगर जाँचिए, ताकि पहले दिनों से तुलना हो सके।'], check: 'fasting' },
  { focus: ['After-meal check', 'खाने के बाद जाँच'], tip: ['Check sugar 2 hours after lunch today.', 'आज दोपहर के खाने के 2 घंटे बाद शुगर जाँचिए।'], check: 'after_meal' },
  { focus: ['Your results', 'आपके नतीजे'], tip: ['Last fasting check today. Your 14-day results are ready tonight.', 'आज आख़िरी खाली पेट जाँच। आज रात आपके 14 दिन के नतीजे तैयार होंगे।'], check: 'fasting' },
];

/** Gentle progression: post-meal walks from 10 to 25 minutes, plus chair yoga, strength and breathing. */
const exercisesFor = (day: number) =>
  day <= 3 ? [{ exerciseId: 'postmeal', minutes: 10 }]
  : day <= 7 ? [{ exerciseId: 'postmeal', minutes: 15 }, { exerciseId: 'chairyoga', minutes: 10 }]
  : day <= 10 ? [{ exerciseId: 'postmeal', minutes: 20 }, { exerciseId: 'sitstand', minutes: 5 }]
  : [{ exerciseId: 'postmeal', minutes: 25 }, { exerciseId: 'pranayama', minutes: 10 }];

export async function seedPrograms(db: PrismaClient) {
  if ((await db.programTemplate.count()) > 0) {
    console.log(`Hindi text added to ${await fillProgramHindi(db)} plan(s)`);
    return;
  }
  const verified = new Set((await db.food.findMany({ where: { active: true, reviewStatus: 'verified' }, select: { id: true } })).map((f) => f.id));
  for (const t of TEMPLATES) {
    const p = POOLS[t.region];
    const meals: { day: number; slot: string; foodId: string; qty: number; sort: number }[] = [];
    const add = (day: number, slot: string, items: Item[]) => items.forEach(([foodId, qty]) => verified.has(foodId) && meals.push({ day, slot, foodId, qty, sort: meals.length }));
    for (let day = 1; day <= 14; day++) {
      const i = day - 1;
      add(day, 'breakfast', p.breakfast[i % p.breakfast.length]);
      add(day, 'lunch', [...p.lunchBase, [p.lunchMain[i % p.lunchMain.length], 1], [p.sabzi[i % p.sabzi.length], 1]]);
      const main = t.diet === 'nonveg' && i % 2 === 0 ? NONVEG_DINNER[(i / 2) % NONVEG_DINNER.length] : p.dinnerMain[i % p.dinnerMain.length];
      add(day, 'dinner', [...p.dinnerBase, [main, 1], [p.sabzi[(i + 4) % p.sabzi.length], 1]]);
      add(day, 'snack', SNACKS[i % SNACKS.length]);
      if (t.risk === 'hypo_safe') add(day, 'snack', BEDTIME);
    }
    await db.programTemplate.create({
      data: {
        ...t, kcal: 1500,
        notes: NOTES[t.risk as keyof typeof NOTES][0],
        notesHi: NOTES[t.risk as keyof typeof NOTES][1],
        days: { create: DAYS.map((d, i) => ({ day: i + 1, focusEn: d.focus[0], focusHi: d.focus[1], tipEn: d.tip[0], tipHi: d.tip[1], sugarCheck: d.check, exercises: exercisesFor(i + 1) })) },
        meals: { create: meals },
      },
    });
  }
  console.log(`Kickstart templates: ${TEMPLATES.length}`);
}

if (require.main === module && !process.argv.includes('--demo')) {
  const db = new PrismaClient();
  seedPrograms(db)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}

/**
 * Demo programmes on existing demo patients (not Dadi, +91 90000 00002, kept for trying the real
 * signup): 3 waiting for review, 6 active on different days, 6 completed (2 then paid).
 * Uses the real ProgramService so plans, portions and results are computed the same way.
 */
export async function seedDemoEnrollments(db: PrismaClient) {
  const { ProgramService, istDate } = await import('../src/program/program.service');
  const svc = new ProgramService(db as never);
  const phones = Array.from({ length: 15 }, (_, i) => `+91900000${String(3 + i).padStart(4, '0')}`);
  const users = await db.user.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true }, orderBy: { phone: 'asc' } });
  await db.enrollment.deleteMany({ where: { patientId: { in: users.map((u) => u.id) } } });
  // Payments recorded on these patients by earlier demos or e2e runs would hide them from the trial tab.
  await db.subscription.deleteMany({ where: { patientId: { in: users.map((u) => u.id) } } });
  await db.patient.updateMany({ where: { userId: { in: users.map((u) => u.id) } }, data: { tier: 'FREE', tierUntil: null } });
  await db.dietPlan.deleteMany({ where: { patientId: { in: users.map((u) => u.id) }, title: { startsWith: '🚀' } } });
  await db.exercisePlan.deleteMany({ where: { patientId: { in: users.map((u) => u.id) }, title: { startsWith: '🚀' } } });
  const regions = ['north', 'south', 'west', 'east'];
  for (const [i, u] of users.entries()) {
    const risky = i < 3;
    await db.patient.update({
      where: { userId: u.id },
      data: { region: regions[i % 4], meds: risky ? 'insulin' : i % 3 ? 'none' : 'tablets', flags: i === 2 ? ['kidney'] : [], sex: i % 2 ? 'male' : 'female', heightCm: 150 + (i % 5) * 5, weightKg: 62 + (i % 6) * 4, dob: new Date(Date.UTC(1955 + (i % 20), 6, 1)), type: 'type2' },
    });
    const e = await svc.enroll(u.id);
    if (!e || risky) continue;
    // Active ones on days 2–12; completed ones started 16–21 days ago.
    const startedDaysAgo = i < 9 ? 1 + (i - 3) * 2 : 15 + (i - 9);
    await db.enrollment.update({ where: { id: e.id }, data: { startsOn: istDate(-startedDaysAgo), createdAt: new Date(Date.now() - (startedDaysAgo + 1) * 86400_000) } });
    await svc.copyPlan(e.id, 'active');
  }
  await svc.completeFinished();
  const done = await db.enrollment.findMany({ where: { patientId: { in: users.map((u) => u.id) }, status: 'completed' }, take: 2 });
  for (const e of done) {
    await db.subscription.create({ data: { patientId: e.patientId, planId: 'basic', status: 'active', startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 86400_000), provider: 'demo' } });
    await db.enrollment.update({ where: { id: e.id }, data: { status: 'converted', convertedAt: new Date() } });
  }
  console.log(`Demo programmes: ${users.length}`);
}

if (require.main === module && process.argv.includes('--demo')) {
  const db = new PrismaClient();
  seedDemoEnrollments(db).finally(() => db.$disconnect());
}
