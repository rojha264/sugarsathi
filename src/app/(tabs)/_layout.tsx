import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui';
import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

const ITEMS: Record<string, { icon: string; label: TextKey }> = {
  index: { icon: '🏠', label: 'today' },
  progress: { icon: '📈', label: 'progress' },
  reels: { icon: '🎬', label: 'reelsTab' },
  family: { icon: '👨‍👩‍👧', label: 'family' },
  report: { icon: '📄', label: 'report' },
};

export default function TabsLayout() {
  const onboarded = useApp((s) => s.onboarded);
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  if (!onboarded) return <Redirect href="/onboarding/lang" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={({ state, navigateToTab }) => (
        <View style={[styles.bar, { borderTopColor: c.line, backgroundColor: c.card, paddingBottom: insets.bottom }]}>
          {state.routes.map((r, i) => {
            const item = ITEMS[r.name];
            if (!item) return null;
            const on = state.index === i;
            return (
              <Pressable
                key={r.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => !on && navigateToTab(r.key)}
                style={styles.item}>
                <Txt size={24} style={{ lineHeight: 28 }}>
                  {item.icon}
                </Txt>
                <Txt size={14} weight={on ? 'heavy' : 'semibold'} color={on ? 'leaf' : 'mute'} numberOfLines={1}>
                  {t(item.label)}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="reels" />
      <Tabs.Screen name="family" />
      <Tabs.Screen name="report" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 8, minHeight: 62 },
});
