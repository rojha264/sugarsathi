import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';
import { Alert, App, AutoComplete, Button, Card, Checkbox, Col, Empty, Row, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { eats, type Diet } from '@shared/diet';
import { MEAL_CARBS, MEAL_SLOTS, type MealSlot } from '@shared/thali';

import { DIETS, SLOT_LABEL } from '../lib/labels';
import { api } from '../providers/api';
import { usable, useFoods, type Food } from './useFoods';
import { bilingual, foodSearch } from '../lib/search';

type Pick = { foodId: string; slots: MealSlot[]; note: string };
const MAX = 30;
/** One portion over this many grams of carbs gets a gentle warning; a "For you" food should help, not spike. */
const HEAVY_PORTION = Math.round(MEAL_CARBS.good / 2);
const NOTE_IDEAS = ['Fiber keeps sugar steady', 'Good protein, keeps you full', 'Eat this before roti or rice', 'Better than white rice', 'Low sugar load'];

/**
 * The patient's "For you" tab on the app's meal screen: foods this dietitian recommends, per meal,
 * each with a short reason. Shows what the patient actually eats so picks can be reviewed against it.
 */
export function ForYouPicks({ id, diet }: { id: string; diet: Diet }) {
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

  const load = useCallback(async () => {
    const r = await api<{ data: Pick[] }>(`/admin/patients/${id}/picks`);
    setPicks(r.data);
    setSaved(JSON.stringify(r.data));
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
  }, [id, load]);

  const dirty = picks !== null && JSON.stringify(picks) !== saved;
  const fits = (f?: Food) => !!f && usable(f) && eats(diet, f.diet as Diet);
  const add = (foodId: string, slots: MealSlot[] = []) =>
    setPicks((cur) => (cur && !cur.some((p) => p.foodId === foodId) && cur.length < MAX ? [...cur, { foodId, slots, note: '' }] : cur));
  const fromPlan = () => {
    const bySlot = new Map<string, Set<MealSlot>>();
    for (const i of planFoods) if (fits(byId.get(i.foodId))) bySlot.set(i.foodId, (bySlot.get(i.foodId) ?? new Set()).add(i.slot));
    setPicks((cur) => {
      const have = new Set((cur ?? []).map((p) => p.foodId));
      const extra = [...bySlot.entries()].filter(([f]) => !have.has(f)).map(([foodId, s]) => ({ foodId, slots: [...s], note: '' }));
      return [...(cur ?? []), ...extra].slice(0, MAX);
    });
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
      message.success(r.notified ? `Saved. The patient was told about ${r.added} new food${r.added > 1 ? 's' : ''}.` : 'Saved. The app shows it on the next sync.');
      await load();
    } catch (e) {
      const code = (e as Error).message;
      setError(code.startsWith('not_in_diet_') ? `${byId.get(code.slice(12))?.nameEn ?? 'A food'} is not ${DIETS[diet]}.` : code);
    } finally {
      setSaving(false);
    }
  };

  if (!picks) return <Card loading />;
  const options = foods
    .filter((f) => fits(f) && f.group !== 'alcohol' && f.group !== 'mixer' && !picks.some((p) => p.foodId === f.id))
    .map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi}`, search: foodSearch(f), f }));
  const perSlot = MEAL_SLOTS.map((s) => ({ s, n: picks.filter((p) => !p.slots.length || p.slots.includes(s)).length }));

  return (
    <Row gutter={16}>
      <Col xs={24} xl={16}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={'These foods appear first in the patient\'s "⭐ For you" tab when they log a meal, above their usual foods.'}
            description={`Only ${DIETS[diet]} foods can be added. Leave "Meals" empty to show a food at every meal.`}
          />
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <Space wrap style={{ width: '100%' }}>
            <Select
              {...bilingual}
              value={null}
              style={{ minWidth: 380 }}
              placeholder="🔍 Add a food: oats, sprouts, दाल…"
              options={options}
              onSelect={(v) => v && add(v)}
              disabled={picks.length >= MAX}
              optionRender={(o) => (
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>{o.data.label}</span>
                  <Typography.Text type="secondary">{o.data.f.carbs} g carbs · GI {o.data.f.gi}</Typography.Text>
                </Space>
              )}
            />
            <Tooltip title={planFoods.length ? 'Adds the foods of their active diet plan, with the meals they are planned for' : 'No active diet plan'}>
              <Button onClick={fromPlan} disabled={!planFoods.length}>➕ From diet plan</Button>
            </Tooltip>
          </Space>
          <Table
            size="small"
            rowKey="foodId"
            pagination={false}
            dataSource={picks}
            locale={{ emptyText: <Empty description="No foods yet. The app shows only the patient's usual foods." /> }}
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
            <Button type="primary" disabled={!dirty} loading={saving} onClick={save}>Save "For you" foods</Button>
            <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)}>Tell the patient about new foods (inbox + push)</Checkbox>
            {dirty ? <Typography.Text type="warning">Unsaved changes</Typography.Text> : null}
          </Space>
        </Space>
      </Col>
      <Col xs={24} xl={8}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small" title="📱 What the patient sees per meal">
            {perSlot.map(({ s, n }) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{SLOT_LABEL[s]}</span>
                <Typography.Text type={n ? undefined : 'secondary'}>{n ? `${n} food${n > 1 ? 's' : ''}` : 'only their usual foods'}</Typography.Text>
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
                      {picked ? <Tag color="green">picked</Tag> : fits(f) ? <Button size="small" onClick={() => add(f.id)}>+ Pick</Button> : null}
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
