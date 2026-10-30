import { App, Button, Card, Empty, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../providers/api';
import { StageTag, SubscriptionModal, type Lifecycle } from './lifecycle';

type Sub = { id: string; status: string; startsAt: string; endsAt: string; provider: string; ref: string | null; amountInr: number | null; note: string; plan: { name: string; priceInr: number } };

/** A patient's paid plans: current status and every payment, with start / renew / cancel. */
export function SubscriptionTab({ id, lifecycle, onChange }: { id: string; lifecycle: Lifecycle; onChange(): void }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [pay, setPay] = useState<{ renewSubId?: string } | null>(null);
  const load = useCallback(() => api<{ data: Sub[] }>(`/admin/patients/${id}/subscriptions`).then((r) => setRows(r.data)), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const current = lifecycle.subscription?.active ? lifecycle.subscription : null;
  const paid = (rows ?? []).filter((r) => r.plan.priceInr > 0).reduce((n, r) => n + (r.amountInr ?? r.plan.priceInr), 0);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={2}>
            <StageTag l={lifecycle} />
            <Typography.Text type="secondary">Total paid so far: ₹{paid.toLocaleString('en-IN')}</Typography.Text>
          </Space>
          <Space>
            {current ? (
              <>
                <Button type="primary" onClick={() => setPay({ renewSubId: current.id })}>🔁 Renew</Button>
                <Popconfirm
                  title="Cancel this subscription now?"
                  description="Access ends today and the patient moves to the free tier. Refunds are handled outside the app."
                  okText="Cancel subscription"
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    await api(`/admin/subscriptions/${current.id}/cancel`, { method: 'POST' });
                    message.success('Cancelled');
                    load();
                    onChange();
                  }}>
                  <Button danger>Cancel</Button>
                </Popconfirm>
              </>
            ) : (
              <Button type="primary" onClick={() => setPay({})}>💰 Start subscription</Button>
            )}
          </Space>
        </Space>
      </Card>
      <Card size="small" title="Payments">
        <Table
          size="small"
          rowKey="id"
          loading={!rows}
          pagination={false}
          dataSource={rows ?? []}
          locale={{ emptyText: <Empty description="No payments yet" /> }}
          columns={[
            { title: 'Plan', render: (_, r) => r.plan.name },
            { title: 'Period', render: (_, r) => `${dayjs(r.startsAt).format('D MMM YY')} → ${dayjs(r.endsAt).format('D MMM YY')}` },
            { title: 'Paid', align: 'right', render: (_, r) => (r.plan.priceInr > 0 ? `₹${r.amountInr ?? r.plan.priceInr}` : '–') },
            { title: 'By', render: (_, r) => <Tag>{r.provider.toUpperCase()}</Tag> },
            { title: 'Reference', render: (_, r) => r.ref ?? '–' },
            {
              title: 'Status',
              render: (_, r) => {
                const live = r.status === 'active' && dayjs(r.endsAt).isAfter(dayjs());
                const upcoming = live && dayjs(r.startsAt).isAfter(dayjs());
                return <Tag color={upcoming ? 'blue' : live ? 'green' : r.status === 'cancelled' ? 'red' : 'default'}>{upcoming ? 'Paid in advance' : live ? 'Active' : r.status}</Tag>;
              },
            },
            { title: 'Note', render: (_, r) => r.note || '' },
          ]}
        />
      </Card>
      <SubscriptionModal
        open={!!pay}
        patientId={id}
        renewSubId={pay?.renewSubId}
        onClose={() => setPay(null)}
        onDone={() => {
          load();
          onChange();
        }}
      />
    </Space>
  );
}
