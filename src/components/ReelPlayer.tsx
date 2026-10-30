import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { youtubeThumb } from '@shared/youtube';
import { useT } from '@/i18n/useT';
import { Txt } from './ui';
import { YouTubeView } from './YouTubeView';

/**
 * One reel. Only the reel on screen loads YouTube (the others show a thumbnail), so scrolling stays smooth
 * and mobile data is not wasted. Nothing is drawn over the player, as YouTube requires.
 */
export function ReelPlayer({ id, title, width, height, playing, onPlay }: { id: string; title: string; width: number; height: number; playing: boolean; onPlay(): void }) {
  const { t } = useT();
  if (!playing) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('videoPlay')}: ${title}`} onPress={onPlay} style={[styles.box, { width, height }]}>
        <Image source={{ uri: youtubeThumb(id) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <View style={styles.play}>
          <Txt size={34} style={{ color: '#fff', lineHeight: 38 }}>
            ▶
          </Txt>
        </View>
      </Pressable>
    );
  }
  return (
    <View style={[styles.box, { width, height }]}>
      <YouTubeView id={id} loop />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#000', borderRadius: 16, overflow: 'hidden', alignSelf: 'center' },
  play: { position: 'absolute', top: '50%', left: '50%', width: 76, height: 76, marginLeft: -38, marginTop: -38, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
