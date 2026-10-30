import { Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold, useFonts } from '@expo-google-fonts/baloo-2';
import * as Notifications from 'expo-notifications';
import { router, SplashScreen } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Before any screen: swap the bundled food catalog for the cached server one.
import '@/cloud/catalog';
import { useUsage } from '@/cloud/analytics';
import { cloudEnabled, signedIn } from '@/cloud/client';
import { useCloud } from '@/cloud/store';
import { ToastHost } from '@/components/Toast';
import { needsConsent } from '@/logic/backup';
import { withCrashReporting } from '@/native/crash';
import { scheduleReminders } from '@/native/reminders';
import { maybeAskReview } from '@/native/review';
import { useStepSync } from '@/native/steps';
import { tidyMeals, useCloudSync } from '@/cloud/sync';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold });
  const c = useColors();
  const onboarded = useApp((s) => s.onboarded);
  const setup = useApp((s) => s.setup);
  const lang = useApp((s) => s.lang);
  const checkDay = useApp((s) => s.checkDay);
  const lastResponse = Notifications.useLastNotificationResponse();
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Close out yesterday when the app opens or comes back on a new date.
  useEffect(() => {
    checkDay();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkDay());
    // Also catch midnight while the app stays open (e.g. on the walk screen).
    const id = setInterval(checkDay, 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [checkDay]);

  // A good week earns one gentle "rate us" request (a few seconds after opening, once ever).
  const reviewDay = useApp((s) => s.day);
  useEffect(() => {
    if (!onboarded) return;
    const id = setTimeout(() => maybeAskReview(useApp.getState().profiles.me), 8000);
    return () => clearTimeout(id);
  }, [onboarded, reviewDay]);

  // One lunch a day: clears duplicates saved by older versions (runs once per launch).
  useEffect(tidyMeals, []);

  useStepSync(onboarded);
  useCloudSync(onboarded);
  useUsage();

  // Reminder text and times follow the language and setup.
  const sugarPlan = useApp((s) => s.profiles.me.sugarPlan);
  const meds = useApp((s) => s.profiles.me.meds);
  const stock = useApp((s) => s.profiles.me.stock);
  const checkups = useApp((s) => s.profiles.me.checkups);
  const day = useApp((s) => s.day);
  useEffect(() => {
    if (onboarded) scheduleReminders(setup, lang, { sugarPlan, meds, stock, checkups }, day);
  }, [onboarded, setup, lang, sugarPlan, meds, stock, checkups, day]);

  // Agreeing again when the consent text has changed since the user last agreed.
  // Existing users sign in once so their dietitian and family can see the logs (or choose "later").
  const authed = useCloud((s) => s.authed);
  const skipLogin = useCloud((s) => s.skipLogin);
  const loginDue = cloudEnabled && onboarded && !authed && !signedIn() && !skipLogin;
  useEffect(() => {
    if (ready && loginDue) router.push('/onboarding/phone');
  }, [ready, loginDue]);

  const consentDue = onboarded && needsConsent(setup);
  useEffect(() => {
    if (ready && consentDue) router.push('/consent');
  }, [ready, consentDue]);

  // Tapping a reminder opens its task, once per tap.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResponse || !ready || !onboarded) return;
    const id = lastResponse.notification.request.identifier + lastResponse.notification.date;
    if (handled.current === id) return;
    handled.current = id;
    const route = lastResponse.notification.request.content.data?.route;
    if (typeof route === 'string') router.push(route as '/walk');
  }, [lastResponse, ready, onboarded]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="emergency" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="consent" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        </Stack>
        <ToastHost />
      </View>
    </SafeAreaProvider>
  );
}

export default withCrashReporting(RootLayout);
