import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, InputNumber, Input, Progress, Row, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { eats, type Diet } from '@shared/diet';

import { DIETS, SLOT_LABEL, SLOTS, WEEKDAYS } from '../lib/labels';
import { totals, type PlanItem } from '../lib/nutrition';
import { usable, useFoods } from './useFoods';
import { bilingual, foodSearch } from '../lib/search';

export type BuilderItem = PlanItem & { note?: string };
export type Targets = { carbsBreakfast?: number | null; carbsLunch?: number | null; carbsDinner?: number | null; protein?: number | null; fiber?: number | null; kcal?: number | null };

const slotTarget = (t: Targets, slot: string) => (slot === 'breakfast' ? t.carbsBreakfast : slot === 'lunch' ? t.carbsLunch : slot === 'dinner' ? t.carbsDinner : 20);

/**
 * Meal-by-meal plan editor. Items apply every day unless a weekday is chosen; with `programDays`
 * (the 14-day Kickstart) each item belongs to one programme day instead.
 * Live totals per meal and per day are compared with the targets.
 */
export function PlanBuilder({ items, onChange, targets = {}, diet, programDays }: { items: BuilderItem[]; onChange(items: BuilderItem[]): void; targets?: Targets; diet?: Diet; programDays?: number }) {
  const foods = useFoods();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const [day, setDay] = useState<number | null>(programDays ? 1 : null);
  const t = programDays ? totals(items, byId, null, day) : totals(items, byId, day);
  const onDay = (it: BuilderItem) => (programDays ? it.day === day : it.weekday == null || it.weekday === day);
  /** Copies the previous day's meals into this day (programme mode), replacing what is there. */
  const copyPrevious = () => day && day > 1 && onChange([...items.filter((it) => it.day !== day), ...items.filter((it) => it.day === day - 1).map((it) => ({ ...it, day }))]);
  // Only foods the patient eats can be added (a vegetarian is never offered egg or meat).
  const fits = (foodId: string) => !diet || !byId.get(foodId) || eats(diet, byId.get(foodId)!.diet as Diet);
  const options = foods.filter((f) => usable(f) && f.group !== 'alcohol' && fits(f.id)).map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi} (${Math.round(f.carbs)} g carbs)`, search: foodSearch(f) }));

  const update = (i: number, patch: Partial<BuilderItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = (slot: string, foodId: string) => onChange([...items, programDays ? { slot, foodId, qty: 1, weekday: null, day, note: '' } : { slot, foodId, qty: 1, weekday: day, note: '' }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {programDays ? (
        <Space wrap>
          <Segmented value={day ?? 1} onChange={(v) => setDay(v as number)} options={Array.from({ length: programDays }, (_, i) => ({ label: `Day ${i + 1}`, value: i + 1 }))} />
          <Button size="small" disabled={!day || day === 1} onClick={copyPrevious}>Copy day {day && day > 1 ? day - 1 : ''} here</Button>
        </Space>
      ) : (
        <Segmented
          value={day ?? -1}
          onChange={(v) => setDay(v === -1 ? null : (v as number))}
          options={[{ label: 'Every day', value: -1 }, ...WEEKDAYS.map((w, i) => ({ label: w, value: i }))]}
        />
      )}
      <Card size="small">
        <Space wrap size="large">
          <Typography.Text strong>Day total{programDays ? ` (day ${day})` : day == null ? ' (every-day items)' : ` (${WEEKDAYS[day]})`}:</Typography.Text>
          <span>🍚 {t.day.carbs} g carbs</span>
          <span>💪 {t.day.protein}{targets.protein ? ` / ${targets.protein}` : ''} g protein</span>
          <span>🥗 {t.day.fiber}{targets.fiber ? ` / ${targets.fiber}` : ''} g fiber</span>
          <span>🔥 {t.day.kcal}{targets.kcal ? ` / ${targets.kcal}` : ''} kcal</span>
        </Space>
      </Card>
      <Row gutter={[12, 12]}>
        {SLOTS.map((slot) => {
          const rows = items.map((it, index) => ({ ...it, index })).filter((it) => it.slot === slot && onDay(it));
          const carbs = t.bySlot[slot]?.carbs ?? 0;
          const target = slotTarget(targets, slot);
          return (
            <Col xs={24} xl={12} key={slot}>
              <Card
                size="small"
                title={SLOT_LABEL[slot]}
                extra={
                  target ? (
                    <Space>
                      <Typography.Text type={carbs > target ? 'danger' : 'secondary'}>{carbs} / {target} g carbs</Typography.Text>
                      <Progress type="circle" size={28} percent={Math.min(100, Math.round((carbs / target) * 100))} status={carbs > target ? 'exception' : 'normal'} showInfo={false} />
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">{carbs} g carbs</Typography.Text>
                  )
                }>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="index"
                  dataSource={rows}
                  locale={{ emptyText: 'Nothing yet' }}
                  columns={[
                    { title: 'Food', render: (_, r) => { const f = byId.get(r.foodId); return f ? <>{f.emoji} {f.nameEn} {fits(r.foodId) ? null : <Tag color="red">Not for {DIETS[diet!]} patient</Tag>}</> : r.foodId; } },
                    { title: 'Qty', width: 90, render: (_, r) => <InputNumber size="small" min={0.25} max={10} step={0.5} value={r.qty} onChange={(v) => update(r.index, { qty: Number(v) || 1 })} /> },
                    { title: 'Note', render: (_, r) => <Input size="small" value={r.note} placeholder="e.g. eat first" onChange={(e) => update(r.index, { note: e.target.value })} /> },
                    ...(programDays ? [] : [{ title: 'Days', width: 70, render: (_: unknown, r: BuilderItem) => (r.weekday == null ? <Tag>All</Tag> : <Tag color="blue">{WEEKDAYS[r.weekday]}</Tag>) }]),
                    { width: 40, render: (_, r) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(items.filter((_, j) => j !== r.index))} /> },
                  ]}
                />
                <Select
                  {...bilingual}
                  value={null}
                  placeholder={<><PlusOutlined /> Add food (Hindi or English)…</>}
                  options={options}
                  onChange={(v) => v && add(slot, v)}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </Card>
            </Col>
          );
        })}
      </Row>
    </Space>
  );
}
