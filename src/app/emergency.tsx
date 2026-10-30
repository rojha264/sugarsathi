import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FamilyAlert } from '@/components/FamilyAlert';
import { Screen } from '@/components/Screen';
import { Banner, Btn, Card, Chip, Legal, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { cloudEvent } from '@/cloud/sync';
import { call } from '@/native/share';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

/** Bundled text only, so it works offline. */
export default function EmergencyScreen() {
  const { t, tl } = useT();
  const c = useColors();
  // Opened from "Not feeling well?" or a red reading, the right guide shows first.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'low' | 'high'>(params.tab === 'high' ? 'high' : 'low');
  const name = useApp((s) => s.profiles[s.cur].name) || t('friend');
  const steps = tl(tab === 'low' ? 'lowS' : 'highS');

  return (
    <Screen title={t('emT')} back sos={false}>
      <Banner tone="red">
        <Txt size={16} weight="semibold">
          {t('offline')}
        </Txt>
      </Banner>
      <View style={styles.seg}>
        <Chip tone="chilli" label={t('low')} on={tab === 'low'} onPress={() => setTab('low')} style={styles.segBtn} />
        <Chip tone="chilli" label={t('high')} on={tab === 'high'} onPress={() => setTab('high')} style={styles.segBtn} />
      </View>
      <Card>
        {steps.map((s, i) => (
          <View key={i} style={[styles.step, i < steps.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.line }]}>
            <View style={[styles.num, { backgroundColor: c.chilli }]}>
              <Txt weight="heavy" style={{ color: c.white }}>
                {i + 1}
              </Txt>
            </View>
            <Txt weight="semibold" style={{ flex: 1 }}>
              {s}
            </Txt>
          </View>
        ))}
      </Card>
      <FamilyAlert message={t('alertFeel', { name, what: t(tab) })} />
      <Btn
        kind="red"
        label={`📞 ${t('call108')}`}
        onPress={() => {
          cloudEvent('sos');
          call('108');
        }}
        style={{ marginBottom: 10 }}
      />
      <Btn kind="alt" label={t('call112')} onPress={() => call('112')} />
      <Legal />
    </Screen>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segBtn: { flex: 1, minHeight: 56, alignItems: 'center', borderRadius: 16 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  num: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
