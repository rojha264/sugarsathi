import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Remote } from '@/cloud/store';
import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { careStatus, todayOf, type CareLevel } from '@/logic/careView';
import { localDate } from '@/logic/ids';
import { useColors, type Colors } from '@/theme/tokens';
import { Txt } from './ui';

const LEVEL: Record<CareLevel, { icon: string; key: TextKey; bg: keyof Colors; fg: keyof Colors }> = {
  red: { icon: '🔴', key: 'lvRed', bg: 'chilliSoft', fg: 'chilli' },
  amber: { icon: '🟠', key: 'lvAmber', bg: 'haldiSoft', fg: 'ink' },
  green: { icon: '🟢', key: 'lvGreen', bg: 'leafSoft', fg: 'leaf' },
  grey: { icon: '⚪', key: 'lvGrey', bg: 'track', fg: 'mute' },
};

/** "Updated 5 min ago" from the last upload time. */
export function useAgo() {
  const { t } = useT();
  return (lastSeen: number | null, now: number) => {
    if (!lastSeen) return t('remoteNever');
    const m = Math.max(0, Math.round((now - lastSeen) / 60000));
    if (m < 2) return t('remoteNow');
    return t('remoteAgo', { n: m < 120 ? `${m} ${t('min')}` : m < 48 * 60 ? `${Math.round(m / 60)} ${t('hourShort')}` : `${Math.round(m / 1440)} ${t('dayShort')}` });
  };
}

/**
 * Who, how they are doing, and what needs attention, at a glance.
 * Compact (Family list): status line, mini numbers and the top concern only.
 */
export function CareHero({ name, data, now, compact }: { name: string; data: Remote | null; now: number; compact?: boolean }) {
  const { t } = useT();
  const c = useColors();
  const ago = useAgo();
  const today = localDate(new Date(now));
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const st = careStatus(data?.snap ?? null, data?.state ?? null, data?.events ?? [], today, nowMin);
  const lv = LEVEL[st.level];
  const day = todayOf(data?.snap ?? null, today);
  const shown = compact ? st.items.slice(0, 1) : st.items;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: st.level === 'red' ? c.chilli : c.line }]}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: c[lv.bg] }]}>
          <Txt size={compact ? 30 : 40}>👵</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={compact ? 20 : 24} weight="heavy">
            {name}
          </Txt>
          <Txt size={14} color="mute">
            {ago(data?.lastSeen ?? null, now)}
          </Txt>
        </View>
        {compact ? <Txt size={24}>›</Txt> : null}
      </View>
      <View style={[styles.pill, { backgroundColor: c[lv.bg] }]}>
        <Txt size={compact ? 16 : 18} weight="heavy" color={lv.fg}>
          {lv.icon} {t(lv.key)}
        </Txt>
      </View>
      {shown.map((a, i) => (
        <View key={i} style={styles.item}>
          <Txt size={18}>{a.icon}</Txt>
          <Txt size={compact ? 15 : 16} weight="semibold" style={{ flex: 1, color: a.level === 'red' ? c.chilli : c.ink }}>
            {t(a.key, a.vars)}
          </Txt>
        </View>
      ))}
      {compact && st.items.length > 1 ? (
        <Txt size={14} color="mute">
          {t('moreItems', { n: st.items.length - 1 })}
        </Txt>
      ) : null}
      {compact && day ? (
        <Txt size={15} color="mute" style={{ marginTop: 4 }}>
          🍽️ {new Set(day.meals.filter((m) => m.slot !== 'snack').map((m) => m.slot)).size}/3 · 💊 {day.doses.filter((d) => d.s === 'taken').length}/{day.doses.length} · 🚶{' '}
          {day.walkMin} {t('min')}
          {day.sugar.length ? ` · 🩸 ${day.sugar.at(-1)!.v}` : ''}
        </Txt>
      ) : null}
    </View>
  );
}

/** A followed elder in a list; tap to open their day. Pending and removed follows say so. */
export function FamilyCard({ patientId, name, status, data, now }: { patientId: string; name: string; status: 'pending' | 'active' | 'gone'; data: Remote | null; now: number }) {
  const { t } = useT();
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={() => router.push(`/remote/${patientId}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {status === 'active' ? (
        <CareHero compact name={name} data={data} now={now} />
      ) : (
        <View style={[styles.card, styles.head, { backgroundColor: c.card, borderColor: c.line }]}>
          <Txt size={30}>{status === 'pending' ? '⏳' : '🚫'}</Txt>
          <View style={{ flex: 1 }}>
            <Txt size={20} weight="heavy">
              {name}
            </Txt>
            <Txt size={15} color="mute">
              {t(status === 'pending' ? 'careWait' : 'remoteGone')}
            </Txt>
          </View>
          <Txt size={24}>›</Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 2, padding: 14, marginBottom: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
