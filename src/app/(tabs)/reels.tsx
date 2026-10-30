import { useLocalSearchParams } from 'expo-router';
import { NetworkStateType, useNetworkState } from 'expo-network';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REEL_CATEGORIES, REEL_CATEGORY_LABEL, type ReelCategory } from '@shared/reels';
import { youtubeThumb, youtubeWatch } from '@shared/youtube';
import { track } from '@/cloud/analytics';
import { useReels } from '@/cloud/catalog';
import { ReelItem } from '@/components/ReelItem';
import { Header } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { feedFor, reelTitle, type ServerReel } from '@/logic/reels';
import { APP_LINK, shareWhatsApp } from '@/native/share';
import { useColors } from '@/theme/tokens';

type Filter = ReelCategory | 'all' | 'saved';
/** Space under the player for the title and the buttons (the player never has anything on top of it). */
const INFO_H = 150;
/** A reel counts as watched after this long on screen. */
const VIEW_MIN_S = 3;

/**
 * Learn: short diabetes videos (education, Indian recipes, exercise, myths, real stories) picked by the
 * Sugar Saathi team. Swipe up for the next one; only the reel on screen plays.
 */
export default function ReelsScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reels = useReels((s) => s.reels);
  const saved = useReels((s) => s.saved);
  const toggleSave = useReels((s) => s.toggleSave);
  const { id: openId } = useLocalSearchParams<{ id?: string }>();
  const [filter, setFilter] = useState<Filter>('all');
  const [pageH, setPageH] = useState(0);
  const [pageW, setPageW] = useState(0);
  const [active, setActive] = useState(0);
  // On mobile data, wait for a tap before playing (data costs money); on Wi-Fi play at once.
  const net = useNetworkState();
  const onWifi = net.type === NetworkStateType.WIFI || net.type === NetworkStateType.ETHERNET;
  const [tapped, setTapped] = useState<string | null>(null);
  const list = useRef<FlatList<ServerReel>>(null);
  const seenAt = useRef<{ id: string; at: number } | null>(null);

  const feed = feedFor(reels, lang, filter, saved);
  const current = feed[active];

  /** Counts the reel that just left the screen as a view (if it stayed long enough). */
  const leave = () => {
    const s = seenAt.current;
    if (!s) return;
    const seconds = Math.round((Date.now() - s.at) / 1000);
    if (seconds >= VIEW_MIN_S) track('reel_view', { reelId: s.id, seconds: Math.min(seconds, 600) });
    seenAt.current = null;
  };
  useEffect(() => {
    if (!current) return;
    seenAt.current = { id: current.id, at: Date.now() };
    return leave;
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from a notification or the home card: show that reel (state set while rendering, scroll after layout).
  const [opened, setOpened] = useState<string | null>(null);
  if (openId && openId !== opened && reels.length) {
    setOpened(openId);
    setFilter('all');
    const i = feedFor(reels, lang, 'all', saved).findIndex((r) => r.id === openId);
    if (i >= 0) {
      setActive(i);
      setTapped(openId);
    }
  }
  useEffect(() => {
    if (!opened || !pageH) return;
    const i = feedFor(reels, lang, 'all', saved).findIndex((r) => r.id === opened);
    if (i >= 0) requestAnimationFrame(() => list.current?.scrollToIndex({ index: i, animated: false }));
  }, [opened, pageH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers keep one identity for the screen's life, so the memoised reels do not re-render while swiping.
  const latest = useRef({ lang, t, toggleSave });
  useEffect(() => {
    latest.current = { lang, t, toggleSave };
  });
  const [handlers] = useState(() => ({
    share: (r: ServerReel) => {
      const { lang: l, t: tr } = latest.current;
      track('reel_share', { reelId: r.id });
      shareWhatsApp(`🎬 ${reelTitle(r, l)}\n${youtubeWatch(r.youtubeId)}\n\n${tr('reelShareApp', { link: APP_LINK })}`);
    },
    save: (r: ServerReel) => {
      const { t: tr, toggleSave: toggle } = latest.current;
      const on = toggle(r.id);
      if (on) track('reel_save', { reelId: r.id });
      toast(on ? `❤️ ${tr('reelSaved')}` : tr('reelUnsaved'));
    },
    play: (id: string) => setTapped(id),
    next: (index: number) => {
      list.current?.scrollToIndex({ index: index + 1, animated: true });
      // Some Android versions send no "scroll ended" event for scrolls started in code.
      setTimeout(() => setActive(index + 1), 450);
    },
  }));

  // The page in view changes only when a swipe has fully settled: starting YouTube mid-swipe is what makes feeds stutter.
  const settle = (y: number) => {
    if (!pageH) return;
    const i = Math.round(y / pageH);
    if (i !== active) setActive(i);
  };

  // Thumbnails of the next reels are fetched ahead, so they are ready before the swipe lands.
  useEffect(() => {
    const next = feed.slice(active + 1, active + 3).map((r) => youtubeThumb(r.youtubeId));
    if (next.length) Image.prefetch(next).catch(() => {});
  }, [active, feed.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const playerW = Math.max(0, pageW - 32);
  const playerH = Math.max(200, Math.min((playerW * 16) / 9, pageH - INFO_H));
  const playW = Math.max(200, Math.min(playerW, (playerH * 9) / 16));
  const filters: Filter[] = ['all', ...REEL_CATEGORIES, 'saved'];
  const label = (f: Filter) => (f === 'all' ? `🎬 ${t('reelAll')}` : f === 'saved' ? `❤️ ${t('reelSavedTab')} (${saved.length})` : `${REEL_CATEGORY_LABEL[f].icon} ${REEL_CATEGORY_LABEL[f][lang]}`);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Header title={t('reelsT')} settings />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {filters.map((f) => {
          const on = filter === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                leave();
                setFilter(f);
                setActive(0);
                list.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={[styles.chip, { borderColor: on ? c.leaf : c.line, backgroundColor: on ? c.leaf : c.card }]}>
              <Txt size={15} weight="bold" style={on ? { color: c.onLeaf } : undefined}>
                {label(f)}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          setPageH(e.nativeEvent.layout.height);
          setPageW(e.nativeEvent.layout.width);
        }}>
        {!feed.length ? (
          <View style={styles.empty}>
            <Txt size={44} center>
              {filter === 'saved' ? '❤️' : '🎬'}
            </Txt>
            <Txt size={18} weight="bold" center>
              {filter === 'saved' ? t('reelNoSaved') : t('reelNone')}
            </Txt>
          </View>
        ) : pageH > 0 ? (
          <FlatList
            ref={list}
            data={feed}
            keyExtractor={(r) => r.id}
            // One reel per swipe, snapping straight to the page like Reels / Shorts.
            pagingEnabled
            disableIntervalMomentum
            decelerationRate="fast"
            snapToAlignment="start"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: pageH, offset: pageH * index, index })}
            onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
            // Only the reel in view and its neighbours are kept; the rest are freed on cheap phones.
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === 'android'}
            extraData={`${active}|${tapped}|${onWifi}|${saved.join(',')}|${playW}|${playerH}`}
            renderItem={({ item, index }) => (
              <ReelItem
                reel={item}
                index={index}
                lang={lang}
                t={t}
                pageH={pageH}
                playerW={playW}
                playerH={playerH}
                playing={index === active && (onWifi || tapped === item.id)}
                waitingTap={index === active && !onWifi && tapped !== item.id}
                saved={saved.includes(item.id)}
                hasNext={index < feed.length - 1}
                onPlay={handlers.play}
                onSave={handlers.save}
                onShare={handlers.share}
                onNext={handlers.next}
              />
            )}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
