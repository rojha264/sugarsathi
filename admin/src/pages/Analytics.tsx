import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Alert, Card, Col, Empty, List, Progress, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Tooltip as Tip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { AGES, DIETS, TIERS, TYPES } from '../lib/labels';
import { api } from '../providers/api';

type Seg = { key: string; users: number; active: number; minutesPerDay: number };
type Report = {
  days: number;
  kpis: {
    totalUsers: number; patients: number; caregivers: number; onboardedPct: number; newUsers: number; prevNewUsers: number;
    dau: number; wau: number; mau: number; stickiness: number; activeUsers: number; prevActiveUsers: number;
    minutesPerDay: number; prevMinutesPerDay: number; sessionMinutes: number; sessionsPerDay: number; unassigned: number; waitingChats: number;
  };
  daily: { day: string; signups: number; onboarded: number; users: number; active: number; sessions: number; minutesPerUser: number }[];
  funnel: { step: string; count: number }[];
  retention: { cohort: string; size: number; weeks: (number | null)[] }[];
  features: { feature: string; actions: number; users: number; pctOfActive: number }[];
  screens: { screen: string; minutes: number; users: number }[];
  segments: Record<string, Seg[]>;
  ops: { id: string; name: string; patients: number; active: number; sent: number; asked: number; answered: number; medianReplyMin: number | null }[];
  engagement: {
    plan: { patients: number; followers: number; followDaysPct: number };
    videos: { plays: number; users: number; avgSec: number; top: { videoId: string; title: string; plays: number; users: number; avgSec: number }[] };
    reels?: { views: number; viewers: number; avgSec: number; saves: number; shares: number; top: { reelId: string; title: string | null; views: number; viewers: number; avgSec: number; saves: number; shares: number }[] };
    exercise: { done: number; users: number; minutes: number };
  };
  lifecycle: { kind: string; sent: number; opened: number; returned: number; openedPct: number; returnedPct: number }[];
  outcomes: { cohort: string; size: number; startA1c: number | null; nowA1c: number | null; labA1c: number | null; inRange: (number | null)[] }[];
  kickstart: { enrolled: number; review: number; day7: number; completed: number; improved: number; paid: number; fastingChange: number | null; completionPct: number; conversionPct: number };
  revenue: {
    mrr: number; paying: number; conversionPct: number; arppu: number; newPaid: number; churned: number; churnPct: number;
    monthly: { month: string; revenue: number; payments: number }[]; byPlan: { plan: string; price: number; active: number }[];
  };
};

const LIFE: Record<string, string> = {
  'life:day2:new': 'Day 2 — not logged yet ("Start with one meal")', 'life:day2:active': 'Day 2 — already logging ("Great start")', 'life:day7': 'Day 7 — first-week recap',
  'life:day14': 'Day 14 — 2-week report', 'life:day30': 'Day 30 — one month', 'life:winback': 'Quiet 3+ days — "We miss you"',
};
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const secs = (n: number) => (n < 60 ? `${n} s` : `${Math.floor(n / 60)} min ${n % 60} s`);
/** One hue, light to dark: the cell colour follows the value. */
const heat = (v: number | null) =>
  v === null ? null : <div style={{ background: `rgba(30,138,90,${0.08 + (v / 100) * 0.7})`, color: v > 55 ? '#fff' : undefined, borderRadius: 4, padding: '2px 0' }}>{v}%</div>;

// Two series at most per chart; validated pair (CVD ΔE 22). Text never wears these colours.
const GREEN = '#1E8A5A';
const BLUE = '#2F6FDB';

