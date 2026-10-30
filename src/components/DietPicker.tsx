import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { say } from '@/native/tts';
import { useColors } from '@/theme/tokens';
import type { Diet } from '@/types';
import { Btn, Txt } from './ui';
import { VegMark } from './VegMark';

const OPTIONS: { diet: Diet; icons: string; title: TextKey; body: TextKey }[] = [
  { diet: 'veg', icons: '🥗🫓🥛', title: 'dietVegT', body: 'dietVegB' },
  { diet: 'egg', icons: '🥚🍳🥗', title: 'dietEggT', body: 'dietEggB' },
  { diet: 'nonveg', icons: '🍗🐟🥚', title: 'dietNonvegT', body: 'dietNonvegB' },
];

/**
 * Vegetarian / eggetarian / non-vegetarian as three big tiles with the food-label mark,
 * pictures and examples, so it is clear without reading. The choice is spoken back.
 */
export function DietPicker({ value, onChange, compact }: { value: Diet | null; onChange(d: Diet): void; compact?: boolean }) {
  const { t, lang } = useT();
  const c = useColors();
  return (
    <View style={{ gap: compact ? 8 : 12 }} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const on = value === o.diet;
        return (
          <Pressable
            key={o.diet}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${t(o.title)}. ${t(o.body)}`}
            onPress={() => {
              onChange(o.diet);
              say(`${t(o.title)}. ${t(o.body)}`, lang);
            }}
            style={({ pressed }) => [
              styles.tile,
              { padding: compact ? 10 : 14, backgroundColor: on ? c.leafSoft : c.card, borderColor: on ? c.leaf : c.line, opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={styles.mark}>
              <VegMark diet={o.diet} size={compact ? 22 : 28} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={compact ? 18 : 22} weight="bold">
                {t(o.title)}
              </Txt>
              <Txt size={compact ? 14 : 16} color="mute">
                {t(o.body)}
              </Txt>
            </View>
            <Txt size={compact ? 22 : 28}>{on ? '✅' : o.icons}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 2.5, minHeight: 76 },
  mark: { width: 32, alignItems: 'center' },
});

/** Bottom sheet to change the food preference from anywhere (saved at once, synced to the dietitian). */
export function DietSheet({ open, value, onChange, onClose }: { open: boolean; value: Diet; onChange(d: Diet): void; onClose(): void }) {
  const { t } = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.backdrop} onPress={onClose} accessibilityLabel={t('back')} />
      <View style={[sheet.body, { backgroundColor: c.bg, borderColor: c.line, paddingBottom: 16 + insets.bottom }]}>
        <Txt size={22} weight="bold" center style={{ marginBottom: 12 }}>
          🍽️ {t('dietTitle')}
        </Txt>
        <DietPicker
          value={value}
          onChange={(d) => {
            onChange(d);
            onClose();
          }}
        />
        <Btn kind="alt" small label={t('videoClose')} onPress={onClose} style={{ marginTop: 12 }} />
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  body: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16 },
});
