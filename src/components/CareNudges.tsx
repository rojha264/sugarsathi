import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useT } from '@/i18n/useT';
import { checkupsToNudge } from '@/logic/checkups';
import { lowMeds } from '@/logic/meds';
import { useApp, useProfile } from '@/store/useApp';
import { Banner, styles as ui, Txt } from './ui';

/** Tablets running out and checkups due, tappable to fix. */
export function CareNudges() {
  const { t } = useT();
  const p = useProfile();
  const today = useApp((s) => s.day);
  const low = lowMeds(p.meds, p.stock);
  const checkups = checkupsToNudge(p.checkups, today);
  return (
    <>
      {low.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/medicine')}>
          <Banner tone="red">
            <Txt size={16} weight="semibold">
              {low.map((l) => t('refillWarn', { name: l.name, n: l.left, d: l.days })).join('\n')}
            </Txt>
          </Banner>
        </Pressable>
      ) : null}
      {checkups.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/checkups')}>
          <Banner tone="amber" style={ui.row}>
            <Txt size={16} weight="semibold" style={{ flex: 1 }}>
              🩺 {checkups[0].state === 'due' ? t('ckDueList', { list: checkups.filter((x) => x.state === 'due').map((x) => t(`ck_${x.id}`)).join(', ') }) : t('ckAddDates')}
            </Txt>
            <Txt size={22}>›</Txt>
          </Banner>
        </Pressable>
      ) : null}

    </>
  );
}
