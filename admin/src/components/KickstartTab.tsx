import { App, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../providers/api';
import { BaselineText, Reasons, ResultLine, STATUS, type Baseline, type Result } from './kickstart';

type Data = {
  enrollment: { id: string; status: string; startsOn: string; day: number; kcal: number; riskReasons: string[]; baseline: Baseline; template: { id: string; title: string } | null } | null;
  days?: { day: number; meals: number; planTicks: number; exercise: boolean; readings: { v: number; ctx: string }[] }[];
  result?: Result;
};

/** One patient's 14-day programme: status, a day-by-day grid of what they did, and before/after results. */
export function KickstartTab({ id }: { id: string }) {
  const { message } = App.useApp();
  const [d, setD] = useState<Data | null>(null);
  const load = useCallback(() => api<Data>(`/admin/patients/${id}/enrollment`).then(setD), [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!d) return <Card loading />;
  const e = d.enrollment;
  if (!e) return <Empty description="Not in a 14-day plan (joined before Kickstart, or a family member)" />;
  const followed = (x: NonNullable<Data['days']>[number]) => x.planTicks > 0 || x.meals >= 2;
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={2}>
            <Space>
              <Tag color={STATUS[e.status]?.color}>{STATUS[e.status]?.label ?? e.status}</Tag>
              <b>{e.template?.title ?? 'No plan chosen'}</b>
              <Typography.Text type="secondary">· {e.kcal} kcal · starts {dayjs(e.startsOn).format('D MMM')}</Typography.Text>
            </Space>
            <BaselineText b={e.baseline} />
            <div><Reasons list={e.riskReasons} /></div>
          </Space>
          {e.status === 'pending_review' ? (
            <Button
              type="primary"
              onClick={async () => {
                await api(`/admin/enrollments/${e.id}/approve`, { method: 'POST', json: {} });
                message.success('Approved. The plan starts tomorrow.');
                load();
              }}>
              ✓ Approve plan
            </Button>
          ) : null}
        </Space>
      </Card>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Day" value={Math.min(Math.max(e.day, 0), 14)} suffix="/ 14" /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Days followed" value={(d.days ?? []).filter(followed).length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Sugar readings" value={(d.days ?? []).reduce((n, x) => n + x.readings.length, 0)} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Exercise days" value={(d.days ?? []).filter((x) => x.exercise).length} /></Card></Col>
      </Row>
      <Card size="small" title="Day by day">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {(d.days ?? []).map((x) => {
            const future = x.day > e.day;
            return (
              <Tooltip key={x.day} title={`${x.meals} meals · ${x.planTicks} plan meals ticked · ${x.exercise ? 'exercised' : 'no exercise'}${x.readings.length ? ` · ${x.readings.map((r) => `${r.ctx} ${r.v}`).join(', ')}` : ''}`}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 8, background: future ? '#fafafa' : followed(x) ? '#e8f5ee' : '#fff7e6', opacity: future ? 0.5 : 1 }}>
                  <div style={{ fontWeight: 600 }}>Day {x.day}</div>
                  <div style={{ fontSize: 12 }}>🍽️ {x.meals} · ✓ {x.planTicks}</div>
                  <div style={{ fontSize: 12 }}>{x.exercise ? '🏃 ✓' : '🏃 –'} {x.readings.length ? `· 🩸 ${x.readings.map((r) => r.v).join('/')}` : ''}</div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </Card>
      {d.result && (e.day >= 12 || e.status !== 'active') ? (
        <Card size="small" title="Results: days 1–3 vs 12–14">
          <ResultLine r={d.result} />
        </Card>
      ) : null}
    </Space>
  );
}
