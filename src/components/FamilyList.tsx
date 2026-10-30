import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { refreshAllRemote } from '@/cloud/link';
import { useCloud } from '@/cloud/store';
import { useT } from '@/i18n/useT';
import { FamilyCard } from './CareHero';
import { Btn, Card, H3, Txt } from './ui';

/** Everyone this phone follows, freshest data first shown from cache; refreshed whenever the screen is opened. */
export function FamilyList({ big }: { big?: boolean }) {
  const { t } = useT();
  const following = useCloud((s) => s.following);
  const remote = useCloud((s) => s.remote);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      refreshAllRemote()
        .catch(() => {})
        .then(() => setNow(Date.now()));
    }, []),
  );

  if (!following.length) {
    return (
      <Card>
        <H3>👵 {t('careEmptyT')}</H3>
        <Txt size={16} style={{ marginBottom: 12 }}>
          {t('careEmptyB')}
        </Txt>
        <Btn label={`➕ ${t('followT')}`} onPress={() => router.push('/follow')} />
      </Card>
    );
  }
  return (
    <>
      {following.map((f) => (
        <FamilyCard key={f.patientId} patientId={f.patientId} name={remote[f.patientId]?.name || f.name} status={f.status} data={remote[f.patientId] ?? null} now={now} />
      ))}
      <Btn small={!big} kind="alt" label={`➕ ${t('followT')}`} onPress={() => router.push('/follow')} style={{ marginBottom: 12 }} />
    </>
  );
}
