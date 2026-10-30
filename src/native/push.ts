import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/cloud/client';
import { translate } from '@/i18n/strings';
import { useApp } from '@/store/useApp';

/**
 * Registers this phone for dietitian notices and family alerts (Expo push). Needs an EAS project id
 * (`eas init`) and, on Android, Firebase credentials; without them it quietly does nothing.
 */
export async function registerPush(_userId: string): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('family', { name: translate(useApp.getState().lang, 'pushChannel'), importance: AndroidImportance.MAX, sound: 'default' });
    }
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api('/me/devices', { json: { token, platform: Platform.OS } });
  } catch {
    // Push is optional; the app still shows everything when opened.
  }
}
