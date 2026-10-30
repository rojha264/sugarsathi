import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import type { SugarLevel } from '@/logic/sugar';
import { FONT, RADIUS, useColors, type Colors, type Weight } from '@/theme/tokens';
import type { TextSize } from '@/types';

type TxtProps = TextProps & { size?: number; weight?: Weight; color?: keyof Colors; center?: boolean };

const SYSTEM_WEIGHT: Record<Weight, TextStyle['fontWeight']> = { medium: '500', semibold: '600', bold: '700', heavy: '800' };

/**
 * Android measures Hindi in Baloo 2 about a fifth narrower than it draws, so labels lose
 * their last word. Its own Devanagari font measures correctly, so Hindi uses that on Android.
 */
const systemFontForHindi = Platform.OS === 'android';

/** Text size setting: older eyes can choose bigger text everywhere. */
export const TEXT_SCALE: Record<TextSize, number> = { normal: 1, large: 1.15, xl: 1.3 };
export const useTextScale = () => TEXT_SCALE[useApp((s) => s.setup.textSize) ?? 'normal'];

export function Txt({ size: base = 18, weight = 'medium', color = 'ink', center, style, children, ...rest }: TxtProps) {
  const c = useColors();
  const { lang } = useT();
  const size = Math.round(base * useTextScale());
  const androidHindi = systemFontForHindi && lang === 'hi';
  const font: TextStyle = androidHindi ? { fontWeight: SYSTEM_WEIGHT[weight] } : { fontFamily: FONT[weight] };
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[font, { fontSize: size, lineHeight: Math.round(size * 1.35), color: c[color] }, center && { textAlign: 'center' }, style]}
      {...rest}>
      {children}
      {/* Android rounds the text box down by a pixel and pushes the last Hindi word to a hidden line; a no-break space gives slack. */}
      {androidHindi ? '\u00A0' : null}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}

type BtnKind = 'primary' | 'alt' | 'red';
type BtnProps = Omit<PressableProps, 'style' | 'children'> & { label: string; kind?: BtnKind; small?: boolean; style?: StyleProp<ViewStyle> };

export function Btn({ label, kind = 'primary', small, style, ...rest }: BtnProps) {
  const c = useColors();
  const bg = kind === 'primary' ? c.leaf : kind === 'red' ? c.chilli : c.card;
  const fg = kind === 'primary' ? c.onLeaf : kind === 'red' ? c.white : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, minHeight: small ? 50 : 58, opacity: pressed ? 0.85 : 1 },
        kind === 'alt' && { borderWidth: 1.5, borderColor: c.line },
        style,
      ]}
      {...rest}>
      <Txt size={small ? 17 : 20} weight="bold" style={{ color: fg }} center>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, tone = 'leaf', style }: { label: string; on?: boolean; onPress: () => void; tone?: 'leaf' | 'chilli'; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const active = tone === 'leaf' ? c.leaf : c.chilli;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[styles.chip, { borderColor: on ? active : c.line, backgroundColor: on ? active : c.card }, style]}>
      <Txt size={17} weight="semibold" style={{ color: on ? (tone === 'leaf' ? c.onLeaf : c.white) : c.ink }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** One-choice chips that wrap onto more lines, so every option stays visible. */
export function ChipRow<V extends string>({ value, options, onChange, label }: { value: V; options: V[]; onChange: (v: V) => void; label: (v: V) => string }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o} label={label(o)} on={value === o} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

export function Tile({ title, sub, icon, onPress }: { title: string; sub?: string; icon?: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.card, borderColor: pressed ? c.leaf : c.line }]}>
      {icon ? <Txt size={44}>{icon}</Txt> : null}
      <Txt size={26} weight="bold">
        {title}
      </Txt>
      {sub ? (
        <Txt size={16} color="mute">
          {sub}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export type Tone = 'info' | 'red' | 'amber' | 'green';
/** Banner tone for a sugar level (green / amber / red). */
export const SUGAR_TONE: Record<SugarLevel, Tone> = { g: 'green', a: 'amber', r: 'red' };
export function Banner({ tone, children, style }: { tone: Tone; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = { info: c.skySoft, red: c.chilliSoft, amber: c.haldiSoft, green: c.leafSoft }[tone];
  return <View style={[styles.banner, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Legal({ text }: { text?: string }) {
  const { t } = useT();
  return (
    <Txt size={14} color="mute" center style={{ marginTop: 8 }}>
      {text ?? t('legal')}
    </Txt>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Txt size={24} weight="bold" style={[{ marginTop: 8, marginBottom: 10 }, style]}>
      {children}
    </Txt>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <Txt size={19} weight="bold" style={{ marginBottom: 6 }}>
      {children}
    </Txt>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.line }]}>
      <Txt size={24} weight="bold" center>
        {value}
      </Txt>
      <Txt size={14} color="mute" center>
        {label}
      </Txt>
    </View>
  );
}

export function KV({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.kv, !last && { borderBottomWidth: 1, borderBottomColor: c.line }]}>
      <Txt weight="semibold" style={{ flex: 1 }}>
        {k}
      </Txt>
      <Txt weight="semibold">{v}</Txt>
    </View>
  );
}

/** Text input with the app's size, colours and font. */
export function Field({ style, ...rest }: TextInputProps) {
  const c = useColors();
  const scale = useTextScale();
  return (
    <TextInput
      placeholderTextColor={c.mute}
      maxFontSizeMultiplier={1.6}
      style={[styles.field, { borderColor: c.line, backgroundColor: c.card, color: c.ink, fontSize: Math.round(18 * scale) }, style]}
      {...rest}
    />
  );
}

export const styles = StyleSheet.create({
  field: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, fontSize: 18, fontFamily: FONT.medium },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
  btn: { width: '100%', borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 48, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tile: { alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 96, borderRadius: RADIUS.lg, borderWidth: 2, marginBottom: 12, padding: 12 },
  banner: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 6 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kv: { flexDirection: 'row', paddingVertical: 8 },
});
