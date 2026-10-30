import * as Speech from 'expo-speech';

import { localeOf } from '@/i18n/strings';
import type { Lang } from '@/types';

export function say(text: string, lang: Lang) {
  try {
    Speech.stop();
    Speech.speak(text, { language: localeOf(lang), rate: 0.95 });
  } catch {
    // Speech is a nicety; never block the flow on it.
  }
}
