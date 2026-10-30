import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, Chip, Field, Legal, styles as ui, Txt } from '@/components/ui';
import { dateFormat } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { allCheckups, monthsAgo, type CheckupState } from '@/logic/checkups';
import { dayDate } from '@/logic/ids';
import { useApp, useProfile } from '@/store/useApp';

/** For people who remember roughly when, not the exact date. */
const EARLIER = [1, 3, 6, 12];

const TONE: Record<CheckupState, 'red' | 'amber' | 'green' | 'info'> = { due: 'red', soon: 'amber', ok: 'green', unknown: 'info' };

/** HbA1c every 3 months; eye, foot and kidney checks once a year. */
export default function CheckupsScreen() {
  const { t, lang } = useT();
  const p = useProfile();
  const today = useApp((s) => s.day);
  const mark = useApp((s) => s.markCheckup);
  const setValue = useApp((s) => s.setCheckupValue);
  const [a1cText, setA1cText] = useState(() => (p.checkupValues?.a1c ? String(p.checkupValues.a1c) : ''));
  const fmt = dateFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' });
  const date = (d: string) => fmt.format(dayDate(d));

  return (
    <Screen title={t('ckT')} back>
      <Txt size={16} color="mute" style={{ marginBottom: 10 }}>
        {t('ckSub')}
      </Txt>
      {allCheckups(p.checkups, today).map((s) => {
        const status =
          s.state === 'unknown'
            ? t('ckUnknown')
            : s.state === 'due'
              ? t('ckOverdue', { d: date(s.due!) })
              : t('ckNext', { d: date(s.due!) });
        return (
          <Card key={s.id} style={{ gap: 8 }}>
            <View style={ui.row}>
              <Txt size={30}>{s.e}</Txt>
              <View style={{ flex: 1 }}>
                <Txt size={20} weight="bold">
                  {t(`ck_${s.id}`)}
                </Txt>
                <Txt size={15} color="mute">
                  {t(`ck_${s.id}Why`)}
                </Txt>
              </View>
            </View>
            <Banner tone={TONE[s.state]} style={{ marginBottom: 0 }}>
              <Txt size={16} weight="semibold">
                {status}
                {s.last ? `\n${t('ckLast', { d: date(s.last) })}` : ''}
              </Txt>
            </Banner>
            <Btn
              small
              label={`✓ ${t('ckDoneToday')}`}
              onPress={() => {
                mark(s.id, today);
                toast(t('ckSaved'));
              }}
            />
            {s.id === 'a1c' ? (
              <View style={[ui.row, { flexWrap: 'wrap' }]}>
                <Txt size={15} weight="semibold" style={{ flex: 1 }}>
                  🧪 {t('ckLabValue')}
                </Txt>
                <Field
                  value={a1cText}
                  onChangeText={(v) => setA1cText(v.replace(/[^0-9.]/g, '').slice(0, 4))}
                  onEndEditing={() => {
                    const n = parseFloat(a1cText);
                    if (n >= 4 && n <= 15) {
                      setValue('a1c', Math.round(n * 10) / 10);
                      toast(t('ckSaved'));
                    } else if (a1cText) toast(t('ckLabBad'));
                  }}
                  placeholder="7.2"
                  keyboardType="decimal-pad"
                  style={{ width: 100, textAlign: 'center' }}
                  accessibilityLabel={t('ckLabValue')}
                />
                <Txt size={15}>%</Txt>
              </View>
            ) : null}
            <Txt size={15} weight="semibold">
              {t('ckEarlier')}
            </Txt>
            <View style={[ui.row, { flexWrap: 'wrap' }]}>
              {EARLIER.map((m) => (
                <Chip key={m} label={t('ckMonths', { n: m })} on={s.last === monthsAgo(today, m)} onPress={() => mark(s.id, monthsAgo(today, m))} />
              ))}
            </View>
          </Card>
        );
      })}
      <Legal />
    </Screen>
  );
}
