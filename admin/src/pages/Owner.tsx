import { List, useTable } from '@refinedev/antd';
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import { api } from '../providers/api';

type Staff = { id: string; name: string; email: string; role: string; active: boolean; patients: number; createdAt: string };

export function StaffList() {
  const { message } = App.useApp();
  const { tableProps, tableQueryResult } = useTable<Staff>({ resource: 'staff', pagination: { mode: 'off' }, syncWithLocation: false });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  return (
    <List title="Staff" headerButtons={<Button type="primary" onClick={() => setOpen(true)}>➕ Add dietitian</Button>}>
      <Table
        {...tableProps}
        rowKey="id"
        columns={[
          { title: 'Name', dataIndex: 'name', render: (v) => <b>{v}</b> },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Role', dataIndex: 'role', render: (v) => <Tag color={v === 'OWNER' ? 'gold' : 'blue'}>{v}</Tag> },
          { title: 'Patients', dataIndex: 'patients' },
          { title: 'Since', dataIndex: 'createdAt', render: (v) => dayjs(v).format('D MMM YYYY') },
          {
            title: 'Active',
            render: (_, r) => <Switch checked={r.active} onChange={async (active) => { await api(`/admin/staff/${r.id}`, { method: 'PATCH', json: { active } }); tableQueryResult.refetch(); }} />,
          },
        ]}
      />
      <Modal open={open} title="Add dietitian" onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: 'DIETITIAN' }}
          onFinish={async (v) => {
            await api('/admin/staff', { method: 'POST', json: v });
            message.success('Added. Share the email and password with them.');
            setOpen(false);
            form.resetFields();
            tableQueryResult.refetch();
          }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="Temporary password" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label="Role"><Select options={[{ value: 'DIETITIAN', label: 'Dietitian' }, { value: 'OWNER', label: 'Owner' }]} /></Form.Item>
        </Form>
      </Modal>
    </List>
  );
}

type Plan = { id: string; name: string; nameHi?: string; priceInr: number; months: number; features: string[]; featuresHi?: string[]; active: boolean; subscribers: number };

export function SubscriptionPlans() {
  const { message } = App.useApp();
  const { tableProps, tableQueryResult } = useTable<Plan>({ resource: 'subscription-plans', pagination: { mode: 'off' }, syncWithLocation: false });
  const [edit, setEdit] = useState<Plan | null>(null);
  return (
    <List title="Subscription plans">
      <Table
        {...tableProps}
        rowKey="id"
        onRow={(r) => ({ onClick: () => setEdit(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Plan', dataIndex: 'name', render: (v) => <b>{v}</b> },
          { title: 'Price', render: (_, r) => (r.priceInr ? `₹${r.priceInr} / ${r.months} month${r.months > 1 ? 's' : ''}` : 'Free') },
          { title: 'Features', dataIndex: 'features', render: (v: string[]) => v.map((f) => <Tag key={f}>{f}</Tag>) },
          { title: 'Active subscribers', dataIndex: 'subscribers' },
        ]}
      />
      <Modal
        open={!!edit}
        title={`Edit ${edit?.name}`}
        onCancel={() => setEdit(null)}
        onOk={async () => {
          if (!edit) return;
          await api(`/admin/subscription-plans/${edit.id}`, { method: 'PUT', json: { name: edit.name, nameHi: edit.nameHi ?? '', priceInr: edit.priceInr, months: edit.months, features: edit.features, featuresHi: edit.featuresHi ?? [], active: edit.active } });
          message.success('Saved');
          setEdit(null);
          tableQueryResult.refetch();
        }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input addonBefore="Name" value={edit?.name} onChange={(e) => edit && setEdit({ ...edit, name: e.target.value })} />
          <InputNumber addonBefore="₹" value={edit?.priceInr} onChange={(v) => edit && setEdit({ ...edit, priceInr: Number(v) || 0 })} />
          <Input addonBefore="नाम (Hindi)" value={edit?.nameHi} onChange={(e) => edit && setEdit({ ...edit, nameHi: e.target.value })} />
          <Typography.Text type="secondary">Features (English), then the same list in Hindi. Patients using Hindi see the Hindi list.</Typography.Text>
          <Select mode="tags" style={{ width: '100%' }} value={edit?.features} onChange={(features) => edit && setEdit({ ...edit, features })} />
          <Select mode="tags" style={{ width: '100%' }} placeholder="सुविधाएँ (हिन्दी में)" value={edit?.featuresHi} onChange={(featuresHi) => edit && setEdit({ ...edit, featuresHi })} />
          {edit && (!edit.nameHi || (edit.featuresHi?.length ?? 0) < edit.features.length) ? <Tag color="orange">Hindi missing: Hindi users will see English.</Tag> : null}
        </Space>
      </Modal>
    </List>
  );
}

export function AuditList() {
  const { tableProps } = useTable<{ id: string; action: string; entityId: string; at: string; actor: { name: string; role: string } | null }>({ resource: 'audit', pagination: { pageSize: 50 }, syncWithLocation: false });
  return (
    <List title="Audit log (who opened patient data)">
      <Table
        {...tableProps}
        rowKey="id"
        columns={[
          { title: 'When', dataIndex: 'at', render: (v) => dayjs(v).format('D MMM YYYY, h:mm:ss A') },
          { title: 'Who', render: (_, r) => r.actor?.name ?? '–' },
          { title: 'Action', dataIndex: 'action', render: (v) => <code>{v}</code> },
          { title: 'Patient', dataIndex: 'entityId', render: (v) => <a href={`/patients/show/${v}`}>{String(v).slice(0, 8)}…</a> },
        ]}
      />
    </List>
  );
}
