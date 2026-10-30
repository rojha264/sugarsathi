import { Card, Chip, Txt } from './ui';
import { useT } from '@/i18n/useT';

/** Disclaimer and data notice with a tick box; used at setup and when the text changes. */
export function ConsentCard({ agreed, onToggle }: { agreed: boolean; onToggle(): void }) {
  const { t } = useT();
  return (
    <Card style={{ marginTop: 6 }}>
      <Txt weight="bold" style={{ marginBottom: 4 }}>
        📋 {t('consentT')}
      </Txt>
      <Txt size={16} style={{ marginBottom: 10 }}>
        {t('consentB')}
      </Txt>
      <Chip label={`${agreed ? '☑️' : '⬜'} ${t('consentOk')}`} on={agreed} onPress={onToggle} />
    </Card>
  );
}
