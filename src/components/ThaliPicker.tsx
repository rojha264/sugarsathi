import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FOOD_BY_ID } from '@/data/foods';
import type { Thali } from '@/data/thalis';
import { useT } from '@/i18n/useT';
import { hasAll, totals, type Basket } from '@/logic/meal';
import { useColors } from '@/theme/tokens';
import { fmtQty } from './FoodGrid';
import { Txt } from './ui';

/** How many plates show before "More thalis"; enough for a regional choice without pushing the food grid off screen. */
const FIRST = 4;

/**
 * One-tap plates as a 2-column grid (no hidden sideways scroll): each card says what is on it and
 * its carbs, shows "✓ on your plate" once added, and a second tap takes it off again.
 */
export function ThaliPicker({ thalis, items, onToggle }: { thalis: Thali[]; items: Basket; onToggle: (th: Thali, on: boolean) => void }) {
  const { t, lang } = useT();
  const c = useColors();
  const [all, setAll] = useState(false);
  const shown = all ? thalis : thalis.slice(0, FIRST);
  return (
    <View style={{ marginBottom: 10 }}>
      <Txt size={16} weight="bold" style={{ marginBottom: 6 }}>
        {t('thaliT')}
      </Txt>
      <View style={styles.grid}>
        {shown.map((th) => {
          const on = hasAll(items, th.items);
          const inside = Object.entries(th.items)
            .filter(([id]) => FOOD_BY_ID[id])
            .map(([id, q]) => `${q > 1 ? `${fmtQty(q)} ` : ''}${FOOD_BY_ID[id].n[lang]}`)
            .join(' · ');
          const n = totals(th.items);
          return (
            <Pressable
              key={th.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${th.n[lang]}: ${inside}. ${on ? t('thaliOn') : t('thaliAdd')}`}
              onPress={() => onToggle(th, !on)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: on ? c.leafSoft : c.card, borderColor: on ? c.leaf : c.line, opacity: pressed ? 0.85 : 1 },
              ]}>
              <View style={styles.top}>
                <Txt size={26}>{th.e}</Txt>
                <Txt size={13} weight="bold" color={on ? 'leaf' : 'mute'}>
                  {on ? `✓ ${t('thaliOn')}` : `+ ${t('thaliAdd')}`}
                </Txt>
              </View>
              <Txt size={16} weight="bold" numberOfLines={2}>
                {th.n[lang]}
              </Txt>
              <Txt size={13} color="mute" numberOfLines={2}>
                {inside}
              </Txt>
              <Txt size={13} weight="semibold" style={{ marginTop: 2 }}>
                {t('thaliCarbs', { n: n.c })}
              </Txt>
              <Txt size={12} color="mute">
                {t('thaliNutri', { p: n.p, f: n.fiber })}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {thalis.length > FIRST ? (
        <Pressable accessibilityRole="button" onPress={() => setAll((x) => !x)} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <Txt size={15} weight="bold" color="leaf">
            {all ? t('thaliLess') : t('thaliMore', { n: thalis.length - FIRST })}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexBasis: '47%', flexGrow: 1, borderWidth: 2, borderRadius: 18, padding: 12, gap: 2, minHeight: 132 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
});
