import { Edit, List, useForm, useTable } from '@refinedev/antd';
import { useNavigation } from '@refinedev/core';
import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Row, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { DIETS, GROUP_LABEL, GROUPS, REGION_LABEL, REGIONS, UNITS } from '../lib/labels';
import { api } from '../providers/api';
import { bilingual, foodSearch } from '../lib/search';
import { SearchBox } from '../components/SearchBox';

type Food = {
  id: string; emoji: string; nameEn: string; nameHi: string; aliases: string[]; diet: string; group: string; gi: string; unit: string; role: string;
  servingG: number; carbs: number; protein: number; fiber: number; fat: number; kcal: number; manual: boolean; active: boolean; sources: string[];
  sugar: number; sodium: number; regions: string[]; measure: string; giValue: number | null; reviewStatus: 'draft' | 'verified'; refCarbs: number | null; refSource: string;
  recipe?: { ingredientId: string; grams: number }[]; swapsFrom?: { toId: string }[];
};
type Ing = { id: string; nameEn: string; nameHi?: string; carb: number; protein: number; fat: number; fiber: number; alc: number; source: string };

/** Food catalog: nutrition per serving; edits reach the app on its next sync. */
export function FoodList() {
  const { edit, create } = useNavigation();
  const { message } = App.useApp();
  const { tableProps, setFilters, tableQueryResult } = useTable<Food>({ resource: 'foods', pagination: { pageSize: 25 }, sorters: { initial: [{ field: 'sort', order: 'asc' }] }, syncWithLocation: false });
  const [view, setView] = useState<'all' | 'draft' | 'verified'>('all');
  const [drafts, setDrafts] = useState(0);
  const countDrafts = () => api<{ total: number }>('/admin/foods?reviewStatus=draft&pageSize=1').then((r) => setDrafts(r.total));
  useEffect(() => {
    countDrafts();
  }, []);
  const show = (v: typeof view) => {
    setView(v);
    setFilters([{ field: 'reviewStatus', operator: 'eq', value: v === 'all' ? undefined : v }], 'merge');
  };
  const review = async (r: Food, status: 'verified' | 'draft') => {
    await api(`/admin/foods/${r.id}/review`, { method: 'POST', json: { status } });
    message.success(status === 'verified' ? `${r.nameEn} verified. Phones get it on their next sync.` : `${r.nameEn} moved back to review.`);
    tableQueryResult.refetch();
    countDrafts();
  };
  return (
    <List title="Foods" headerButtons={<Button type="primary" onClick={() => create('foods')}>➕ Add food</Button>}>
      <Segmented
        style={{ marginBottom: 12 }}
        value={view}
        onChange={(v) => show(v as typeof view)}
        options={[{ label: 'All foods', value: 'all' }, { label: `📝 Review queue (${drafts})`, value: 'draft' }, { label: '✓ Verified (in app)', value: 'verified' }]}
      />
      {view === 'draft' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="New foods computed from IFCT 2017 ingredients. Check the recipe and nutrition, then verify. Only verified foods reach the app."
          description="Click a row to see and edit its recipe. Orange = more than 20% away from a published value."
        />
      ) : null}
      <Space style={{ marginBottom: 12 }} wrap>
        <SearchBox
          placeholder="Search foods: roti, रोटी, chawal…"
          onSearch={(q) => setFilters([{ field: 'q', operator: 'eq', value: q || undefined }], 'merge')}
          suggest={(q) => api<{ data: Food[] }>(`/admin/foods?q=${encodeURIComponent(q)}&pageSize=8`).then((r) => r.data.map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi}` })))}
          onPick={(id) => edit('foods', id)}
        />
        <Select allowClear placeholder="App tab" style={{ width: 200 }} options={GROUPS.map((g) => ({ value: g, label: GROUP_LABEL[g] ?? g }))} onChange={(v) => setFilters([{ field: 'group', operator: 'eq', value: v }], 'merge')} />
        <Select allowClear placeholder="Diet" style={{ width: 140 }} options={Object.entries(DIETS).map(([value, label]) => ({ value, label }))} onChange={(v) => setFilters([{ field: 'diet', operator: 'eq', value: v }], 'merge')} />
        <Select allowClear placeholder="Region" style={{ width: 150 }} options={REGIONS.map((v) => ({ value: v, label: REGION_LABEL[v] }))} onChange={(v) => setFilters([{ field: 'region', operator: 'eq', value: v }], 'merge')} />
      </Space>
      <Table
        {...tableProps}
        rowKey="id"
        onRow={(r) => ({ onClick: () => edit('foods', r.id), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Food',
            dataIndex: 'nameEn',
            sorter: true,
            render: (_, r) => (
              <Space direction="vertical" size={0}>
                <span>{r.emoji} <b>{r.nameEn}</b> · {r.nameHi}</span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{[r.measure, ...(r.regions ?? []).map((g) => REGION_LABEL[g] ?? g)].filter(Boolean).join(' · ')}</Typography.Text>
              </Space>
            ),
          },
          { title: 'App tab', dataIndex: 'group', sorter: true, render: (g: string) => GROUP_LABEL[g] ?? g },
          { title: 'Diet', dataIndex: 'diet', render: (v) => DIETS[v] },
          { title: 'GI', dataIndex: 'gi', render: (v) => <Tag color={v === 'low' ? 'green' : v === 'med' ? 'gold' : 'red'}>{v}</Tag> },
          { title: 'Serving', render: (_, r) => `1 ${r.unit} (${r.servingG} g)` },
          {
            title: 'Carbs',
            dataIndex: 'carbs',
            sorter: true,
            render: (v: number, r) => {
              const off = r.refCarbs ? Math.round(((v - r.refCarbs) / r.refCarbs) * 100) : null;
              return (
                <Tooltip title={r.refCarbs ? `Published: ${r.refCarbs} g (${r.refSource})` : 'No published reference'}>
                  <span style={{ color: off !== null && Math.abs(off) > 20 ? '#d46b08' : undefined }}>{v} g{off !== null ? ` (${off > 0 ? '+' : ''}${off}%)` : ''}</span>
                </Tooltip>
              );
            },
          },
          { title: 'Protein', dataIndex: 'protein', sorter: true, render: (v) => `${v} g` },
          { title: 'Fiber', dataIndex: 'fiber', render: (v) => `${v} g` },
          { title: 'kcal', dataIndex: 'kcal', sorter: true },
          { title: 'Sodium', dataIndex: 'sodium', sorter: true, render: (v: number) => <span style={{ color: v > 800 ? '#cf1322' : undefined }}>{Math.round(v ?? 0)} mg</span> },
          { title: 'Source', render: (_, r) => (r.manual ? <Tag color="purple">Manual</Tag> : <Tag>{r.sources.join(', ') || 'Recipe'}</Tag>) },
          { title: 'Shown', dataIndex: 'active', render: (v) => (v ? '✓' : <Tag>Hidden</Tag>) },
          {
            title: 'Review',
            dataIndex: 'reviewStatus',
            sorter: true,
            render: (v: string, r) =>
              v === 'draft' ? (
                <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); review(r, 'verified'); }}>✓ Verify</Button>
              ) : (
                <Tooltip title="Move back to the review queue (hides it from phones)">
                  <Tag color="green" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); review(r, 'draft'); }}>Verified</Tag>
                </Tooltip>
              ),
          },
        ]}
      />
    </List>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Create or edit a food. With a recipe, nutrition is computed from ingredients (same maths as the server). */
/** Defaults for a brand-new food only; an edit loads the food's own values. */
const NEW_FOOD = { servingG: 100, active: true, manual: false, diet: 'veg', gi: 'med', unit: 'katori', role: 'other', group: 'dalsabzi', aliases: [] };

export function FoodEdit() {
  const { id } = useParams();
  const isNew = !id;
  const { message } = App.useApp();
  const { list } = useNavigation();
  const { formProps, queryResult, form } = useForm<Food>({ resource: 'foods', id, action: isNew ? 'create' : 'edit', meta: { method: 'put' }, redirect: false });
  const food = queryResult?.data?.data;
  const [recipe, setRecipe] = useState<{ ingredientId: string; grams: number }[]>([]);
  const [ings, setIngs] = useState<Ing[]>([]);
  const [foods, setFoods] = useState<{ id: string; nameEn: string; nameHi: string; emoji: string; aliases?: string[] }[]>([]);
  useEffect(() => {
    api<{ data: Ing[] }>('/admin/ingredients?pageSize=2000').then((r) => setIngs(r.data));
    api<{ data: typeof foods }>('/admin/foods?pageSize=2000').then((r) => setFoods(r.data));
  }, []);
  useEffect(() => {
    if (food) {
      // Fill the form with the loaded food (the defaults below are only for a new one).
      form.setFieldsValue({ ...food, swapTo: food.swapsFrom?.[0]?.toId ?? null } as never);
      setRecipe(food.recipe?.map(({ ingredientId, grams }) => ({ ingredientId, grams })) ?? []);
    }
  }, [food, form]);
  const manual = Form.useWatch('manual', form);
  const byId = useMemo(() => new Map(ings.map((i) => [i.id, i])), [ings]);
  const computed = recipe.reduce(
    (a, r) => {
      const i = byId.get(r.ingredientId);
      if (!i) return a;
      const k = r.grams / 100;
      return { carbs: a.carbs + i.carb * k, protein: a.protein + i.protein * k, fiber: a.fiber + i.fiber * k, fat: a.fat + i.fat * k, alc: a.alc + i.alc * k };
    },
    { carbs: 0, protein: 0, fiber: 0, fat: 0, alc: 0 },
  );
  const kcal = Math.round(4 * computed.carbs + 4 * computed.protein + 9 * computed.fat + 2 * computed.fiber + 7 * computed.alc);

  const onFinish = async (v: Food & { swapTo?: string | null }) => {
    const body = { ...v, aliases: typeof v.aliases === 'string' ? String(v.aliases).split(',').map((s) => s.trim()).filter(Boolean) : v.aliases, recipe: manual ? undefined : recipe, sources: v.sources ?? food?.sources ?? [] };
    try {
      await api(`/admin/foods/${v.id}`, { method: 'PUT', json: body });
      message.success('Saved. Phones get it on their next sync.');
      list('foods');
    } catch (e) {
      message.error(`Could not save: ${(e as Error).message}`);
    }
  };

  return (
    <Edit title={isNew ? 'New food' : `Edit ${food?.nameEn ?? ''}`} saveButtonProps={{ onClick: () => form.submit() }} canDelete={false}>
      <Form {...formProps} layout="vertical" onFinish={onFinish as never} initialValues={isNew ? NEW_FOOD : formProps.initialValues}>
        <Row gutter={12}>
          <Col xs={24} md={4}><Form.Item name="id" label="Id (slug)" rules={[{ required: true, pattern: /^[a-z0-9]+$/, message: 'lowercase letters and digits' }]}><Input disabled={!isNew} /></Form.Item></Col>
          <Col xs={6} md={2}><Form.Item name="emoji" label="Emoji" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={18} md={6}><Form.Item name="nameEn" label="Name (English)" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name="nameHi" label="Name (Hindi)" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name="aliases" label="Voice words (comma separated)" getValueProps={(v) => ({ value: Array.isArray(v) ? v.join(', ') : v })}><Input /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="group" label="App tab" tooltip="Where the food shows on the app's meal screen. 'Eat first' is for salads, soups and other foods to start a meal with."><Select options={GROUPS.map((g) => ({ value: g, label: GROUP_LABEL[g] ?? g }))} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="diet" label="Diet"><Select options={Object.entries(DIETS).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
          <Col xs={12} md={3}><Form.Item name="gi" label="Glycemic index"><Select options={['low', 'med', 'high'].map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
          <Col xs={12} md={3}><Form.Item name="unit" label="Unit"><Select options={UNITS.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
          <Col xs={12} md={3}><Form.Item name="servingG" label="Serving (g / ml)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={3}><Form.Item name="role" label="Plate role"><Select options={['veg', 'protein', 'grain', 'other'].map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
          <Col xs={12} md={2}><Form.Item name="active" label="Shown in app" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12} md={2}><Form.Item name="manual" label="Set by hand" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} md={6}>
            <Form.Item name="swapTo" label="Healthier swap">
              <Select allowClear {...bilingual} options={foods.filter((f) => f.id !== id).map((f) => ({ value: f.id, label: `${f.emoji} ${f.nameEn} · ${f.nameHi}`, search: foodSearch(f) }))} />
            </Form.Item>
          </Col>
        </Row>

        {manual ? (
          <Card size="small" title="Nutrition per serving (manual)">
            <Row gutter={12}>
              {(['carbs', 'protein', 'fiber', 'fat', 'kcal'] as const).map((k) => (
                <Col xs={12} md={4} key={k}><Form.Item name={k} label={k} rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              ))}
            </Row>
          </Card>
        ) : (
          <Card
            size="small"
            title="Recipe for one serving (raw ingredient weights)"
            extra={<Typography.Text strong>= {r1(computed.carbs)} g carbs · {r1(computed.protein)} g protein · {r1(computed.fiber)} g fiber · {r1(computed.fat)} g fat · {kcal} kcal</Typography.Text>}>
            <Table
              size="small"
              rowKey={(_, i) => String(i)}
              pagination={false}
              dataSource={recipe}
              columns={[
                { title: 'Ingredient', render: (_, r) => { const i = byId.get(r.ingredientId); return i ? `${i.id} · ${i.source}` : r.ingredientId; } },
                { title: 'Grams', width: 130, render: (_, r, idx) => <InputNumber min={0} value={r.grams} onChange={(v) => setRecipe(recipe.map((x, j) => (j === idx ? { ...x, grams: Number(v) || 0 } : x)))} /> },
                { width: 60, render: (_, __, idx) => <Button type="text" danger onClick={() => setRecipe(recipe.filter((_, j) => j !== idx))}>✕</Button> },
              ]}
            />
            <Select
              {...bilingual}
              value={null}
              placeholder="➕ Add ingredient (Hindi or English)…"
              style={{ width: 360, marginTop: 8 }}
              options={ings.map((i) => ({ value: i.id, label: `${i.id} · ${i.nameEn || i.source}${i.nameHi ? ` · ${i.nameHi}` : ''}`, search: [i.nameEn, i.nameHi, i.id, i.source] }))}
              onChange={(v) => v && setRecipe([...recipe, { ingredientId: v, grams: 50 }])}
            />
          </Card>
        )}
      </Form>
    </Edit>
  );
}

/** Raw ingredients per 100 g (IFCT 2017 / USDA). Changing one updates every food made from it. */
export function IngredientList() {
  const { message } = App.useApp();
  const { tableProps, setFilters, tableQueryResult } = useTable<Ing>({ resource: 'ingredients', pagination: { pageSize: 50 }, syncWithLocation: false });
  const [editing, setEditing] = useState<Ing | null>(null);
  const save = async () => {
    if (!editing) return;
    const r = await api<{ foodsUpdated: number }>(`/admin/ingredients/${editing.id}`, { method: 'PUT', json: { nameEn: editing.nameEn, carb: editing.carb, protein: editing.protein, fat: editing.fat, fiber: editing.fiber, alc: editing.alc, source: editing.source } });
    message.success(`Saved; ${r.foodsUpdated} food(s) recalculated`);
    setEditing(null);
    tableQueryResult.refetch();
  };
  const num = (k: keyof Ing) => ({
    title: `${k} /100g`,
    dataIndex: k,
    render: (v: number, r: Ing) => (editing?.id === r.id ? <InputNumber size="small" value={editing[k] as number} onChange={(n) => setEditing({ ...editing, [k]: Number(n) || 0 })} /> : v),
  });
  return (
    <List title="Ingredients (per 100 g)" headerButtons={<Button onClick={() => setEditing({ id: prompt('New ingredient id (slug)') ?? '', nameEn: '', carb: 0, protein: 0, fat: 0, fiber: 0, alc: 0, source: '' })}>➕ Add</Button>}>
      <div style={{ marginBottom: 12 }}>
        <SearchBox
          placeholder="Search ingredients: atta, आटा, besan…"
          onSearch={(q) => setFilters([{ field: 'q', operator: 'eq', value: q || undefined }], 'replace')}
          suggest={(q) => api<{ data: Ing[] }>(`/admin/ingredients?q=${encodeURIComponent(q)}&pageSize=8`).then((r) => r.data.map((i) => ({ value: i.id, label: `${i.id} · ${i.nameEn || i.source}${i.nameHi ? ` · ${i.nameHi}` : ''}` })))}
          onPick={(id) => setFilters([{ field: 'q', operator: 'eq', value: id }], 'replace')}
        />
      </div>
      {editing && !tableProps.dataSource?.some((r) => r.id === editing.id) ? (
        <Card size="small" title={`New: ${editing.id}`} style={{ marginBottom: 12 }}>
          <Space wrap>
            <Input placeholder="Name (e.g. Wheat flour, atta)" value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} style={{ width: 220 }} />
            <Input placeholder="Source (e.g. IFCT A019 Wheat flour)" value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} style={{ width: 320 }} />
            {(['carb', 'protein', 'fat', 'fiber'] as const).map((k) => <InputNumber key={k} addonBefore={k} value={editing[k]} onChange={(n) => setEditing({ ...editing, [k]: Number(n) || 0 })} />)}
            <Button type="primary" onClick={save} disabled={!editing.id || !editing.nameEn.trim()}>Save</Button>
          </Space>
        </Card>
      ) : null}
      <Table
        {...tableProps}
        rowKey="id"
        columns={[
          { title: 'Id', dataIndex: 'id' },
          { title: 'Source', dataIndex: 'source', render: (v, r) => (editing?.id === r.id ? <Input size="small" value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} /> : v) },
          num('carb'), num('protein'), num('fat'), num('fiber'),
          { width: 140, render: (_, r) => (editing?.id === r.id ? <Space><Button size="small" type="primary" onClick={save}>Save</Button><Button size="small" onClick={() => setEditing(null)}>Cancel</Button></Space> : <Button size="small" onClick={() => setEditing(r)}>Edit</Button>) },
        ]}
      />
    </List>
  );
}
