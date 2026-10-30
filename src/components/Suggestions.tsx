import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/tokens';
import { Txt } from './ui';

export type Suggestion = { key: string; icon?: string; title: string; sub?: string };

/**
 * Autocomplete rows shown right under a search box while typing (big rows, one tap picks).
 * Shows `empty` when nothing matches.
 */
export function Suggestions({ items, onPick, empty, action = '＋' }: { items: Suggestion[]; onPick(key: string): void; empty?: string; action?: string }) {
  const c = useColors();
  if (!items.length && !empty) return null;
  return (
    <View accessibilityRole="list" style={[styles.box, { borderColor: c.line, backgroundColor: c.card }]}>
      {items.length ? (
        items.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityLabel={s.sub ? `${s.title}, ${s.sub}` : s.title}
            onPress={() => onPick(s.key)}
            style={({ pressed }) => [styles.row, { borderColor: c.line, opacity: pressed ? 0.6 : 1 }]}>
            {s.icon ? <Txt size={24}>{s.icon}</Txt> : null}
            <View style={{ flex: 1 }}>
              <Txt size={17} weight="bold">{s.title}</Txt>
              {s.sub ? <Txt size={13} color="mute">{s.sub}</Txt> : null}
            </View>
            <Txt size={22} weight="bold" color="leaf">{action}</Txt>
          </Pressable>
        ))
      ) : (
        <Txt size={15} color="mute" style={{ padding: 12 }}>{empty}</Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, marginBottom: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
});
