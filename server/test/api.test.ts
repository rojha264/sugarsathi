/**
 * End-to-end API tests against the local database (docker compose db + seed).
 * Run: DATABASE_URL=postgresql://glucobuddy:glucobuddy@localhost:5432/glucobuddy npm test
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';

process.env.JWT_SECRET ??= 'test-secret';
process.env.OTP_MODE = 'dev';
process.env.DEV_TEST_PHONES = '+9190009*';
process.env.OTP_IP_LIMIT = '1000';

let app: INestApplication;
let db: PrismaService;
const run = Date.now() % 100000;
const phone = (n: number) => `+9190009${String(run).padStart(5, '0')}`.slice(0, 11) + String(n).padStart(2, '0');

async function loginPhone(p: string) {
  await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: p }).expect(200);
  const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone: p, code: '123456' }).expect(200);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string }; isNew: boolean };
}
async function loginStaff(email: string) {
  const res = await request(app.getHttpServer()).post('/auth/staff/login').send({ email, password: 'Admin@123' }).expect(200);
  return res.body as { accessToken: string; user: { id: string } };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Same as main.ts: the client IP comes from the proxy header.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.init();
  db = app.get(PrismaService);
});
afterAll(async () => {
  await db.user.deleteMany({ where: { phone: { startsWith: '+9190009' } } });
  await app.close();
});

describe('auth', () => {
  it('signs up with a phone OTP, rejects wrong codes, refreshes tokens', async () => {
    const p = phone(1);
    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: p }).expect(200);
    await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone: p, code: '000000' }).expect(401);
    const s = await loginPhone(p);
    expect(s.isNew).toBe(true);
    const r = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
    expect(r.body.accessToken).toBeTruthy();
    // A refresh token works once.
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
  });

  it('blocks admin routes for app users and wrong staff passwords', async () => {
    const s = await loginPhone(phone(2));
    await request(app.getHttpServer()).get('/admin/patients').set(auth(s.accessToken)).expect(403);
    await request(app.getHttpServer()).post('/auth/staff/login').send({ email: 'owner@glucobuddy.local', password: 'nope1234' }).expect(401);
    await request(app.getHttpServer()).get('/me').expect(401);
  });
});

describe('sync', () => {
  it('stores the outbox once even if sent twice, with server-side nutrition', async () => {
    const s = await loginPhone(phone(3));
    await request(app.getHttpServer()).patch('/me').set(auth(s.accessToken)).send({ name: 'Test Dadi', type: 'type2', diet: 'veg', lang: 'hi' }).expect(200);
    const now = Date.now();
    const batch = {
      meals: [{ id: `m-${run}`, slot: 'lunch', at: now, items: [{ id: 'roti', q: 2 }, { id: 'dal', q: 1 }] }],
      readings: [{ id: `r-${run}`, v: 182, ctx: 'fasting', at: now }],
      meds: [{ id: `med-${run}`, name: 'Metformin 500', time: '08:30', stock: 9 }],
      doses: [{ medId: `med-${run}`, date: '2026-10-23', status: 'taken' }],
      activity: [{ date: '2026-10-23', walkMin: 15, steps: 2500, water: 4 }],
    };
    await request(app.getHttpServer()).post('/sync/push').set(auth(s.accessToken)).send(batch).expect(200);
    await request(app.getHttpServer()).post('/sync/push').set(auth(s.accessToken)).send(batch).expect(200);
    expect(await db.meal.count({ where: { patientId: s.user.id } })).toBe(1);
    const meal = await db.meal.findUniqueOrThrow({ where: { id: `m-${run}` } });
    const roti = await db.food.findUniqueOrThrow({ where: { id: 'roti' } });
    const dal = await db.food.findUniqueOrThrow({ where: { id: 'dal' } });
    expect(meal.carbs).toBeCloseTo(roti.carbs * 2 + dal.carbs, 1);
    const stats = await db.patientStats.findUniqueOrThrow({ where: { patientId: s.user.id } });
    expect(stats.fastingAvg7).toBe(182);

    const pull = await request(app.getHttpServer()).get('/sync/pull').set(auth(s.accessToken)).expect(200);
    expect(pull.body.catalog.foods.length).toBeGreaterThan(100);
    expect(pull.body.me.name).toBe('Test Dadi');
    const later = await request(app.getHttpServer()).get(`/sync/pull?since=${pull.body.serverTime}`).set(auth(s.accessToken)).expect(200);
    expect(later.body.catalog.foods).toHaveLength(0);
  });

  it('keeps one lunch a day: a second lunch replaces the first, snacks can repeat', async () => {
    const s = await loginPhone(phone(31));
    const noon = Date.now();
    const push = (meals: object[]) => request(app.getHttpServer()).post('/sync/push').set(auth(s.accessToken)).send({ meals }).expect(200);
    await push([{ id: `l1-${run}`, slot: 'lunch', at: noon, items: [{ id: 'roti', q: 2 }], updatedAt: noon }]);
    await push([{ id: `l2-${run}`, slot: 'lunch', at: noon + 60_000, items: [{ id: 'rice', q: 1 }], updatedAt: noon + 60_000 }]);
    await push([{ id: `s1-${run}`, slot: 'snack', at: noon, items: [{ id: 'roti', q: 1 }], updatedAt: noon }, { id: `s2-${run}`, slot: 'snack', at: noon + 1, items: [{ id: 'roti', q: 1 }], updatedAt: noon + 1 }]);
    const live = await db.meal.findMany({ where: { patientId: s.user.id, deletedAt: null }, orderBy: { id: 'asc' } });
    expect(live.map((m) => m.id)).toEqual([`l2-${run}`, `s1-${run}`, `s2-${run}`]);
  });

  it('never lets one user overwrite another user’s rows', async () => {
    const a = await loginPhone(phone(4));
    const b = await loginPhone(phone(5));
    await request(app.getHttpServer()).post('/sync/push').set(auth(a.accessToken)).send({ readings: [{ id: `shared-${run}`, v: 120, ctx: 'random', at: Date.now() }] }).expect(200);
    await request(app.getHttpServer()).post('/sync/push').set(auth(b.accessToken)).send({ readings: [{ id: `shared-${run}`, v: 400, ctx: 'random', at: Date.now() }] }).expect(200);
    const r = await db.sugarReading.findUniqueOrThrow({ where: { id: `shared-${run}` } });
    expect([r.patientId, r.value]).toEqual([a.user.id, 120]);
  });

  it('rejects impossible readings', async () => {
    const s = await loginPhone(phone(6));
    await request(app.getHttpServer()).post('/sync/push').set(auth(s.accessToken)).send({ readings: [{ id: `bad-${run}`, v: 9999, ctx: 'random', at: Date.now() }] }).expect(400);
  });
});

describe('admin access', () => {
  it('limits a dietitian to assigned patients; the owner sees all', async () => {
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const owner = await loginStaff('owner@glucobuddy.local');
    const other = await db.patient.findFirstOrThrow({ where: { assignedDietitianId: { not: d1.user.id, notIn: [] }, type: { not: 'care' } } });
    await request(app.getHttpServer()).get(`/admin/patients/${other.userId}`).set(auth(d1.accessToken)).expect(403);
    await request(app.getHttpServer()).get(`/admin/patients/${other.userId}`).set(auth(owner.accessToken)).expect(200);
    const mine = await request(app.getHttpServer()).get('/admin/patients?pageSize=200').set(auth(d1.accessToken)).expect(200);
    expect(mine.body.data.every((p: { dietitian: { id: string } | null }) => p.dietitian?.id === d1.user.id)).toBe(true);
    const all = await request(app.getHttpServer()).get('/admin/patients?pageSize=200').set(auth(owner.accessToken)).expect(200);
    expect(all.body.total).toBeGreaterThan(mine.body.total);
  });

  it('filters by sugar range on the chosen average', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const res = await request(app.getHttpServer()).get('/admin/patients?ctx=fasting&days=7&sugarMin=180&sugarMax=250&pageSize=200').set(auth(owner.accessToken)).expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const p of res.body.data) expect(p.stats.fastingAvg7).toBeGreaterThanOrEqual(180), expect(p.stats.fastingAvg7).toBeLessThanOrEqual(250);
  });

  it('recomputes food nutrition when an ingredient changes', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const atta = await db.ingredient.findUniqueOrThrow({ where: { id: 'atta' } });
    const before = await db.food.findUniqueOrThrow({ where: { id: 'roti' } });
    const res = await request(app.getHttpServer()).put('/admin/ingredients/atta').set(auth(owner.accessToken)).send({ ...atta, updatedAt: undefined, carb: atta.carb + 10 }).expect(200);
    expect(res.body.foodsUpdated).toBeGreaterThan(0);
    const after = await db.food.findUniqueOrThrow({ where: { id: 'roti' } });
    expect(after.carbs).toBeGreaterThan(before.carbs);
    await request(app.getHttpServer()).put('/admin/ingredients/atta').set(auth(owner.accessToken)).send({ ...atta, updatedAt: undefined }).expect(200);
  });
});

describe('exercise videos', () => {
  it('stores sample videos from any YouTube link, rejects other links, and the app pulls them', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const ex = await db.exercise.findUniqueOrThrow({ where: { id: 'plank' } });
    const { updatedAt: _, videos: before, ...base } = ex;
    const ok = await request(app.getHttpServer())
      .put('/admin/exercises/plank').set(auth(owner.accessToken))
      .send({ ...base, videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ?si=x', title: 'Easy' }, { url: '' }] })
      .expect(200);
    expect(ok.body.videos).toEqual([{ id: 'dQw4w9WgXcQ', title: 'Easy' }]);
    const bad = await request(app.getHttpServer()).put('/admin/exercises/plank').set(auth(owner.accessToken)).send({ ...base, videos: [{ url: 'https://vimeo.com/1' }] }).expect(400);
    expect(bad.body.message).toBe('bad_youtube_row_1');
    const user = await loginPhone(phone(10));
    const pull = await request(app.getHttpServer()).get('/sync/pull').set(auth(user.accessToken)).expect(200);
    expect(pull.body.catalog.exercises.find((e: { id: string }) => e.id === 'plank').videos[0].id).toBe('dQw4w9WgXcQ');
    await request(app.getHttpServer()).put('/admin/exercises/plank').set(auth(owner.accessToken)).send({ ...base, videos: before }).expect(200);
  });
});

describe('food preference', () => {
  it('keeps egg and meat out of a vegetarian patient’s plan', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const s = await loginPhone(phone(11));
    await request(app.getHttpServer()).patch('/me').set(auth(s.accessToken)).send({ diet: 'veg' }).expect(200);
    const bad = await request(app.getHttpServer()).post('/admin/diet-plans').set(auth(owner.accessToken)).send({ patientId: s.user.id, title: 'x', items: [{ slot: 'lunch', foodId: 'chicken', qty: 1 }, { slot: 'lunch', foodId: 'dal', qty: 1 }] }).expect(400);
    expect(bad.body.message).toBe('foods_not_in_diet:chicken');
    const tpl = await db.dietTemplate.findFirstOrThrow({ where: { diet: 'nonveg' } });
    const r = await request(app.getHttpServer()).post('/admin/patients/bulk').set(auth(owner.accessToken)).send({ ids: [s.user.id], action: 'applyTemplate', templateId: tpl.id }).expect(200);
    expect(r.body.skippedFoods).toBeGreaterThan(0);
    const plan = await request(app.getHttpServer()).get('/me/plan').set(auth(s.accessToken)).expect(200);
    expect(plan.body.diet.items.every((i: { food: { diet: string } }) => i.food.diet === 'veg')).toBe(true);
    // Changing the preference in the app reaches the dietitian.
    await request(app.getHttpServer()).patch('/me').set(auth(s.accessToken)).send({ diet: 'egg' }).expect(200);
    const seen = await request(app.getHttpServer()).get(`/admin/patients/${s.user.id}`).set(auth(owner.accessToken)).expect(200);
    expect(seen.body.diet).toBe('egg');
  });
});

describe('chat, vitals and doses', () => {
  it('patient and dietitian chat both ways, with read receipts and online status', async () => {
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const d2 = await loginStaff('dietitian2@glucobuddy.local');
    const s = await loginPhone(phone(12));
    await db.patient.update({ where: { userId: s.user.id }, data: { assignedDietitianId: d1.user.id } });
    const first = await request(app.getHttpServer()).get('/chat').set(auth(s.accessToken)).expect(200);
    expect(first.body.dietitian.name).toBe('Dr. Anjali Sharma');
    expect(first.body.dietitian.online).toBe(true); // she just signed in above
    await request(app.getHttpServer()).post('/chat').set(auth(s.accessToken)).send({ text: '  ' }).expect(400);
    await request(app.getHttpServer()).post('/chat').set(auth(s.accessToken)).send({ text: 'My sugar was 250 after lunch' }).expect(201);
    const list = await request(app.getHttpServer()).get('/admin/chats').set(auth(d1.accessToken)).expect(200);
    const row = list.body.data.find((c: { patientId: string }) => c.patientId === s.user.id);
    expect(row).toMatchObject({ unread: 1, online: true, last: { fromStaff: false } });
    await request(app.getHttpServer()).get(`/admin/patients/${s.user.id}/chat`).set(auth(d2.accessToken)).expect(403);
    await request(app.getHttpServer()).post(`/admin/patients/${s.user.id}/chat`).set(auth(d1.accessToken)).send({ text: 'Skip rice at dinner and walk 10 minutes.' }).expect(201);
    await request(app.getHttpServer()).post(`/admin/patients/${s.user.id}/chat/read`).set(auth(d1.accessToken)).expect(200);
    const pull = await request(app.getHttpServer()).get('/sync/pull').set(auth(s.accessToken)).expect(200);
    expect(pull.body.chat.unread).toBe(1);
    const thread = await request(app.getHttpServer()).get('/chat').set(auth(s.accessToken)).expect(200);
    expect(thread.body.messages.map((m: { fromStaff: boolean; readAt: string | null }) => [m.fromStaff, !!m.readAt])).toEqual([[false, true], [true, false]]);
    await request(app.getHttpServer()).post('/chat/read').set(auth(s.accessToken)).expect(200);
    expect((await request(app.getHttpServer()).get('/sync/pull').set(auth(s.accessToken))).body.chat.unread).toBe(0);
  });

  it('ticks go sent, then delivered when the other side fetches, then read', async () => {
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const s = await loginPhone(phone(14));
    await db.patient.update({ where: { userId: s.user.id }, data: { assignedDietitianId: d1.user.id } });
    const mine = await request(app.getHttpServer()).post('/chat').set(auth(s.accessToken)).send({ text: 'Hello' }).expect(201);
    expect(mine.body).toMatchObject({ deliveredAt: null, readAt: null });
    await request(app.getHttpServer()).get('/admin/chats').set(auth(d1.accessToken)).expect(200);
    const tick = async () => {
      const r = await request(app.getHttpServer()).get(`/chat?after=${encodeURIComponent(mine.body.at)}`).set(auth(s.accessToken)).expect(200);
      return r.body.receipts.find((x: { id: string }) => x.id === mine.body.id);
    };
    expect(await tick()).toMatchObject({ deliveredAt: expect.any(String), readAt: null });
    await request(app.getHttpServer()).post(`/admin/patients/${s.user.id}/chat/read`).set(auth(d1.accessToken)).expect(200);
    expect((await tick()).readAt).toEqual(expect.any(String));
    // The dietitian's reply is delivered as soon as the phone syncs, before the chat is opened.
    const reply = await request(app.getHttpServer()).post(`/admin/patients/${s.user.id}/chat`).set(auth(d1.accessToken)).send({ text: 'Hi' }).expect(201);
    await request(app.getHttpServer()).get('/sync/pull').set(auth(s.accessToken)).expect(200);
    const seen = await request(app.getHttpServer()).get(`/admin/patients/${s.user.id}/chat`).set(auth(d1.accessToken)).expect(200);
    expect(seen.body.messages.find((m: { id: string }) => m.id === reply.body.id)).toMatchObject({ deliveredAt: expect.any(String), readAt: null });
  });

  it('stores weight, blood pressure and insulin units', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const s = await loginPhone(phone(13));
    const now = Date.now();
    await request(app.getHttpServer()).post('/sync/push').set(auth(s.accessToken)).send({ vitals: [{ id: `bp-${run}`, kind: 'bp', sys: 90, dia: 140, at: now }] }).expect(400);
    await request(app.getHttpServer())
      .post('/sync/push').set(auth(s.accessToken))
      .send({
        vitals: [{ id: `w-${run}`, kind: 'weight', weightKg: 72.5, at: now }, { id: `bp-${run}`, kind: 'bp', sys: 142, dia: 91, pulse: 78, at: now }],
        meds: [{ id: `ins-${run}`, name: 'Insulin Glargine', time: '22:00', kind: 'insulin', dose: 14, unit: 'units' }],
        doses: [{ medId: `ins-${run}`, date: '2026-10-23', status: 'taken', amount: 16 }],
      })
      .expect(200);
    const st = await db.patientStats.findUniqueOrThrow({ where: { patientId: s.user.id } });
    expect([st.weightKg, st.bpSys, st.bpDia]).toEqual([72.5, 142, 91]);
    expect((await db.doseLog.findUniqueOrThrow({ where: { id: `ins-${run}:2026-10-23` } })).amount).toBe(16);
    const v = await request(app.getHttpServer()).get(`/admin/patients/${s.user.id}/vitals`).set(auth(owner.accessToken)).expect(200);
    expect(v.body).toHaveLength(2);
  });
});

describe('plans and notifications', () => {
  it('a dietitian plan and a filtered notice reach the patient', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const s = await loginPhone(phone(7));
    await request(app.getHttpServer()).post('/sync/push').set(auth(s.accessToken)).send({ readings: [{ id: `hi-${run}`, v: 333, ctx: 'fasting', at: Date.now() }] }).expect(200);
    await request(app.getHttpServer())
      .post('/admin/diet-plans').set(auth(owner.accessToken))
      .send({ patientId: s.user.id, title: 'Test plan', items: [{ slot: 'breakfast', foodId: 'idli', qty: 2 }, { slot: 'lunch', foodId: 'salad', qty: 1 }] })
      .expect(201);
    const plan = await request(app.getHttpServer()).get('/me/plan').set(auth(s.accessToken)).expect(200);
    expect(plan.body.diet.items.map((i: { foodId: string }) => i.foodId)).toEqual(['idli', 'salad']);

    const sent = await request(app.getHttpServer())
      .post('/admin/notifications').set(auth(owner.accessToken))
      .send({ titleEn: 'Fasting check', bodyEn: 'Please recheck tomorrow', audience: { filter: { ctx: 'fasting', days: 7, sugarMin: 330, sugarMax: 340, q: phone(7) } } })
      .expect(201);
    expect(sent.body.recipients).toBe(1);
    const inbox = await request(app.getHttpServer()).get('/me/inbox').set(auth(s.accessToken)).expect(200);
    expect(inbox.body[0].titleEn).toBe('Fasting check');
    await request(app.getHttpServer()).post(`/me/inbox/${inbox.body[0].id}/read`).set(auth(s.accessToken)).expect(200);
  });
});

describe('admin saves', () => {
  it('creates, edits and deletes a diet template (template items have no programme day)', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const items = [{ slot: 'breakfast', foodId: 'idli', qty: 2, note: '', weekday: null }];
    const made = await request(app.getHttpServer()).post('/admin/diet-templates').set(auth(owner.accessToken))
      .send({ title: `T ${run}`, diet: 'veg', kcal: 1500, notes: '', items }).expect(201);
    await request(app.getHttpServer()).put(`/admin/diet-templates/${made.body.id}`).set(auth(owner.accessToken))
      .send({ title: `T2 ${run}`, titleHi: `टी2 ${run}`, notesHi: 'नोट', diet: 'veg', kcal: 1400, notes: 'x', items: [...items, { slot: 'lunch', foodId: 'salad', qty: 1, note: '', weekday: 1 }] }).expect(200);
    const row = await db.dietTemplate.findUniqueOrThrow({ where: { id: made.body.id }, include: { items: true } });
    expect([row.title, row.titleHi, row.notesHi, row.kcal, row.items.length]).toEqual([`T2 ${run}`, `टी2 ${run}`, 'नोट', 1400, 2]);
    await request(app.getHttpServer()).delete(`/admin/diet-templates/${made.body.id}`).set(auth(owner.accessToken)).expect(200);
  });
});

describe('production safety', () => {
  it('limits how many codes one IP address can request', async () => {
    process.env.OTP_IP_LIMIT = '3';
    try {
      const ask = (n: number) => request(app.getHttpServer()).post('/auth/otp/request').set('X-Forwarded-For', '203.0.113.9').send({ phone: phone(40 + n) });
      // Earlier tests used the default test IP; this one uses its own.
      const codes = [];
      for (let n = 0; n < 4; n++) codes.push((await ask(n)).status);
      expect(codes).toEqual([200, 200, 200, 429]);
    } finally {
      process.env.OTP_IP_LIMIT = '1000';
    }
  });
});

describe('reels (YouTube learning videos)', () => {
  it('staff add, edit, order and delete reels; phones get them by sync; views show in analytics', async () => {
    const http = app.getHttpServer();
    const owner = await loginStaff('owner@glucobuddy.local');
    const put = (id: string, body: object) => request(http).put(`/admin/reels/${id}`).set(auth(owner.accessToken)).send(body);
    expect((await put('new', { url: 'https://example.com/x', titleEn: 'Bad', category: 'learn' }).expect(400)).body.message).toBe('bad_youtube');
    expect((await put('new', { url: 'https://youtube.com/shorts/abcdefghijk', titleEn: '', category: 'learn' }).expect(400)).body.message).toBe('no_title');
    const a = (await put('new', { url: 'https://youtube.com/shorts/abcdefghijk', titleEn: `Sugar basics ${run}`, titleHi: 'शुगर की बातें', category: 'learn', lang: 'hi' }).expect(200)).body;
    const b = (await put('new', { url: 'https://youtu.be/bcdefghijkl', titleEn: `Millet roti ${run}`, category: 'recipe' }).expect(200)).body;
    expect(a.youtubeId).toBe('abcdefghijk');
    // Newest goes on top; then staff reorder.
    await request(http).post('/admin/reels/order').set(auth(owner.accessToken)).send({ ids: [a.id, b.id] }).expect(200);
    await put(a.id, { youtubeId: a.youtubeId, titleEn: `Sugar basics ${run}`, titleHi: 'शुगर की बातें', category: 'myth', lang: 'hi' }).expect(200);
    const list = (await request(http).get(`/admin/reels?q=${encodeURIComponent('शुगर')}`).set(auth(owner.accessToken)).expect(200)).body.data;
    expect(list[0]).toMatchObject({ id: a.id, category: 'myth' });

    const s = await loginPhone(phone(33));
    const pull = async () => (await request(http).get('/sync/pull').set(auth(s.accessToken)).expect(200)).body.catalog.reels as { id: string; deletedAt: string | null }[];
    expect((await pull()).map((r) => r.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    await request(http).delete(`/admin/reels/${b.id}`).set(auth(owner.accessToken)).expect(200);
    expect((await pull()).find((r) => r.id === b.id)?.deletedAt).toBeTruthy();

    await request(http).post('/sync/push').set(auth(s.accessToken)).send({
      appEvents: [
        { id: `rv-${run}`, name: 'reel_view', props: { reelId: a.id, seconds: 40 }, at: Date.now() - 1000 },
        { id: `rs-${run}`, name: 'reel_save', props: { reelId: a.id }, at: Date.now() - 900 },
      ],
    }).expect(200);
    const an = (await request(http).get('/admin/analytics?days=7').set(auth(owner.accessToken)).expect(200)).body.engagement.reels;
    expect(an.top.find((r: { reelId: string }) => r.reelId === a.id)).toMatchObject({ views: 1, saves: 1, avgSec: 40, title: `Sugar basics ${run}` });
    await request(http).delete(`/admin/reels/${a.id}`).set(auth(owner.accessToken)).expect(200);
  });

  it('sends one "we miss you" message to people quiet for 3+ days', async () => {
    const { LifecycleService } = await import('../src/notify/lifecycle.service');
    const s = await loginPhone(phone(34));
    const noon = new Date();
    noon.setUTCHours(6, 30, 0, 0);
    await db.patient.update({ where: { userId: s.user.id }, data: { consentAt: new Date(noon.getTime() - 20 * 86400_000), type: 'type2' } });
    await db.user.update({ where: { id: s.user.id }, data: { lastActiveAt: new Date(noon.getTime() - 5 * 86400_000) } });
    const svc = app.get(LifecycleService);
    await svc.run(noon);
    await svc.run(noon);
    const got = await db.notificationReceipt.findMany({ where: { userId: s.user.id, notification: { kind: 'life:winback' } } });
    expect(got).toHaveLength(1);
  });
});

describe('search in Hindi or English', () => {
  it('finds foods and patients across scripts and Hinglish spellings, best match first', async () => {
    const owner = await loginStaff('owner@glucobuddy.local');
    const foods = (q: string) => request(app.getHttpServer()).get(`/admin/foods?q=${encodeURIComponent(q)}&pageSize=5`).set(auth(owner.accessToken)).expect(200).then((r) => r.body.data.map((f: { id: string }) => f.id));
    expect((await foods('रोटी'))[0]).toBe('roti');
    expect((await foods('chaval'))[0]).toBe('rice');
    expect(await foods('panir')).toContain('paneer');

    const s = await loginPhone(phone(32));
    await request(app.getHttpServer()).patch('/me').set(auth(s.accessToken)).send({ name: `राकेश ${run}`, type: 'type2', diet: 'veg', lang: 'hi' }).expect(200);
    const found = await request(app.getHttpServer()).get(`/admin/patients?q=rakesh ${run}&pageSize=5`).set(auth(owner.accessToken)).expect(200);
    expect(found.body.data.map((p: { id: string }) => p.id)).toContain(s.user.id);
  });
});

describe('family', () => {
  it('shares with an approved caregiver only', async () => {
    const dadi = await loginPhone(phone(8));
    const grandson = await loginPhone(phone(9));
    const code = (await request(app.getHttpServer()).post('/family/share').set(auth(dadi.accessToken)).expect(200)).body.code;
    await request(app.getHttpServer()).post('/family/join').set(auth(grandson.accessToken)).send({ code: '000000', name: 'X' }).expect(400);
    await request(app.getHttpServer()).post('/family/join').set(auth(grandson.accessToken)).send({ code, name: 'Rakesh' }).expect(200);
    await request(app.getHttpServer()).get(`/family/${dadi.user.id}/day`).set(auth(grandson.accessToken)).expect(403);
    await request(app.getHttpServer()).post(`/family/members/${grandson.user.id}/approve`).set(auth(dadi.accessToken)).expect(200);
    const day = await request(app.getHttpServer()).get(`/family/${dadi.user.id}/day`).set(auth(grandson.accessToken)).expect(200);
    expect(day.body.snap.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await request(app.getHttpServer()).post(`/family/${dadi.user.id}/message`).set(auth(grandson.accessToken)).send({ kind: 'cheer' }).expect(201);
    const pull = await request(app.getHttpServer()).get('/sync/pull').set(auth(dadi.accessToken)).expect(200);
    expect(pull.body.family.messages[0].kind).toBe('cheer');
    await request(app.getHttpServer()).delete('/family/share').set(auth(dadi.accessToken)).expect(200);
    await request(app.getHttpServer()).get(`/family/${dadi.user.id}/day`).set(auth(grandson.accessToken)).expect(403);
  });
});

describe('analytics and dietitian assignment', () => {
  it('counts install steps without login, stores visits from sync, and auto-assigns a dietitian at onboarding', async () => {
    const http = app.getHttpServer();
    const installId = `test-install-${run}`;
    await request(http).post('/analytics/install').send({ id: installId, platform: 'android', steps: { open: Date.now(), lang: Date.now(), bogus: 1 } }).expect(200);
    await request(http).post('/analytics/install').send({ id: installId, platform: 'android', steps: { open: Date.now() + 5000, mode: Date.now() } }).expect(200);
    const inst = await db.appInstall.findUniqueOrThrow({ where: { id: installId } });
    expect(Object.keys(inst.steps as object).sort()).toEqual(['lang', 'mode', 'open']);
    await request(http).post('/analytics/install').send({ platform: 'android' }).expect(400);

    const s = await loginPhone(phone(15));
    await request(http).patch('/me').set(auth(s.accessToken)).send({ name: 'New Patient', type: 'type2', consentVer: 2 }).expect(200);
    expect((await db.patient.findUniqueOrThrow({ where: { userId: s.user.id } })).assignedDietitianId).not.toBeNull();

    const visit = { id: `visit-${run}`, startedAt: Date.now() - 60_000, seconds: 240, screens: { '/': 120, '/meal': 120 }, platform: 'android', appVersion: '1.2.0' };
    await request(http).post('/sync/push').set(auth(s.accessToken)).send({ sessions: [visit, { ...visit, id: `bad-${run}`, seconds: -5 }], installId }).expect(200);
    await request(http).post('/sync/push').set(auth(s.accessToken)).send({ sessions: [visit] }).expect(200); // resend is a no-op
    expect(await db.appSession.count({ where: { userId: s.user.id } })).toBe(1);
    expect((await db.appInstall.findUniqueOrThrow({ where: { id: installId } })).userId).toBe(s.user.id);

    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    await request(http).get('/admin/analytics').set(auth(d1.accessToken)).expect(403);
    const owner = await loginStaff('owner@glucobuddy.local');
    const r = await request(http).get('/admin/analytics?days=7').set(auth(owner.accessToken)).expect(200);
    expect(r.body.daily).toHaveLength(7);
    expect(r.body.kpis.dau).toBeGreaterThanOrEqual(1);
    expect(r.body.funnel.map((f: { step: string }) => f.step)).toEqual(['open', 'lang', 'mode', 'diet', 'phone', 'otp', 'setup', 'done', 'firstLog', 'week1']);
    expect(r.body.screens.find((x: { screen: string }) => x.screen === '/meal')).toBeTruthy();
  });
});

describe('first-week messages, plan and video events, revenue', () => {
  it('picks the right day-2 / day-7 message once, only in the daytime', async () => {
    const { lifecycleDue, isDaytimeIST, LifecycleService } = await import('../src/notify/lifecycle.service');
    const t0 = new Date('2026-10-20T04:30:00Z'); // 10 AM IST
    const at = (h: number) => new Date(t0.getTime() + h * 3600_000);
    expect(lifecycleDue(t0, at(10), false, new Set())).toBeNull();
    expect(lifecycleDue(t0, at(30), false, new Set())).toBe('life:day2:new');
    expect(lifecycleDue(t0, at(30), true, new Set())).toBe('life:day2:active');
    expect(lifecycleDue(t0, at(30), true, new Set(['life:day2:new']))).toBeNull();
    expect(lifecycleDue(t0, at(150), true, new Set(['life:day2:active']))).toBe('life:day7');
    expect(lifecycleDue(t0, at(300), true, new Set())).toBeNull();
    expect(lifecycleDue(t0, at(14 * 24), true, new Set(['life:day2:active', 'life:day7']))).toBe('life:day14');
    expect(lifecycleDue(t0, at(30 * 24), true, new Set(['life:day14']))).toBe('life:day30');
    expect(lifecycleDue(t0, at(40 * 24), true, new Set())).toBeNull();
    expect(isDaytimeIST(new Date('2026-10-20T04:30:00Z'))).toBe(true); // 10 AM IST
    expect(isDaytimeIST(new Date('2026-10-20T17:30:00Z'))).toBe(false); // 11 PM IST

    const s = await loginPhone(phone(16));
    const noon = new Date();
    noon.setUTCHours(6, 30, 0, 0); // 12 PM IST today
    await db.patient.update({ where: { userId: s.user.id }, data: { consentAt: new Date(noon.getTime() - 30 * 3600_000), type: 'type2' } });
    const svc = app.get(LifecycleService);
    await svc.run(noon);
    await svc.run(noon); // second run sends nothing new
    const got = await db.notificationReceipt.findMany({ where: { userId: s.user.id, notification: { kind: { startsWith: 'life:' } } }, include: { notification: true } });
    expect(got.map((r) => r.notification.kind)).toEqual(['life:day2:new']);
  });

  it('stores plan / video / exercise events and reports them with revenue and outcomes', async () => {
    const http = app.getHttpServer();
    const s = await loginPhone(phone(17));
    const ev = (name: string, props: object) => ({ id: `${name}-${run}-${Math.random()}`, name, props, at: Date.now() - 1000 });
    await request(http).post('/sync/push').set(auth(s.accessToken)).send({
      appEvents: [ev('video_play', { videoId: `vid-${run}`, title: 'Test video', seconds: 90 }), ev('exercise_done', { exerciseId: 'squat', minutes: 10 }), ev('hack', {}), ev('plan_ate', { big: 'x'.repeat(600) })],
    }).expect(200);
    expect(await db.appEvent.count({ where: { userId: s.user.id } })).toBe(2);
    const owner = await loginStaff('owner@glucobuddy.local');
    const r = await request(http).get('/admin/analytics?days=7').set(auth(owner.accessToken)).expect(200);
    expect(r.body.engagement.videos.top.find((v: { videoId: string }) => v.videoId === `vid-${run}`)).toMatchObject({ plays: 1, avgSec: 90 });
    expect(r.body.revenue).toEqual(expect.objectContaining({ mrr: expect.any(Number), paying: expect.any(Number), churnPct: expect.any(Number) }));
    expect(Array.isArray(r.body.outcomes)).toBe(true);
  });
});

describe('thalis (admin-managed one-tap plates)', () => {
  it('validates, derives diet and nutrition, orders, hides and reaches the app via pull', async () => {
    const http = app.getHttpServer();
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const id = `test-thali-${run}`;
    const put = (body: object) => request(http).put(`/admin/thalis/${id}`).set(auth(d1.accessToken)).send(body);
    await put({ emoji: '🍛', nameEn: 'Test', nameHi: 'टेस्ट', items: [{ foodId: 'roti', qty: 2 }] }).expect(400); // needs 2 foods
    await put({ emoji: '🍛', nameEn: 'Test', nameHi: 'टेस्ट', items: [{ foodId: 'roti', qty: 2 }, { foodId: 'nope', qty: 1 }] }).expect(400);
    const saved = await put({ emoji: '🍛', nameEn: 'Test chicken plate', nameHi: 'टेस्ट', slots: ['lunch', 'bogus'], items: [{ foodId: 'roti', qty: 2 }, { foodId: 'chicken', qty: 1 }] }).expect(200);
    expect(saved.body).toMatchObject({ diet: 'nonveg', slots: ['lunch'] });
    expect(saved.body.nutrition.carbs).toBeGreaterThan(20);
    const list = await request(http).get('/admin/thalis').set(auth(d1.accessToken)).expect(200);
    const row = list.body.data.find((t: { id: string }) => t.id === id);
    expect(row.nutrition).toEqual(expect.objectContaining({ protein: expect.any(Number), fiber: expect.any(Number), kcal: expect.any(Number) }));

    const p = await loginPhone(phone(18));
    const before = Date.now() - 60_000;
    const pull = await request(http).get(`/sync/pull?since=${before}`).set(auth(p.accessToken)).expect(200);
    expect(pull.body.catalog.thalis.some((t: { id: string }) => t.id === id)).toBe(true);

    await request(http).delete(`/admin/thalis/${id}`).set(auth(d1.accessToken)).expect(200);
    const gone = await request(http).get(`/sync/pull?since=${before}`).set(auth(p.accessToken)).expect(200);
    expect(gone.body.catalog.thalis.find((t: { id: string }) => t.id === id)).toMatchObject({ active: false, deletedAt: expect.any(String) });
    expect((await request(http).get('/admin/thalis').set(auth(d1.accessToken))).body.data.some((t: { id: string }) => t.id === id)).toBe(false);
  });
});

describe('"For you" foods picked by the dietitian', () => {
  it('saves picks for the patient diet only, notifies on new ones, and sends them in pull', async () => {
    const http = app.getHttpServer();
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const d2 = await loginStaff('dietitian2@glucobuddy.local');
    const s = await loginPhone(phone(19));
    await db.patient.update({ where: { userId: s.user.id }, data: { assignedDietitianId: d1.user.id, diet: 'veg' } });
    const url = `/admin/patients/${s.user.id}/picks`;
    await request(http).put(url).set(auth(d2.accessToken)).send({ picks: [] }).expect(403);
    const bad = await request(http).put(url).set(auth(d1.accessToken)).send({ picks: [{ foodId: 'chicken' }] }).expect(400);
    expect(bad.body.message).toBe('not_in_diet_chicken');
    await request(http).put(url).set(auth(d1.accessToken)).send({ picks: [{ foodId: 'salad' }, { foodId: 'salad' }] }).expect(400);
    const ok = await request(http).put(url).set(auth(d1.accessToken)).send({
      notify: true,
      picks: [{ foodId: 'salad', slots: ['lunch', 'dinner', 'bogus'], note: 'Eat this first' }, { foodId: 'dal' }],
    }).expect(200);
    expect(ok.body).toMatchObject({ saved: 2, added: 2, notified: true });
    const again = await request(http).put(url).set(auth(d1.accessToken)).send({ notify: true, picks: [{ foodId: 'dal' }, { foodId: 'salad', slots: ['lunch'] }] }).expect(200);
    expect(again.body).toMatchObject({ added: 0, notified: false }); // reorder / edit only: no new message

    const pull = await request(http).get('/sync/pull').set(auth(s.accessToken)).expect(200);
    expect(pull.body.picks).toEqual([{ foodId: 'dal', slots: [], note: '' }, { foodId: 'salad', slots: ['lunch'], note: '' }]);
    const inbox = await request(http).get('/me/inbox').set(auth(s.accessToken)).expect(200);
    expect(JSON.stringify(inbox.body)).toContain('Your meal menu is updated');
    expect(JSON.stringify(inbox.body)).toContain('मेन्यू');
  });

  it('defaults the meal menu to the active diet plan foods until a custom menu is saved', async () => {
    const http = app.getHttpServer();
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const s = await loginPhone(phone(20));
    await db.patient.update({ where: { userId: s.user.id }, data: { assignedDietitianId: d1.user.id, diet: 'veg' } });
    const url = `/admin/patients/${s.user.id}/picks`;
    await db.dietPlan.updateMany({ where: { patientId: s.user.id }, data: { status: 'ended' } });
    expect((await request(http).get(url).set(auth(d1.accessToken)).expect(200)).body.default).toEqual({ source: 'none', planTitle: null, items: [] });

    await db.dietPlan.create({
      data: {
        patientId: s.user.id, title: 'Menu test', status: 'active', dietitianId: d1.user.id, startsOn: new Date(),
        items: { create: [{ slot: 'lunch', foodId: 'dal' }, { slot: 'dinner', foodId: 'dal' }, { slot: 'breakfast', foodId: 'salad' }] },
      },
    });
    const r = await request(http).get(url).set(auth(d1.accessToken)).expect(200);
    expect(r.body.data).toEqual([]);
    expect(r.body.default.source).toBe('plan');
    expect(r.body.default.planTitle).toBe('Menu test');
    expect(r.body.default.items).toEqual(expect.arrayContaining([{ foodId: 'dal', slots: ['lunch', 'dinner'] }, { foodId: 'salad', slots: ['breakfast'] }]));
    const show = await request(http).get(`/admin/patients/${s.user.id}`).set(auth(d1.accessToken)).expect(200);
    expect(show.body._count).toEqual({ foodPicks: 0, dietPlans: 1 });
  });
});

describe('14-day Kickstart programme', () => {
  const http = () => app.getHttpServer();
  const signup = async (n: number, profile: object) => {
    const s = await loginPhone(phone(n));
    await db.enrollment.deleteMany({ where: { patientId: s.user.id } });
    await request(http()).patch('/me').set(auth(s.accessToken)).send({ name: 'Kick', type: 'type2', diet: 'veg', consentVer: 2, ...profile }).expect(200);
    return s;
  };

  it('auto-enrols a low-risk patient in the matching plan with portions scaled to their calories', async () => {
    const s = await signup(20, { sex: 'female', birthYear: 1968, heightCm: 158, weightKg: 72, region: 'south', meds: 'none', flags: [] });
    const e = await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } });
    expect(e).toMatchObject({ status: 'active', templateId: 'veg-south', kcal: 1200, riskReasons: [] });
    const plan = await db.dietPlan.findFirstOrThrow({ where: { patientId: s.user.id, status: 'active' }, include: { items: true } });
    expect(new Set(plan.items.map((i) => i.day)).size).toBe(14);
    // Hindi readers get the plan in Hindi, with the portion in plain words.
    expect(plan.titleHi).toMatch(/^🚀 14 दिन का प्लान: /);
    expect(plan.notesHi).toContain('रोटी / चावल: आम मात्रा का तीन-चौथाई');
    expect(plan.notes).toContain('Roti / rice: three-quarters of the usual amount');
    // 1200 kcal → grain portions ×0.75: the template's 1 katori rice becomes 1 (rounded to halves: 0.75 → 1) and 3 idli → 2.5 rounds to 2.5
    const idli = plan.items.find((i) => i.foodId === 'idli');
    expect(idli?.qty).toBe(2.5);
    const ex = await db.exercisePlan.findFirstOrThrow({ where: { patientId: s.user.id, status: 'active' }, include: { items: true } });
    expect(ex.items.find((i) => i.day === 14)?.minutes).toBe(25);
    const pull = await request(http()).get('/sync/pull').set(auth(s.accessToken)).expect(200);
    expect(pull.body.program).toMatchObject({ status: 'active', title: 'Veg · South Indian' });
    const mine = await request(http()).get('/me/program').set(auth(s.accessToken)).expect(200);
    expect(mine.body.enrollment).toMatchObject({ status: 'active', day: 1 }); // trial day 1 = the day the plan is shared
    expect(mine.body.days).toHaveLength(14);
    // Enrolling twice does nothing new
    await request(http()).patch('/me').set(auth(s.accessToken)).send({ consentVer: 2 }).expect(200);
    expect(await db.enrollment.count({ where: { patientId: s.user.id } })).toBe(1);
  });

  it('holds risky profiles for review, rechecks when a low reading syncs, and starts after approval', async () => {
    const s = await signup(21, { sex: 'male', birthYear: 1960, heightCm: 170, weightKg: 80, region: 'north', meds: 'insulin' });
    const e = await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } });
    expect(e.status).toBe('pending_review');
    expect(e.riskReasons).toContain('insulin');
    expect(e.templateId).toBe('veg-north-safe'); // insulin → steady-carb plan
    expect(await db.dietPlan.count({ where: { patientId: s.user.id, status: 'draft' } })).toBe(1);

    const owner = await loginStaff('owner@glucobuddy.local');
    const queue = await request(http()).get('/admin/enrollments').set(auth(owner.accessToken)).expect(200);
    expect(queue.body.data.some((x: { id: string }) => x.id === e.id)).toBe(true);
    await request(http()).post(`/admin/enrollments/${e.id}/approve`).set(auth(owner.accessToken)).send({}).expect(200);
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('active');
    expect(await db.dietPlan.count({ where: { patientId: s.user.id, status: 'active', title: { startsWith: '🚀' } } })).toBe(1);

    // A low-risk start becomes pending when a dangerous first reading arrives before day 1.
    const t = await signup(22, { sex: 'female', birthYear: 1975, heightCm: 160, weightKg: 60, region: 'west', meds: 'none' });
    expect((await db.enrollment.findFirstOrThrow({ where: { patientId: t.user.id } })).status).toBe('active');
    await request(http()).post('/sync/push').set(auth(t.accessToken)).send({ readings: [{ id: `low-${run}`, v: 58, ctx: 'fasting', at: Date.now() }] }).expect(200);
    const after = await db.enrollment.findFirstOrThrow({ where: { patientId: t.user.id } });
    expect(after).toMatchObject({ status: 'pending_review' });
    expect(after.riskReasons).toContain('sugar_low');
  });

  it('computes 14-day results and completes the programme', async () => {
    const s = await signup(23, { sex: 'female', birthYear: 1970, heightCm: 155, weightKg: 70, region: 'north', meds: 'none' });
    const e = await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } });
    const start = new Date(Date.now() - 15 * 86400_000);
    const startsOn = new Date(start.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    await db.enrollment.update({ where: { id: e.id }, data: { startsOn } });
    const at = (day: number, h = 8) => new Date(new Date(`${startsOn}T00:00:00+05:30`).getTime() + (day - 1) * 86400_000 + h * 3600_000);
    const rd = (day: number, v: number, ctx = 'fasting') => ({ id: `r-${run}-${day}-${ctx}`, patientId: s.user.id, value: v, ctx, at: at(day), updatedAt: at(day) });
    await db.sugarReading.createMany({ data: [rd(1, 170), rd(2, 166), rd(3, 174), rd(12, 140), rd(13, 138), rd(14, 142)] });
    const owner = await loginStaff('owner@glucobuddy.local');
    const res = await request(http()).get(`/admin/patients/${s.user.id}/enrollment`).set(auth(owner.accessToken)).expect(200);
    expect(res.body.result).toMatchObject({ fastingBefore: 170, fastingAfter: 140, improved: true });
    const svc = app.get((await import('../src/program/program.service')).ProgramService);
    await svc.completeFinished();
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('completed');
    const mine = await request(http()).get('/me/program').set(auth(s.accessToken)).expect(200);
    expect(mine.body.result.improved).toBe(true);
    expect(mine.body.offer.length).toBeGreaterThan(0);
    await request(http()).post('/me/program/interest').set(auth(s.accessToken)).send({ planId: mine.body.offer[0].id }).expect(200);
    expect((await db.chatMessage.findFirstOrThrow({ where: { patientId: s.user.id }, orderBy: { createdAt: 'desc' } })).text).toContain('want to continue');
  });

  it('rejects templates with draft foods and sends the programme messages by day', async () => {
    const d1 = await loginStaff('dietitian1@glucobuddy.local');
    const draft = await db.food.findFirstOrThrow({ where: { reviewStatus: 'draft' } });
    const res = await request(http()).put('/admin/programs/test-tpl').set(auth(d1.accessToken)).send({ title: 'T', diet: 'veg', region: 'north', days: [], meals: [{ day: 1, slot: 'lunch', foodId: draft.id }] }).expect(400);
    expect(res.body.message).toContain('foods_not_available');
    const { kickstartDue } = await import('../src/notify/lifecycle.service');
    expect(kickstartDue(1, new Set(), false)).toBe('kick:day1');
    expect(kickstartDue(4, new Set(['kick:day1']), false)).toBe('kick:day3');
    expect(kickstartDue(5, new Set(['kick:day1']), false)).toBeNull(); // too late for day 3's message
    expect(kickstartDue(17, new Set(['kick:results']), true)).toBeNull(); // paid already: no offer reminder
  });
});

describe('editing health details later', () => {
  it('keeps a running plan but tells the dietitian when a new risk appears; before day 1 it goes back to review', async () => {
    const http = app.getHttpServer();
    const s = await loginPhone(phone(24));
    await db.enrollment.deleteMany({ where: { patientId: s.user.id } });
    await request(http).patch('/me').set(auth(s.accessToken)).send({ type: 'type2', diet: 'veg', consentVer: 2, sex: 'female', birthYear: 1970, heightCm: 158, weightKg: 68, region: 'north', meds: 'none' }).expect(200);
    const e = await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } });

    // Day 5 of the programme: starting insulin keeps the plan running and messages the dietitian.
    const fiveDaysAgo = new Date(Date.now() + 330 * 60_000 - 4 * 86400_000).toISOString().slice(0, 10);
    await db.enrollment.update({ where: { id: e.id }, data: { startsOn: fiveDaysAgo } });
    await request(http).patch('/me').set(auth(s.accessToken)).send({ weightKg: 67, meds: 'insulin', consentVer: 2 }).expect(200);
    const after = await db.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.status).toBe('active');
    expect(after.riskReasons).toContain('insulin');
    const note = await db.chatMessage.findFirstOrThrow({ where: { patientId: s.user.id }, orderBy: { createdAt: 'desc' } });
    expect(note.text).toContain('now on insulin');
    // Saving the same details again does not repeat the message.
    await request(http).patch('/me').set(auth(s.accessToken)).send({ meds: 'insulin' }).expect(200);
    expect(await db.chatMessage.count({ where: { patientId: s.user.id } })).toBe(1);

    // Before day 1: a new risk sends the plan back to review.
    const tomorrow = new Date(Date.now() + 330 * 60_000 + 86400_000).toISOString().slice(0, 10);
    await db.enrollment.update({ where: { id: e.id }, data: { startsOn: tomorrow, riskReasons: [] } });
    await request(http).patch('/me').set(auth(s.accessToken)).send({ flags: ['kidney'] }).expect(200);
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('pending_review');
    expect((await db.patient.findUniqueOrThrow({ where: { userId: s.user.id } })).weightKg).toBe(67);
  });
});

describe('phone login without an SMS service (dev mode)', () => {
  it('lets any number sign in with the fixed code, tells the app, and refuses dev mode in production', async () => {
    const http = app.getHttpServer();
    const num = `98${String(run).padStart(8, '0').slice(-8)}`; // not a test number
    const r = await request(http).post('/auth/otp/request').send({ phone: num }).expect(200);
    expect(r.body).toMatchObject({ sent: true, testCode: '123456' });
    await request(http).post('/auth/otp/verify').send({ phone: num, code: '000000' }).expect(401);
    const ok = await request(http).post('/auth/otp/verify').send({ phone: num, code: '123456' }).expect(200);
    expect(ok.body.accessToken).toBeTruthy();
    await db.user.delete({ where: { phone: r.body.phone } });

    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await request(http).post('/auth/otp/request').send({ phone: num }).expect(503);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe('trial → subscriber lifecycle (admin tabs, payments, expiry)', () => {
  const ymd = (days: number) => new Date(Date.now() + 330 * 60_000 + days * 86400_000).toISOString().slice(0, 10);

  it('moves a patient from trial to subscriber and back to ended, with the right tabs and reminders', async () => {
    const http = app.getHttpServer();
    const owner = await loginStaff('owner@glucobuddy.local');
    const s = await loginPhone(phone(25));
    await db.enrollment.deleteMany({ where: { patientId: s.user.id } });
    await db.subscription.deleteMany({ where: { patientId: s.user.id } });
    await request(http).patch('/me').set(auth(s.accessToken)).send({ type: 'type2', diet: 'veg', consentVer: 2, sex: 'male', birthYear: 1975, heightCm: 170, weightKg: 75, region: 'south', meds: 'none' }).expect(200);
    const inTab = async (tab: string, extra = '') => {
      const r = await request(http).get(`/admin/patients?lifecycle=${tab}${extra}&q=${encodeURIComponent(phone(25).slice(-10))}&pageSize=5`).set(auth(owner.accessToken)).expect(200);
      return r.body.data.find((x: { id: string }) => x.id === s.user.id);
    };

    // Trial started today (the plan was shared at signup): day 1, 13 days left.
    expect((await inTab('trial')).lifecycle).toMatchObject({ stage: 'trial', trial: { day: 1, daysLeft: 13 } });
    expect(await inTab('trial', '&trialEndsIn=3')).toBeUndefined();
    await db.enrollment.updateMany({ where: { patientId: s.user.id }, data: { startsOn: ymd(-11) } }); // day 12
    expect((await inTab('trial', '&trialEndsIn=3')).lifecycle.trial.daysLeft).toBe(2);
    const counts = await request(http).get('/admin/patients/lifecycle').set(auth(owner.accessToken)).expect(200);
    expect(counts.body.trialsEnding).toBeGreaterThanOrEqual(1);

    // Payment recorded → subscriber, trial converted, tier set, welcome notice.
    await request(http).post(`/admin/patients/${s.user.id}/subscriptions`).set(auth(owner.accessToken)).send({ planId: 'basic', method: 'bitcoin' }).expect(400);
    const sub = await request(http).post(`/admin/patients/${s.user.id}/subscriptions`).set(auth(owner.accessToken)).send({ planId: 'basic', method: 'upi', ref: 'UPI123', amountInr: 249 }).expect(201);
    expect(await inTab('trial')).toBeUndefined();
    expect((await inTab('subscriber')).lifecycle.subscription).toMatchObject({ active: true, amountInr: 249 });
    expect((await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } })).status).toBe('converted');
    expect((await db.patient.findUniqueOrThrow({ where: { userId: s.user.id } })).tier).toBe('BASIC');

    // Renewal reminder 7 days before the end, only once; a renewal starts when the current one ends.
    await db.subscription.update({ where: { id: sub.body.id }, data: { endsAt: new Date(Date.now() + 5 * 86400_000) } });
    expect(await inTab('subscriber', '&renewalIn=7')).toBeTruthy();
    const svc = app.get((await import('../src/admin/subscriptions.controller')).SubscriptionService);
    expect(await svc.remind()).toBeGreaterThanOrEqual(1);
    const again = await svc.remind();
    expect(await db.alertSent.count({ where: { patientId: s.user.id, key: { startsWith: 'sub:' } } })).toBe(1);
    expect(again).toBe(0);
    const renewed = await request(http).post(`/admin/subscriptions/${sub.body.id}/renew`).set(auth(owner.accessToken)).send({ method: 'cash' }).expect(201);
    const firstEnd = (await db.subscription.findUniqueOrThrow({ where: { id: sub.body.id } })).endsAt;
    expect(new Date(renewed.body.startsAt).getTime()).toBe(firstEnd.getTime()); // renewal starts when the current period ends
    const history = await request(http).get(`/admin/patients/${s.user.id}/subscriptions`).set(auth(owner.accessToken)).expect(200);
    expect(history.body.data).toHaveLength(2);

    // Cancel both → ended; nightly expiry drops the tier.
    await request(http).post(`/admin/subscriptions/${renewed.body.id}/cancel`).set(auth(owner.accessToken)).expect(200);
    await request(http).post(`/admin/subscriptions/${sub.body.id}/cancel`).set(auth(owner.accessToken)).expect(200);
    expect((await inTab('ended')).lifecycle.stage).toBe('ended');
    expect((await db.patient.findUniqueOrThrow({ where: { userId: s.user.id } })).tier).toBe('FREE');
  });

  it('starts a trial when a dietitian shares a plan by hand, and closes an unpaid trial after day 14', async () => {
    const http = app.getHttpServer();
    const owner = await loginStaff('owner@glucobuddy.local');
    const s = await loginPhone(phone(26));
    await db.enrollment.deleteMany({ where: { patientId: s.user.id } });
    await db.subscription.deleteMany({ where: { patientId: s.user.id } });
    await request(http).post('/admin/diet-plans').set(auth(owner.accessToken)).send({ patientId: s.user.id, title: 'Personal plan', items: [{ slot: 'lunch', foodId: 'dal', qty: 1 }] }).expect(201);
    const e = await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } });
    expect(e).toMatchObject({ status: 'active', startsOn: ymd(0), templateId: null });

    // Unpaid, past day 14 → completed, its programme plans closed.
    await db.enrollment.update({ where: { id: e.id }, data: { startsOn: ymd(-15) } });
    await db.dietPlan.updateMany({ where: { patientId: s.user.id, status: 'active' }, data: { title: '🚀 14-day plan: test' } });
    await app.get((await import('../src/program/program.service')).ProgramService).completeFinished();
    expect((await db.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('completed');
    expect(await db.dietPlan.count({ where: { patientId: s.user.id, status: 'active' } })).toBe(0);
  });
});

describe('editing a diet plan from the admin', () => {
  it('accepts the plan sent back exactly as it was loaded (ids, dietitian, dates) and saves items', async () => {
    const http = app.getHttpServer();
    const owner = await loginStaff('owner@glucobuddy.local');
    const s = await loginPhone(phone(27));
    await db.patient.update({ where: { userId: s.user.id }, data: { diet: 'veg' } });
    await request(http).post('/admin/diet-plans').set(auth(owner.accessToken)).send({ patientId: s.user.id, title: 'Plan', items: [{ slot: 'lunch', foodId: 'dal', qty: 1 }, { slot: 'lunch', foodId: 'roti', qty: 2 }] }).expect(201);
    const [loaded] = (await request(http).get(`/admin/diet-plans?patientId=${s.user.id}`).set(auth(owner.accessToken)).expect(200)).body;
    const items = [...loaded.items.filter((i: { foodId: string }) => i.foodId !== 'dal'), { slot: 'dinner', foodId: 'salad', qty: 1 }];
    await request(http).put(`/admin/diet-plans/${loaded.id}`).set(auth(owner.accessToken)).send({ ...loaded, patientId: s.user.id, items }).expect(200);
    const [after] = (await request(http).get(`/admin/diet-plans?patientId=${s.user.id}`).set(auth(owner.accessToken)).expect(200)).body;
    expect(after.items.map((i: { foodId: string }) => i.foodId).sort()).toEqual(['roti', 'salad']);
    // A food the patient does not eat is refused with a clear code.
    const bad = await request(http).put(`/admin/diet-plans/${loaded.id}`).set(auth(owner.accessToken)).send({ ...after, items: [{ slot: 'dinner', foodId: 'chicken', qty: 1 }] }).expect(400);
    expect(bad.body.message).toContain('foods_not_in_diet');
  });
});

describe('changing food preference during the 14-day plan', () => {
  it('moves the plan to the matching template and keeps the day count', async () => {
    const http = app.getHttpServer();
    const s = await loginPhone(phone(28));
    await db.enrollment.deleteMany({ where: { patientId: s.user.id } });
    await request(http).patch('/me').set(auth(s.accessToken)).send({ type: 'type2', diet: 'nonveg', consentVer: 2, sex: 'male', birthYear: 1980, heightCm: 172, weightKg: 70, region: 'south', meds: 'none' }).expect(200);
    const e = await db.enrollment.findFirstOrThrow({ where: { patientId: s.user.id } });
    expect(e.templateId).toBe('nonveg-south');
    await request(http).patch('/me').set(auth(s.accessToken)).send({ diet: 'veg', consentVer: 2 }).expect(200);
    const after = await db.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(after).toMatchObject({ templateId: 'veg-south', startsOn: e.startsOn, status: 'active' });
    const plan = await db.dietPlan.findFirstOrThrow({ where: { patientId: s.user.id, status: 'active' }, include: { items: { include: { food: true } } } });
    expect(plan.items.every((i) => i.food.diet === 'veg')).toBe(true);
  });
});
