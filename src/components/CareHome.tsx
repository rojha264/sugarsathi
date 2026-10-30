import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import { FamilyList } from './FamilyList';
import { Screen } from './Screen';
import { Txt } from './ui';

/** Home for someone who looks after a family member rather than tracking their own sugar. */
export function CareHome() {
  const { t } = useT();
  const name = useApp((s) => s.setup.name.trim()) || t('friend');
  return (
    <Screen title={`${t('hi')}, ${name}`} settings>
      <Txt size={17} color="mute" style={{ marginBottom: 12 }}>
        {t('careHomeSub')}
      </Txt>
      <FamilyList big />
    </Screen>
  );
}
