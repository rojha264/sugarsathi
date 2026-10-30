import { App, Button, Card, Empty, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { BaselineText, Reasons, ResultLine, STATUS, type Baseline, type Result } from '../components/kickstart';
import { DIETS, REGION_LABEL } from '../lib/labels';
import { api } from '../providers/api';

type Row = {
  id: string; patientId: string; status: string; startsOn: string; kcal: number; riskReasons: string[]; baseline: Baseline; result: Result | null; createdAt: string;
  template: { id: string; title: string } | null; patient: { diet: string; region: string | null; user: { name: string; phone: string } };
};

/** Kickstart review queue: risky profiles wait here until a dietitian approves (or switches) their 14-day plan. */
export function KickstartList() {
  const { message } = App.useApp();
  const [status, setStatus] = useState('pending_review');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [templates, setTemplates] = useState<{ id: string; title: string; diet: string }[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const load = useCallback(() => api<{ data: Row[] }>(`/admin/enrollments?status=${status}`).then((r) => setRows(r.data)), [status]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);
  useEffect(() => {
    api<{ data: { id: string; title: string; diet: string; active: boolean }[] }>('/admin/programs').then((r) => setTemplates(r.data.filter((t) => t.active)));
  }, []);

  const approve = async (r: Row) => {
    const templateId = pick[r.id] ?? r.template?.id;
    await api(`/admin/enrollments/${r.id}/approve`, { method: 'POST', json: { templateId } });
    message.success(`${r.patient.user.name || r.patient.user.phone}'s plan starts tomorrow.`);
    load();
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>🚀 Kickstart (14-day plans)</Typography.Title>
        <Typography.Text type="secondary">Approve risky profiles quickly: until you do, the patient sees "Your dietitian is preparing your plan".</Typography.Text>
      </div>
      <Segmented value={status} onChange={(v) => setStatus(v as string)} options={[{ label: '⏳ Needs review', value: 'pending_review' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }]} />
      <Card size="small">
        <Table
          rowKey="id"
          loading={!rows}
          dataSource={rows ?? []}
          locale={{ emptyText: <Empty description={status === 'pending_review' ? 'Nothing waiting 🎉' : 'None'} /> }}
          columns={[
            {
              title: 'Patient',
              render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <Link to={`/patients/show/${r.patientId}`}><b>{r.patient.user.name || r.patient.user.phone}</b></Link>
                  <BaselineText b={r.baseline} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {DIETS[r.patient.diet]} · {REGION_LABEL[r.patient.region ?? ''] ?? 'region ?'} · {r.kcal} kcal · joined {dayjs(r.createdAt).format('D MMM')}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: 'Why review', render: (_, r) => <Reasons list={r.riskReasons} /> },
            {
              title: 'Plan',
              render: (_, r) =>
                r.status === 'pending_review' ? (
                  <Select
                    style={{ width: 260 }}
                    value={pick[r.id] ?? r.template?.id}
                    placeholder="Choose a plan"
                    onChange={(v) => setPick({ ...pick, [r.id]: v })}
                    options={templates.map((t) => ({ value: t.id, label: t.title }))}
                  />
                ) : (
                  <span>{r.template?.title ?? '–'} <Typography.Text type="secondary">· starts {dayjs(r.startsOn).format('D MMM')}</Typography.Text></span>
                ),
            },
            ...(status === 'completed' ? [{ title: 'Result', render: (_: unknown, r: Row) => (r.result ? <ResultLine r={r.result} /> : '–') }] : []),
            {
              title: '',
              width: 150,
              render: (_, r) =>
                r.status === 'pending_review' ? (
                  <Button type="primary" disabled={!(pick[r.id] ?? r.template?.id)} onClick={() => approve(r)}>✓ Approve</Button>
                ) : (
                  <Tag color={STATUS[r.status]?.color}>{STATUS[r.status]?.label ?? r.status}</Tag>
                ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
