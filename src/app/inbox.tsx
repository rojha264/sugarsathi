import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { readNotice } from '@/cloud/link';
import { useCloud } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { Btn, Card, Chip, H3, styles as ui, Txt } from '@/components/ui';
import { dateFormat } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { say } from '@/native/tts';
import { useColors } from '@/theme/tokens';

/** Messages from the dietitian, in the user's language, read aloud on tap. */
export default function InboxScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const notices = useCloud((s) => s.notices);
  const dietitian = useCloud((s) => s.chat.dietitian);
  const chatUnread = useCloud((s) => s.chat.unread);
  const fmt = dateFormat(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const chatCard = (
    <Pressable accessibilityRole="button" onPress={() => router.push('/chat')}>
      <Card style={{ borderColor: c.leaf, borderWidth: 2 }}>
        <View style={ui.row}>
          <Txt size={30}>💬</Txt>
          <View style={{ flex: 1 }}>
            <Txt size={19} weight="bold">
              {t('chatWith', { n: dietitian?.name ?? t('chatT') })}
            </Txt>
            <Txt size={15} color={dietitian?.online ? 'leaf' : 'mute'}>
              {dietitian?.online ? `🟢 ${t('chatOnline')}` : `⚪ ${t('chatOffline')}`}
              {chatUnread ? ` · ${t('chatNew', { n: chatUnread })}` : ''}
            </Txt>
          </View>
          <Txt size={24}>›</Txt>
        </View>
      </Card>
    </Pressable>
  );

  if (!notices.length) {
    return (
      <Screen title={t('inboxT')} back>
        {chatCard}
        <Card>
          <Txt size={40} center>✉️</Txt>
          <H3>{t('inboxNone')}</H3>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title={t('inboxT')} back>
      {chatCard}
      {notices.map((n) => {
        const title = (lang === 'hi' && n.titleHi) || n.titleEn;
        const body = (lang === 'hi' && n.bodyHi) || n.bodyEn;
        const unread = !n.readAt;
        const open = () => {
          if (unread) readNotice(n.id);
          say(`${title}. ${body}`, lang);
        };
        return (
          <Pressable key={n.id} accessibilityRole="button" onPress={open}>
            <Card style={unread ? { borderColor: c.leaf, borderWidth: 2 } : undefined}>
              <View style={ui.row}>
                <Txt size={18} weight={unread ? 'heavy' : 'bold'} style={{ flex: 1 }}>
                  {unread ? '🔵 ' : ''}
                  {title}
                </Txt>
                <Chip label="🔊" onPress={open} />
              </View>
              <Txt size={17} style={{ marginVertical: 6 }}>
                {body}
              </Txt>
              <Txt size={14} color="mute">
                {n.from ? `👩‍⚕️ ${n.from} · ` : ''}
                {fmt.format(new Date(n.sentAt))}
              </Txt>
              {n.deeplink && n.deeplink !== '/inbox' && n.deeplink !== '/' ? (
                <Btn small kind="alt" label={t('inboxOpen')} onPress={() => { if (unread) readNotice(n.id); router.push(n.deeplink as '/sugar'); }} style={{ marginTop: 8 }} />
              ) : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
