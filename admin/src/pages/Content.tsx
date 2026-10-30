import { List, useTable } from '@refinedev/antd';
import { Alert, App, Button, Card, Checkbox, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import { MAX_VIDEOS, youtubeEmbed, youtubeId, youtubeThumb, type ExerciseVideo } from '@shared/youtube';

import { useFoods } from '../components/useFoods';
import { BANDS, EX_KINDS } from '../lib/labels';
import { api } from '../providers/api';
import { bilingual, foodSearch } from '../lib/search';
import { SearchBox } from '../components/SearchBox';

type Ex = { id: string; emoji: string; nameEn: string; nameHi: string; kind: string; defaultMin: number; intensity: string; safeFor: string[]; stepsEn: string; stepsHi: string; videoUrl?: string | null; videos?: ExerciseVideo[]; active: boolean; sort: number };
type VideoRow = { url?: string; title?: string };
type ExForm = Omit<Ex, 'videos'> & { videos?: VideoRow[] };
const toRows = (v?: ExerciseVideo[]): VideoRow[] => (v ?? []).map((x) => ({ url: x.id, title: x.title }));

/** One sample-video row: live check of the pasted link, thumbnail, and a playable preview on demand. */
export function VideoPreview({ value }: { value?: string }) {
  const [play, setPlay] = useState(false);
  const id = youtubeId(value);
  if (!value?.trim()) return null;
  if (!id) return <Alert type="error" showIcon message="Not a YouTube video link" style={{ marginBottom: 8 }} />;
  return play ? (
    <iframe title="preview" width="100%" height="260" src={`${youtubeEmbed(id)}&autoplay=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ border: 0, borderRadius: 8, marginBottom: 8 }} />
  ) : (
    <Space style={{ marginBottom: 8 }}>
      <img src={youtubeThumb(id)} alt="" width={160} style={{ borderRadius: 8, cursor: 'pointer' }} onClick={() => setPlay(true)} />
      <Space direction="vertical" size={4}>
        <Typography.Text type="success">✓ Video id <code>{id}</code></Typography.Text>
        <Button size="small" onClick={() => setPlay(true)}>▶ Preview</Button>
      </Space>
    </Space>
  );
}
const SAFE = ['senior', 'pregnancy', 'child', 'low_mobility'];

/** Exercise library used in exercise plans (en + hi instructions, safety flags). */
export function ExerciseList() {
  const { message } = App.useApp();
  const { tableProps, tableQueryResult, setFilters } = useTable<Ex>({ resource: 'exercises', pagination: { pageSize: 50 }, syncWithLocation: false });
  const [open, setOpen] = useState<Partial<Ex> | null>(null);
  const [form] = Form.useForm<ExForm>();
  const rows = Form.useWatch('videos', form) as VideoRow[] | undefined;
  const save = async (v: ExForm) => {
    const { id, ...rest } = v;
    await api(`/admin/exercises/${id}`, { method: 'PUT', json: { ...rest, videos: v.videos ?? [], sort: open?.sort ?? 99, videoUrl: v.videoUrl || null } });
    message.success('Saved');
    setOpen(null);
    tableQueryResult.refetch();
  };
  return (
    <List title="Exercises" headerButtons={<Button type="primary" onClick={() => { form.resetFields(); setOpen({ active: true, safeFor: [], intensity: 'light', kind: 'walk', defaultMin: 10 }); }}>➕ Add exercise</Button>}>
      <div style={{ marginBottom: 12 }}>
        <SearchBox
          placeholder="Search exercises: walk, योग, chair…"
          onSearch={(q) => setFilters([{ field: 'q', operator: 'eq', value: q || undefined }], 'replace')}
          suggest={(q) => api<{ data: Ex[] }>(`/admin/exercises?q=${encodeURIComponent(q)}&pageSize=8`).then((r) => r.data.map((e) => ({ value: e.id, label: `${e.emoji} ${e.nameEn} · ${e.nameHi}` })))}
          onPick={(id) => api<{ data: Ex[] }>(`/admin/exercises?q=${encodeURIComponent(id)}&pageSize=1`).then((r) => { const e = r.data[0]; if (e) { form.setFieldsValue({ ...e, videos: toRows(e.videos) }); setOpen(e); } })}
        />
      </div>
      <Table
        {...tableProps}
        rowKey="id"
        onRow={(r) => ({ onClick: () => { form.setFieldsValue({ ...r, videos: toRows(r.videos) }); setOpen(r); }, style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Exercise', render: (_, r) => <>{r.emoji} <b>{r.nameEn}</b> · {r.nameHi}</> },
          {
            title: 'Sample videos',
            width: 150,
            render: (_, r) =>
              r.videos?.length ? (
                <Space size={4}>
                  <img src={youtubeThumb(r.videos[0].id)} alt="" width={80} style={{ borderRadius: 6 }} />
                  {r.videos.length > 1 ? <Tag>+{r.videos.length - 1}</Tag> : null}
                </Space>
              ) : (
                <Tag>No video</Tag>
              ),
          },
          { title: 'Kind', dataIndex: 'kind' },
          { title: 'Default', dataIndex: 'defaultMin', render: (v) => `${v} min` },
          { title: 'Intensity', dataIndex: 'intensity', render: (v) => <Tag color={v === 'light' ? 'green' : v === 'moderate' ? 'gold' : 'red'}>{v}</Tag> },
          { title: 'Safe for', dataIndex: 'safeFor', render: (v: string[]) => v.map((s) => <Tag key={s}>{s}</Tag>) },
          { title: 'Shown', dataIndex: 'active', render: (v) => (v ? '✓' : <Tag>Hidden</Tag>) },
        ]}
      />
      <Modal open={!!open} title={open?.id ? `Edit ${open.nameEn}` : 'New exercise'} width={720} onCancel={() => setOpen(null)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ ...(open ?? {}), videos: toRows(open?.videos) }}>
          <Row gutter={12}>
            <Col span={6}><Form.Item name="id" label="Id" rules={[{ required: true, pattern: /^[a-z0-9]+$/ }]}><Input disabled={!!open?.id && !!tableProps.dataSource?.some((r) => r.id === open.id)} /></Form.Item></Col>
            <Col span={3}><Form.Item name="emoji" label="Emoji" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={7}><Form.Item name="nameEn" label="Name (English)" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="nameHi" label="Name (Hindi)" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="kind" label="Kind"><Select options={EX_KINDS.map((k) => ({ value: k, label: k }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="intensity" label="Intensity"><Select options={['light', 'moderate', 'vigorous'].map((k) => ({ value: k, label: k }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="defaultMin" label="Default minutes"><InputNumber min={1} max={120} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="active" label="Shown" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
          <Form.Item name="safeFor" label="Safe for"><Checkbox.Group options={SAFE} /></Form.Item>
          <Form.Item name="stepsEn" label="How to (English)" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="stepsHi" label="How to (Hindi)" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
          <Typography.Text strong>🎬 Sample videos (YouTube)</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            Paste a YouTube link, embed code or video id. Patients see these on the exercise and can play them inside the app (up to {MAX_VIDEOS}).
          </Typography.Paragraph>
          <Form.List name="videos">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f, i) => (
                  <Card key={f.key} size="small" style={{ marginBottom: 8 }}>
                    <Row gutter={8}>
                      <Col span={13}>
                        <Form.Item name={[f.name, 'url']} rules={[{ validator: async (_, v) => { if (v && !youtubeId(v)) throw new Error('Not a YouTube video link'); } }]} style={{ marginBottom: 8 }}>
                          <Input placeholder="https://youtu.be/…  or  https://www.youtube.com/watch?v=…" />
                        </Form.Item>
                      </Col>
                      <Col span={9}>
                        <Form.Item name={[f.name, 'title']} style={{ marginBottom: 8 }}>
                          <Input placeholder="Title, e.g. Seated version" maxLength={80} />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button type="text" danger onClick={() => remove(f.name)} aria-label="Remove video">✕</Button>
                      </Col>
                    </Row>
                    <VideoPreview value={rows?.[i]?.url} />
                  </Card>
                ))}
                <Button onClick={() => add({ url: '', title: '' })} disabled={fields.length >= MAX_VIDEOS}>➕ Add sample video</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </List>
  );
}

type Tip = { id: string; emoji: string; en: string; hi: string; category: string; active: boolean; sort: number };

/** Daily tips shown (and read aloud) in the app. */
export function TipList() {
  const { message } = App.useApp();
  const { tableProps, tableQueryResult, setFilters } = useTable<Tip>({ resource: 'tips', pagination: { pageSize: 50 }, syncWithLocation: false });
  const [edit, setEdit] = useState<Partial<Tip> | null>(null);
  const save = async () => {
    if (!edit) return;
    const body = { emoji: edit.emoji ?? '💡', en: edit.en ?? '', hi: edit.hi ?? '', category: edit.category ?? 'general', active: edit.active ?? true };
    if (edit.id) await api(`/admin/tips/${edit.id}`, { method: 'PUT', json: body });
    else await api('/admin/tips', { method: 'POST', json: { ...body, sort: 99 } });
    message.success('Saved');
    setEdit(null);
    tableQueryResult.refetch();
  };
  return (
    <List title="Tips" headerButtons={<Button type="primary" onClick={() => setEdit({ emoji: '💡', category: 'general', active: true })}>➕ Add tip</Button>}>
      <div style={{ marginBottom: 12 }}>
        <SearchBox
          placeholder="Search tips: water, पानी, walk…"
          onSearch={(q) => setFilters([{ field: 'q', operator: 'eq', value: q || undefined }], 'replace')}
          suggest={(q) => api<{ data: Tip[] }>(`/admin/tips?q=${encodeURIComponent(q)}&pageSize=8`).then((r) => r.data.map((t) => ({ value: String(t.id), label: `${t.emoji} ${t.en.slice(0, 60)}` })))}
          onPick={(id) => api<{ data: Tip[] }>(`/admin/tips?pageSize=2000`).then((r) => setEdit(r.data.find((t) => String(t.id) === id) ?? null))}
        />
      </div>
      <Table
        {...tableProps}
        rowKey="id"
        onRow={(r) => ({ onClick: () => setEdit(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: '', dataIndex: 'emoji', width: 40 },
          { title: 'English', dataIndex: 'en' },
          { title: 'Hindi', dataIndex: 'hi' },
          { title: 'Category', dataIndex: 'category', width: 110 },
          { title: 'Shown', dataIndex: 'active', width: 80, render: (v) => (v ? '✓' : <Tag>Hidden</Tag>) },
        ]}
      />
      <Modal open={!!edit} title={edit?.id ? 'Edit tip' : 'New tip'} onCancel={() => setEdit(null)} onOk={save} okButtonProps={{ disabled: !edit?.en || !edit?.hi }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Input style={{ width: 80 }} value={edit?.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} />
            <Select style={{ width: 160 }} value={edit?.category} onChange={(category) => setEdit({ ...edit, category })} options={['general', 'myth', 'food', 'exercise', 'care'].map((c) => ({ value: c, label: c }))} />
            <Switch checked={edit?.active} onChange={(active) => setEdit({ ...edit, active })} checkedChildren="Shown" unCheckedChildren="Hidden" />
          </Space>
          <Input.TextArea rows={3} placeholder="English" value={edit?.en} onChange={(e) => setEdit({ ...edit, en: e.target.value })} />
          <Input.TextArea rows={3} placeholder="Hindi" value={edit?.hi} onChange={(e) => setEdit({ ...edit, hi: e.target.value })} />
        </Space>
      </Modal>
    </List>
  );
}

type Rule = { id: string; band: string; ctx: string; recommend: string[]; avoid: string[]; messageEn: string; messageHi: string; active: boolean };

/** "When sugar is in this band, suggest these foods": drives the app's "What to eat now". */
export function RuleList() {
  const { message } = App.useApp();
  const foods = useFoods();
  const options = foods.map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi}`, search: foodSearch(f) }));
  const name = (id: string) => { const f = foods.find((x) => x.id === id); return f ? `${f.emoji} ${f.nameEn}` : id; };
  const { tableProps, tableQueryResult } = useTable<Rule>({ resource: 'food-rules', pagination: { mode: 'off' }, syncWithLocation: false });
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const save = async () => {
    if (!edit) return;
    const { id, ...body } = { recommend: [], avoid: [], active: true, ctx: 'any', ...edit } as Rule;
    if (id) await api(`/admin/food-rules/${id}`, { method: 'PUT', json: body });
    else await api('/admin/food-rules', { method: 'POST', json: body });
    message.success('Saved');
    setEdit(null);
    tableQueryResult.refetch();
  };
  return (
    <List title="Food rules by sugar level" headerButtons={<Button type="primary" onClick={() => setEdit({ band: 'high', ctx: 'any', recommend: [], avoid: [], active: true })}>➕ Add rule</Button>}>
      <Table
        {...tableProps}
        rowKey="id"
        onRow={(r) => ({ onClick: () => setEdit(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'When sugar is', render: (_, r) => <><Tag color={r.band === 'low' || r.band === 'very_high' ? 'red' : r.band === 'high' ? 'orange' : 'green'}>{BANDS[r.band]}</Tag>{r.ctx !== 'any' ? <Tag>{r.ctx}</Tag> : null}</> },
          { title: 'Suggest', render: (_, r) => r.recommend.map((id) => <Tag key={id} color="green">{name(id)}</Tag>) },
          { title: 'Avoid', render: (_, r) => r.avoid.map((id) => <Tag key={id} color="red">{name(id)}</Tag>) },
          { title: 'Message', dataIndex: 'messageEn' },
          { title: 'On', dataIndex: 'active', render: (v) => (v ? '✓' : '–') },
        ]}
      />
      <Modal open={!!edit} title="Food rule" width={720} onCancel={() => setEdit(null)} onOk={save} okButtonProps={{ disabled: !edit?.messageEn || !edit?.messageHi }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Select style={{ width: 200 }} value={edit?.band} onChange={(band) => setEdit({ ...edit, band })} options={Object.entries(BANDS).map(([value, label]) => ({ value, label }))} />
            <Select style={{ width: 160 }} value={edit?.ctx} onChange={(ctx) => setEdit({ ...edit, ctx })} options={[{ value: 'any', label: 'Any reading' }, { value: 'fasting', label: 'Fasting' }, { value: 'after', label: 'After meal' }]} />
            <Switch checked={edit?.active} onChange={(active) => setEdit({ ...edit, active })} checkedChildren="On" unCheckedChildren="Off" />
          </Space>
          <Select mode="multiple" placeholder="Suggest these foods" style={{ width: '100%' }} {...bilingual} value={edit?.recommend} onChange={(recommend) => setEdit({ ...edit, recommend })} options={options} />
          <Select mode="multiple" placeholder="Avoid these foods" style={{ width: '100%' }} {...bilingual} value={edit?.avoid} onChange={(avoid) => setEdit({ ...edit, avoid })} options={options} />
          <Input.TextArea rows={2} placeholder="Message (English)" value={edit?.messageEn} onChange={(e) => setEdit({ ...edit, messageEn: e.target.value })} />
          <Input.TextArea rows={2} placeholder="Message (Hindi)" value={edit?.messageHi} onChange={(e) => setEdit({ ...edit, messageHi: e.target.value })} />
        </Space>
      </Modal>
    </List>
  );
}
