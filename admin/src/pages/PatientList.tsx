import { List, useTable } from '@refinedev/antd';
import { useCustom, useNavigation, type CrudFilter } from '@refinedev/core';
import { App, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { STAGE_LABEL, StageTag, SubscriptionModal, type Lifecycle, type Stage } from '../components/lifecycle';
import { AttentionTags, SugarTag, type Stats } from '../components/StatusTag';
import { AGES, DIETS, fmt, TIERS, TYPES } from '../lib/labels';
import { api } from '../providers/api';
import { isOwner } from '../providers/authProvider';
import { SearchBox } from '../components/SearchBox';

type Row = { id: string; name: string; phone: string; type: string; ageGroup: string; diet: string; tier: string; dietitian: { id: string; name: string } | null; stats: Stats | null; lifecycle: Lifecycle };
type Counts = { counts: Record<Stage, number>; trialsEnding: number; renewalsDue: number; trialEndingDays: number; renewalDueDays: number };
type Filter = Record<string, string | number | undefined>;
const FILTER_KEYS = ['q', 'ctx', 'days', 'sugarMin', 'sugarMax', 'a1cMin', 'a1cMax', 'type', 'ageGroup', 'diet', 'tier', 'dietitianId', 'attention', 'lifecycle', 'trialEndsIn', 'renewalIn'];
/** Tabs in business order: who needs a plan, who is trying, who to follow up, who pays. */
const TABS: (Stage | 'all')[] = ['all', 'waiting', 'trial', 'ended', 'subscriber'];

/** Patients table with the sugar-range filter; save filters as segments, act on a selection. */
export function PatientList() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useNavigation();
  const { message } = App.useApp();
  const [form] = Form.useForm<Filter>();
  const initial: Filter = Object.fromEntries(FILTER_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)!]));
  const toFilters = (f: Filter): CrudFilter[] => Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([field, value]) => ({ field, operator: 'eq', value }));
  const { tableProps, setFilters, filters } = useTable<Row>({
    resource: 'patients',
    syncWithLocation: false,
    filters: { initial: toFilters({ ctx: 'fasting', days: 7, ...initial }) },
    sorters: { initial: [{ field: 'avg7', order: 'desc' }] },
    pagination: { pageSize: 20 },
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<Stage | 'all'>((initial.lifecycle as Stage) ?? 'all');
  const [soon, setSoon] = useState(!!(initial.trialEndsIn || initial.renewalIn));
  const [pay, setPay] = useState<{ patientId: string; renewSubId?: string } | null>(null);
  const lifecycle = useCustom<Counts>({ url: '/admin/patients/lifecycle', method: 'get' });
  const lc = lifecycle.data?.data;
  /** Switch tab (and the "ending soon / renewal due" chip) while keeping the other filters. */
  const showTab = (next: Stage | 'all', ending = false) => {
    setTab(next);
    setSoon(ending);
    const rest = Object.fromEntries(Object.entries(current()).filter(([k]) => !['lifecycle', 'trialEndsIn', 'renewalIn'].includes(k)));
    apply({
      ...rest,
      ...(next !== 'all' ? { lifecycle: next } : {}),
      ...(ending && next === 'trial' ? { trialEndsIn: lc?.trialEndingDays ?? 3 } : {}),
      ...(ending && next === 'subscriber' ? { renewalIn: lc?.renewalDueDays ?? 7 } : {}),
    });
  };
  const [bulk, setBulk] = useState<null | 'assign' | 'template'>(null);
  const [bulkValue, setBulkValue] = useState<string | null>(null);
  const staff = useCustom<{ data: { id: string; name: string; role: string }[] }>({ url: '/admin/staff', method: 'get', queryOptions: { enabled: isOwner() } });
  const templates = useCustom<{ data: { id: string; title: string }[] }>({ url: '/admin/diet-templates', method: 'get' });
  const segments = useCustom<{ data: { id: string; name: string; filter: Filter }[] }>({ url: '/admin/segments', method: 'get' });

  useEffect(() => {
    form.setFieldsValue({ ctx: 'fasting', days: 7, ...initial });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = () => Object.fromEntries((filters as { field: string; value: unknown }[]).map((f) => [f.field, f.value])) as Filter;
  const apply = (v: Filter) => setFilters(toFilters(v), 'replace');
  const saveSegment = () => {
    let name = '';
    Modal.confirm({
      title: 'Save these filters as a segment',
      content: <Input placeholder="e.g. High fasting seniors" onChange={(e) => (name = e.target.value)} />,
      onOk: async () => {
        await api('/admin/segments', { method: 'POST', json: { name: name || 'Untitled segment', filter: current() } });
        segments.refetch();
        message.success('Segment saved');
      },
    });
  };
  const runBulk = async () => {
    if (!bulk || !bulkValue) return;
    const r = await api<{ updated: number; skippedFoods?: number }>('/admin/patients/bulk', { method: 'POST', json: { ids: selected, action: bulk === 'assign' ? 'assign' : 'applyTemplate', dietitianId: bulkValue === 'none' ? null : bulkValue, templateId: bulkValue } });
    message.success(`Updated ${r.updated} patient(s)${r.skippedFoods ? `; ${r.skippedFoods} food(s) left out to match their food preference` : ''}`);
    setBulk(null);
    setBulkValue(null);
    setFilters(filters, 'replace');
  };

  return (
    <List title="Patients">
      <Segmented
        size="large"
        style={{ marginBottom: 8 }}
        value={tab}
        onChange={(v) => showTab(v as Stage | 'all')}
        options={TABS.map((t) => ({ value: t, label: t === 'all' ? 'All' : `${STAGE_LABEL[t]} (${lc?.counts[t] ?? '…'})` }))}
      />
      {tab === 'trial' || tab === 'subscriber' ? (
        <Space style={{ marginBottom: 12, display: 'flex' }}>
          <Tag.CheckableTag checked={!soon} onChange={() => showTab(tab, false)}>All</Tag.CheckableTag>
          <Tag.CheckableTag checked={soon} onChange={() => showTab(tab, true)}>
            {tab === 'trial' ? `⚠️ Trial ending in ≤ ${lc?.trialEndingDays ?? 3} days (${lc?.trialsEnding ?? 0})` : `🔁 Renewal due in ≤ ${lc?.renewalDueDays ?? 7} days (${lc?.renewalsDue ?? 0})`}
          </Tag.CheckableTag>
          <Typography.Text type="secondary">
            {tab === 'trial' ? 'Call or message before the trial ends: that is when people decide to pay.' : 'Remind before the plan ends to avoid a gap.'}
          </Typography.Text>
        </Space>
      ) : tab === 'ended' ? (
        <Typography.Paragraph type="secondary">Not paying after the trial (or a lapsed plan). Follow up, starting with those whose sugar improved ✨.</Typography.Paragraph>
      ) : tab === 'waiting' ? (
        <Typography.Paragraph type="secondary">Signed up, plan not shared yet. Approve in Kickstart or share a plan: the 14-day trial starts the day the plan is shared.</Typography.Paragraph>
      ) : null}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Form form={form} layout="vertical" onFinish={apply} initialValues={{ ctx: 'fasting', days: 7 }}>
          <Row gutter={12}>
            <Col xs={24} md={6}><Form.Item name="q" label="Name or phone">
              <SearchBox
                width="100%"
                placeholder="Name (Hindi or English) or phone"
                onSearch={() => form.submit()}
                suggest={(text) => api<{ data: Row[] }>(`/admin/patients?q=${encodeURIComponent(text)}&pageSize=8`).then((r) => r.data.map((x) => ({ value: x.id, label: `${x.name || 'Patient'} · ${x.phone}` })))}
                onPick={(id) => navigate(`/patients/show/${id}`)}
              />
            </Form.Item></Col>
            <Col xs={12} md={4}>
              <Form.Item name="ctx" label="Sugar average of">
                <Select options={[{ value: 'fasting', label: 'Fasting' }, { value: 'after', label: 'After meal' }, { value: 'any', label: 'All readings' }]} />
              </Form.Item>
            </Col>
            <Col xs={12} md={3}><Form.Item name="days" label="Over"><Select options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }]} /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="sugarMin" label="From (mg/dL)"><InputNumber min={20} max={600} style={{ width: '100%' }} placeholder="e.g. 180" /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="sugarMax" label="To (mg/dL)"><InputNumber min={20} max={600} style={{ width: '100%' }} placeholder="e.g. 250" /></Form.Item></Col>
            <Col xs={12} md={2}><Form.Item name="a1cMin" label="eA1c ≥"><InputNumber min={4} max={15} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={3}>
              <Form.Item name="attention" label="Needs attention">
                <Select allowClear options={[{ value: 'low', label: 'Had a low' }, { value: 'high', label: 'High average' }, { value: 'poorMeds', label: 'Missing medicine' }, { value: 'inactive', label: 'Inactive 3+ days' }]} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}><Form.Item name="type" label="Type"><Select allowClear options={Object.entries(TYPES).filter(([k]) => k !== 'care').map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="ageGroup" label="Age"><Select allowClear options={Object.entries(AGES).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="diet" label="Diet"><Select allowClear options={Object.entries(DIETS).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="tier" label="Plan"><Select allowClear options={Object.entries(TIERS).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
            {isOwner() ? (
              <Col xs={12} md={4}>
                <Form.Item name="dietitianId" label="Dietitian">
                  <Select allowClear options={[{ value: 'none', label: '— Unassigned —' }, ...(staff.data?.data.data ?? []).filter((s) => s.role === 'DIETITIAN').map((s) => ({ value: s.id, label: s.name }))]} />
                </Form.Item>
              </Col>
            ) : null}
            <Col xs={24} md={7} style={{ display: 'flex', alignItems: 'end', gap: 8, paddingBottom: 24, flexWrap: 'wrap' }}>
              <Button type="primary" htmlType="submit">Apply</Button>
              <Button onClick={() => { form.resetFields(); apply({ ctx: 'fasting', days: 7 }); }}>Reset</Button>
              <Button onClick={saveSegment}>Save as segment</Button>
            </Col>
          </Row>
          <Space wrap>
            <Typography.Text type="secondary">Segments:</Typography.Text>
            {(segments.data?.data.data ?? []).map((s) => (
              <Tag.CheckableTag key={s.id} checked={false} onChange={() => { form.resetFields(); form.setFieldsValue(s.filter); apply(s.filter); }}>{s.name}</Tag.CheckableTag>
            ))}
          </Space>
        </Form>
      </Card>

      {selected.length ? (
        <Space style={{ marginBottom: 12 }} wrap>
          <Typography.Text strong>{selected.length} selected</Typography.Text>
          <Button type="primary" onClick={() => navigate(`/notifications/create?userIds=${selected.join(',')}`)}>🔔 Send notification</Button>
          <Button onClick={() => setBulk('template')}>🥗 Apply diet template</Button>
          {isOwner() ? <Button onClick={() => setBulk('assign')}>👩‍⚕️ Assign dietitian</Button> : null}
        </Space>
      ) : null}

      <Table
        {...tableProps}
        rowKey="id"
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as string[]) }}
        onRow={(r) => ({ onClick: (e) => { if (!(e.target as HTMLElement).closest('.ant-checkbox-wrapper')) show('patients', r.id); }, style: { cursor: 'pointer' } })}
        scroll={{ x: 1900 }}
        columns={[
          { title: 'Patient', dataIndex: 'name', sorter: true, width: 190, fixed: 'left', render: (_, r) => <Space direction="vertical" size={0}><b>{r.name || '—'}</b><Typography.Text type="secondary">{r.phone}</Typography.Text></Space> },
          { title: 'Stage', width: 250, render: (_, r) => <StageTag l={r.lifecycle} /> },
          { title: 'Type', width: 170, render: (_, r) => <Space direction="vertical" size={0}>{TYPES[r.type]}<Typography.Text type="secondary">{AGES[r.ageGroup]} · {DIETS[r.diet]}</Typography.Text></Space> },
          { title: 'Last reading', render: (_, r) => <Space direction="vertical" size={0}><SugarTag v={r.stats?.lastValue} ctx={r.stats?.lastCtx} /><Typography.Text type="secondary">{r.stats?.lastCtx ?? ''}</Typography.Text></Space> },
          { title: 'Fasting 7d', dataIndex: ['stats', 'fastingAvg7'], key: 'fastingAvg7', sorter: true, render: (v) => <SugarTag v={v} ctx="fasting" /> },
          { title: 'After meal 7d', dataIndex: ['stats', 'afterAvg7'], key: 'afterAvg7', sorter: true, render: (v) => <SugarTag v={v} ctx="after" /> },
          { title: 'eA1c', dataIndex: ['stats', 'ea1c'], key: 'ea1c', sorter: true, render: (v) => fmt(v, '%') },
          { title: 'In range', dataIndex: ['stats', 'inRange30'], key: 'inRange30', sorter: true, render: (v) => fmt(v, '%') },
          { title: 'Medicine', dataIndex: ['stats', 'medAdherence7'], key: 'medAdherence7', sorter: true, render: (v) => fmt(v, '%') },
          { title: 'Last seen', dataIndex: ['stats', 'lastSeenAt'], key: 'lastSeenAt', sorter: true, render: (v) => (v ? dayjs(v).format('D MMM') : '–') },
          { title: 'Status', render: (_, r) => <AttentionTags s={r.stats} /> },
          { title: 'Dietitian', render: (_, r) => r.dietitian?.name ?? <Tag>Unassigned</Tag> },
          { title: 'Plan', dataIndex: 'tier', render: (v) => <Tag color={v === 'FREE' ? 'default' : 'green'}>{TIERS[v]}</Tag> },
          {
            title: '',
            fixed: 'right',
            width: 170,
            render: (_, r) =>
              r.lifecycle?.stage === 'subscriber' ? (
                <Button size="small" onClick={(e) => { e.stopPropagation(); setPay({ patientId: r.id, renewSubId: r.lifecycle.subscription?.id }); }}>🔁 Renew</Button>
              ) : r.lifecycle?.stage === 'waiting' ? (
                <Button size="small" onClick={(e) => { e.stopPropagation(); navigate('/kickstart'); }}>Review plan</Button>
              ) : (
                <Button size="small" type={r.lifecycle?.stage === 'trial' && (r.lifecycle.trial?.daysLeft ?? 99) <= 3 ? 'primary' : 'default'} onClick={(e) => { e.stopPropagation(); setPay({ patientId: r.id }); }}>
                  💰 Start subscription
                </Button>
              ),
          },
        ]}
      />

      <SubscriptionModal
        open={!!pay}
        patientId={pay?.patientId ?? ''}
        renewSubId={pay?.renewSubId}
        onClose={() => setPay(null)}
        onDone={() => {
          setFilters(filters, 'replace');
          lifecycle.refetch();
        }}
      />
      <Modal open={!!bulk} title={bulk === 'assign' ? 'Assign dietitian' : 'Apply diet template'} onCancel={() => setBulk(null)} onOk={runBulk} okButtonProps={{ disabled: !bulkValue }}>
        <Select
          style={{ width: '100%' }}
          value={bulkValue}
          onChange={setBulkValue}
          options={
            bulk === 'assign'
              ? [{ value: 'none', label: '— Unassigned —' }, ...(staff.data?.data.data ?? []).filter((s) => s.role === 'DIETITIAN').map((s) => ({ value: s.id, label: s.name }))]
              : (templates.data?.data.data ?? []).map((t) => ({ value: t.id, label: t.title }))
          }
        />
        {bulk === 'template' ? <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>Each selected patient gets a new active plan from this template; their current plan ends.</Typography.Paragraph> : null}
      </Modal>
    </List>
  );
}
