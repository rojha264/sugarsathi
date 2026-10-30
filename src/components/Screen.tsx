import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n/useT';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import { Txt } from './ui';

/** `settings` adds a ⚙️ button (used on the main tabs). */
type Props = { title: string; back?: boolean; sos?: boolean; settings?: boolean; children: ReactNode };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function Header({ title, back, sos = true, settings }: Omit<Props, 'children'>) {
  const c = useColors();
  const { t, lang } = useT();
  const setLang = useApp((s) => s.setLang);
  const ib = [styles.ib, { borderColor: c.line, backgroundColor: c.card }];
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={goBack} style={ib} hitSlop={6}>
          <Txt size={28} weight="bold" style={{ lineHeight: 32 }}>
            ‹
          </Txt>
        </Pressable>
      ) : null}
      <Txt size={22} weight="bold" numberOfLines={2} style={{ flex: 1, lineHeight: 32, paddingTop: 4 }} accessibilityRole="header">
        {title}
      </Txt>
      {settings ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('setT')} onPress={() => router.push('/settings')} style={ib}>
          <Txt size={20}>⚙️</Txt>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('language')} onPress={() => setLang(lang === 'en' ? 'hi' : 'en')} style={ib}>
        <Txt size={16} weight="bold">
          {lang === 'en' ? 'हिं' : 'EN'}
        </Txt>
      </Pressable>
      {sos ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('emT')}
          onPress={() => router.push('/emergency')}
          style={[styles.ib, { borderColor: c.chilli, backgroundColor: c.chilli }]}>
          <Txt size={16} weight="bold" style={{ color: c.white }}>
            SOS
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Screen({ title, back, sos, settings, children }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Header title={title} back={back} sos={sos} settings={settings} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 + (back ? insets.bottom : 0) }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, minHeight: 60 },
  ib: { minWidth: 48, height: 48, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
