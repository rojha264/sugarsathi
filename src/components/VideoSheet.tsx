import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { youtubeThumb, youtubeWatch, type ExerciseVideo } from '@shared/youtube';
import { track } from '@/cloud/analytics';
import { useT } from '@/i18n/useT';
import { useColors } from '@/theme/tokens';
import { Btn, Txt } from './ui';
import { YouTubeView } from './YouTubeView';

/** The exercise's sample videos: the first one large, any others below it with their titles. */
export function VideoList({ videos, title }: { videos: ExerciseVideo[]; title: string }) {
  if (!videos.length) return null;
  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      {videos.map((v, i) => (
        <VideoThumb key={v.id} id={v.id} title={v.title || title} label={v.title} small={i > 0} />
      ))}
    </View>
  );
}

/** Thumbnail with a big play button; tapping opens the in-app player. */
export function VideoThumb({ id, title, label, small }: { id: string; title: string; label?: string; small?: boolean }) {
  const { t } = useT();
  const c = useColors();
  const [open, setOpen] = useState<number | null>(null);
  // How long the player stayed open is the watch time (the YouTube embed does not report progress).
  const close = () => {
    if (open) track('video_play', { videoId: id, title: title.slice(0, 80), seconds: Math.round((Date.now() - open) / 1000) });
    setOpen(null);
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('videoPlay')}: ${title}`} onPress={() => setOpen(Date.now())} style={[styles.thumb, { backgroundColor: c.ink, height: small ? 120 : 180 }]}>
        <Image source={{ uri: youtubeThumb(id) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <View style={styles.play}>
          <Txt size={30} style={{ color: '#fff', lineHeight: 34 }}>
            ▶
          </Txt>
        </View>
        <View style={styles.label}>
          <Txt size={15} weight="bold" style={{ color: '#fff' }}>
            🎬 {label || t('videoPlay')}
          </Txt>
        </View>
      </Pressable>
      <VideoSheet id={id} title={title} open={open !== null} onClose={close} />
    </>
  );
}

export function VideoSheet({ id, title, open, onClose }: { id: string; title: string; open: boolean; onClose(): void }) {
  const { t } = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.sheet, { backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <Txt size={20} weight="bold" style={{ marginBottom: 10 }}>
          🎬 {title}
        </Txt>
        <View style={styles.player}>
          {open ? <YouTubeView id={id} /> : null}
        </View>
        <Btn kind="alt" small label={t('videoYoutube')} onPress={() => Linking.openURL(youtubeWatch(id)).catch(() => {})} style={{ marginTop: 12 }} />
        <Btn label={t('videoClose')} onPress={onClose} style={{ marginTop: 10 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(220,38,38,0.92)', alignItems: 'center', justifyContent: 'center', paddingLeft: 6 },
  label: { position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  sheet: { flex: 1, paddingHorizontal: 16 },
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
});
