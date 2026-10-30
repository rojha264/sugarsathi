import { Show } from '@refinedev/antd';
import { bmi, bpBand } from '@shared/presence';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useOne } from '@refinedev/core';
import { Alert, App, Button, Card, Col, Descriptions, Empty, Form, Input, InputNumber, List, Row, Segmented, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Tooltip as Hint, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { Diet } from '@shared/diet';
import { isOnline } from '@shared/presence';

import { ChatPane, OnlineDot } from '../components/ChatPane';
import { ForYouPicks } from '../components/ForYouPicks';
import { KickstartTab } from '../components/KickstartTab';
import { StageTag, type Lifecycle } from '../components/lifecycle';
import { SubscriptionTab } from '../components/SubscriptionTab';
import { presenceText } from '../components/presence';
import { PlanBuilder, type BuilderItem } from '../components/PlanBuilder';
import { AttentionTags, SugarTag, type Stats } from '../components/StatusTag';
import { BilingualTitleNotes } from '../components/Bilingual';
import { SugarChart } from '../components/SugarChart';
import { useFoods } from '../components/useFoods';
import { AGES, CTX, DIETS, fmt, SLOT_LABEL, TIERS, TYPES, WEEKDAYS, type Slot } from '../lib/labels';
import { api } from '../providers/api';
import { bilingual } from '../lib/search';


type Snapshot = {
  day: string; score: number; walkMin: number; steps: number; water: number;
  meals: { slot: Slot; at: number; foods: { e: string; en: string; q: number }[]; c: number }[];
  doses: { name: string; at: string; s: string | null }[];
  sugar: { v: number; ctx: string; at: number }[];
};
type Patient = {
  userId: string; type: string; ageGroup: string; diet: string; sex: string | null; heightCm: number | null; weightKg: number | null; tier: string; tierUntil: string | null;
  lifecycle: Lifecycle;
  targetMealCarbs: number; targetProtein: number; targetFiber: number; targetKcal: number | null; targetMode: string; sugarEvery: string;
  user: { name: string; phone: string; lang: string; createdAt: string; lastActiveAt: string | null };
  stats: Stats | null; assignedDietitian: { id: string; name: string } | null;
  medications: { id: string; name: string; time: string; kind: string; dose: number | null; unit: string | null; stock: number | null }[];
  checkups: { kind: string; lastDone: string; value: number | null }[];
  circle: { members: { name: string; status: string }[] } | null;
  today: Snapshot;
  care: { low: { name: string; left: number; days: number }[]; checkupsDue: string[] };
};
type Plan = {
  id: string; title: string; titleHi?: string; status: string; startsOn: string; notes: string; notesHi?: string; dietitian?: { name: string } | null;
  carbsBreakfast: number | null; carbsLunch: number | null; carbsDinner: number | null; protein: number | null; fiber: number | null; kcal: number | null;
  items: (BuilderItem & { id: string })[];
};

function Overview({ p, id }: { p: Patient; id: string }) {
  const [days, setDays] = useState(30);
  const [readings, setReadings] = useState<{ value: number; ctx: string; at: string }[]>([]);
  useEffect(() => {
    api<typeof readings>(`/admin/patients/${id}/readings?from=${dayjs().subtract(days, 'day').toISOString()}`).then(setReadings);
  }, [id, days]);
  const s = p.stats;
  const t = p.today;
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {[
          ['Fasting avg 7d', s?.fastingAvg7, 'fasting'],
          ['After-meal avg 7d', s?.afterAvg7, 'after'],
          ['All readings 7d', s?.avg7, 'random'],
        ].map(([label, v, ctx]) => (
          <Col xs={12} md={6} xl={4} key={label as string}>
            <Card size="small"><Statistic title={label as string} value={v == null ? '–' : (v as number)} suffix={v == null ? '' : 'mg/dL'} /><SugarTag v={v as number} ctx={ctx as string} /></Card>
          </Col>
        ))}
        <Col xs={12} md={6} xl={4}>
          <Card size="small">
            <Statistic title="Estimated HbA1c" value={fmt(s?.ea1c, '%')} />
            {p.checkups.find((c) => c.kind === 'a1c')?.value ? (
              <Typography.Text type="secondary">
                Lab: <b>{p.checkups.find((c) => c.kind === 'a1c')!.value}%</b> ({dayjs(p.checkups.find((c) => c.kind === 'a1c')!.lastDone).format('D MMM YYYY')})
              </Typography.Text>
            ) : null}
          </Card>
        </Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="In range (30 d)" value={fmt(s?.inRange30, '%')} /></Card></Col>
        <Col xs={12} md={6} xl={4}><Card size="small"><Statistic title="Medicine taken (7 d)" value={fmt(s?.medAdherence7, '%')} /></Card></Col>
      </Row>
      <Card title="Blood sugar" extra={<Segmented value={days} onChange={(v) => setDays(v as number)} options={[{ label: '7 d', value: 7 }, { label: '30 d', value: 30 }, { label: '90 d', value: 90 }]} />}>
        {readings.length ? <SugarChart readings={readings} /> : <Empty description="No readings in this period" />}
      </Card>
      <Row gutter={[12, 12]}>
        <Col xs={24} xl={12}>
          <Card title={`Today (${t.day}) · score ${t.score}/100`}>
            <Timeline
              items={[
                ...t.sugar.map((r) => ({ t: r.at, color: r.v < 70 || r.v > 250 ? 'red' : 'blue', children: <>🩸 {r.v} mg/dL · {CTX[r.ctx]} · {dayjs(r.at).format('h:mm A')}</> })),
                ...t.meals.map((m) => ({ t: m.at, color: 'green', children: <>{SLOT_LABEL[m.slot]} {dayjs(m.at).format('h:mm A')}: {m.foods.map((f) => `${f.e} ${f.en}${f.q !== 1 ? ` ×${f.q}` : ''}`).join(', ')} · ~{m.c} g carbs</> })),
              ]
                .sort((a, b) => a.t - b.t)
                .map(({ t: _, ...i }) => i)}
            />
            <Space wrap>
              {t.doses.map((d, i) => <Tag key={i} color={d.s === 'taken' ? 'green' : d.s === 'skipped' ? 'red' : 'default'}>💊 {d.at} {d.name}: {d.s ?? 'not marked'}</Tag>)}
              <Tag>🚶 {t.walkMin} min · {t.steps} steps</Tag>
              <Tag>💧 {t.water} glasses</Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Medicines and checkups">
            <List
              size="small"
              dataSource={p.medications}
              locale={{ emptyText: 'No medicines' }}
              renderItem={(m) => (
                <List.Item extra={m.stock != null ? <Tag color={p.care.low.some((l) => l.name === m.name) ? 'red' : 'default'}>{m.stock} left</Tag> : null}>
                  {m.kind === 'insulin' ? '💉' : m.kind === 'syrup' ? '🧴' : '💊'} {m.time} · {m.name}
                  {m.dose ? <Tag style={{ marginLeft: 6 }}>{m.dose} {m.unit === 'units' ? 'units' : m.unit === 'ml' ? 'ml' : 'tab'}</Tag> : null}
                </List.Item>
              )}
            />
            <Descriptions size="small" column={1} style={{ marginTop: 12 }}>
              {p.checkups.map((c) => (
                <Descriptions.Item key={c.kind} label={c.kind.toUpperCase()}>
                  {dayjs(c.lastDone).format('D MMM YYYY')}{c.value ? ` · ${c.value}%` : ''} {p.care.checkupsDue.includes(c.kind) ? <Tag color="orange">Due</Tag> : null}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function Meals({ id }: { id: string }) {
  const foods = useFoods();
  const byId = new Map(foods.map((f) => [f.id, f]));
  const [rows, setRows] = useState<{ id: string; slot: Slot; at: string; items: { id: string; q: number }[]; carbs: number; protein: number; fiber: number; kcal: number }[]>([]);
  useEffect(() => {
    api<typeof rows>(`/admin/patients/${id}/meals?from=${dayjs().subtract(14, 'day').toISOString()}`).then(setRows);
  }, [id]);
  return (
    <Table
      rowKey="id"
      dataSource={rows}
      pagination={{ pageSize: 20 }}
      columns={[
        { title: 'When', render: (_, r) => dayjs(r.at).format('ddd D MMM, h:mm A') },
        { title: 'Meal', render: (_, r) => SLOT_LABEL[r.slot] },
        { title: 'Foods', render: (_, r) => r.items.map((i) => { const f = byId.get(i.id); return f ? `${f.emoji} ${f.nameEn}${i.q !== 1 ? ` ×${i.q}` : ''}` : i.id; }).join(', ') },
        { title: 'Carbs', dataIndex: 'carbs', render: (v) => <Tag color={v > 70 ? 'orange' : 'default'}>{Math.round(v)} g</Tag> },
        { title: 'Protein', dataIndex: 'protein', render: (v) => `${Math.round(v)} g` },
        { title: 'Fiber', dataIndex: 'fiber', render: (v) => `${Math.round(v)} g` },
        { title: 'kcal', dataIndex: 'kcal', render: (v) => Math.round(v) },
      ]}
    />
  );
}

function Activity({ id }: { id: string }) {
  const [data, setData] = useState<{ activity: { date: string; walkMin: number; steps: number; water: number; score: number | null }[]; doses: { date: string; status: string; amount: number | null; medication: { name: string; time: string } }[] } | null>(null);
  useEffect(() => {
    api<NonNullable<typeof data>>(`/admin/patients/${id}/activity`).then(setData);
  }, [id]);
  const byDate = new Map<string, { taken: number; total: number }>();
  for (const d of data?.doses ?? []) {
    const e = byDate.get(d.date) ?? { taken: 0, total: 0 };
    byDate.set(d.date, { taken: e.taken + (d.status === 'taken' ? 1 : 0), total: e.total + 1 });
  }
  return (
    <Table
      rowKey="date"
      dataSource={data?.activity ?? []}
      pagination={false}
      columns={[
        { title: 'Date', dataIndex: 'date', render: (v) => dayjs(v).format('ddd D MMM') },
        { title: 'Score', dataIndex: 'score', render: (v) => <Tag color={v >= 60 ? 'green' : v >= 40 ? 'orange' : 'red'}>{v ?? '–'}</Tag> },
        { title: 'Medicine', render: (_, r) => { const d = byDate.get(r.date); return d ? `${d.taken}/${d.total}` : '–'; } },
        {
          title: 'Insulin / doses',
          render: (_, r) =>
            (data?.doses ?? [])
              .filter((d) => d.date === r.date && d.amount)
              .map((d) => <Tag key={d.medication.name + d.medication.time}>{d.medication.name} {d.amount}</Tag>),
        },
        { title: 'Walk', dataIndex: 'walkMin', render: (v) => `${v} min` },
        { title: 'Steps', dataIndex: 'steps' },
        { title: 'Water', dataIndex: 'water', render: (v) => `${v} glasses` },
      ]}
    />
  );
}

type VitalRow = { id: string; kind: 'weight' | 'bp'; weightKg: number | null; sys: number | null; dia: number | null; pulse: number | null; at: string };

/** Weight and blood pressure history with charts and BMI. */
function Vitals({ id, heightCm }: { id: string; heightCm: number | null }) {
  const [rows, setRows] = useState<VitalRow[]>([]);
  useEffect(() => {
    api<VitalRow[]>(`/admin/patients/${id}/vitals`).then(setRows);
  }, [id]);
  const weights = rows.filter((r) => r.kind === 'weight').map((r) => ({ t: dayjs(r.at).valueOf(), kg: r.weightKg }));
  const bps = rows.filter((r) => r.kind === 'bp').map((r) => ({ t: dayjs(r.at).valueOf(), sys: r.sys, dia: r.dia }));
  const lastW = weights.at(-1)?.kg ?? null;
  const lastBp = bps.at(-1);
  const band = lastBp?.sys && lastBp.dia ? bpBand(lastBp.sys, lastBp.dia) : null;
  if (!rows.length) return <Empty description="No weight or blood pressure logged yet" />;
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Weight" value={lastW ?? '–'} suffix={lastW ? 'kg' : ''} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="BMI" value={lastW && heightCm ? bmi(lastW, heightCm)! : '–'} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Blood pressure" value={lastBp ? `${lastBp.sys}/${lastBp.dia}` : '–'} />
            {band ? <Tag color={band === 'normal' ? 'green' : band === 'crisis' || band === 'high2' ? 'red' : 'orange'}>{band}</Tag> : null}
          </Card>
        </Col>
      </Row>
      {weights.length > 1 ? (
        <Card size="small" title="Weight (kg)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weights}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={(t) => dayjs(t).format('D MMM')} />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip labelFormatter={(t) => dayjs(t as number).format('D MMM YYYY')} />
              <Line dataKey="kg" stroke="#1677ff" dot />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : null}
      {bps.length ? (
        <Card size="small" title="Blood pressure (mmHg)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={bps}>
              <CartesianGrid strokeDasharray="3 3" />
              <ReferenceLine y={130} stroke="#faad14" strokeDasharray="4 4" />
              <ReferenceLine y={80} stroke="#faad14" strokeDasharray="4 4" />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={(t) => dayjs(t).format('D MMM')} />
              <YAxis domain={[50, 'dataMax + 10']} />
              <Tooltip labelFormatter={(t) => dayjs(t as number).format('D MMM, h:mm A')} />
              <Legend />
              <Line dataKey="sys" name="Systolic" stroke="#eb2f96" dot />
              <Line dataKey="dia" name="Diastolic" stroke="#722ed1" dot />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : null}
    </Space>
  );
}

/** A 14-day Kickstart copy: its items belong to programme days 1–14. */
const isProgram = (items?: { day?: number | null }[]) => !!items?.some((i) => i.day != null);

function DietPlanTab({ p, id }: { p: Patient; id: string }) {
  const { message } = App.useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState<Partial<Plan> | null>(null);
  const [templates, setTemplates] = useState<{ id: string; title: string; titleHi: string; kcal: number | null; notes: string; notesHi: string; items: BuilderItem[] }[]>([]);
  const load = useCallback(() => {
    api<Plan[]>(`/admin/diet-plans?patientId=${id}`).then(setPlans);
  }, [id]);
  useEffect(() => {
    load();
    api<{ data: typeof templates }>('/admin/diet-templates').then((r) => setTemplates(r.data));
  }, [load]);
  const active = plans.find((x) => x.status === 'active');
  // The active plan is edited in place: changes stay here until Save (or Discard).
  const [edits, setEdits] = useState<Plan['items'] | null>(null);
  const [savingEdits, setSavingEdits] = useState(false);
  useEffect(() => setEdits(null), [active?.id]);
  const saveEdits = async () => {
    if (!active || !edits) return;
    setSavingEdits(true);
    try {
      await api(`/admin/diet-plans/${active.id}`, { method: 'PUT', json: { ...active, patientId: id, items: edits } });
      message.success('Plan updated; the app shows it on next sync');
      setEdits(null);
      load();
    } catch (e) {
      const m = (e as Error).message;
      message.error(
        m.startsWith('foods_not_in_diet') ? `Remove the foods marked "Not for ${DIETS[p.diet]} patient" first.` : m.startsWith('foods_not_verified') ? 'Some foods are still drafts (not verified) and cannot be in a plan.' : m,
      );
    } finally {
      setSavingEdits(false);
    }
  };
  const defaults = { carbsBreakfast: Math.min(p.targetMealCarbs, 45), carbsLunch: p.targetMealCarbs, carbsDinner: Math.min(p.targetMealCarbs, 50), protein: p.targetProtein, fiber: p.targetFiber, kcal: p.targetKcal };
  const save = async () => {
    if (!draft) return;
    const body = { ...draft, patientId: id, items: draft.items ?? [] };
    if (draft.id) await api(`/admin/diet-plans/${draft.id}`, { method: 'PUT', json: body });
    else await api('/admin/diet-plans', { method: 'POST', json: { ...body, status: 'active' } });
    message.success('Diet plan saved; the app shows it on next sync');
    setDraft(null);
    load();
  };

  if (draft) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Row gutter={12}>
          {(['carbsBreakfast', 'carbsLunch', 'carbsDinner', 'protein', 'fiber', 'kcal'] as const).map((k) => (
            <Col xs={8} md={2} key={k}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{{ carbsBreakfast: 'Bkfst carbs', carbsLunch: 'Lunch carbs', carbsDinner: 'Dinner carbs', protein: 'Protein/day', fiber: 'Fiber/day', kcal: 'kcal/day' }[k]}</Typography.Text>
              <InputNumber value={draft[k] ?? undefined} onChange={(v) => setDraft({ ...draft, [k]: v })} style={{ width: '100%' }} />
            </Col>
          ))}
        </Row>
        <BilingualTitleNotes value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
        <Typography.Text type="secondary">The patient uses the app in <b>{p.user.lang === 'hi' ? 'हिन्दी (Hindi)' : 'English'}</b>. Notes on single foods show as typed.</Typography.Text>
        <Typography.Text type="secondary">Food preference: <b>{DIETS[p.diet]}</b>. Only foods the patient eats can be added.</Typography.Text>
        <PlanBuilder items={draft.items ?? []} onChange={(items) => setDraft({ ...draft, items: items as Plan['items'] })} targets={draft} diet={p.diet as never} programDays={isProgram(draft.items) ? 14 : undefined} />
        <Space>
          <Hint title={!draft.title ? 'Add a title first' : !(draft.items ?? []).length ? 'Add at least one food first' : undefined}><Button type="primary" onClick={save} disabled={!draft.title || !(draft.items ?? []).length}>Save plan</Button></Hint>
          <Button onClick={() => setDraft(null)}>Cancel</Button>
        </Space>
      </Space>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Button type="primary" onClick={() => setDraft({ title: 'Personal diet plan', titleHi: 'आपका डाइट प्लान', notes: '', notesHi: '', items: [], ...defaults })}>➕ New plan</Button>
        <Select
          placeholder="Start from a template…"
          style={{ width: 280 }}
          options={templates.map((t) => ({ value: t.id, label: t.title }))}
          onChange={(tid) => {
            const t = templates.find((x) => x.id === tid)!;
            setDraft({ title: t.title, titleHi: t.titleHi, notes: t.notes, notesHi: t.notesHi, ...defaults, kcal: t.kcal ?? defaults.kcal, items: t.items.map(({ slot, foodId, qty, note, weekday }) => ({ slot, foodId, qty, note, weekday })) as Plan['items'] });
          }}
        />
        {active ? <Button onClick={() => setDraft({ ...active })}>✏️ Edit current plan</Button> : null}
      </Space>
      {active ? (
        <Card title={<>🥗 {active.title} <Tag color="green">Active since {dayjs(active.startsOn).format('D MMM')}</Tag></>} extra={active.dietitian?.name}>
          {active.notes ? <Typography.Paragraph>{active.notes}</Typography.Paragraph> : null}
          {edits ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12, position: 'sticky', top: 0, zIndex: 2 }}
              message="Unsaved changes to this plan"
              action={
                <Space>
                  <Button onClick={() => setEdits(null)}>Discard</Button>
                  <Button type="primary" loading={savingEdits} onClick={saveEdits}>Save changes</Button>
                </Space>
              }
            />
          ) : null}
          <PlanBuilder items={edits ?? active.items} onChange={(items) => setEdits(items as Plan['items'])} targets={active} diet={p.diet as never} programDays={isProgram(active.items) ? 14 : undefined} />
        </Card>
      ) : (
        <Empty description="No active diet plan" />
      )}
      {plans.filter((x) => x.status !== 'active').length ? (
        <Card size="small" title="Earlier plans">
          {plans.filter((x) => x.status !== 'active').map((x) => <div key={x.id}>{dayjs(x.startsOn).format('D MMM YYYY')} · {x.title}</div>)}
        </Card>
      ) : null}
    </Space>
  );
}

type ExItem = { exerciseId: string; minutes: number; time: string; weekdays: number[]; day?: number | null };
/** Programme plans list "every day" exercises first, then day 1–14 in order. */
const byDay = (list: ExItem[]) => [...list].sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
const DAY_OPTIONS = [{ value: 0, label: 'Every day' }, ...Array.from({ length: 14 }, (_, i) => ({ value: i + 1, label: `Day ${i + 1}` }))];

function ExerciseTab({ id }: { id: string }) {
  const { message } = App.useApp();
  type Ex = { id: string; emoji: string; nameEn: string; nameHi: string; defaultMin: number; safeFor: string[]; intensity: string };
  const [exercises, setExercises] = useState<Ex[]>([]);
  const [plan, setPlan] = useState<{ id: string; title: string; titleHi?: string; notes?: string; notesHi?: string; startsOn?: string; endsOn?: string | null; items: (ExItem & { exercise: Ex })[] } | null>(null);
  const [items, setItems] = useState<ExItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  /** Day a newly added exercise goes to in a 14-day plan (0 = every day). */
  const [addDay, setAddDay] = useState(0);
  const load = useCallback(() => {
    api<NonNullable<typeof plan>[]>(`/admin/exercise-plans?patientId=${id}`).then((r) => setPlan(r.find((p) => (p as { status?: string }).status === 'active') ?? r[0] ?? null));
  }, [id]);
  useEffect(() => {
    load();
    api<{ data: Ex[] }>('/admin/exercises?pageSize=2000').then((r) => setExercises(r.data));
  }, [load]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const current = (plan?.items ?? []).map(({ exerciseId, minutes, time, weekdays, day }) => ({ exerciseId, minutes, time, weekdays, day }));
  const editing = items;
  // A 14-day plan (🚀) keeps its day column even when only "every day" exercises are left.
  const program = isProgram(editing ?? current) || !!plan?.title.startsWith('🚀');
  const startEdit = () => setItems(byDay(current));
  const update = (i: number, patch: Partial<ExItem>) => editing && setItems(byDay(editing.map((x, j) => (j === i ? { ...x, ...patch } : x))));
  /** Picking an exercise works straight away: it opens editing if needed. */
  const add = (exerciseId: string) => {
    const base = editing ?? byDay(current);
    setItems(byDay([...base, { exerciseId, minutes: byId.get(exerciseId)?.defaultMin ?? 10, time: '', weekdays: [], day: program && addDay ? addDay : null }]));
  };
  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api('/admin/exercise-plans', {
        method: 'POST',
        json: {
          patientId: id, title: plan?.title ?? 'Exercise plan', titleHi: plan?.titleHi || 'व्यायाम प्लान', notes: plan?.notes ?? '', notesHi: plan?.notesHi ?? '',
          // Keep the plan's dates: a 14-day plan must stay on the same day count.
          ...(plan?.startsOn ? { startsOn: plan.startsOn, endsOn: plan.endsOn ?? null } : {}),
          items: editing,
        },
      });
      message.success('Exercise plan saved; the app shows it on next sync');
      setItems(null);
      load();
    } finally {
      setSaving(false);
    }
  };
  const rows = editing ?? byDay(current);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        {editing ? (
          <>
            <Hint title={!editing.length ? 'Add at least one exercise first' : undefined}><Button type="primary" loading={saving} onClick={save} disabled={!editing.length}>Save plan</Button></Hint>
            <Button onClick={() => setItems(null)}>Cancel</Button>
            <Typography.Text type="warning">Unsaved changes</Typography.Text>
          </>
        ) : (
          <Button onClick={startEdit}>{plan ? '✏️ Edit plan' : '➕ New plan'}</Button>
        )}
      </Space>
      <Card size="small" title="➕ Add an exercise">
        <Space wrap>
          {program ? (
            <Select style={{ width: 140 }} value={addDay} onChange={setAddDay} options={DAY_OPTIONS} aria-label="Add to day" />
          ) : null}
          <Select
            {...bilingual}
            value={null}
            placeholder="Search exercise (Hindi or English)…"
            style={{ width: 380 }}
            options={exercises.map((e) => ({ value: e.id, label: `${e.emoji} ${e.nameEn} · ${e.nameHi} (${e.intensity}, ${e.defaultMin} min)`, search: [e.nameEn, e.nameHi, e.id] }))}
            onChange={(v) => v && add(v)}
          />
          <Typography.Text type="secondary">{program ? 'This is a 14-day plan: pick the day, or "Every day".' : 'Then set minutes, time and days below, and Save.'}</Typography.Text>
        </Space>
      </Card>
      <Table
        rowKey={(_, i) => String(i)}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'No exercise plan yet. Add an exercise above.' }}
        columns={[
          ...(program
            ? [{
                title: 'Day', width: 150,
                render: (_: unknown, r: ExItem, i: number) =>
                  editing ? <Select style={{ width: 130 }} value={r.day ?? 0} options={DAY_OPTIONS} onChange={(d) => update(i, { day: d || null })} /> : r.day ? <Tag color="green">Day {r.day}</Tag> : <Tag color="blue">Every day</Tag>,
              }]
            : []),
          { title: 'Exercise', render: (_, r) => { const e = byId.get(r.exerciseId); return e ? <>{e.emoji} {e.nameEn} · {e.nameHi} {e.safeFor.includes('senior') ? <Tag>senior-safe</Tag> : null}</> : r.exerciseId; } },
          { title: 'Minutes', render: (_, r, i) => (editing ? <InputNumber min={1} max={120} value={r.minutes} onChange={(v) => update(i, { minutes: Number(v) || 5 })} /> : `${r.minutes} min`) },
          { title: 'Time', render: (_, r, i) => (editing ? <Input style={{ width: 90 }} placeholder="HH:MM" value={r.time} onChange={(e) => update(i, { time: e.target.value })} /> : r.time || '–') },
          ...(program
            ? []
            : [{
                title: 'Days',
                render: (_: unknown, r: ExItem, i: number) =>
                  editing ? (
                    <Select mode="multiple" placeholder="Every day" style={{ minWidth: 200 }} value={r.weekdays} options={WEEKDAYS.map((w, d) => ({ value: d, label: w }))} onChange={(v) => update(i, { weekdays: v })} />
                  ) : r.weekdays.length ? r.weekdays.map((d) => WEEKDAYS[d]).join(', ') : 'Every day',
              }]),
          ...(editing ? [{ title: '', render: (_: unknown, __: unknown, i: number) => <Button danger type="text" onClick={() => setItems(editing.filter((_, j) => j !== i))}>Remove</Button> }] : []),
        ]}
      />
    </Space>
  );
}

