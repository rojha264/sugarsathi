import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { SUGAR_EVERY } from '@/logic/sugarPlan';
import type { SugarEvery } from '@/types';
import { ChipRow, Txt } from './ui';

const LABEL: Record<SugarEvery, TextKey> = {
  daily: 'seDaily', every3: 'seEvery3', twiceWeek: 'seTwiceWeek', weekly: 'seWeekly', fortnight: 'seFortnight', off: 'seOff',
};

/** How often to test sugar, with the guideline hint underneath. */
export function SugarEveryChips({ value, onChange }: { value: SugarEvery; onChange(v: SugarEvery): void }) {
  const { t } = useT();
  return (
    <>
      <ChipRow<SugarEvery> value={value} options={SUGAR_EVERY} onChange={onChange} label={(v) => t(LABEL[v])} />
      <Txt size={14} color="mute" style={{ marginTop: -6, marginBottom: 12 }}>
        {t('sugEveryHint')}
      </Txt>
    </>
  );
}
