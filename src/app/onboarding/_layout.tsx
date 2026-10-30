import { Stack } from 'expo-router/stack';

import { useColors } from '@/theme/tokens';

export default function OnboardingLayout() {
  const c = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
