import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCloud, useSignedIn } from '@/cloud/store';
import { useT } from '@/i18n/useT';
import { useColors } from '@/theme/tokens';
import { Txt } from './ui';

/** Dietitian links: today's diet plan, exercises, chat and notices (each with its own unread count). Hidden when not signed in. */
export function CoachLinks({ big }: { big?: boolean }) {
  const { t } = useT();
  const c = useColors();
  const authed = useSignedIn();
  const chatUnread = useCloud((s) => s.chat.unread);
  const notices = useCloud((s) => s.notices.filter((n) => !n.readAt).length);
  const online = useCloud((s) => !!s.chat.dietitian?.online);
  const hasPlan = useCloud((s) => !!s.plans.diet);
  const hasEx = useCloud((s) => !!s.plans.exercise?.items.length);
  if (!authed) return null;
  const links = [
    { icon: '📋', label: t('planT'), route: '/plan' as const, dot: hasPlan, online: false, count: 0 },
    { icon: '🏃', label: t('exT'), route: '/exercise' as const, dot: hasEx, online: false, count: 0 },
    { icon: '💬', label: t('chatT'), route: '/chat' as const, count: chatUnread, online },
    { icon: '📬', label: t('inboxT'), route: '/inbox' as const, count: notices, online: false },
  ];
  return (
    <View style={styles.row}>
      {links.map((l) => (
        <Pressable
          key={l.route}
          accessibilityRole="button"
          accessibilityLabel={`${l.label}${l.count ? `, ${l.count}` : ''}`}
          onPress={() => router.push(l.route)}
          style={({ pressed }) => [styles.btn, { minHeight: big ? 104 : 84, backgroundColor: c.card, borderColor: l.count ? c.leaf : c.line, opacity: pressed ? 0.85 : 1 }]}>
          <Txt size={big ? 34 : 28} style={{ lineHeight: big ? 40 : 34 }}>
            {l.icon}
          </Txt>
          <Txt size={big ? 16 : 14} weight="bold" center numberOfLines={2}>
            {l.label}
          </Txt>
          {l.online ? <View style={[styles.online, { backgroundColor: c.leaf, borderColor: c.card }]} accessibilityLabel={t('chatOnline')} /> : null}
          {l.count ? (
            <View style={[styles.badge, { backgroundColor: c.chilli }]}>
              <Txt size={13} weight="heavy" style={{ color: c.white }}>
                {l.count}
              </Txt>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btn: { flex: 1, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: 8 },
  online: { position: 'absolute', top: 10, left: 10, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  badge: { position: 'absolute', top: 6, right: 8, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
