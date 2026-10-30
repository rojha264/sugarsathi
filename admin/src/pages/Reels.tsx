import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Col, Empty, Form, Input, List, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { REEL_CATEGORIES, REEL_CATEGORY_LABEL, REEL_TITLE_MAX, type ReelCategory, type ReelLang } from '@shared/reels';
import { searchRank } from '@shared/search';
import { youtubeId, youtubeThumb } from '@shared/youtube';
import { SearchBox } from '../components/SearchBox';
import { api } from '../providers/api';
import { VideoPreview } from './Content';

type Reel = { id: string; youtubeId: string; titleEn: string; titleHi: string; category: ReelCategory; lang: ReelLang; featured: boolean; active: boolean; sort: number };
type FormValues = { url: string; titleEn: string; titleHi: string; category: ReelCategory; lang: ReelLang; featured: boolean; active: boolean; notify: boolean };

const LANG_LABEL: Record<ReelLang, string> = { hi: 'Hindi', en: 'English', both: 'Both / no speech' };
const ERRORS: Record<string, string> = {
  bad_youtube: 'That is not a YouTube link. Paste a YouTube or Shorts link.',
  no_title: 'Add an English title.',
  bad_category: 'Choose a category.',
};
const NEW: FormValues = { url: '', titleEn: '', titleHi: '', category: 'learn', lang: 'hi', featured: false, active: true, notify: false };

/**
 * Short diabetes videos for the app's "Learn" tab: education, Indian recipes, exercise, myths and real stories.
 * Staff paste YouTube links; phones get the list on their next sync, in this order.
 */
