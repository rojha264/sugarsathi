import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { refreshChat, reloadChat, sendChat } from '@/cloud/chat';
import { useCloud, type ChatMsg } from '@/cloud/store';
import { Header } from '@/components/Screen';
import { Chip, Txt } from '@/components/ui';
import { dateFormat, type TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { say } from '@/native/tts';
import { useVoiceLog } from '@/native/voice';
import { useColors } from '@/theme/tokens';

const POLL_MS = 4000;
const QUICK: TextKey[] = ['qOk', 'qDone', 'qQuestion', 'qCall', 'qUnwell'];

/** Two-way chat with the dietitian: big bubbles, quick replies, voice typing, read aloud. */
export default function ChatScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const messages = useCloud((s) => s.chatMessages);
  const dietitian = useCloud((s) => s.chat.dietitian);
  const notices = useCloud((s) => s.notices.filter((n) => !n.readAt).length);
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatMsg>>(null);
  const time = dateFormat(lang, { hour: 'numeric', minute: '2-digit' });
  const day = dateFormat(lang, { day: 'numeric', month: 'short' });
  const voice = useVoiceLog(lang, { onText: (s) => s && setText((cur) => (cur ? `${cur} ${s}` : s)), onUnavailable: () => {} });

  const tick = useCallback(() => {
    refreshChat();
  }, []);
  useEffect(() => {
    reloadChat();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [tick]);

  const send = (s: string) => {
    const msg = s.trim();
    if (!msg) return;
    setText('');
    sendChat(msg);
  };

  const status = !dietitian
    ? t('chatNoDietitian')
    : dietitian.online
      ? `🟢 ${t('chatOnline')}`
      : dietitian.lastSeen
        ? `⚪ ${t('chatLastSeen', { t: `${day.format(new Date(dietitian.lastSeen))}, ${time.format(new Date(dietitian.lastSeen))}` })}`
        : `⚪ ${t('chatOffline')}`;

  const bubble = ({ item: m }: { item: ChatMsg }) => {
    const mine = !m.fromStaff;
    return (
      <Pressable
        accessibilityRole={m.failed ? 'button' : undefined}
        accessibilityLabel={`${mine ? t('chatYou') : m.sender}: ${m.text}`}
        onPress={() => (m.failed ? sendChat(m.text, m.id) : !mine ? say(m.text, lang) : undefined)}
        style={[styles.bubble, mine ? [styles.mine, { backgroundColor: c.leafSoft }] : [styles.theirs, { backgroundColor: c.card, borderColor: c.line }]]}>
        {!mine ? (
          <Txt size={14} weight="bold" color="leaf">
            👩‍⚕️ {m.sender}
          </Txt>
        ) : null}
        <Txt size={18}>{m.text}</Txt>
        <View style={styles.meta}>
          {!mine ? <Txt size={14}>🔊</Txt> : null}
          <Txt size={13} color={m.failed ? 'chilli' : 'mute'}>
            {m.failed ? `⚠️ ${t('chatRetry')}` : m.pending ? `🕓 ${t('chatSending')}` : time.format(new Date(m.at))}
          </Txt>
          {mine && !m.pending && !m.failed ? <Ticks m={m} label={t(m.readAt ? 'chatRead' : m.deliveredAt ? 'chatDelivered' : 'chatSent')} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
        <Header title={dietitian?.name ?? t('chatT')} back />
        <Txt size={15} weight="semibold" color={dietitian?.online ? 'leaf' : 'mute'} style={{ marginBottom: 6 }}>
          {status}
        </Txt>
        <Pressable accessibilityRole="button" onPress={() => router.push('/inbox')} style={[styles.notices, { backgroundColor: notices ? c.haldiSoft : c.card, borderColor: c.line }]}>
          <Txt size={15} weight="bold" style={{ flex: 1 }}>
            📣 {notices ? t('chatNotices', { n: notices }) : t('inboxT')}
          </Txt>
          <Txt size={18}>›</Txt>
        </Pressable>
      </View>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={bubble}
        contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Txt size={44} center>💬</Txt>
            <Txt size={18} weight="bold" center>
              {t('chatEmptyT')}
            </Txt>
            <Txt size={16} color="mute" center>
              {t('chatEmptyB')}
            </Txt>
          </View>
        }
      />
      <View style={[styles.quick]}>
        {QUICK.map((k) => (
          <Chip key={k} label={t(k)} onPress={() => send(t(k))} />
        ))}
      </View>
      <View style={[styles.bar, { borderTopColor: c.line, backgroundColor: c.card, paddingBottom: 10 + insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('speak')}
          onPress={() => (voice.live ? voice.stop() : voice.start())}
          style={[styles.round, { backgroundColor: voice.live ? c.chilli : c.bg, borderColor: c.line }]}>
          <Txt size={22}>🎤</Txt>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={voice.live ? t('listening') : t('chatPh')}
          placeholderTextColor={c.mute}
          multiline
          maxLength={1000}
          style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.bg }]}
          accessibilityLabel={t('chatPh')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chatSend')}
          disabled={!text.trim()}
          onPress={() => send(text)}
          style={[styles.round, { backgroundColor: text.trim() ? c.leaf : c.track, borderColor: 'transparent' }]}>
          <Txt size={22} style={{ color: c.onLeaf }}>
            ➤
          </Txt>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** WhatsApp-style ticks: ✓ grey sent, ✓✓ grey delivered, ✓✓ blue read. */
function Ticks({ m, label }: { m: ChatMsg; label: string }) {
  const read = !!m.readAt;
  return (
    <Txt size={15} weight="bold" accessibilityLabel={label} style={{ color: read ? TICK_READ : TICK_GREY, letterSpacing: -4 }}>
      {read || m.deliveredAt ? '✓✓' : '✓'}
    </Txt>
  );
}

const TICK_READ = '#1A8CD8';
const TICK_GREY = '#8A948F';

const styles = StyleSheet.create({
  notices: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1 },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, alignItems: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  round: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  input: { flex: 1, minHeight: 50, maxHeight: 120, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
});
