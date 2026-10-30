import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { useColors } from '@/theme/tokens';
import { Txt } from './ui';

const useToastStore = create<{ msg: string | null; seq: number }>(() => ({ msg: null, seq: 0 }));

export function toast(msg: string) {
  useToastStore.setState((s) => ({ msg, seq: s.seq + 1 }));
}

export function ToastHost() {
  const { msg, seq } = useToastStore();
  const c = useColors();
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => useToastStore.setState({ msg: null }), 2600);
    return () => clearTimeout(id);
  }, [msg, seq]);
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: c.ink }]}>
        <Txt size={16} weight="semibold" center style={{ color: c.bg }}>
          {msg}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center', zIndex: 10 },
  toast: { borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, maxWidth: '86%' },
});
