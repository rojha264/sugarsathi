import { Badge, Card, Col, Empty, List, Row, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ChatPane, OnlineDot } from '../components/ChatPane';
import { presenceText } from '../components/presence';
import { api } from '../providers/api';
import { searchRank } from '@shared/search';
import { SearchBox } from '../components/SearchBox';

type Row = { patientId: string; name: string; phone: string | null; online: boolean; lastSeen: string | null; last: { text: string; fromStaff: boolean; at: string }; unread: number };

/** Inbox of patient conversations: unread first-class, who is online, then the open chat. */
export function Chats() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const load = useCallback(() => {
    api<{ data: Row[] }>('/admin/chats').then((r) => setRows(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  // Hindi or English name ("rakesh" finds राकेश) or phone.
  const shown = q.trim() ? searchRank(rows, q, (r) => [r.name, r.phone]) : rows;

  return (
    <Row gutter={12}>
      <Col xs={24} lg={8}>
        <Card title="💬 Chats" styles={{ body: { padding: 0 } }}>
          <div style={{ padding: 12 }}>
            <SearchBox
              width="100%"
              placeholder="Search patient: name (Hindi or English) or phone"
              onChange={setQ}
              suggest={(text) => searchRank(rows, text, (r) => [r.name, r.phone], 8).map((r) => ({ value: r.patientId, label: `${r.name || 'Patient'} · ${r.phone ?? ''}` }))}
              onPick={(id) => navigate(`/chats/${id}`)}
            />
          </div>
          <List
            dataSource={shown}
            locale={{ emptyText: 'No conversations yet. Start one from a patient page.' }}
            renderItem={(r) => (
              <List.Item
                onClick={() => navigate(`/chats/${r.patientId}`)}
                style={{ cursor: 'pointer', padding: '10px 16px', background: r.patientId === id ? '#e8f5ee' : undefined }}
                extra={r.unread ? <Badge count={r.unread} /> : null}>
                <List.Item.Meta
                  avatar={<OnlineDot online={r.online} />}
                  title={
                    <span>
                      <b>{r.name || r.phone}</b> <Typography.Text type="secondary" style={{ fontSize: 12 }}>· {dayjs(r.last.at).format('D MMM, h:mm A')}</Typography.Text>
                    </span>
                  }
                  description={
                    <span style={{ fontWeight: r.unread ? 600 : 400 }}>
                      {r.last.fromStaff ? 'You: ' : ''}
                      {r.last.text.length > 60 ? `${r.last.text.slice(0, 60)}…` : r.last.text}
                      <br />
                      <Typography.Text type={r.online ? 'success' : 'secondary'} style={{ fontSize: 12 }}>
                        {presenceText(r.online, r.lastSeen)}
                      </Typography.Text>
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Card>{id ? <ChatPane key={id} patientId={id} showLink /> : <Empty description="Choose a conversation" />}</Card>
      </Col>
    </Row>
  );
}
