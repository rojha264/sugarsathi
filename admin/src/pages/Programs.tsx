import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Empty, Input, InputNumber, Row, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { BilingualTitleNotes } from '../components/Bilingual';
import { PlanBuilder, type BuilderItem } from '../components/PlanBuilder';
import { DIETS, REGION_LABEL } from '../lib/labels';
import { api } from '../providers/api';

type Ex = { id: string; emoji: string; nameEn: string; defaultMin: number };
type Day = { day: number; focusEn: string; focusHi: string; tipEn: string; tipHi: string; sugarCheck: 'none' | 'fasting' | 'after_meal'; exercises: { exerciseId: string; minutes: number }[] };
type Meal = BuilderItem & { day: number; altGroup?: string };
type Template = { id: string; title: string; titleHi?: string; notesHi?: string; diet: 'veg' | 'egg' | 'nonveg'; region: string; risk: 'standard' | 'hypo_safe'; kcal: number; notes: string; active: boolean; days: Day[]; meals: Meal[] };
type Row = Omit<Template, 'days' | 'meals'> & { meals: number; enrolled: number };

const DAYS = 14;
const CHECK = { none: '—', fasting: '🌅 Fasting', after_meal: '🍽️ After a meal' } as const;
const RISK = { standard: 'Standard', hypo_safe: 'Steady carbs (on tablets / insulin)' } as const;
const blankDays = (): Day[] => Array.from({ length: DAYS }, (_, i) => ({ day: i + 1, focusEn: '', focusHi: '', tipEn: '', tipHi: '', sugarCheck: 'none', exercises: [] }));
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** The 14-day Kickstart templates: new patients get a personal copy of the best match for their diet, region and medicines. */
export function ProgramList() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edit, setEdit] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [exercises, setExercises] = useState<Ex[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<{ data: Row[] }>('/admin/programs').then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
    api<{ data: Ex[] }>('/admin/exercises?pageSize=2000').then((r) => setExercises(r.data));
  }, [load]);

  const open = async (id?: string) => {
    setError(null);
    setIsNew(!id);
    if (!id) return setEdit({ id: '', title: '', diet: 'veg', region: 'north', risk: 'standard', kcal: 1500, notes: '', active: true, days: blankDays(), meals: [] });
    const t = await api<Template>(`/admin/programs/${id}`);
    // Every day gets a row even if the template skipped some.
    const days = blankDays().map((d) => t.days.find((x) => x.day === d.day) ?? d);
    setEdit({ ...t, days, meals: t.meals.map((m) => ({ ...m, weekday: null, note: '' })) });
  };
  const up = (patch: Partial<Template>) => setEdit((e) => (e ? { ...e, ...patch } : e));
  const upDay = (day: number, patch: Partial<Day>) => setEdit((e) => (e ? { ...e, days: e.days.map((d) => (d.day === day ? { ...d, ...patch } : d)) } : e));

  const save = async () => {
    if (!edit) return;
    const id = isNew ? slug(edit.id || edit.title) : edit.id;
    setSaving(true);
    setError(null);
    try {
      await api(`/admin/programs/${id}`, {
        method: 'PUT',
        json: { ...edit, id: undefined, meals: edit.meals.map(({ day, slot, foodId, qty, altGroup }) => ({ day, slot, foodId, qty, altGroup })) },
      });
      message.success('Saved. New patients get this plan from now on; running programmes keep their copy.');
      setEdit(null);
      load();
    } catch (e) {
      const m = (e as Error).message;
      setError(m.startsWith('foods_not_available') ? `These foods are hidden or not verified yet: ${m.split(':')[1]}` : m);
    } finally {
      setSaving(false);
    }
  };

  if (edit) {
    const missingTips = edit.days.filter((d) => !d.tipEn || !d.tipHi).length;
    const emptyDays = edit.days.filter((d) => !edit.meals.some((m) => m.day === d.day)).length;
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>📅 {isNew ? 'New 14-day plan' : edit.title}</Typography.Title>
          <Space>
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={save} disabled={!edit.title.trim()}>Save template</Button>
          </Space>
        </Space>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        {emptyDays || missingTips ? (
          <Alert type="warning" showIcon message={`${emptyDays ? `${emptyDays} day(s) have no meals. ` : ''}${missingTips ? `${missingTips} day(s) are missing a tip in English or Hindi.` : ''}`} />
        ) : null}
        <Card size="small">
          <Row gutter={[12, 12]}>
            {isNew ? <Col xs={24} md={4}><Input addonBefore="Id" value={edit.id || slug(edit.title)} onChange={(e) => up({ id: slug(e.target.value) })} /></Col> : null}
            <Col xs={12} md={3}><Select style={{ width: '100%' }} value={edit.diet} onChange={(v) => up({ diet: v })} options={Object.entries(DIETS).map(([value, label]) => ({ value, label }))} /></Col>
            <Col xs={12} md={3}><Select style={{ width: '100%' }} value={edit.region} onChange={(v) => up({ region: v })} options={['north', 'south', 'east', 'west', 'northeast'].map((v) => ({ value: v, label: REGION_LABEL[v] }))} /></Col>
            <Col xs={12} md={4}><Select style={{ width: '100%' }} value={edit.risk} onChange={(v) => up({ risk: v })} options={Object.entries(RISK).map(([value, label]) => ({ value, label }))} /></Col>
            <Col xs={12} md={2}><Switch checked={edit.active} onChange={(v) => up({ active: v })} /> {edit.active ? 'In use' : 'Off'}</Col>
            <Col xs={24}><BilingualTitleNotes value={edit} onChange={up} titlePlaceholder="Veg · North Indian" notesPlaceholder="Notes shown with the plan (e.g. eat every 3–4 hours, do not skip meals)" /></Col>
          </Row>
          <Typography.Text type="secondary">
            Written for {edit.kcal} kcal. Roti / rice portions scale automatically for each patient (1200–2100 kcal); vegetables and protein stay as written.
          </Typography.Text>
        </Card>
        <Tabs
          items={[
            {
              key: 'meals',
              label: '🍽️ Meals by day',
              children: <PlanBuilder items={edit.meals} onChange={(m) => up({ meals: m as Meal[] })} diet={edit.diet} programDays={DAYS} targets={{ kcal: edit.kcal, carbsBreakfast: 45, carbsLunch: 60, carbsDinner: 50 }} />,
            },
            {
              key: 'days',
              label: '💡 Tips, sugar checks & exercise',
              children: (
                <Table
                  size="small"
                  rowKey="day"
                  pagination={false}
                  dataSource={edit.days}
                  scroll={{ x: 1100 }}
                  columns={[
                    { title: 'Day', dataIndex: 'day', width: 55 },
                    {
                      title: 'Focus (EN / हिं)',
                      width: 200,
                      render: (_, d: Day) => (
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Input size="small" value={d.focusEn} placeholder="Plate order" onChange={(e) => upDay(d.day, { focusEn: e.target.value })} />
                          <Input size="small" value={d.focusHi} placeholder="थाली का क्रम" onChange={(e) => upDay(d.day, { focusHi: e.target.value })} />
                        </Space>
                      ),
                    },
                    {
                      title: 'Tip of the day (EN / हिं)',
                      render: (_, d: Day) => (
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Input.TextArea size="small" autoSize value={d.tipEn} onChange={(e) => upDay(d.day, { tipEn: e.target.value })} />
                          <Input.TextArea size="small" autoSize value={d.tipHi} onChange={(e) => upDay(d.day, { tipHi: e.target.value })} />
                        </Space>
                      ),
                    },
                    {
                      title: 'Sugar check',
                      width: 150,
                      render: (_, d: Day) => <Select size="small" style={{ width: 140 }} value={d.sugarCheck} onChange={(v) => upDay(d.day, { sugarCheck: v })} options={Object.entries(CHECK).map(([value, label]) => ({ value, label }))} />,
                    },
                    {
                      title: 'Exercise',
                      width: 320,
                      render: (_, d: Day) => (
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          {d.exercises.map((x, i) => (
                            <Space key={i} size={4}>
                              <Select size="small" style={{ width: 170 }} value={x.exerciseId} onChange={(v) => upDay(d.day, { exercises: d.exercises.map((y, j) => (j === i ? { ...y, exerciseId: v } : y)) })} options={exercises.map((e) => ({ value: e.id, label: `${e.emoji} ${e.nameEn}` }))} />
                              <InputNumber size="small" min={1} max={90} value={x.minutes} addonAfter="min" style={{ width: 100 }} onChange={(v) => upDay(d.day, { exercises: d.exercises.map((y, j) => (j === i ? { ...y, minutes: Number(v) || 5 } : y)) })} />
                              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove" onClick={() => upDay(d.day, { exercises: d.exercises.filter((_, j) => j !== i) })} />
                            </Space>
                          ))}
                          <Button size="small" icon={<PlusOutlined />} onClick={() => upDay(d.day, { exercises: [...d.exercises, { exerciseId: exercises[0]?.id ?? 'postmeal', minutes: 10 }] })}>Add</Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>📅 14-day Kickstart plans</Typography.Title>
          <Typography.Text type="secondary">Every new patient gets a personal copy of the best match (diet → region → medicines). Risky profiles go to the review queue first.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>New plan</Button>
      </Space>
      {!rows ? (
        <Card loading />
      ) : !rows.length ? (
        <Empty description="No plans yet" />
      ) : (
        <Row gutter={[12, 12]}>
          {rows.map((t) => (
            <Col key={t.id} xs={24} md={12} xl={8}>
              <Card hoverable size="small" onClick={() => open(t.id)} style={{ opacity: t.active ? 1 : 0.55, height: '100%' }} title={t.title}>
                <Space wrap size={4}>
                  <Tag>{DIETS[t.diet]}</Tag>
                  <Tag color="blue">{REGION_LABEL[t.region] ?? t.region}</Tag>
                  {t.risk === 'hypo_safe' ? <Tag color="orange">Steady carbs</Tag> : null}
                  {!t.active ? <Tag>Off</Tag> : null}
                </Space>
                <div style={{ marginTop: 8, color: '#595959' }}>{t.meals} meals over 14 days · {t.enrolled} patients enrolled</div>
                {t.notes ? <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginTop: 6, marginBottom: 0 }}>{t.notes}</Typography.Paragraph> : null}
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
