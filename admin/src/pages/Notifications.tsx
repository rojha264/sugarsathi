import { List, useTable } from '@refinedev/antd';
import { useNavigation } from '@refinedev/core';
import { Alert, App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Radio, Row, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../providers/api';

type Notice = { id: string; titleEn: string; bodyEn: string; sender: { name: string } | null; scheduledAt: string; sentAt: string | null; recipients: number; pushed: number; read: number; audience: Record<string, unknown> };

export function NotificationList() {
  const { create } = useNavigation();
  const { tableProps } = useTable<Notice>({ resource: 'notifications', pagination: { pageSize: 20 }, syncWithLocation: false });
  return (
    <List title="Notifications" headerButtons={<Button type="primary" onClick={() => create('notifications')}>✉️ New notification</Button>}>
      <Table
        {...tableProps}
        rowKey="id"
        columns={[
          { title: 'Message', render: (_, r) => <Space direction="vertical" size={0}><b>{r.titleEn}</b><Typography.Text type="secondary">{r.bodyEn}</Typography.Text></Space> },
          { title: 'From', render: (_, r) => r.sender?.name ?? '–' },
          { title: 'Audience', render: (_, r) => <Tag>{r.audience.userIds ? `${(r.audience.userIds as string[]).length} selected` : r.audience.segmentId ? 'Segment' : r.audience.filter ? 'Filter' : 'All my patients'}</Tag> },
          { title: 'When', render: (_, r) => (r.sentAt ? dayjs(r.sentAt).format('D MMM, h:mm A') : <Tag color="blue">Scheduled {dayjs(r.scheduledAt).format('D MMM, h:mm A')}</Tag>) },
          { title: 'Recipients', dataIndex: 'recipients' },
          { title: 'Pushed', dataIndex: 'pushed' },
          { title: 'Read in app', render: (_, r) => `${r.read} (${r.recipients ? Math.round((r.read / r.recipients) * 100) : 0}%)` },
        ]}
      />
    </List>
  );
}

type Values = { titleEn: string; titleHi?: string; bodyEn: string; bodyHi?: string; deeplink: string; mode: 'selected' | 'segment' | 'filter' | 'all'; segmentId?: string; ctx?: string; days?: number; sugarMin?: number; sugarMax?: number; when: 'now' | 'later'; at?: Dayjs };

const DEEPLINKS = [
  { value: '/inbox', label: 'Messages (default)' },
  { value: '/sugar', label: 'Check sugar' },
  { value: '/meal', label: 'Log a meal' },
  { value: '/walk', label: 'Walk timer' },
  { value: '/medicine', label: 'Medicine' },
  { value: '/plan', label: 'My diet plan' },
  { value: '/checkups', label: 'Health checkups' },
];

/** Compose: write in English and Hindi, choose who gets it, send now or schedule. */
export function NotificationCompose() {
  const [params] = useSearchParams();
  const userIds = params.get('userIds')?.split(',').filter(Boolean) ?? [];
  const { message } = App.useApp();
  const { list } = useNavigation();
  const [form] = Form.useForm<Values>();
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const values = Form.useWatch([], form);
  useEffect(() => {
    api<{ data: typeof segments }>('/admin/segments').then((r) => setSegments(r.data));
  }, []);
  const audience = (v?: Partial<Values>) => {
    if (!v) return null;
    if (v.mode === 'selected') return { userIds };
    if (v.mode === 'segment') return v.segmentId ? { segmentId: v.segmentId } : null;
    if (v.mode === 'filter') return { filter: { ctx: v.ctx, days: v.days, sugarMin: v.sugarMin, sugarMax: v.sugarMax } };
    return { all: true };
  };
  const key = JSON.stringify(audience(values));
  useEffect(() => {
    const a = audience(values);
    if (!a) return setCount(null);
    const t = setTimeout(() => api<{ recipients: number }>('/admin/notifications/preview', { method: 'POST', json: { audience: a } }).then((r) => setCount(r.recipients)).catch(() => setCount(null)), 300);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (v: Values) => {
    await api('/admin/notifications', {
      method: 'POST',
      json: { titleEn: v.titleEn, titleHi: v.titleHi, bodyEn: v.bodyEn, bodyHi: v.bodyHi, deeplink: v.deeplink, audience: audience(v), scheduledAt: v.when === 'later' && v.at ? v.at.toISOString() : undefined },
    });
    message.success(v.when === 'later' ? 'Scheduled' : `Sent to ${count} patient(s)`);
    list('notifications');
  };

  return (
    <Card title="✉️ New notification">
      <Form form={form} layout="vertical" onFinish={send} initialValues={{ mode: userIds.length ? 'selected' : 'filter', ctx: 'fasting', days: 7, sugarMin: 180, deeplink: '/inbox', when: 'now' }}>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Form.Item name="titleEn" label="Title (English)" rules={[{ required: true, max: 60 }]}><Input placeholder="Check your fasting sugar tomorrow" /></Form.Item>
            <Form.Item name="bodyEn" label="Message (English)" rules={[{ required: true, max: 300 }]}><Input.TextArea rows={3} /></Form.Item>
            <Form.Item name="titleHi" label="Title (Hindi, for Hindi users)" rules={[{ max: 60 }]}><Input placeholder="कल खाली पेट शुगर जाँचिए" /></Form.Item>
            <Form.Item name="bodyHi" label="Message (Hindi)" rules={[{ max: 300 }]}><Input.TextArea rows={3} /></Form.Item>
            <Form.Item name="deeplink" label="Opens in the app"><Select options={DEEPLINKS} /></Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="mode" label="Who gets it">
              <Radio.Group>
                <Space direction="vertical">
                  {userIds.length ? <Radio value="selected">The {userIds.length} patient(s) I selected</Radio> : null}
                  <Radio value="filter">Patients in a sugar range</Radio>
                  <Radio value="segment">A saved segment</Radio>
                  <Radio value="all">All my patients</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            {values?.mode === 'filter' ? (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space wrap>
                  <Form.Item name="ctx" noStyle><Select style={{ width: 140 }} options={[{ value: 'fasting', label: 'Fasting avg' }, { value: 'after', label: 'After-meal avg' }, { value: 'any', label: 'All readings' }]} /></Form.Item>
                  <Form.Item name="days" noStyle><Select style={{ width: 110 }} options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }]} /></Form.Item>
                  <Form.Item name="sugarMin" noStyle><InputNumber addonBefore="from" min={20} max={600} /></Form.Item>
                  <Form.Item name="sugarMax" noStyle><InputNumber addonBefore="to" min={20} max={600} /></Form.Item>
                </Space>
              </Card>
            ) : null}
            {values?.mode === 'segment' ? <Form.Item name="segmentId" rules={[{ required: true }]}><Select placeholder="Choose a segment" options={segments.map((s) => ({ value: s.id, label: s.name }))} /></Form.Item> : null}
            <Alert type={count ? 'info' : 'warning'} showIcon message={count == null ? 'Choose an audience' : `${count} patient(s) will get this`} style={{ marginBottom: 16 }} />
            <Form.Item name="when" label="When">
              <Radio.Group options={[{ value: 'now', label: 'Send now' }, { value: 'later', label: 'Schedule' }]} />
            </Form.Item>
            {values?.when === 'later' ? <Form.Item name="at" rules={[{ required: true }]}><DatePicker showTime format="D MMM YYYY, h:mm A" disabledDate={(d) => d.isBefore(dayjs(), 'day')} /></Form.Item> : null}
            {values?.titleEn && (!values?.titleHi || !values?.bodyHi) ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Hindi is empty: patients who use the app in Hindi will get the English text. Add the Hindi title and message." />
            ) : null}
            <Card size="small" title="Preview on phone" style={{ background: '#fafafa' }}>
              <b>🩸 {values?.titleEn || 'Title'}</b>
              <div>{values?.bodyEn || 'Message'}</div>
            </Card>
          </Col>
        </Row>
        <Button type="primary" htmlType="submit" disabled={!count} style={{ marginTop: 16 }}>{values?.when === 'later' ? 'Schedule' : 'Send'}</Button>
      </Form>
    </Card>
  );
}

/** Saved patient filters, reusable in the Patients table and as notification audiences. */
export function SegmentList() {
  const { modal } = App.useApp();
  const [rows, setRows] = useState<{ id: string; name: string; filter: Record<string, unknown>; createdAt: string }[]>([]);
  const load = () => api<{ data: typeof rows }>('/admin/segments').then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);
  return (
    <List title="Segments">
      <Typography.Paragraph type="secondary">Create segments from Patients → filter → “Save as segment”.</Typography.Paragraph>
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name', render: (v) => <b>{v}</b> },
          { title: 'Filter', dataIndex: 'filter', render: (f) => Object.entries(f).filter(([, v]) => v != null && v !== '').map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>) },
          { title: 'Open', render: (_, r) => <a href={`/patients?${new URLSearchParams(Object.entries(r.filter).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`}>Patients →</a> },
          { title: '', render: (_, r) => <Button danger type="text" onClick={() => modal.confirm({ title: `Delete “${r.name}”?`, onOk: async () => { await api(`/admin/segments/${r.id}`, { method: 'DELETE' }); load(); } })}>Delete</Button> },
        ]}
      />
    </List>
  );
}
