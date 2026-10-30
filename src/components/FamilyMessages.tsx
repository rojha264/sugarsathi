import { View } from 'react-native';

import { approve, markRead, removeMember } from '@/cloud/link';
import { useCloud } from '@/cloud/store';
import { useT } from '@/i18n/useT';
import { say } from '@/native/tts';
import { toast } from './Toast';
import { Banner, Btn, Chip, styles as ui, Txt } from './ui';

/** Follow requests (Allow / No) and cheers or reminders from family, on the patient's Today. */
export function FamilyMessages() {
  const { t, lang } = useT();
  const inbox = useCloud((s) => s.inbox);
  const requests = useCloud((s) => s.requests);
  const asks = requests.map((r) => (
    <Banner key={r.userId} tone="info">
      <Txt size={19} weight="bold" style={{ marginBottom: 8 }}>
        👨‍👩‍👦 {t('shareAsk', { n: r.name || t('family') })}
      </Txt>
      <View style={ui.row}>
        <Btn small label={`✓ ${t('shareAllow')}`} onPress={() => approve(r.userId).catch(() => toast(t('netFail')))} style={{ flex: 1 }} />
        <Btn small kind="alt" label={t('shareDeny')} onPress={() => removeMember(r.userId).catch(() => toast(t('netFail')))} style={{ flex: 1 }} />
      </View>
    </Banner>
  ));
  const msgs = inbox.map((m) => {
    const text = m.kind === 'cheer' ? t('msgCheer', { n: m.fromName || t('family') }) : t('msgRemind', { n: m.fromName || t('family') });
    const full = m.text ? `${text} ${m.text}` : text;
    return (
      <Banner key={m.id} tone={m.kind === 'cheer' ? 'green' : 'amber'}>
        <Txt size={19} weight="bold" style={{ marginBottom: 8 }}>
          {full}
        </Txt>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          <Chip label="🔊" onPress={() => say(full, lang)} />
          <Chip label={`👍 ${t('msgOk')}`} onPress={() => markRead(m.id)} />
        </View>
      </Banner>
    );
  });
  return [...asks, ...msgs];
}
