import { List } from '@refinedev/antd';
import { App, Button, Card, Col, InputNumber, Row, Select, Space, Table, Tag, Tooltip } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { BilingualTitleNotes } from '../components/Bilingual';
import { PlanBuilder, type BuilderItem } from '../components/PlanBuilder';
import { DIETS } from '../lib/labels';
import { api } from '../providers/api';

type Template = { id?: string; title: string; titleHi?: string; diet: string; kcal: number | null; notes: string; notesHi?: string; items: BuilderItem[] };

/** Reusable diet plans: apply to one patient (Diet plan tab) or many (Patients → Apply diet template). */
export function TemplateList() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<Template[]>([]);
  const [edit, setEdit] = useState<Template | null>(null);
  const load = useCallback(() => {
    api<{ data: Template[] }>('/admin/diet-templates').then((r) => setRows(r.data));
  }, []);
  useEffect(load, [load]);
  const save = async () => {
    if (!edit) return;
    const body = { title: edit.title, titleHi: edit.titleHi ?? '', diet: edit.diet, kcal: edit.kcal, notes: edit.notes, notesHi: edit.notesHi ?? '', items: edit.items.map(({ slot, foodId, qty, note, weekday }) => ({ slot, foodId, qty, note, weekday })) };
    if (edit.id) await api(`/admin/diet-templates/${edit.id}`, { method: 'PUT', json: body });
    else await api('/admin/diet-templates', { method: 'POST', json: body });
    message.success('Template saved');
    setEdit(null);
    load();
  };
  if (edit) {
    return (
      <Card title={edit.id ? `Edit template` : 'New template'} extra={<Space><Button onClick={() => setEdit(null)}>Cancel</Button><Tooltip title={!edit.title ? 'Add a title first' : !edit.items.length ? 'Add at least one food first' : undefined}><Button type="primary" onClick={save} disabled={!edit.title || !edit.items.length}>Save</Button></Tooltip></Space>}>
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col xs={12} md={5}><Select style={{ width: '100%' }} value={edit.diet} onChange={(diet) => setEdit({ ...edit, diet })} options={Object.entries(DIETS).map(([value, label]) => ({ value, label }))} /></Col>
          <Col xs={12} md={5}><InputNumber addonAfter="kcal/day" style={{ width: '100%' }} value={edit.kcal ?? undefined} onChange={(v) => setEdit({ ...edit, kcal: v ?? null })} /></Col>
        </Row>
        <div style={{ marginBottom: 12 }}><BilingualTitleNotes value={edit} onChange={(patch) => setEdit({ ...edit, ...patch })} notesPlaceholder="Notes for patients" /></div>
        <PlanBuilder items={edit.items} onChange={(items) => setEdit({ ...edit, items })} targets={{ carbsBreakfast: 45, carbsLunch: 60, carbsDinner: 50, kcal: edit.kcal }} diet={edit.diet as never} />
      </Card>
    );
  }
  return (
    <List title="Diet templates" headerButtons={<Button type="primary" onClick={() => setEdit({ title: '', diet: 'veg', kcal: 1500, notes: '', items: [] })}>➕ New template</Button>}>
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={false}
        onRow={(r) => ({ onClick: () => setEdit(r), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Template', dataIndex: 'title', render: (v) => <b>{v}</b> },
          { title: 'Diet', dataIndex: 'diet', render: (v) => DIETS[v] },
          { title: 'kcal/day', dataIndex: 'kcal' },
          { title: 'Items', render: (_, r) => <Tag>{r.items.length} foods</Tag> },
          { title: 'Notes', dataIndex: 'notes' },
          {
            title: '',
            render: (_, r) => (
              <Button danger type="text" onClick={(e) => { e.stopPropagation(); modal.confirm({ title: `Delete “${r.title}”?`, onOk: async () => { await api(`/admin/diet-templates/${r.id}`, { method: 'DELETE' }); load(); } }); }}>
                Delete
              </Button>
            ),
          },
        ]}
      />
    </List>
  );
}
