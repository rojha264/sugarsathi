import { View } from 'react-native';

import type { Diet } from '@/types';

export const DIET_MARK: Record<Diet, string> = { veg: '🟢', egg: '🥚', nonveg: '🍗' };

const VEG = '#1E8A3A';
const EGG = '#C77800';
const NON_VEG = '#7A3B12';

/**
 * Food-label marks in a square: green dot = veg (FSSAI), brown triangle = non-veg (FSSAI),
 * amber dot = egg (no official mark; kept distinct so egg and meat never look the same).
 */
export function VegMark({ diet, size = 14 }: { diet: Diet; size?: number }) {
  const col = diet === 'veg' ? VEG : diet === 'egg' ? EGG : NON_VEG;
  const inner = size * 0.5;
  return (
    <View
      accessibilityLabel={diet}
      style={{ width: size, height: size, borderWidth: 1.5, borderColor: col, borderRadius: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
      {diet === 'nonveg' ? (
        <View
          style={{
            width: 0, height: 0, borderLeftWidth: inner / 2, borderRightWidth: inner / 2, borderBottomWidth: inner * 0.9,
            borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: col, marginBottom: size * 0.05,
          }}
        />
      ) : (
        <View style={{ width: inner * 0.9, height: inner * 0.9, borderRadius: size, backgroundColor: col }} />
      )}
    </View>
  );
}
