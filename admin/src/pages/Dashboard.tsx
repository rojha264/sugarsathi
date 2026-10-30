import { useCustom } from '@refinedev/core';
import { Card, Col, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { fmt } from '../lib/labels';
import { isOwner } from '../providers/authProvider';

type Dash = {
  counts: { total: number; high: number; lows: number; inactive: number; poorMeds: number; paid: number; unassigned: number; reviews: number; trialsEnding: number; renewalsDue: number };
  averages: { inRange30: number | null; avg7: number | null; ea1c: number | null; medAdherence7: number | null };
  events: { id: string; patientId: string; name: string; kind: string; data: { v?: number; what?: string }; at: string }[];
  trend: { day: string; avg: number; n: number }[];
};

const EVENT: Record<string, string> = { sugar: '🩸 Sugar', unwell: '😟 Not feeling well', sos: '🚨 SOS' };

/** What needs attention today, for the signed-in dietitian (or everyone, for the owner). */
export function Dashboard() {
  const { data, isLoading } = useCustom<Dash>({ url: '/admin/dashboard', method: 'get' });
  const d = data?.data;
  const card = (title: string, value: number | undefined, to: string, color?: string) => (
    <Col xs={12} md={8} xl={4}>
      <Link to={to}>
        <Card hoverable loading={isLoading}>
          <Statistic title={title} value={value ?? 0} valueStyle={color ? { color } : undefined} />
        </Card>
      </Link>
    </Col>
  );
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Today</Typography.Title>
      <Row gutter={[12, 12]}>
        {card('🚀 Kickstart reviews', d?.counts.reviews, '/kickstart', d?.counts.reviews ? '#fa8c16' : undefined)}
        {card('⚠️ Trials ending ≤ 3 days', d?.counts.trialsEnding, '/patients?lifecycle=trial&trialEndsIn=3', d?.counts.trialsEnding ? '#fa541c' : undefined)}
        {card('🔁 Renewals due ≤ 7 days', d?.counts.renewalsDue, '/patients?lifecycle=subscriber&renewalIn=7', d?.counts.renewalsDue ? '#fa8c16' : undefined)}
        {card('My patients', d?.counts.total, '/patients')}
        {card('High 7-day avg (> 180)', d?.counts.high, '/patients?attention=high', '#fa8c16')}
        {card('Had a low (30 d)', d?.counts.lows, '/patients?attention=low', '#f5222d')}
        {card('Missing medicine (< 70 %)', d?.counts.poorMeds, '/patients?attention=poorMeds', '#fa8c16')}
        {card('Inactive 3+ days', d?.counts.inactive, '/patients?attention=inactive')}
        {card('Paid plans', d?.counts.paid, '/patients?tier=BASIC', '#52c41a')}
        {isOwner() ? card('Waiting for a dietitian', d?.counts.unassigned, '/patients?dietitianId=none', d?.counts.unassigned ? '#fa8c16' : undefined) : null}
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={24} xl={16}>
          <Card title="Average sugar, last 30 days" loading={isLoading}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <ReferenceArea y1={70} y2={180} fill="#52c41a" fillOpacity={0.08} />
                <XAxis dataKey="day" tickFormatter={(v) => dayjs(v).format('D MMM')} />
                <YAxis domain={[60, 'dataMax + 20']} />
                <Tooltip />
                <Line dataKey="avg" name="mg/dL" stroke="#1677ff" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <Space size="large">
              <span>In range: <b>{fmt(d?.averages.inRange30, '%')}</b></span>
              <span>Avg eA1c: <b>{fmt(d?.averages.ea1c, '%')}</b></span>
              <span>Medicine taken: <b>{fmt(d?.averages.medAdherence7, '%')}</b></span>
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Alerts, last 48 hours" loading={isLoading}>
            <List
              dataSource={d?.events ?? []}
              locale={{ emptyText: 'No alerts 🎉' }}
              renderItem={(e) => (
                <List.Item extra={<Typography.Text type="secondary">{dayjs(e.at).format('D MMM h:mm A')}</Typography.Text>}>
                  <Link to={`/patients/show/${e.patientId}`}>{e.name}</Link>{' '}
                  <Tag color={e.kind === 'sugar' && (e.data.v ?? 100) < 70 ? 'red' : 'orange'}>
                    {EVENT[e.kind] ?? e.kind}
                    {e.data.v ? ` ${e.data.v}` : ''}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
