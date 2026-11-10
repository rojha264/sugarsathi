import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';
import { Alert, App, AutoComplete, Button, Card, Checkbox, Col, Empty, Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { eats, type Diet } from '@shared/diet';
import { MEAL_CARBS, MEAL_SLOTS, type MealSlot } from '@shared/thali';

import { CATEGORY_OPTIONS, DIETS, SLOT_LABEL } from '../lib/labels';
import { api } from '../providers/api';
import { usable, useFoods, type Food } from './useFoods';
import { bilingual, foodSearch } from '../lib/search';

type Pick = { foodId: string; slots: MealSlot[]; note: string };
const MAX = 80;
/** One portion over this many grams of carbs gets a gentle warning; a menu food should help, not spike. */
const HEAVY_PORTION = Math.round(MEAL_CARBS.good / 2);
const NOTE_IDEAS = ['Fiber keeps sugar steady', 'Good protein, keeps you full', 'Eat this before roti or rice', 'Better than white rice', 'Low sugar load'];

type Default = { source: 'plan' | 'none'; planTitle: string | null; items: { foodId: string; slots: MealSlot[] }[] };
type Template = { id: string; title: string; diet: string; items: { foodId: string; slot: MealSlot }[] };

/**
 * The patient's meal menu: the only foods the app's meal screen opens with, per meal, each with an
 * optional reason ("Ate something else?" still opens the full list). With nothing saved, the active
 * diet plan's foods are the default. Shows what the patient actually eats so the menu can be reviewed against it.
 */
export function MealMenu({ id, diet }: { id: string; diet: Diet }) {
  const { message } = App.useApp();
  const foods = useFoods();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [saved, setSaved] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usual, setUsual] = useState<{ foodId: string; times: number }[]>([]);
  const [planFoods, setPlanFoods] = useState<{ foodId: string; slot: MealSlot }[]>([]);
  const [fallback, setFallback] = useState<Default | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ data: Pick[]; default: Default }>(`/admin/patients/${id}/picks`);
    setPicks(r.data.map(({ foodId, slots, note }) => ({ foodId, slots, note })));
    setSaved(JSON.stringify(r.data.map(({ foodId, slots, note }) => ({ foodId, slots, note }))));
    setFallback(r.default);
  }, [id]);
  useEffect(() => {
    load();
    // What they really eat (last 14 days), to review picks against.
    api<{ items: { id: string; q: number }[] }[]>(`/admin/patients/${id}/meals?from=${dayjs().subtract(14, 'day').toISOString()}`).then((rows) => {
      const n = new Map<string, number>();
      for (const m of rows) for (const i of m.items) n.set(i.id, (n.get(i.id) ?? 0) + 1);
      setUsual([...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([foodId, times]) => ({ foodId, times })));
    });
    api<{ status: string; items: { foodId: string; slot: MealSlot }[] }[]>(`/admin/diet-plans?patientId=${id}`).then((plans) => setPlanFoods(plans.find((p) => p.status === 'active')?.items ?? []));
    api<{ data: Template[] }>('/admin/diet-templates').then((r) => setTemplates(r.data));
  }, [id, load]);

  const dirty = picks !== null && JSON.stringify(picks) !== saved;
  const fits = (f?: Food) => !!f && usable(f) && eats(diet, f.diet as Diet);
  const add = (foodId: string, slots: MealSlot[] = []) =>
    setPicks((cur) => (cur && !cur.some((p) => p.foodId === foodId) && cur.length < MAX ? [...cur, { foodId, slots, note: '' }] : cur));
  /** Adds foods with the meals they are planned for, skipping ones already on the menu. */
  const addItems = (items: { foodId: string; slot: MealSlot }[]) => {
    const bySlot = new Map<string, Set<MealSlot>>();
    for (const i of items) if (fits(byId.get(i.foodId))) bySlot.set(i.foodId, (bySlot.get(i.foodId) ?? new Set()).add(i.slot));
    setPicks((cur) => {
      const have = new Set((cur ?? []).map((p) => p.foodId));
      const extra = [...bySlot.entries()].filter(([f]) => !have.has(f)).map(([foodId, s]) => ({ foodId, slots: [...s], note: '' }));
      return [...(cur ?? []), ...extra].slice(0, MAX);
    });
  };
  const fromPlan = () => addItems(planFoods);
  const fromTemplate = (tid: string) => {
    const tpl = templates.find((x) => x.id === tid);
    if (!tpl) return;
    const skipped = new Set(tpl.items.filter((i) => !fits(byId.get(i.foodId))).map((i) => i.foodId)).size;
    addItems(tpl.items);
    message.info(`Added foods from "${tpl.title}"${skipped ? `; ${skipped} not ${DIETS[diet]} or not in the catalog were skipped` : ''}. Review, then save.`);
  };
  const patch = (foodId: string, p: Partial<Pick>) => setPicks((cur) => cur!.map((x) => (x.foodId === foodId ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) =>
    setPicks((cur) => {
      const next = [...cur!];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ added: number; notified: boolean }>(`/admin/patients/${id}/picks`, { method: 'PUT', json: { picks, notify } });
      message.success(
        !picks?.length
          ? 'Saved. The app goes back to the default menu on the next sync.'
          : r.notified
            ? `Saved. The patient was told about ${r.added} new food${r.added > 1 ? 's' : ''}.`
            : 'Saved. The app shows it on the next sync.',
      );
      await load();
    } catch (e) {
      const code = (e as Error).message;
      setError(code.startsWith('not_in_diet_') ? `${byId.get(code.slice(12))?.nameEn ?? 'A food'} is not ${DIETS[diet]}.` : code);
    } finally {
      setSaving(false);
    }
  };

  if (!picks) return <Card loading />;
  const addable = foods.filter((f) => fits(f) && f.group !== 'alcohol' && f.group !== 'mixer' && !picks.some((p) => p.foodId === f.id) && (!category || f.category === category));
  // Foods in this category still waiting for a dietitian's check (not on phones yet, so not addable).
  const waiting = category ? foods.filter((f) => f.category === category && f.active && f.reviewStatus === 'draft' && eats(diet, f.diet as Diet)).length : 0;
  const options = addable.map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi}`, search: foodSearch(f), f }));
  // Whole category at once, low-GI first, as far as the menu has room.
  const addAll = () => {
    const room = MAX - picks.length;
    const order = { low: 0, med: 1, high: 2 } as Record<string, number>;
    const list = [...addable].sort((a, b) => (order[a.gi] ?? 1) - (order[b.gi] ?? 1) || a.carbs - b.carbs).slice(0, room);
    setPicks([...picks, ...list.map((f) => ({ foodId: f.id, slots: [] as MealSlot[], note: '' }))]);
    message.info(`Added ${list.length} food${list.length === 1 ? '' : 's'}. Untick meals they don't suit, remove any you don't want, then save.`);
  };
  const custom = picks.length > 0;
  // What the app opens with per meal: this list, else the plan default, else the full food list.
  const perSlot = MEAL_SLOTS.map((s) => ({
    s,
    ids: custom
      ? picks.filter((p) => !p.slots.length || p.slots.includes(s)).map((p) => p.foodId)
      : (fallback?.items ?? []).filter((i) => i.slots.includes(s)).map((i) => i.foodId),
  }));

  return (
    <Row gutter={16}>
      <Col xs={24} xl={16}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type={custom ? 'success' : 'info'}
            showIcon
            message={
              custom ? (
                <span><Tag color="green">Custom menu</Tag>{picks.length} food{picks.length > 1 ? 's' : ''}. The app opens each meal with only these foods.</span>
              ) : fallback?.source === 'plan' ? (
                <span><Tag>Default</Tag>From the diet plan “{fallback.planTitle}” ({fallback.items.length} foods). Add foods below to make a custom menu.</span>
              ) : (
                <span><Tag>Default</Tag>Full food list: no diet plan and no menu yet. Add foods below to make a custom menu.</span>
              )
            }
            description={`The patient can still tap "Ate something else?" or search to log any food. Only ${DIETS[diet]} foods can be added. Leave "Meals" empty to show a food at every meal.`}
          />
          {error ? <Alert type="error" showIcon message={error} /> : null}
          {waiting ? (
            <Alert
              type="warning"
              showIcon
              message={`${waiting} more food${waiting === 1 ? '' : 's'} in this category ${waiting === 1 ? 'is' : 'are'} waiting for review and can't be added yet.`}
              action={<Button size="small" href="/foods" target="_blank">Open review queue</Button>}
            />
          ) : null}
          <Space wrap style={{ width: '100%' }}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={category}
              onChange={(v) => setCategory(v ?? null)}
              style={{ width: 240 }}
              placeholder="📂 Category: fruits, smoothies…"
              options={CATEGORY_OPTIONS}
            />
            <Select
              {...bilingual}
              value={null}
              style={{ minWidth: 340 }}
              placeholder={category ? `🔍 Pick from ${options.length} foods in this category` : '🔍 Add a food: oats, sprouts, smoothie, दाल…'}
              options={options}
              onSelect={(v) => v && add(v)}
              disabled={picks.length >= MAX}
              listHeight={360}
              optionRender={(o) => (
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>{o.data.label}</span>
                  <Typography.Text type="secondary">{o.data.f.carbs} g carbs · GI {o.data.f.gi}</Typography.Text>
                </Space>
              )}
            />
            {category ? (
              <Popconfirm title={`Add all ${Math.min(addable.length, MAX - picks.length)} foods in this category?`} description="Low-GI foods first. You can remove any before saving." onConfirm={addAll} disabled={!addable.length || picks.length >= MAX}>
                <Button disabled={!addable.length || picks.length >= MAX}>➕ Add all ({addable.length})</Button>
              </Popconfirm>
            ) : null}
            <Tooltip title={planFoods.length ? 'Adds the foods of their active diet plan, with the meals they are planned for' : 'No active diet plan'}>
              <Button onClick={fromPlan} disabled={!planFoods.length}>➕ From diet plan</Button>
            </Tooltip>
            <Select
              value={null}
              style={{ minWidth: 220 }}
              placeholder="📋 Start from template"
              disabled={!templates.length}
              options={templates.map((x) => ({ value: x.id, label: `${x.title} · ${x.items.length} items` }))}
              onSelect={(v) => v && fromTemplate(v)}
            />
            <Popconfirm
              title="Reset to the default menu?"
              description={fallback?.source === 'plan' ? 'The app will show the diet plan foods again.' : 'The app will show the full food list again.'}
              okText="Reset"
              onConfirm={() => setPicks([])}
              disabled={!custom}>
              <Button danger disabled={!custom}>↺ Reset to default</Button>
            </Popconfirm>
          </Space>
          <Table
            size="small"
            rowKey="foodId"
            pagination={false}
            dataSource={picks}
            locale={{ emptyText: <Empty description={fallback?.source === 'plan' ? 'No custom menu. The app uses the diet plan foods (see right).' : 'No custom menu. The app shows the full food list.'} /> }}
            columns={[
              {
                title: 'Food',
                width: 230,
                render: (_, p) => {
                  const f = byId.get(p.foodId);
                  if (!f) return <Tag color="red">{p.foodId} (missing)</Tag>;
                  return (
                    <Space direction="vertical" size={0}>
                      <span>{f.emoji} <b>{f.nameEn}</b> <Typography.Text type="secondary">· {f.nameHi}</Typography.Text></span>
                      <Space size={4} wrap>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{f.carbs} g carbs / {f.unit}</Typography.Text>
                        {f.carbs > HEAVY_PORTION ? <Tag color="orange" style={{ fontSize: 11 }}>carb-heavy portion</Tag> : null}
                        {f.gi === 'low' ? <Tag color="green" style={{ fontSize: 11 }}>low GI</Tag> : null}
                        {!f.active ? <Tag color="red">hidden in catalog</Tag> : null}
                      </Space>
                    </Space>
                  );
                },
              },
              {
                title: 'Meals',
                width: 200,
                render: (_, p) => (
                  <Checkbox.Group value={p.slots} onChange={(v) => patch(p.foodId, { slots: v as MealSlot[] })} options={MEAL_SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s].split(' ')[1] }))} />
                ),
              },
              {
                title: 'Why (shown to the patient)',
                render: (_, p) => (
                  <AutoComplete
                    value={p.note}
                    allowClear
                    placeholder="Optional short reason"
                    style={{ width: '100%', minWidth: 150 }}
                    options={NOTE_IDEAS.map((n) => ({ value: n }))}
                    filterOption={(input, o) => !!o?.value.toLowerCase().includes(input.toLowerCase())}
                    onChange={(v) => patch(p.foodId, { note: (v ?? '').slice(0, 120) })}
                  />
                ),
              },
              {
                width: 100,
                render: (_, p, i) => (
                  <Space size={0}>
                    <Button type="text" icon={<ArrowUpOutlined />} disabled={!i} onClick={() => move(i, -1)} aria-label="Move up" />
                    <Button type="text" icon={<ArrowDownOutlined />} disabled={i === picks.length - 1} onClick={() => move(i, 1)} aria-label="Move down" />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setPicks(picks.filter((x) => x.foodId !== p.foodId))} aria-label="Remove" />
                  </Space>
                ),
              },
            ]}
          />
          <Space wrap>
            <Button type="primary" disabled={!dirty} loading={saving} onClick={save}>Save meal menu</Button>
            <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)}>Tell the patient about new foods (inbox + push)</Checkbox>
            {dirty ? <Typography.Text type="warning">Unsaved changes</Typography.Text> : null}
          </Space>
        </Space>
      </Col>
      <Col xs={24} xl={8}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small" title="📱 What the patient sees per meal" extra={custom ? <Tag color="green">Custom</Tag> : <Tag>Default</Tag>}>
            {perSlot.map(({ s, ids }) => (
              <div key={s} style={{ padding: '4px 0', opacity: custom ? 1 : 0.7 }}>
                <Typography.Text strong>{SLOT_LABEL[s]}</Typography.Text>
                <div>
                  {ids.length ? (
                    ids.map((fid) => <Tag key={fid} style={{ marginTop: 4 }}>{byId.get(fid)?.emoji} {byId.get(fid)?.nameEn ?? fid}</Tag>)
                  ) : (
                    <Typography.Text type="secondary">Full food list</Typography.Text>
                  )}
                </div>
              </div>
            ))}
          </Card>
          <Card size="small" title="🕘 What they ate most (14 days)">
            {usual.length ? (
              usual.map((u) => {
                const f = byId.get(u.foodId);
                if (!f) return null;
                const picked = picks.some((p) => p.foodId === u.foodId);
                return (
                  <div key={u.foodId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                    <span>{f.emoji} {f.nameEn} <Typography.Text type="secondary">×{u.times}</Typography.Text></span>
                    <Space size={4}>
                      <Typography.Text type={f.carbs > HEAVY_PORTION ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>{f.carbs} g</Typography.Text>
                      {picked ? <Tag color="green">on menu</Tag> : fits(f) ? <Button size="small" onClick={() => add(f.id)}>+ Add</Button> : null}
                    </Space>
                  </div>
                );
              })
            ) : (
              <Typography.Text type="secondary">No meals logged in the last 14 days.</Typography.Text>
            )}
          </Card>
        </Space>
      </Col>
    </Row>
  );
}