function TargetsTab({ p, id, onSaved }: { p: Patient; id: string; onSaved(): void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      layout="vertical"
      style={{ maxWidth: 520 }}
      initialValues={{ ...p, tierUntil: p.tierUntil?.slice(0, 10), assignedDietitianId: p.assignedDietitian?.id }}
      onFinish={async (v) => {
        await api(`/admin/patients/${id}`, { method: 'PATCH', json: v });
        message.success('Saved; the app picks this up on next sync');
        onSaved();
      }}>
      <Form.Item name="targetMode" label="Targets">
        <Select options={[{ value: 'auto', label: 'Auto: the app adjusts from sugar readings (within safe limits)' }, { value: 'dietitian', label: 'Dietitian-set: use these numbers as they are' }]} />
      </Form.Item>
      <Row gutter={12}>
        <Col span={8}><Form.Item name="targetMealCarbs" label="Carbs per main meal (g)"><InputNumber min={20} max={120} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item name="targetProtein" label="Protein per day (g)"><InputNumber min={20} max={150} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item name="targetFiber" label="Fiber per day (g)"><InputNumber min={10} max={60} style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <Form.Item name="targetKcal" label="Calories per day (optional)"><InputNumber min={800} max={4000} style={{ width: '100%' }} /></Form.Item>
      <Row gutter={12}>
        <Col span={12}><Form.Item name="tier" label="Plan"><Select options={Object.entries(TIERS).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
        <Col span={12}><Form.Item name="tierUntil" label="Plan valid until"><Input type="date" /></Form.Item></Col>
      </Row>
      <Button type="primary" htmlType="submit">Save</Button>
    </Form>
  );
}

function Notes({ id }: { id: string }) {
  const [notes, setNotes] = useState<{ id: string; text: string; createdAt: string; author: { name: string } | null }[]>([]);
  const [text, setText] = useState('');
  const load = useCallback(() => {
    api<typeof notes>(`/admin/patients/${id}/notes`).then(setNotes);
  }, [id]);
  useEffect(load, [load]);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Input.TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Private note (only staff can see this)" />
      <Button type="primary" disabled={!text.trim()} onClick={async () => { await api(`/admin/patients/${id}/notes`, { method: 'POST', json: { text } }); setText(''); load(); }}>Add note</Button>
      <List dataSource={notes} renderItem={(n) => <List.Item><List.Item.Meta title={`${n.author?.name ?? 'Staff'} · ${dayjs(n.createdAt).format('D MMM YYYY, h:mm A')}`} description={n.text} /></List.Item>} />
    </Space>
  );
}