const STEP: Record<string, string> = {
  open: 'Opened the app', lang: 'Chose language', mode: 'Chose Simple / Detailed', diet: 'Chose diet', phone: 'Reached phone number',
  otp: 'Verified phone (signed up)', setup: 'Reached profile setup', done: 'Finished onboarding', firstLog: 'Logged something', week1: 'Used it 3+ days in week 1',
};
const FEATURE: Record<string, string> = { meals: '🍽️ Meals', sugar: '🩸 Sugar', medicine: '💊 Medicine taken', walk: '🚶 Walk', vitals: '⚖️ Weight / BP', chat: '💬 Chat with dietitian' };
const SCREEN: Record<string, string> = {
  '/': 'Today (home)', '/meal': 'Meal log', '/sugar': 'Sugar', '/medicine': 'Medicine', '/walk': 'Walk', '/chat': 'Chat', '/plan': 'Diet plan', '/progress': 'Progress',
  '/exercise': 'Exercises', '/vitals': 'Weight & BP', '/report': 'Report', '/family': 'Family', '/inbox': 'Messages', '/settings': 'Settings',
};
const SEGMENTS: { key: string; label: string; names?: Record<string, string> }[] = [
  { key: 'lang', label: 'Language', names: { hi: 'हिन्दी', en: 'English' } },
  { key: 'ageGroup', label: 'Age group', names: AGES },
  { key: 'type', label: 'Diabetes type', names: TYPES },
  { key: 'diet', label: 'Diet', names: DIETS },
  { key: 'tier', label: 'Plan', names: TIERS },
  { key: 'platform', label: 'Phone', names: { android: 'Android', ios: 'iPhone' } },
];

const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);
const short = (d: string) => dayjs(d).format('D MMM');

function Delta({ now, before, unit = '' }: { now: number; before: number; unit?: string }) {
  const c = change(now, before);
  if (c === null) return null;
  const up = c >= 0;
  return (
    <Typography.Text type={up ? 'success' : 'danger'} style={{ fontSize: 13 }}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(c)}% vs previous {unit}
    </Typography.Text>
  );
}

function Kpi({ title, value, suffix, hint, children }: { title: string; value: number | string; suffix?: string; hint: string; children?: React.ReactNode }) {
  return (
    <Col xs={12} md={8} xl={6}>
      <Card size="small" style={{ height: '100%' }}>
        <Tip title={hint}>
          <Statistic title={title} value={value} suffix={suffix} />
        </Tip>
        {children}
      </Card>
    </Col>
  );
}

/** Plain-language findings a product manager would raise from these numbers. */
function insights(r: Report) {
  const out: { type: 'warning' | 'info' | 'success'; text: string }[] = [];
  const f = r.funnel.filter((s) => STEP[s.step]);
  let worst = { from: '', to: '', drop: 0 };
  for (let i = 1; i < f.length; i++) {
    const drop = f[i - 1].count ? 1 - f[i].count / f[i - 1].count : 0;
    if (drop > worst.drop) worst = { from: STEP[f[i - 1].step], to: STEP[f[i].step], drop };
  }
  if (worst.drop > 0.15) out.push({ type: 'warning', text: `Biggest onboarding drop: ${Math.round(worst.drop * 100)}% leave between "${worst.from}" and "${worst.to}". Simplify that step first.` });
  const w1 = r.retention.filter((c) => c.size >= 5 && c.weeks[1] !== null).map((c) => c.weeks[1] as number);
  if (w1.length) {
    const avg = Math.round(w1.reduce((a, b) => a + b, 0) / w1.length);
    out.push({ type: avg < 40 ? 'warning' : 'success', text: `Week-1 retention averages ${avg}% across recent cohorts${avg < 40 ? ' — add a day-2 reminder and a first-week goal' : ''}.` });
  }
  const k = r.kpis;
  const nu = change(k.newUsers, k.prevNewUsers);
  if (nu !== null) out.push({ type: nu >= 0 ? 'success' : 'warning', text: `New signups ${nu >= 0 ? 'up' : 'down'} ${Math.abs(nu)}% compared with the previous ${r.days} days.` });
  const weak = r.features.filter((x) => ['medicine', 'walk', 'vitals'].includes(x.feature)).sort((a, b) => a.pctOfActive - b.pctOfActive)[0];
  if (weak && weak.pctOfActive < 50) out.push({ type: 'info', text: `Only ${weak.pctOfActive}% of active users use ${FEATURE[weak.feature]}. Promote it on the home screen or in reminders.` });
  if (k.unassigned) out.push({ type: 'warning', text: `${k.unassigned} onboarded ${k.unassigned === 1 ? 'patient has' : 'patients have'} no dietitian yet.` });
  if (k.waitingChats) out.push({ type: 'warning', text: `${k.waitingChats} ${k.waitingChats === 1 ? 'chat is' : 'chats are'} waiting for a dietitian's reply.` });
  if (r.revenue.churnPct > 10) out.push({ type: 'warning', text: `${r.revenue.churnPct}% of paying users stopped this period (${r.revenue.churned}). Call them before renewal is due.` });
  if (r.engagement.plan.patients && r.engagement.plan.followDaysPct < 50) out.push({ type: 'info', text: `Patients follow their diet plan on only ${r.engagement.plan.followDaysPct}% of days. Make "I ate this" more prominent.` });
  const worse = r.outcomes.filter((o) => o.size >= 5 && o.startA1c && o.nowA1c && o.nowA1c - o.startA1c >= 0.5);
  if (worse.length) out.push({ type: 'warning', text: `Estimated HbA1c went up by 0.5 or more for ${worse.length} signup week(s): ${worse.map((o) => short(o.cohort)).join(', ')}. Review those patients' plans.` });
  const slow = r.ops.filter((o) => (o.medianReplyMin ?? 0) > 120);
  if (slow.length) out.push({ type: 'warning', text: `Slow replies (median over 2 h): ${slow.map((o) => o.name).join(', ')}.` });
  return out;
}

