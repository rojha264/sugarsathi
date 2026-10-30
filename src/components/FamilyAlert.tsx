import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n/useT';
import { callNumber, shareWhatsApp } from '@/native/share';
import { useApp } from '@/store/useApp';
import { Btn } from './ui';

/**
 * One tap to tell or call the saved family member (WhatsApp message prefilled).
 * With no contact saved, offers to add one in Settings.
 */
export function FamilyAlert({ message }: { message: string }) {
  const { t } = useT();
  const cg = useApp((s) => s.setup.caregiver);
  const has = cg.phone.replace(/\D/g, '').length >= 10;
  const who = cg.name || t('family');

  if (!has) return <Btn small kind="alt" label={t('addFamilyContact')} onPress={() => router.push('/settings')} style={{ marginBottom: 10 }} />;
  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      <Btn small label={t('tellFamily', { n: who })} onPress={() => shareWhatsApp(message, cg.phone)} />
      <Btn small kind="alt" label={t('callFamily', { n: who })} onPress={() => callNumber(cg.phone)} />
    </View>
  );
}
