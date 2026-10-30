import { Pressable, StyleSheet, View } from 'react-native';

import type { Food } from '@/data/foods';
import type { Basket } from '@/logic/meal';
import { useColors } from '@/theme/tokens';
import type { Lang } from '@/types';
import { Txt } from './ui';
import { VegMark } from './VegMark';

/** 0.5 → ½, 1.5 → 1½. */
export function fmtQty(q: number): string {
  const whole = Math.floor(q);
  const half = q - whole >= 0.5 ? '½' : '';
  return whole ? `${whole}${half}` : half || '0';
}

type Props = {
  foods: Food[];
  items: Basket;
  lang: Lang;
  sizeLabel: string;
  onAdd(id: string): void;
  onSub(id: string): void;
  onSize(id: string): void;
};

export function FoodGrid({ foods, items, lang, sizeLabel, onAdd, onSub, onSize }: Props) {
  const c = useColors();
  return (
    <View style={styles.grid}>
      {foods.map((f) => {
        const q = items[f.id] ?? 0;
        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityLabel={`${f.n[lang]}${q ? ` × ${fmtQty(q)}` : ''}`}
            onPress={() => onAdd(f.id)}
            style={[styles.food, { borderColor: q ? c.leaf : c.line, backgroundColor: q ? c.leafSoft : c.card }]}>
            {f.group !== 'mixer' ? (
              <View style={styles.mark}>
                <VegMark diet={f.diet} size={12} />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${sizeLabel} ${f.n[lang]}`}
              hitSlop={10}
              onPress={() => onSize(f.id)}
              style={[styles.size, { borderColor: c.line, backgroundColor: c.card }]}>
              <Txt size={16} weight="heavy" style={{ lineHeight: 18 }}>
                ⋯
              </Txt>
            </Pressable>
            {q ? (
              <>
                <View style={[styles.qty, { backgroundColor: c.leaf }]}>
                  <Txt size={15} weight="heavy" style={{ color: c.onLeaf, lineHeight: 20 }}>
                    {fmtQty(q)}
                  </Txt>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`− ${f.n[lang]}`}
                  hitSlop={4}
                  onPress={() => onSub(f.id)}
                  style={[styles.minus, { backgroundColor: c.card, borderColor: c.line }]}>
                  <Txt size={20} weight="heavy" style={{ lineHeight: 24 }}>
                    −
                  </Txt>
                </Pressable>
              </>
            ) : null}
            <Txt size={32} style={{ lineHeight: 38 }}>
              {f.e}
            </Txt>
            <Txt size={15} weight="semibold" center numberOfLines={2} style={{ lineHeight: 22 }}>
              {f.n[lang]}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  food: { width: '31%', minHeight: 112, borderRadius: 18, borderWidth: 2, paddingHorizontal: 6, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', bottom: 6, right: 6 },
  size: { position: 'absolute', bottom: 4, left: 4, width: 40, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  qty: { position: 'absolute', top: 4, right: 6, minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  minus: { position: 'absolute', top: 2, left: 2, width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});
