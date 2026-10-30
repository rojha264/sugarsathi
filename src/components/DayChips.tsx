import { dateFormat } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { addDays, dayDate } from '@/logic/ids';
import { useApp } from '@/store/useApp';
import { ChipRow, Txt } from './ui';

/** Today / Yesterday / Day before, with the date, for logging something that was missed. */
export function DayChips({ value, onChange }: { value: number; onChange(daysAgo: number): void }) {
  const { t, lang } = useT();
  const today = useApp((s) => s.day);
  const fmt = dateFormat(lang, { weekday: 'short', day: 'numeric' });
  const label = (n: number) => `${n === 0 ? t('dayToday') : n === 1 ? t('dayYesterday') : t('dayBefore')} · ${fmt.format(dayDate(addDays(today, -n)))}`;
  return (
    <>
      <ChipRow<'0' | '1' | '2'> value={String(value) as '0'} options={['0', '1', '2']} onChange={(v) => onChange(Number(v))} label={(v) => label(Number(v))} />
      {value > 0 ? (
        <Txt size={14} color="mute" style={{ marginTop: -4, marginBottom: 8 }}>
          🕓 {t('dayLateNote')}
        </Txt>
      ) : null}
    </>
  );
}
