import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { youtubeThumb } from '@shared/youtube';
import { useReels } from '@/cloud/catalog';
import { useT } from '@/i18n/useT';
import { feedFor, reelTitle } from '@/logic/reels';
import { useColors } from '@/theme/tokens';
import { Card, Txt } from './ui';

/** Three short videos on the home screen (featured and the viewer's language first); tap one to watch it in the Learn tab. */
export function ReelsCard() {
  const { t, lang } = useT();
  const c = useColors();
  const reels = useReels((s) => s.reels);
  const saved = useReels((s) => s.saved);
  const top = feedFor(reels, lang, 'all', saved).slice(0, 3);
  if (!top.length) return null;
  return (
    <Card>
      <Pressable accessibilityRole="button" onPress={() => router.push('/reels')} style={styles.head} hitSlop={6}>
        <Txt size={18} weight="bold" style={{ flex: 1 }}>
          {t('reelHomeT')}
        </Txt>
        <Txt size={15} weight="bold" color="leaf">
          {t('reelHomeMore')}
        </Txt>
      </Pressable>
      <View style={styles.row}>
        {top.map((r) => (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${t('videoPlay')}: ${reelTitle(r, lang)}`}
            onPress={() => router.push({ pathname: '/reels', params: { id: r.id } })}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.thumb, { backgroundColor: c.ink }]}>
              <Image source={{ uri: youtubeThumb(r.youtubeId) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              <View style={styles.play}>
                <Txt size={18} style={{ color: '#fff', lineHeight: 22 }}>
                  ▶
                </Txt>
              </View>
            </View>
            <Txt size={13} weight="semibold" numberOfLines={2}>
              {reelTitle(r, lang)}
            </Txt>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 32 },
  row: { flexDirection: 'row', gap: 8 },
  item: { flex: 1, gap: 6 },
  thumb: { aspectRatio: 9 / 14, borderRadius: 12, overflow: 'hidden' },
  play: { position: 'absolute', top: '50%', left: '50%', width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