/** Owner-only product analytics: growth, onboarding funnel, engagement, retention, feature use, segments, dietitian service. */
export function Analytics() {
  const [days, setDays] = useState(30);
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    api<Report>(`/admin/analytics?days=${days}`)
      .then(setR)
      .catch((e: Error) => setError(e.message));
  }, [days]);

  if (error) return <Alert type="error" message="Could not load analytics" description={error} />;
  const k = r?.kpis;
  const top = r?.funnel[0]?.count ?? 0;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>📈 Analytics</Typography.Title>
        <Segmented value={days} onChange={(v) => setDays(v as number)} options={[{ label: '7 days', value: 7 }, { label: '30 days', value: 30 }, { label: '90 days', value: 90 }]} />
      </Space>

      {!r || !k ? (
        <Card loading />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Kpi title="Total users" value={k.totalUsers} hint="Everyone who verified a phone number">
              <Typography.Text type="secondary">{k.patients} patients · {k.caregivers} family</Typography.Text>
            </Kpi>
            <Kpi title={`New users (${r.days} d)`} value={k.newUsers} hint="Signed up (phone verified) in this period">
              <Delta now={k.newUsers} before={k.prevNewUsers} unit="period" />
            </Kpi>
            <Kpi title="Daily active (today)" value={k.dau} hint="Opened the app today (IST)">
              <Typography.Text type="secondary">Weekly {k.wau} · Monthly {k.mau}</Typography.Text>
            </Kpi>
            <Kpi title="Stickiness" value={k.stickiness} suffix="%" hint="Daily ÷ monthly active users. Above 20% is good for a health app.">
              <Typography.Text type="secondary">DAU ÷ MAU</Typography.Text>
            </Kpi>
            <Kpi title="Time per user per day" value={k.minutesPerDay} suffix="min" hint="Average minutes in the app on days a user opened it">
              <Delta now={k.minutesPerDay} before={k.prevMinutesPerDay} unit="period" />
            </Kpi>
            <Kpi title="Visit length" value={k.sessionMinutes} suffix="min" hint="Average time per visit (a 30-second break starts a new visit)">
              <Typography.Text type="secondary">{k.sessionsPerDay} visits a day</Typography.Text>
            </Kpi>
            <Kpi title="Active users" value={k.activeUsers} hint="Opened the app at least once in this period">
              <Delta now={k.activeUsers} before={k.prevActiveUsers} unit="period" />
            </Kpi>
            <Kpi title="Finished onboarding" value={k.onboardedPct} suffix="%" hint="Signed-up users who completed profile setup and consent">
              <Progress percent={k.onboardedPct} showInfo={false} strokeColor={GREEN} size="small" />
            </Kpi>
          </Row>

          <Card size="small" title="💡 What stands out">
            <List
              dataSource={insights(r)}
              locale={{ emptyText: 'Nothing unusual.' }}
              renderItem={(i) => (
                <List.Item style={{ padding: '6px 0' }}>
                  <Tag color={i.type === 'warning' ? 'orange' : i.type === 'success' ? 'green' : 'blue'}>{i.type === 'warning' ? 'Act' : i.type === 'success' ? 'Good' : 'Idea'}</Tag> {i.text}
                </List.Item>
              )}
            />
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} xl={12}>
              <Card size="small" title="New users per day">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={r.daily} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={short} minTickGap={20} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(d) => dayjs(d as string).format('ddd, D MMM')} />
                    <Legend />
                    <Bar dataKey="signups" name="Signed up" fill={BLUE} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="onboarded" name="Finished onboarding" fill={GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Total users">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={r.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={short} minTickGap={20} />
                    <YAxis allowDecimals={false} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip labelFormatter={(d) => dayjs(d as string).format('ddd, D MMM')} />
                    <Line dataKey="users" name="Users" stroke={BLUE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Daily active users">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={r.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={short} minTickGap={20} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(d) => dayjs(d as string).format('ddd, D MMM')} />
                    <Line dataKey="active" name="Active users" stroke={GREEN} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Minutes in the app per active user">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={r.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={short} minTickGap={20} />
                    <YAxis />
                    <Tooltip labelFormatter={(d) => dayjs(d as string).format('ddd, D MMM')} formatter={(v) => [`${v} min`, 'Per active user']} />
                    <Line dataKey="minutesPerUser" name="Minutes" stroke={BLUE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} xl={12}>
              <Card size="small" title={`Onboarding funnel (installs in the last ${r.days} days)`}>
                {!top ? (
                  <Empty description="No installs yet" />
                ) : (
                  r.funnel.map((s, i) => {
                    const prev = i ? r.funnel[i - 1].count : s.count;
                    const lost = prev ? Math.round((1 - s.count / prev) * 100) : 0;
                    return (
                      <div key={s.step} style={{ marginBottom: 8 }}>
                        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Typography.Text>{STEP[s.step] ?? s.step}</Typography.Text>
                          <Typography.Text>
                            <b>{s.count}</b> <Typography.Text type="secondary">({Math.round((s.count / top) * 100)}%)</Typography.Text>
                            {i && lost > 0 ? <Typography.Text type={lost > 15 ? 'danger' : 'secondary'}> −{lost}%</Typography.Text> : null}
                          </Typography.Text>
                        </Space>
                        <Progress percent={Math.round((s.count / top) * 100)} showInfo={false} strokeColor={i < 8 ? BLUE : GREEN} size="small" />
                      </div>
                    );
                  })
                )}
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Retention: share of each week's signups still opening the app">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="cohort"
                  scroll={{ x: true }}
                  dataSource={r.retention}
                  columns={[
                    { title: 'Joined week of', render: (_, c) => <span>{short(c.cohort)} <Typography.Text type="secondary">({c.size})</Typography.Text></span> },
                    ...Array.from({ length: 8 }, (_, w) => ({
                      title: `W${w}`,
                      align: 'center' as const,
                      render: (_: unknown, c: Report['retention'][number]) => {
                        return heat(c.weeks[w]);
                      },
                    })),
                  ]}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>W0 is the week they joined. Read across a row to see how use fades.</Typography.Text>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} xl={12}>
              <Card size="small" title="Feature use (share of active users)">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="feature"
                  dataSource={r.features}
                  columns={[
                    { title: 'Feature', render: (_, f) => FEATURE[f.feature] ?? f.feature },
                    { title: 'Users', dataIndex: 'users', align: 'right' },
                    { title: '% of active', render: (_, f) => <Progress percent={f.pctOfActive} size="small" strokeColor={GREEN} /> },
                    { title: 'Logs', dataIndex: 'actions', align: 'right' },
                    { title: 'Per user', align: 'right', render: (_, f) => (f.users ? (f.actions / f.users).toFixed(1) : '–') },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Where time goes (minutes per screen)">
                {r.screens.length ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, r.screens.length * 26)}>
                    <BarChart data={r.screens.map((s) => ({ ...s, label: SCREEN[s.screen] ?? s.screen }))} layout="vertical" margin={{ left: 20, right: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="label" width={120} />
                      <Tooltip formatter={(v, _n, p) => [`${v} min · ${(p.payload as { users: number }).users} users`, 'Time']} />
                      <Bar dataKey="minutes" fill={BLUE} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="minutes" position="right" style={{ fill: '#595959', fontSize: 12 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="No visits yet" />
                )}
              </Card>
            </Col>
          </Row>

          <Typography.Title level={4} style={{ margin: '8px 0 0' }}>🚀 14-day Kickstart (started in the last {r.days} days)</Typography.Title>
          <Row gutter={[12, 12]}>
            <Col xs={24} xl={14}>
              <Card size="small" title="From signup to paying">
                {[
                  { k: 'Enrolled', v: r.kickstart.enrolled },
                  { k: 'Still using the app on day 7+', v: r.kickstart.day7 },
                  { k: 'Completed 14 days', v: r.kickstart.completed },
                  { k: 'Sugar or weight improved', v: r.kickstart.improved },
                  { k: 'Took a paid plan', v: r.kickstart.paid },
                ].map((x, i) => (
                  <div key={x.k} style={{ marginBottom: 8 }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Typography.Text>{x.k}</Typography.Text>
                      <Typography.Text><b>{x.v}</b> <Typography.Text type="secondary">({r.kickstart.enrolled ? Math.round((x.v / r.kickstart.enrolled) * 100) : 0}%)</Typography.Text></Typography.Text>
                    </Space>
                    <Progress percent={r.kickstart.enrolled ? Math.round((x.v / r.kickstart.enrolled) * 100) : 0} showInfo={false} size="small" strokeColor={i < 3 ? BLUE : GREEN} />
                  </div>
                ))}
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Row gutter={[12, 12]}>
                <Kpi title="Completion" value={r.kickstart.completionPct} suffix="%" hint="Enrolled people who reached day 14">
                  <Typography.Text type="secondary">{r.kickstart.completed} of {r.kickstart.enrolled}</Typography.Text>
                </Kpi>
                <Kpi title="Paid after 14 days" value={r.kickstart.conversionPct} suffix="%" hint="Completed programmes followed by a paid plan">
                  <Typography.Text type="secondary">{r.kickstart.paid} patients</Typography.Text>
                </Kpi>
                <Kpi title="Avg fasting change" value={r.kickstart.fastingChange ?? '–'} suffix={r.kickstart.fastingChange !== null ? 'mg/dL' : ''} hint="Days 12–14 minus days 1–3, completed programmes">
                  <Typography.Text type="secondary">negative = better</Typography.Text>
                </Kpi>
                <Kpi title="Waiting for review" value={r.kickstart.review} hint="Risky profiles a dietitian must approve">
                  <Link to="/kickstart">Open queue ›</Link>
                </Kpi>
              </Row>
            </Col>
          </Row>

          <Typography.Title level={4} style={{ margin: '8px 0 0' }}>💰 Revenue</Typography.Title>
          <Row gutter={[12, 12]}>
            <Kpi title="Monthly recurring revenue" value={inr(r.revenue.mrr)} hint="Active paid plans, as a monthly amount">
              <Typography.Text type="secondary">{inr(r.revenue.arppu)} per paying user</Typography.Text>
            </Kpi>
            <Kpi title="Paying users" value={r.revenue.paying} hint="Patients with an active paid plan now">
              <Typography.Text type="secondary">{r.revenue.conversionPct}% of onboarded patients</Typography.Text>
            </Kpi>
            <Kpi title={`New paying (${r.days} d)`} value={r.revenue.newPaid} hint="First paid plan started in this period">
              <Typography.Text type="secondary">Free → paid</Typography.Text>
            </Kpi>
            <Kpi title={`Churned (${r.days} d)`} value={r.revenue.churned} hint="Paid plan ended in this period and was not renewed">
              <Typography.Text type={r.revenue.churnPct > 10 ? 'danger' : 'secondary'}>{r.revenue.churnPct}% of payers at the start</Typography.Text>
            </Kpi>
          </Row>
          <Row gutter={[12, 12]}>
            <Col xs={24} xl={14}>
              <Card size="small" title="Money in per month (plan payments)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={r.revenue.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={(m) => dayjs(`${m}-01`).format('MMM YYYY')} />
                    <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v, _n, p) => [`${inr(v as number)} · ${(p.payload as { payments: number }).payments} payments`, 'Revenue']} labelFormatter={(m) => dayjs(`${m}-01`).format('MMMM YYYY')} />
                    <Bar dataKey="revenue" fill={GREEN} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="revenue" position="top" formatter={(v: number) => `₹${(v / 1000).toFixed(1)}k`} style={{ fill: '#595959', fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card size="small" title="Active plans">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="plan"
                  dataSource={r.revenue.byPlan}
                  columns={[
                    { title: 'Plan', dataIndex: 'plan' },
                    { title: 'Price', align: 'right', render: (_, p) => inr(p.price) },
                    { title: 'Active', dataIndex: 'active', align: 'right' },
                    { title: 'Monthly', align: 'right', render: (_, p) => inr(p.price * p.active) },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Typography.Title level={4} style={{ margin: '8px 0 0' }}>🥗 Plans, exercise and videos</Typography.Title>
          <Row gutter={[12, 12]}>
            <Kpi title="Diet plan followed" value={r.engagement.plan.followDaysPct} suffix="%" hint={'Share of plan days with at least one "I ate this"'}>
              <Typography.Text type="secondary">{r.engagement.plan.followers} of {r.engagement.plan.patients} patients with a plan</Typography.Text>
            </Kpi>
            <Kpi title="Exercises finished" value={r.engagement.exercise.done} hint="Timer finished on an exercise from the plan">
              <Typography.Text type="secondary">{r.engagement.exercise.users} patients · {r.engagement.exercise.minutes} min</Typography.Text>
            </Kpi>
            <Kpi title="Video plays" value={r.engagement.videos.plays} hint="Exercise sample videos opened">
              <Typography.Text type="secondary">{r.engagement.videos.users} patients</Typography.Text>
            </Kpi>
            <Kpi title="Average watch" value={secs(r.engagement.videos.avgSec)} hint="Time the player stayed open (YouTube embeds do not report exact progress)">
              <Typography.Text type="secondary">per play</Typography.Text>
            </Kpi>
          </Row>
          <Row gutter={[12, 12]}>
            <Col xs={24} xl={12}>
              <Card size="small" title="Most watched exercise videos">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="videoId"
                  dataSource={r.engagement.videos.top}
                  locale={{ emptyText: 'No videos watched yet' }}
                  columns={[
                    { title: 'Video', dataIndex: 'title' },
                    { title: 'Plays', dataIndex: 'plays', align: 'right' },
                    { title: 'Patients', dataIndex: 'users', align: 'right' },
                    { title: 'Avg watch', align: 'right', render: (_, v) => secs(v.avgSec) },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card size="small" title="Automatic messages (day 2, 7, 14, 30 and when someone goes quiet)">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="kind"
                  dataSource={r.lifecycle}
                  locale={{ emptyText: 'None sent in this period' }}
                  columns={[
                    { title: 'Message', render: (_, l) => LIFE[l.kind] ?? l.kind },
                    { title: 'Sent', dataIndex: 'sent', align: 'right' },
                    { title: 'Opened', render: (_, l) => <Progress percent={l.openedPct} size="small" strokeColor={BLUE} /> },
                    { title: 'Came back in 48 h', render: (_, l) => <Progress percent={l.returnedPct} size="small" strokeColor={GREEN} /> },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          {r.engagement.reels ? (
            <>
              <Typography.Title level={4} style={{ margin: '8px 0 0' }}>🎬 Reels (Learn tab)</Typography.Title>
              <Row gutter={[12, 12]}>
                <Kpi title="Reel views" value={r.engagement.reels.views} hint="A reel counts once it was on screen for 3 seconds or more">
                  <Typography.Text type="secondary">{r.engagement.reels.viewers} patients</Typography.Text>
                </Kpi>
                <Kpi title="Average watch" value={secs(r.engagement.reels.avgSec)} hint="Time each reel stayed on screen">
                  <Typography.Text type="secondary">per view</Typography.Text>
                </Kpi>
                <Kpi title="Saved" value={r.engagement.reels.saves} hint="❤️ taps: patients want to watch again">
                  <Typography.Text type="secondary">times</Typography.Text>
                </Kpi>
                <Kpi title="Shared on WhatsApp" value={r.engagement.reels.shares} hint="Each share can bring a new user">
                  <Typography.Text type="secondary">times</Typography.Text>
                </Kpi>
              </Row>
              <Card size="small" title="Top reels">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="reelId"
                  dataSource={r.engagement.reels.top}
                  locale={{ emptyText: 'No reels watched yet' }}
                  columns={[
                    { title: 'Reel', render: (_, v) => v.title ?? '(deleted)' },
                    { title: 'Views', dataIndex: 'views', align: 'right' },
                    { title: 'Patients', dataIndex: 'viewers', align: 'right' },
                    { title: 'Avg watch', align: 'right', render: (_, v) => secs(v.avgSec) },
                    { title: 'Saved', dataIndex: 'saves', align: 'right' },
                    { title: 'Shared', dataIndex: 'shares', align: 'right' },
                  ]}
                />
              </Card>
            </>
          ) : null}

          <Card size="small" title="🩸 Health outcomes by signup week (patients only)">
            <Table
              size="small"
              pagination={false}
              rowKey="cohort"
              scroll={{ x: true }}
              dataSource={r.outcomes}
              columns={[
                { title: 'Joined week of', render: (_, o) => <span>{short(o.cohort)} <Typography.Text type="secondary">({o.size})</Typography.Text></span> },
                ...Array.from({ length: 8 }, (_, w) => ({ title: `W${w} in range`, align: 'center' as const, render: (_: unknown, o: Report['outcomes'][number]) => heat(o.inRange[w]) })),
                {
                  title: 'Est. HbA1c: first 2 weeks → now',
                  align: 'center' as const,
                  render: (_: unknown, o: Report['outcomes'][number]) => {
                    if (!o.startA1c) return '–';
                    if (!o.nowA1c) return `${o.startA1c}%`;
                    const d = Math.round((o.nowA1c - o.startA1c) * 10) / 10;
                    return (
                      <span>
                        {o.startA1c}% → <b>{o.nowA1c}%</b>{' '}
                        <Typography.Text type={d < 0 ? 'success' : d > 0 ? 'danger' : 'secondary'}>({d > 0 ? '+' : ''}{d})</Typography.Text>
                      </span>
                    );
                  },
                },
                { title: 'Lab HbA1c', align: 'center' as const, render: (_: unknown, o: Report['outcomes'][number]) => (o.labA1c ? `${o.labA1c}%` : '–') },
              ]}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              In range = readings between 70 and 180 mg/dL in that week after joining. Estimated HbA1c = (average sugar + 46.7) ÷ 28.7; lower is better.
            </Typography.Text>
          </Card>

          <Card size="small" title="Who uses it most (segments)">
            <Tabs
              items={SEGMENTS.map((s) => ({
                key: s.key,
                label: s.label,
                children: (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="key"
                    dataSource={r.segments[s.key] ?? []}
                    columns={[
                      { title: s.label, render: (_, x: Seg) => s.names?.[x.key] ?? x.key },
                      { title: 'Users', dataIndex: 'users', align: 'right' },
                      { title: `Active (${r.days} d)`, dataIndex: 'active', align: 'right' },
                      { title: 'Active %', render: (_, x: Seg) => <Progress percent={x.users ? Math.round((x.active / x.users) * 100) : 0} size="small" strokeColor={GREEN} /> },
                      { title: 'Min / day', dataIndex: 'minutesPerDay', align: 'right' },
                    ]}
                  />
                ),
              }))}
            />
          </Card>

          <Card
            size="small"
            title="Dietitian service"
            extra={
              <Space>
                <Link to="/patients?dietitianId=none">
                  <Tag color={k.unassigned ? 'orange' : 'green'}>{k.unassigned} waiting for a dietitian</Tag>
                </Link>
                <Link to="/chats">
                  <Tag color={k.waitingChats ? 'orange' : 'green'}>{k.waitingChats} {k.waitingChats === 1 ? 'chat' : 'chats'} waiting for reply</Tag>
                </Link>
              </Space>
            }>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={r.ops}
              columns={[
                { title: 'Dietitian', dataIndex: 'name' },
                { title: 'Patients', dataIndex: 'patients', align: 'right' },
                { title: `Active (${r.days} d)`, dataIndex: 'active', align: 'right' },
                { title: 'Messages sent', dataIndex: 'sent', align: 'right' },
                { title: 'Questions answered', align: 'right', render: (_, o) => `${o.answered} / ${o.asked}` },
                {
                  title: 'Median reply time',
                  align: 'right',
                  render: (_, o) => (o.medianReplyMin === null ? '–' : o.medianReplyMin < 60 ? `${Math.round(o.medianReplyMin)} min` : `${(o.medianReplyMin / 60).toFixed(1)} h`),
                },
              ]}
            />
          </Card>
        </>
      )}
    </Space>
  );
}
