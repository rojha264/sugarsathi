import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FOOD_BY_ID, portionsFor, type Portion } from '@/data/foods';
import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { useColors } from '@/theme/tokens';
import { fmtQty } from './FoodGrid';
import { Btn, KV, Txt } from './ui';

const UNIT_KEY: Record<Portion['unit'], TextKey> = {
  katori: 'uKatori', piece: 'uPiece', pcs: 'uPcs', plate: 'uPlate', glass: 'uGlass', ml: 'uMl',
};
const LIQUID = ['peg', 'beer', 'wine', 'glass'];

/** Bottom sheet with big size buttons (katori, pieces, ml). Picking sets the plate quantity. */
export function PortionSheet({ foodId, current, onPick, onClose }: { foodId: string | null; current: number; onPick(mult: number): void; onClose(): void }) {
  const { t, lang } = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const f = foodId ? FOOD_BY_ID[foodId] : null;
  // Show nutrition for the current amount, or one standard portion if none yet.
  const shown = current || 1;

  return (
    <Modal visible={!!f} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('back')} />
      {f ? (
        <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.line, paddingBottom: 16 + insets.bottom }]}>
          <Txt size={22} weight="bold" center style={{ marginBottom: 12 }}>
            {f.e} {t('portionT', { food: f.n[lang] })}
          </Txt>
          <View style={styles.grid}>
            {portionsFor(f).map((p) => {
              const on = current === p.mult;
              return (
                <Pressable
                  key={p.mult}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onPick(p.mult)}
                  style={[styles.opt, { borderColor: on ? c.leaf : c.line, backgroundColor: on ? c.leafSoft : c.card }]}>
                  <Txt size={26} weight="heavy">
                    {p.unit === 'ml' ? p.amount : fmtQty(p.amount)}
                  </Txt>
                  <Txt size={15} color="mute">
                    {t(UNIT_KEY[p.unit])}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.info, { borderColor: c.line, backgroundColor: c.card }]}>
            <View style={styles.infoHead}>
              <Txt size={15} weight="bold">
                {t('grams')}: {Math.round(f.g * shown)} {LIQUID.includes(f.unit) ? 'ml' : 'g'}
              </Txt>
              <View style={[styles.gi, { backgroundColor: f.gi === 'low' ? c.leafSoft : f.gi === 'med' ? c.haldiSoft : c.chilliSoft }]}>
                <Txt size={13} weight="bold">
                  {t(f.gi === 'low' ? 'giLow' : f.gi === 'med' ? 'giMed' : 'giHigh')}
                </Txt>
              </View>
            </View>
            <KV k={t('carbs')} v={`${Math.round(f.c * shown)} g`} />
            <KV k={t('prot')} v={`${Math.round(f.p * shown)} g`} />
            <KV k={t('fiber')} v={`${Math.round(f.f * shown)} g`} />
            <KV k={t('fat')} v={`${Math.round(f.fat * shown)} g`} />
            <KV k={t('kcal')} v={`${Math.round(f.kcal * shown)}`} last />
            <Txt size={12} color="mute" style={{ marginTop: 6 }}>
              {t('srcLine', { s: f.src.join(', ') })}
            </Txt>
          </View>
          {current ? <Btn kind="alt" small label={t('remove')} onPress={() => onPick(0)} /> : null}
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12, justifyContent: 'center' },
  info: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  infoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  gi: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  opt: { width: '30%', minHeight: 76, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
