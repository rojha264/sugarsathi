import { Col, Input, Row, Tag } from 'antd';

export type TitleNotes = { title?: string; titleHi?: string; notes?: string; notesHi?: string };

/**
 * Title and notes in English and Hindi, side by side. Patients who chose Hindi see the Hindi text;
 * when it is empty they see the English one, so the tag warns about that.
 */
export function BilingualTitleNotes({ value, onChange, notesPlaceholder = 'Notes for the patient (shown in the app)', titlePlaceholder }: {
  value: TitleNotes;
  onChange(patch: TitleNotes): void;
  notesPlaceholder?: string;
  titlePlaceholder?: string;
}) {
  const missingHi = (!!value.title?.trim() && !value.titleHi?.trim()) || (!!value.notes?.trim() && !value.notesHi?.trim());
  return (
    <Row gutter={[12, 8]}>
      <Col xs={24} md={12}><Input addonBefore="Title" value={value.title} placeholder={titlePlaceholder} onChange={(e) => onChange({ title: e.target.value })} /></Col>
      <Col xs={24} md={12}><Input addonBefore="शीर्षक (Hindi)" value={value.titleHi} onChange={(e) => onChange({ titleHi: e.target.value })} /></Col>
      <Col xs={24} md={12}><Input.TextArea rows={2} placeholder={notesPlaceholder} value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} /></Col>
      <Col xs={24} md={12}><Input.TextArea rows={2} placeholder="मरीज़ के लिए नोट (हिन्दी में)" value={value.notesHi} onChange={(e) => onChange({ notesHi: e.target.value })} /></Col>
      {missingHi ? <Col xs={24}><Tag color="orange">Hindi missing: patients who use the app in Hindi will see the English text.</Tag></Col> : null}
    </Row>
  );
}
