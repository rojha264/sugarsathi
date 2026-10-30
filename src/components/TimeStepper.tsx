import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/tokens';
import { Txt } from './ui';

const STEP = 15;

function shift(hhmm: string, by: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + by) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** 12-hour display, stored as HH:MM. */
function display(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Big −/+ buttons instead of typing a time. */
export function TimeStepper({ label, icon, value, onChange }: { label: string; icon: string; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  const btn = [styles.btn, { borderColor: c.line, backgroundColor: c.bg }];
  return (
    <View style={styles.row}>
      <Txt weight="semibold" style={{ flex: 1 }}>
        {icon} {label}
      </Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} −${STEP}`} onPress={() => onChange(shift(value, -STEP))} style={btn}>
        <Txt size={24} weight="bold">−</Txt>
      </Pressable>
      <Txt size={19} weight="bold" center style={{ minWidth: 92 }} accessibilityLabel={`${label} ${display(value)}`}>
        {display(value)}
      </Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +${STEP}`} onPress={() => onChange(shift(value, STEP))} style={btn}>
        <Txt size={24} weight="bold">+</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  btn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
