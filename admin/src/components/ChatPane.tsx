import { SendOutlined } from '@ant-design/icons';
import { Badge, Button, Empty, Input, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../providers/api';
import { presenceText } from './presence';

export type ChatMsg = { id: string; text: string; fromStaff: boolean; at: string; deliveredAt: string | null; readAt: string | null; sender: string };
type Thread = { patient: { name: string; phone: string | null; online: boolean; lastSeen: string | null }; messages: ChatMsg[] };

const POLL_MS = 4000;
/** One-click replies for common answers; the dietitian can edit before sending. */
const CANNED = [
  'Great progress! Keep it up 👏',
  'Please check your fasting sugar tomorrow before tea and log it in the app.',
  'Please take your medicine on time and mark it in the app.',
  'Eat salad first, then dal and sabzi, and roti or rice last.',
  'Walk for 10 minutes after lunch and dinner.',
  'Can I call you today? Please share a good time.',
];

/** WhatsApp-style ticks: ✓ grey sent, ✓✓ grey delivered, ✓✓ blue read. */
function Ticks({ m }: { m: ChatMsg }) {
  const label = m.readAt ? `Read ${dayjs(m.readAt).format('h:mm A')}` : m.deliveredAt ? 'Delivered' : 'Sent';
  return (
    <span title={label} style={{ marginLeft: 6, fontWeight: 700, letterSpacing: -3, color: m.readAt ? '#1A8CD8' : '#8c8c8c' }}>
      {m.readAt || m.deliveredAt ? '✓✓' : '✓'}
      <span style={{ letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>{label}</span>
    </span>
  );
}

export function OnlineDot({ online }: { online: boolean }) {
  return <Badge status={online ? 'success' : 'default'} />;
}


/** The dietitian's side of one patient conversation, refreshed every few seconds while open. */
export function ChatPane({ patientId, showLink }: { patientId: string; showLink?: boolean }) {
  const [data, setData] = useState<Thread | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const t = await api<Thread>(`/admin/patients/${patientId}/chat`).catch(() => null);
    if (!t) return;
    setData(t);
    if (t.messages.some((m) => !m.fromStaff && !m.readAt)) await api(`/admin/patients/${patientId}/chat/read`, { method: 'POST' }).catch(() => {});
  }, [patientId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);
  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and React would call it as a cleanup.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [data?.messages.length]);

  const send = async (msg = text) => {
    if (!msg.trim()) return;
    setSending(true);
    await api(`/admin/patients/${patientId}/chat`, { method: 'POST', json: { text: msg.trim() } });
    setText('');
    setSending(false);
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 460 }}>
      {data ? (
        <Space style={{ padding: '8px 4px', justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <OnlineDot online={data.patient.online} />
            <Typography.Text strong style={{ fontSize: 16 }}>
              {data.patient.name || 'Patient'}
            </Typography.Text>
            <Typography.Text type={data.patient.online ? 'success' : 'secondary'}>{presenceText(data.patient.online, data.patient.lastSeen)}</Typography.Text>
          </Space>
          {showLink ? <Link to={`/patients/show/${patientId}`}>Open patient →</Link> : null}
        </Space>
      ) : null}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f6f8f7', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520 }}>
        {data && !data.messages.length ? <Empty description="No messages yet. Say hello 👋" /> : null}
        {data?.messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.fromStaff ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
            <div style={{ background: m.fromStaff ? '#d7f0e3' : '#fff', border: m.fromStaff ? 'none' : '1px solid #e5e7eb', borderRadius: 14, padding: '8px 12px', whiteSpace: 'pre-wrap' }}>
              {!m.fromStaff ? null : <div style={{ fontSize: 12, color: '#1E8A5A', fontWeight: 600 }}>{m.sender}</div>}
              {m.text}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', textAlign: m.fromStaff ? 'right' : 'left', marginTop: 2 }}>
              {dayjs(m.at).format('D MMM, h:mm A')}
              {m.fromStaff ? <Ticks m={m} /> : null}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <Space wrap style={{ margin: '8px 0' }}>
        {CANNED.map((c) => (
          <Tag key={c} style={{ cursor: 'pointer' }} onClick={() => setText(c)}>
            {c.length > 38 ? `${c.slice(0, 38)}…` : c}
          </Tag>
        ))}
      </Space>
      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="Write a message (Enter to send, Shift+Enter for a new line)"
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={1000}
        />
        <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!text.trim()} onClick={() => send()}>
          Send
        </Button>
      </Space.Compact>
    </div>
  );
}
