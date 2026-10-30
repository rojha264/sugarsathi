import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useState } from 'react';

import { localeOf } from '@/i18n/strings';
import { VOICE_HINTS } from '@/logic/voice';
import type { Lang } from '@/types';

type Handlers = {
  onText(text: string): void;
  /** Called when voice cannot run (no permission, no recogniser, error). */
  onUnavailable(): void;
};

/** Single-shot speech recognition for meal logging. */
export function useVoiceLog(lang: Lang, { onText, onUnavailable }: Handlers) {
  const [live, setLive] = useState(false);

  useSpeechRecognitionEvent('result', (e) => {
    if (!e.isFinal) return;
    const text = e.results[0]?.transcript ?? '';
    onText(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setLive(false);
    if (e.error === 'aborted') return;
    if (e.error === 'no-speech' || e.error === 'speech-timeout') onText('');
    else onUnavailable();
  });
  useSpeechRecognitionEvent('end', () => setLive(false));

  async function start() {
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return onUnavailable();
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return onUnavailable();
      setLive(true);
      ExpoSpeechRecognitionModule.start({
        lang: localeOf(lang),
        interimResults: false,
        maxAlternatives: 1,
        contextualStrings: VOICE_HINTS,
      });
    } catch {
      setLive(false);
      onUnavailable();
    }
  }

  function stop() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setLive(false);
    }
  }

  return { live, start, stop };
}
