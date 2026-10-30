import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/tokens';
import { Txt } from './ui';

/** Big −/+ buttons for a number, like TimeStepper. */
export function NumberStepper({ label, value, step, min, max, unit, onChange }: {
  label: string; value: number; step: number; min: number; max: number; unit: string; onChange(v: number): void;
}) {
  const c = useColors();
  const btn = [styles.btn, { borderColor: c.line, backgroundColor: c.bg }];
  return (
    <View style={styles.row}>
      <Txt weight="semibold" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} −${step}`} onPress={() => onChange(Math.max(min, value - step))} style={btn}>
        <Txt size={24} weight="bold">−</Txt>
      </Pressable>
      <Txt size={19} weight="bold" center style={{ minWidth: 72 }} accessibilityLabel={`${label} ${value} ${unit}`}>
        {value} {unit}
      </Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +${step}`} onPress={() => onChange(Math.min(max, value + step))} style={btn}>
        <Txt size={24} weight="bold">+</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  btn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
