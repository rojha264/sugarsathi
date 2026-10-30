import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Coaching, Tip, TipAction } from '@/logic/coach';
import { useColors, type Colors } from '@/theme/tokens';
import { Chip, styles as ui, Txt } from './ui';

const RISK_BG: Record<Coaching['risk'], keyof Colors> = { none: 'track', low: 'leafSoft', med: 'haldiSoft', high: 'chilliSoft' };

type Props = {
  advice: Coaching;
  headline: string;
  tipTexts: string[];
  note: string;
  listenLabel: string;
  /** Button text for an action, or null for info-only tips. */
  labelFor(action: TipAction): string | null;
  isOn(action: TipAction): boolean;
  onAction(action: TipAction): void;
  onListen(): void;
  extra?(tip: Tip): ReactNode;
};

export function CoachCard({ advice, headline, tipTexts, note, listenLabel, labelFor, isOn, onAction, onListen, extra }: Props) {
  const c = useColors();
  return (
    <>
      <View style={[styles.headline, { backgroundColor: c[RISK_BG[advice.risk]] }]}>
        <Txt size={18} weight="bold" color={advice.risk === 'none' ? 'mute' : 'ink'} style={{ flex: 1 }}>
          {headline}
        </Txt>
        {advice.risk !== 'none' || advice.tips.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listenLabel}
            onPress={onListen}
            style={[styles.speaker, { borderColor: c.line, backgroundColor: c.card }]}>
            <Txt size={22}>🔊</Txt>
          </Pressable>
        ) : null}
      </View>

      {advice.tips.map((tip, i) => {
        const actions = (tip.choices?.length ? tip.choices : [tip.action]).filter((a) => labelFor(a));
        return (
          <View key={tip.id} style={[styles.tip, { borderTopColor: c.line }]}>
            <Txt size={26} style={{ lineHeight: 32 }}>
              {tip.icon}
            </Txt>
            <View style={{ flex: 1, gap: 8 }}>
              <Txt size={17} weight="semibold">
                {tipTexts[i]}
              </Txt>
              {actions.length || extra?.(tip) ? (
                <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
                  {actions.map((a, k) => (
                    <Chip key={k} on={isOn(a)} tone={a.type === 'emergency' ? 'chilli' : 'leaf'} label={labelFor(a)!} onPress={() => onAction(a)} />
                  ))}
                  {extra?.(tip)}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
      {advice.tips.length ? (
        <Txt size={13} color="mute" style={{ marginTop: 8 }}>
          {note}
        </Txt>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  speaker: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
});