export function PatientShow() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useOne<Patient>({ resource: 'patients', id });
  const p = data?.data;
  return (
    <Show
      isLoading={isLoading}
      title={p ? `${p.user.name || 'Patient'}` : 'Patient'}
      headerButtons={<Button type="primary" onClick={() => navigate(`/notifications/create?userIds=${id}`)}>🔔 Send notification</Button>}>
      {p ? (
        <>
          <Descriptions size="small" column={{ xs: 1, md: 3, xl: 6 }} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Phone">{p.user.phone}</Descriptions.Item>
            <Descriptions.Item label="Type">{TYPES[p.type]}</Descriptions.Item>
            <Descriptions.Item label="Age">{AGES[p.ageGroup]}</Descriptions.Item>
            <Descriptions.Item label="Diet">{DIETS[p.diet]}</Descriptions.Item>
            <Descriptions.Item label="Language">{p.user.lang === 'hi' ? 'हिन्दी' : 'English'}</Descriptions.Item>
            <Descriptions.Item label="Plan"><Tag color={p.tier === 'FREE' ? 'default' : 'green'}>{TIERS[p.tier]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Dietitian">{p.assignedDietitian?.name ?? 'Unassigned'}</Descriptions.Item>
            <Descriptions.Item label="Height / weight">{p.heightCm ?? '–'} cm / {p.weightKg ?? '–'} kg</Descriptions.Item>
            <Descriptions.Item label="Family">{p.circle?.members.filter((m) => m.status === 'active').map((m) => m.name).join(', ') || '–'}</Descriptions.Item>
            <Descriptions.Item label="Stage"><StageTag l={p.lifecycle} /></Descriptions.Item>
            <Descriptions.Item label="Status"><AttentionTags s={p.stats} /></Descriptions.Item>
            <Descriptions.Item label="App">
              <OnlineDot online={isOnline(p.user.lastActiveAt)} /> {presenceText(isOnline(p.user.lastActiveAt), p.user.lastActiveAt)}
            </Descriptions.Item>
          </Descriptions>
          <Tabs
            items={[
              { key: 'o', label: '📈 Overview', children: <Overview p={p} id={id} /> },
              { key: 'k', label: '🚀 Kickstart', children: <KickstartTab id={id} /> },
              { key: 's', label: '💳 Subscription', children: <SubscriptionTab id={id} lifecycle={p.lifecycle} onChange={refetch} /> },
              { key: 'm', label: '🍽️ Meals', children: <Meals id={id} /> },
              { key: 'a', label: '💊 Medicine & activity', children: <Activity id={id} /> },
              { key: 'd', label: '🥗 Diet plan', children: <DietPlanTab p={p} id={id} /> },
              { key: 'f', label: '⭐ For you foods', children: <ForYouPicks id={id} diet={p.diet as Diet} /> },
              { key: 'e', label: '🏃 Exercise plan', children: <ExerciseTab id={id} /> },
              { key: 't', label: '🎯 Targets & plan', children: <TargetsTab p={p} id={id} onSaved={refetch} /> },
              { key: 'c', label: '💬 Chat', children: <ChatPane patientId={id} /> },
              { key: 'v', label: '⚖️ Weight & BP', children: <Vitals id={id} heightCm={p.heightCm} /> },
              { key: 'n', label: '📝 Notes', children: <Notes id={id} /> },
            ]}
          />
        </>
      ) : null}
    </Show>
  );
}