export function ReelList() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Reel[] | null>(null);
  const [cat, setCat] = useState<ReelCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Reel | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();
  const titleEn = Form.useWatch('titleEn', form);
  const titleHi = Form.useWatch('titleHi', form);

  const load = useCallback(() => {
    api<{ data: Reel[] }>('/admin/reels').then((r) => setRows(r.data));
  }, []);
  useEffect(load, [load]);

  const open = (r: Reel | 'new') => {
    setError(null);
    form.setFieldsValue(r === 'new' ? NEW : { url: `https://youtu.be/${r.youtubeId}`, titleEn: r.titleEn, titleHi: r.titleHi, category: r.category, lang: r.lang, featured: r.featured, active: r.active, notify: false });
    setEdit(r);
  };
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    setError(null);
    try {
      await api(`/admin/reels/${edit === 'new' ? 'new' : edit!.id}`, { method: 'PUT', json: v });
      message.success(v.notify ? 'Saved and sent to patients' : 'Saved. Phones get it on their next sync.');
      setEdit(null);
      load();
    } catch (e) {
      const code = (e as Error).message;
      setError(ERRORS[code] ?? code);
    } finally {
      setSaving(false);
    }
  };
  const all = rows ?? [];
  const move = async (r: Reel, dir: -1 | 1) => {
    const i = all.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= all.length) return;
    const next = [...all];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    await api('/admin/reels/order', { method: 'POST', json: { ids: next.map((x) => x.id) } });
  };
  const toggle = async (r: Reel, active: boolean) => {
    await api(`/admin/reels/${r.id}`, { method: 'PUT', json: { ...r, active } });
    message.success(active ? 'Shown in the app' : 'Hidden from the app');
    load();
  };
  const remove = async (r: Reel) => {
    await api(`/admin/reels/${r.id}`, { method: 'DELETE' });
    message.success('Deleted. It leaves phones on their next sync.');
    load();
  };

  const filtered = all.filter((r) => cat === 'all' || r.category === cat);
  const shown = q.trim() ? searchRank(filtered, q, (r) => [r.titleEn, r.titleHi, r.youtubeId]) : filtered;
  const counts = Object.fromEntries(REEL_CATEGORIES.map((c) => [c, all.filter((r) => r.category === c).length]));

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>🎬 Reels</Typography.Title>
          <Typography.Text type="secondary">Short videos in the app's Learn tab. Patients swipe through them; the top of this list shows first.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>New reel</Button>
      </Space>
      <Alert
        type="info"
        showIcon
        message="Pick short videos (under 3 minutes) from trusted sources: doctors, dietitians, hospitals. Hindi videos reach the most patients."
        description="Shorts links, normal YouTube links and youtu.be links all work. The video plays inside the app with YouTube's own player."
      />
      <Space wrap>
        <Segmented
          value={cat}
          onChange={(v) => setCat(v as typeof cat)}
          options={[{ label: `All (${all.length})`, value: 'all' }, ...REEL_CATEGORIES.map((c) => ({ label: `${REEL_CATEGORY_LABEL[c].icon} ${REEL_CATEGORY_LABEL[c].en} (${counts[c]})`, value: c }))]}
        />
        <SearchBox placeholder="Search reels: sugar, रोटी, walk…" onChange={setQ} />
      </Space>

      <Card loading={!rows} styles={{ body: { padding: 0 } }}>
        <List
          dataSource={shown}
          locale={{ emptyText: <Empty description="No reels yet. Add the first one." /> }}
          renderItem={(r) => (
            <List.Item
              style={{ padding: '12px 16px', opacity: r.active ? 1 : 0.5 }}
              actions={[
                <Tooltip title="Move up" key="u"><ArrowUpOutlined aria-label="Move up" onClick={() => move(r, -1)} /></Tooltip>,
                <Tooltip title="Move down" key="d"><ArrowDownOutlined aria-label="Move down" onClick={() => move(r, 1)} /></Tooltip>,
                <Switch key="a" size="small" checked={r.active} onChange={(v) => toggle(r, v)} aria-label="Shown in app" />,
                <EditOutlined key="e" aria-label="Edit" onClick={() => open(r)} />,
                <Popconfirm key="x" title="Delete this reel?" description="It disappears from the app on the next sync." onConfirm={() => remove(r)}>
                  <DeleteOutlined aria-label="Delete" style={{ color: '#cf1322' }} />
                </Popconfirm>,
              ]}>
              <List.Item.Meta
                avatar={<img src={youtubeThumb(r.youtubeId)} alt="" width={96} height={72} style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }} onClick={() => open(r)} />}
                title={
                  <Space wrap>
                    {r.featured ? <StarFilled style={{ color: '#faad14' }} aria-label="Featured" /> : null}
                    <span>{r.titleEn}</span>
                    {!r.titleHi ? <Tag color="orange">Hindi title missing</Tag> : null}
                  </Space>
                }
                description={
                  <Space wrap size={4}>
                    {r.titleHi ? <span>{r.titleHi} ·</span> : null}
                    <Tag>{REEL_CATEGORY_LABEL[r.category]?.icon} {REEL_CATEGORY_LABEL[r.category]?.en ?? r.category}</Tag>
                    <Tag color="blue">{LANG_LABEL[r.lang]}</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal open={!!edit} title={edit === 'new' ? '🎬 New reel' : '✏️ Edit reel'} okText="Save" confirmLoading={saving} onOk={save} onCancel={() => setEdit(null)} width={720} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={NEW}>
          {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
          <Form.Item name="url" label="YouTube link" rules={[{ required: true, message: 'Paste a YouTube link' }, { validator: (_, v) => (!v || youtubeId(v) ? Promise.resolve() : Promise.reject(new Error('Not a YouTube link'))) }]}>
            <Input placeholder="https://youtube.com/shorts/… or https://youtu.be/…" allowClear />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.url !== b.url}>{() => <VideoPreview value={form.getFieldValue('url')} />}</Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="titleEn" label="Title (English)" rules={[{ required: true, message: 'Add an English title' }]}>
                <Input maxLength={REEL_TITLE_MAX} showCount placeholder="Why walk after meals?" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="titleHi" label="शीर्षक (Hindi)">
                <Input maxLength={REEL_TITLE_MAX} showCount placeholder="खाने के बाद सैर क्यों?" />
              </Form.Item>
            </Col>
          </Row>
          {titleEn && !titleHi ? <Alert type="warning" showIcon message="Hindi title missing: Hindi users will see the English title." style={{ marginBottom: 12 }} /> : null}
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="Category">
                <Select options={REEL_CATEGORIES.map((c) => ({ value: c, label: `${REEL_CATEGORY_LABEL[c].icon} ${REEL_CATEGORY_LABEL[c].en} · ${REEL_CATEGORY_LABEL[c].hi}` }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="lang" label="Language spoken in the video">
                <Select options={(Object.keys(LANG_LABEL) as ReelLang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} />
              </Form.Item>
            </Col>
          </Row>
          <Space size="large" wrap>
            <Form.Item name="featured" valuePropName="checked" noStyle><Checkbox>⭐ Featured (shown first)</Checkbox></Form.Item>
            <Form.Item name="active" valuePropName="checked" noStyle><Checkbox>Shown in the app</Checkbox></Form.Item>
            <Form.Item name="notify" valuePropName="checked" noStyle><Checkbox>🔔 Tell patients about it now</Checkbox></Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
