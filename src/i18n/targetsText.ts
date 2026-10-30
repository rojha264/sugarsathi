import type { Adjustment, MealSlot } from '@/types';
import { dateFormat, type TextKey } from './strings';
import { useT } from './useT';

const FIELD_KEY: Record<Adjustment['field'] | 'snack', TextKey> = {
  breakfast: 'bf', lunch: 'ln', dinner: 'dn', snack: 'sn', protein: 'prot', fiber: 'fiber',
};

/** Words for target changes, e.g. "Breakfast: 60 → 55 g · sugar 2 h after was 220". */
export function useTargetsText() {
  const { t, lang } = useT();
  const fieldName = (f: Adjustment['field'] | MealSlot) => t(FIELD_KEY[f]);
  const reason = (a: Adjustment) => t(a.reason, a.vars as Record<string, number>);
  const line = (a: Adjustment) => `${t('changed', { field: fieldName(a.field), from: a.from, to: a.to })} · ${reason(a)}`;
  const date = (at: number) => dateFormat(lang, { day: 'numeric', month: 'short' }).format(at);
  return { t, lang, fieldName, reason, line, date };
}
