import { App, Form, Input, InputNumber, Modal, Select, Space, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { api } from '../providers/api';

export type Stage = 'waiting' | 'trial' | 'ended' | 'subscriber' | 'none';
export type Lifecycle = {
  stage: Stage;
  trial: { day: number; daysLeft: number; endsOn: string } | null;
  trialEnded: { status: string; improved: boolean } | null;
  riskReasons: string[];
  subscription: { id: string; plan: string; endsAt: string; daysLeft: number; active: boolean; amountInr: number } | null;
};
export type Plan = { id: string; name: string; priceInr: number; months: number; active: boolean };

export const STAGE_LABEL: Record<Stage, string> = { waiting: '⏳ Waiting for plan', trial: '🆕 On trial', ended: '⌛ Trial ended', subscriber: '💰 Subscribers', none: 'Other' };
/** Days left at or under these turn the tag orange / red. */
const WARN = { trial: 3, renewal: 7 };

/** One tag that says where the patient is and what is coming up. */
export function StageTag({ l }: { l?: Lifecycle | null }) {
  if (!l) return null;
  if (l.stage === 'subscriber' && l.subscription) {
    const d = l.subscription.daysLeft;
    return (
      <Tooltip title={`${l.subscription.plan} · ₹${l.subscription.amountInr} · until ${dayjs(l.subscription.endsAt).format('D MMM YYYY')}`}>
        <Tag color={d <= 1 ? 'red' : d <= WARN.renewal ? 'orange' : 'green'}>💰 {l.subscription.plan} · {d <= 0 ? 'ends today' : `renews in ${d} day${d > 1 ? 's' : ''}`}</Tag>
      </Tooltip>
    );
  }
  if (l.stage === 'trial' && l.trial) {
    const d = l.trial.daysLeft;
    return (
      <Tooltip title={`Trial day ${l.trial.day} of 14 · last day ${dayjs(l.trial.endsOn).format('D MMM')}`}>
        <Tag color={d <= 1 ? 'red' : d <= WARN.trial ? 'orange' : 'blue'}>🆕 Trial day {Math.max(1, l.trial.day)}/14 · {d <= 0 ? 'ends today' : `ends in ${d} day${d > 1 ? 's' : ''}`}</Tag>
      </Tooltip>
    );
  }
  if (l.stage === 'waiting') return <Tag color="orange">⏳ Waiting for plan</Tag>;
  if (l.stage === 'ended') {
    return l.subscription && !l.subscription.active ? (
      <Tag>⌛ {l.subscription.plan} ended {dayjs(l.subscription.endsAt).format('D MMM')}</Tag>
    ) : (
      <Tag color={l.trialEnded?.improved ? 'gold' : 'default'}>⌛ Trial ended{l.trialEnded?.improved ? ' · improved ✨' : ''}</Tag>
    );
  }
  return <Tag>Free</Tag>;
}

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' },
];

/**
 * Records a payment: starts a paid plan (from a trial or after it ended), or renews one (the new period
 * starts when the current one ends). Online payments come later; until then staff record them here.
 */
export function SubscriptionModal({ patientId, renewSubId, open, onClose, onDone }: { patientId: string; renewSubId?: string | null; open: boolean; onClose(): void; onDone(): void }) {
  const { message } = App.useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ planId: string; months: number; amountInr: number; method: string; ref?: string; note?: string }>();
  useEffect(() => {
    if (!open) return;
    api<{ data: Plan[] } | Plan[]>('/admin/subscription-plans').then((r) => {
      const list = (Array.isArray(r) ? r : r.data).filter((p) => p.active && p.priceInr > 0);
      setPlans(list);
      const first = list[0];
      if (first) form.setFieldsValue({ planId: first.id, months: first.months, amountInr: first.priceInr, method: 'upi' });
    });
  }, [open, form]);
  const planId = Form.useWatch('planId', form);
  const months = Form.useWatch('months', form);
  const plan = plans.find((p) => p.id === planId);

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (renewSubId) await api(`/admin/subscriptions/${renewSubId}/renew`, { method: 'POST', json: v });
      else await api(`/admin/patients/${patientId}/subscriptions`, { method: 'POST', json: v });
      message.success(renewSubId ? 'Renewed. The new period starts when the current one ends.' : 'Subscription started. The patient got a welcome message.');
      onDone();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={renewSubId ? '🔁 Renew subscription' : '💰 Start subscription'} okText={renewSubId ? 'Record renewal' : 'Record payment & start'} confirmLoading={saving} onOk={save} onCancel={onClose} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="planId" label="Plan" rules={[{ required: true }]}>
          <Select
            options={plans.map((p) => ({ value: p.id, label: `${p.name} · ₹${p.priceInr} / ${p.months > 1 ? `${p.months} months` : 'month'}` }))}
            onChange={(id) => {
              const p = plans.find((x) => x.id === id);
              if (p) form.setFieldsValue({ months: p.months, amountInr: p.priceInr });
            }}
          />
        </Form.Item>
        <Space style={{ width: '100%' }} size="middle" wrap>
          <Form.Item name="months" label="Months" rules={[{ required: true }]}>
            <InputNumber min={1} max={24} onChange={(m) => plan && form.setFieldsValue({ amountInr: Math.round((plan.priceInr / plan.months) * Number(m || 1)) })} />
          </Form.Item>
          <Form.Item name="amountInr" label="Amount paid (₹)" rules={[{ required: true }]} extra={plan ? `List price ₹${Math.round((plan.priceInr / plan.months) * (months || 1))}` : undefined}>
            <InputNumber min={0} max={100000} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="method" label="Paid by" rules={[{ required: true }]}>
            <Select style={{ width: 150 }} options={METHODS} />
          </Form.Item>
        </Space>
        <Form.Item name="ref" label="Payment reference (UPI id / receipt no.)">
          <Input maxLength={80} placeholder="e.g. 4321XXXX9876" />
        </Form.Item>
        <Form.Item name="note" label="Note">
          <Input maxLength={200} placeholder="e.g. Diwali offer" />
        </Form.Item>
        <Typography.Text type="secondary">Payment is recorded by staff for now. Online payment (UPI / cards) can be connected later.</Typography.Text>
      </Form>
    </Modal>
  );
}
