import { router } from 'expo-router';
import { View } from 'react-native';

import { Thali } from '@/components/charts';
import { Screen } from '@/components/Screen';
import { H2, Tile } from '@/components/ui';
import { say } from '@/native/tts';
import { useApp } from '@/store/useApp';
import type { Lang } from '@/types';
import { StepBar } from '@/components/StepHeader';

export default function LangScreen() {
  const setLang = useApp((s) => s.setLang);
  const pick = (l: Lang) => {
    setLang(l);
    say(l === 'hi' ? 'नमस्ते' : 'Hello', l);
    router.push('/onboarding/mode');
  };
  return (
    <Screen title="Sugar Saathi · शुगर साथी" sos={false}>
      <StepBar at="lang" />
      <View style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Thali fracs={[1, 0.6, 0.8, 0.35]} score={null} size={240} />
      </View>
      <H2 style={{ textAlign: 'center' }}>{'Choose your language\nअपनी भाषा चुनें'}</H2>
      <Tile title="English" sub="Hello" onPress={() => pick('en')} />
      <Tile title="हिन्दी" sub="नमस्ते" onPress={() => pick('hi')} />
    </Screen>
  );
}
