import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, Checkbox, Col, Drawer, Empty, Form, Input, InputNumber, Popconfirm, Progress, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { kindsFor, type Diet } from '@shared/diet';
import { MAX_QTY, MAX_THALI_ITEMS, MEAL_CARBS, MEAL_SLOTS, thaliNutrition, type MealSlot, type ThaliItem, type ThaliNutrition } from '@shared/thali';

import { usable, useFoods, type Food } from '../components/useFoods';
import { DIETS, SLOT_LABEL } from '../lib/labels';
import { api } from '../providers/api';
import { bilingual, foodSearch } from '../lib/search';

type Thali = { id: string; emoji: string; nameEn: string; nameHi: string; diet: Diet; slots: MealSlot[]; items: ThaliItem[]; active: boolean; sort: number; nutrition: ThaliNutrition };
type Draft = { id?: string; emoji: string; nameEn: string; nameHi: string; slots: MealSlot[]; items: ThaliItem[]; active: boolean };

const EMOJIS = ['🍱', '🍛', '🍙', '🫓', '🥗', '🍚', '🥘', '🍲', '🌽', '🐟', '🍗', '🥚'];
const LEVEL = { good: { color: '#1E8A5A', text: 'Fits one meal' }, high: { color: '#d48806', text: 'A bit high for one meal' }, heavy: { color: '#cf1322', text: 'Heavy: suggest a smaller portion' } } as const;
const PLATE_TARGET = { veg: 0.5, protein: 0.25, grain: 0.25 };
const PLATE_LABEL = { veg: '🥗 Vegetables', protein: '💪 Protein', grain: '🌾 Roti / rice' } as const;
const DIET_TEXT: Record<Diet, string> = { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-vegetarian' };
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const ERRORS: Record<string, string> = {
  name_required: 'Add the name in English and Hindi.', emoji_required: 'Pick an emoji.', at_least_two_items: 'A thali needs at least 2 foods.',
  too_many_items: `Up to ${MAX_THALI_ITEMS} foods.`, bad_id: 'The short id may only use a–z, 0–9 and "-".',
};

/** Who sees a plate of this diet: a veg thali is shown to everyone, a non-veg one only to non-vegetarians. */
const shownTo = (d: Diet) => (['veg', 'egg', 'nonveg'] as Diet[]).filter((p) => kindsFor(p).includes(d)).map((p) => DIET_TEXT[p]);

function itemsText(items: ThaliItem[], byId: Map<string, Food>, lang: 'en' | 'hi') {
  return items
    .filter((i) => byId.get(i.foodId))
    .map((i) => {
      const f = byId.get(i.foodId)!;
      return `${i.qty !== 1 ? `${i.qty} ` : ''}${lang === 'hi' ? f.nameHi : f.nameEn}`;
    })
    .join(' · ');
}

/** The card exactly as patients see it on the app's meal screen. */
function AppPreview({ d, n, byId }: { d: Draft; n: ThaliNutrition; byId: Map<string, Food> }) {
  const [lang, setLang] = useState<'en' | 'hi'>('hi');
  return (
    <Card size="small" title="📱 In the app" extra={<Segmented size="small" value={lang} onChange={(v) => setLang(v as 'en' | 'hi')} options={[{ label: 'हिं', value: 'hi' }, { label: 'EN', value: 'en' }]} />}>
      <div style={{ border: '2px solid #e3ebe6', borderRadius: 18, padding: 12, background: '#fff', maxWidth: 220 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <span style={{ fontSize: 28 }}>{d.emoji || '🍱'}</span>
          <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>+ {lang === 'hi' ? 'जोड़ें' : 'Add'}</Typography.Text>
        </Space>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{(lang === 'hi' ? d.nameHi : d.nameEn) || (lang === 'hi' ? 'थाली का नाम' : 'Thali name')}</div>
        <div style={{ color: '#6b7a72', fontSize: 13 }}>{itemsText(d.items, byId, lang) || '—'}</div>
        <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>🌾 {lang === 'hi' ? `लगभग ${n.carbs} ग्राम कार्ब` : `About ${n.carbs} g carbs`}</div>
        <div style={{ color: '#6b7a72', fontSize: 12 }}>{lang === 'hi' ? `💪 ${n.protein} ग्राम प्रोटीन · 🥗 ${n.fiber} ग्राम फ़ाइबर` : `💪 ${n.protein} g protein · 🥗 ${n.fiber} g fiber`}</div>
      </div>
    </Card>
  );
}

/** Live nutrition for the plate being built: carbs against the one-meal guide, the rest, plate balance and who will see it. */
function NutritionPanel({ n }: { n: ThaliNutrition }) {
  const level = LEVEL[n.carbsLevel];
  const advice = n.plate
    ? n.plate.grain - PLATE_TARGET.grain > 0.1
      ? 'More roti / rice than the plate method suggests. Add salad or sabzi, or reduce grain.'
      : PLATE_TARGET.veg - n.plate.veg > 0.1
        ? 'Add more vegetables (salad, sabzi) to reach half the plate.'
        : PLATE_TARGET.protein - n.plate.protein > 0.1
          ? 'Add protein (dal, curd, paneer, egg) to reach a quarter of the plate.'
          : 'Balanced plate 👍'
    : null;
  return (
    <Card size="small" title="🧮 Nutrition (whole thali)">
      <Statistic title="Carbs" value={n.carbs} suffix="g" valueStyle={{ color: level.color }} />
      <Progress percent={Math.min(100, Math.round((n.carbs / MEAL_CARBS.heavy) * 100))} showInfo={false} strokeColor={level.color} size="small" />
      <Typography.Text style={{ color: level.color }} strong>{level.text}</Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Guide: up to {MEAL_CARBS.good} g for one meal; over {MEAL_CARBS.heavy} g is heavy.</Typography.Text>
      <Row gutter={8} style={{ marginTop: 12 }}>
        <Col span={8}><Statistic title="Protein" value={n.protein} suffix="g" valueStyle={{ fontSize: 20 }} /></Col>
        <Col span={8}><Statistic title="Fiber" value={n.fiber} suffix="g" valueStyle={{ fontSize: 20 }} /></Col>
        <Col span={8}><Statistic title="Fat" value={n.fat} suffix="g" valueStyle={{ fontSize: 20 }} /></Col>
        <Col span={8}><Statistic title="Energy" value={n.kcal} suffix="kcal" valueStyle={{ fontSize: 20 }} /></Col>
        <Col span={16}>
          <Tooltip title="Glycemic load: carbs weighted by how fast each food raises sugar. Under 20 is low for a meal.">
            <Statistic title="Sugar load (GL) ⓘ" value={n.gl} valueStyle={{ fontSize: 20, color: n.gl > 30 ? '#cf1322' : n.gl > 20 ? '#d48806' : undefined }} />
          </Tooltip>
        </Col>
      </Row>
      {n.plate ? (
        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Plate balance</Typography.Text>
          {(Object.keys(PLATE_LABEL) as (keyof typeof PLATE_LABEL)[]).map((k) => (
            <div key={k}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>{PLATE_LABEL[k]}</span>
                <Typography.Text type="secondary">{Math.round(n.plate![k] * 100)}% (aim {PLATE_TARGET[k] * 100}%)</Typography.Text>
              </Space>
              <Progress percent={Math.round(n.plate![k] * 100)} showInfo={false} size="small" strokeColor="#2F6FDB" />
            </div>
          ))}
          <Typography.Text type="secondary">{advice}</Typography.Text>
        </div>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <Typography.Text strong>Diet: </Typography.Text>
        <Tag>{DIETS[n.diet]}</Tag>
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Worked out from the foods. Shown to: {shownTo(n.diet).join(', ')}.</Typography.Text>
      </div>
    </Card>
  );
}

/** Add, edit, order and hide the one-tap thalis on the app's meal screen. */
export function ThaliList() {
  const { message } = App.useApp();
  const foods = useFoods();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const food = useCallback((id: string) => byId.get(id), [byId]);
  const [rows, setRows] = useState<Thali[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<{ data: Thali[] }>('/admin/thalis').then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
  }, [load]);

  const n = useMemo(() => (draft ? thaliNutrition(draft.items, food) : null), [draft, food]);
  const isNew = !draft?.id;
  const edit = (t?: Thali) => {
    setError(null);
    setDraft(t ? { id: t.id, emoji: t.emoji, nameEn: t.nameEn, nameHi: t.nameHi, slots: t.slots, items: t.items, active: t.active } : { emoji: '🍱', nameEn: '', nameHi: '', slots: ['lunch', 'dinner'], items: [], active: true });
  };
  const up = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const addFood = (id: string) =>
    up({ items: draft!.items.some((i) => i.foodId === id) ? draft!.items.map((i) => (i.foodId === id ? { ...i, qty: Math.min(MAX_QTY, i.qty + 1) } : i)) : [...draft!.items, { foodId: id, qty: 1 }] });

  const save = async () => {
    if (!draft) return;
    const id = draft.id ?? slug(draft.nameEn);
    setSaving(true);
    setError(null);
    try {
      await api(`/admin/thalis/${id}`, { method: 'PUT', json: { ...draft, id: undefined } });
      message.success(`Saved. Phones get it on their next sync.`);
      setDraft(null);
      load();
    } catch (e) {
      const code = (e as Error).message;
      setError(ERRORS[code] ?? (code.startsWith('unknown_food_') ? 'One of the foods no longer exists.' : code));
    } finally {
      setSaving(false);
    }
  };
  const move = async (i: number, dir: -1 | 1) => {
    if (!rows) return;
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setRows(next);
    await api('/admin/thalis/order', { method: 'POST', json: { ids: next.map((t) => t.id) } });
  };
  const toggle = async (t: Thali, active: boolean) => {
    await api(`/admin/thalis/${t.id}`, { method: 'PUT', json: { emoji: t.emoji, nameEn: t.nameEn, nameHi: t.nameHi, slots: t.slots, items: t.items, active } });
    message.success(active ? 'Shown in the app' : 'Hidden from the app');
    load();
  };
  const remove = async (t: Thali) => {
    await api(`/admin/thalis/${t.id}`, { method: 'DELETE' });
    message.success('Deleted');
    load();
  };

  const options = foods
    .filter((f) => usable(f) && f.group !== 'alcohol' && f.group !== 'mixer')
    .map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi}`, search: foodSearch(f), f }));

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>🍱 Thalis</Typography.Title>
          <Typography.Text type="secondary">One-tap plates on the app's meal screen. The first 4 show without scrolling; plates that suit the meal being logged come first.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => edit()}>New thali</Button>
      </Space>

      {!rows ? (
        <Card loading />
      ) : !rows.length ? (
        <Empty description="No thalis yet" />
      ) : (
        <Row gutter={[12, 12]}>
          {rows.map((t, i) => {
            const lvl = LEVEL[t.nutrition.carbsLevel];
            return (
              <Col key={t.id} xs={24} md={12} xl={8}>
                <Card
                  size="small"
                  style={{ opacity: t.active ? 1 : 0.55, height: '100%' }}
                  title={<span><span style={{ fontSize: 22 }}>{t.emoji}</span> {t.nameEn} <Typography.Text type="secondary">· {t.nameHi}</Typography.Text></span>}
                  extra={<Typography.Text type="secondary">#{i + 1}</Typography.Text>}
                  actions={[
                    <Tooltip title="Edit" key="e"><EditOutlined onClick={() => edit(t)} /></Tooltip>,
                    <Tooltip title="Move up" key="u"><ArrowUpOutlined onClick={() => i > 0 && move(i, -1)} style={{ opacity: i ? 1 : 0.3 }} /></Tooltip>,
                    <Tooltip title="Move down" key="d"><ArrowDownOutlined onClick={() => i < rows.length - 1 && move(i, 1)} style={{ opacity: i < rows.length - 1 ? 1 : 0.3 }} /></Tooltip>,
                    <Popconfirm key="x" title="Delete this thali?" description="It disappears from the app on the next sync." onConfirm={() => remove(t)}>
                      <DeleteOutlined />
                    </Popconfirm>,
                  ]}>
                  <Space wrap size={4} style={{ marginBottom: 6 }}>
                    <Tag>{DIETS[t.diet]}</Tag>
                    {t.slots.map((s) => <Tag key={s} color="blue">{SLOT_LABEL[s as keyof typeof SLOT_LABEL] ?? s}</Tag>)}
                    {t.nutrition.missing.length ? <Tag color="red">⚠ {t.nutrition.missing.length} food hidden or missing</Tag> : null}
                  </Space>
                  <div style={{ color: '#595959', minHeight: 40 }}>{itemsText(t.items, byId, 'en')}</div>
                  <Space size="middle" style={{ marginTop: 6 }} wrap>
                    <Typography.Text strong style={{ color: lvl.color }}>🌾 {t.nutrition.carbs} g carbs</Typography.Text>
                    <span>💪 {t.nutrition.protein} g</span>
                    <span>🥗 {t.nutrition.fiber} g</span>
                    <span>🔥 {t.nutrition.kcal} kcal</span>
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Switch size="small" checked={t.active} onChange={(v) => toggle(t, v)} /> <Typography.Text type="secondary">{t.active ? 'Shown in app' : 'Hidden'}</Typography.Text>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Drawer
        open={!!draft}
        width={Math.min(1100, window.innerWidth)}
        title={isNew ? 'New thali' : `Edit ${draft?.nameEn}`}
        onClose={() => setDraft(null)}
        extra={<Space><Button onClick={() => setDraft(null)}>Cancel</Button><Button type="primary" loading={saving} onClick={save}>Save</Button></Space>}>
        {draft && n ? (
          <Row gutter={16}>
            <Col xs={24} lg={14}>
              {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
              <Form layout="vertical">
                <Form.Item label="Emoji">
                  <Space wrap>
                    {EMOJIS.map((e) => (
                      <Button key={e} type={draft.emoji === e ? 'primary' : 'default'} onClick={() => up({ emoji: e })} style={{ fontSize: 18 }}>{e}</Button>
                    ))}
                    <Input value={draft.emoji} onChange={(e) => up({ emoji: e.target.value.slice(0, 4) })} style={{ width: 70, fontSize: 18 }} />
                  </Space>
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="Name (English)" required extra={isNew && draft.nameEn ? `Short id: ${slug(draft.nameEn)}` : undefined}>
                      <Input value={draft.nameEn} onChange={(e) => up({ nameEn: e.target.value })} placeholder="e.g. South Indian breakfast" maxLength={40} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Name (Hindi)" required>
                      <Input value={draft.nameHi} onChange={(e) => up({ nameHi: e.target.value })} placeholder="जैसे दक्षिण भारतीय नाश्ता" maxLength={40} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Good for" extra="The app shows these first when the patient logs that meal.">
                  <Checkbox.Group value={draft.slots} onChange={(v) => up({ slots: v as MealSlot[] })} options={MEAL_SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] }))} />
                </Form.Item>
                <Form.Item label={`Foods on the plate (${draft.items.length}/${MAX_THALI_ITEMS})`} required>
                  <Select
                    {...bilingual}
                    value={null}
                    placeholder="🔍 Search a food to add: roti, रोटी, dal…"
                    options={options}
                    onSelect={(id) => id && addFood(id)}
                    disabled={draft.items.length >= MAX_THALI_ITEMS}
                    optionRender={(o) => (
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <span>{o.data.label}</span>
                        <Typography.Text type="secondary">{o.data.f.carbs} g carbs / {o.data.f.unit}</Typography.Text>
                      </Space>
                    )}
                  />
                </Form.Item>
              </Form>
              <Table
                size="small"
                pagination={false}
                rowKey="foodId"
                dataSource={draft.items}
                locale={{ emptyText: 'Add at least 2 foods' }}
                columns={[
                  {
                    title: 'Food',
                    render: (_, i) => {
                      const f = byId.get(i.foodId);
                      return f ? <span>{f.emoji} {f.nameEn} <Typography.Text type="secondary">· {f.nameHi}</Typography.Text>{f.active ? null : <Tag color="red" style={{ marginLeft: 4 }}>hidden</Tag>}</span> : <Tag color="red">{i.foodId} (missing)</Tag>;
                    },
                  },
                  {
                    title: 'Portions',
                    width: 120,
                    render: (_, i) => (
                      <InputNumber
                        min={0.5}
                        max={MAX_QTY}
                        step={0.5}
                        value={i.qty}
                        addonAfter={byId.get(i.foodId)?.unit}
                        onChange={(q) => up({ items: draft.items.map((x) => (x.foodId === i.foodId ? { ...x, qty: Number(q) || 0.5 } : x)) })}
                        style={{ width: 120 }}
                      />
                    ),
                  },
                  { title: 'Carbs', align: 'right', render: (_, i) => `${Math.round((byId.get(i.foodId)?.carbs ?? 0) * i.qty)} g` },
                  { title: 'Protein', align: 'right', render: (_, i) => `${Math.round((byId.get(i.foodId)?.protein ?? 0) * i.qty)} g` },
                  { title: 'Fiber', align: 'right', render: (_, i) => `${Math.round((byId.get(i.foodId)?.fiber ?? 0) * i.qty)} g` },
                  { title: 'kcal', align: 'right', render: (_, i) => Math.round((byId.get(i.foodId)?.kcal ?? 0) * i.qty) },
                  {
                    width: 40,
                    render: (_, i) => <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove" onClick={() => up({ items: draft.items.filter((x) => x.foodId !== i.foodId) })} />,
                  },
                ]}
              />
              <div style={{ marginTop: 12 }}>
                <Switch checked={draft.active} onChange={(v) => up({ active: v })} /> <Typography.Text>{draft.active ? 'Shown in the app' : 'Hidden (draft)'}</Typography.Text>
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <Space direction="vertical" style={{ width: '100%', position: 'sticky', top: 0 }}>
                <NutritionPanel n={n} />
                <AppPreview d={draft} n={n} byId={byId} />
              </Space>
            </Col>
          </Row>
        ) : null}
      </Drawer>
    </Space>
  );
}
