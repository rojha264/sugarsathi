import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { REEL_CATEGORY_LABEL } from '@shared/reels';
import type { TextKey } from '@/i18n/strings';
import { reelTitle, type ServerReel } from '@/logic/reels';
import { useColors } from '@/theme/tokens';
import { ReelPlayer } from './ReelPlayer';
import { Txt } from './ui';

type Props = {
  reel: ServerReel;
  index: number;
  lang: 'en' | 'hi';
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
  pageH: number;
  playerW: number;
  playerH: number;
  /** This reel is on screen and allowed to play. */
  playing: boolean;
  /** On screen but waiting for a tap (mobile data). */
  waitingTap: boolean;
  saved: boolean;
  hasNext: boolean;
  onPlay(id: string): void;
  onSave(reel: ServerReel): void;
  onShare(reel: ServerReel): void;
  onNext(index: number): void;
};

/**
 * One page of the Learn feed. Memoised: while swiping, only the reel that starts or stops playing
 * re-renders, so the list stays smooth on low-end phones.
 */
export const ReelItem = memo(function ReelItem({ reel, index, lang, t, pageH, playerW, playerH, playing, waitingTap, saved, hasNext, onPlay, onSave, onShare, onNext }: Props) {
  const c = useColors();
  const title = reelTitle(reel, lang);
  const cat = REEL_CATEGORY_LABEL[reel.category];
  return (
    <View style={[styles.page, { height: pageH }]}>
      <ReelPlayer id={reel.youtubeId} title={title} width={playerW} height={playerH} playing={playing} onPlay={() => onPlay(reel.id)} />
      <View style={styles.info}>
        <Txt size={18} weight="bold" numberOfLines={2}>
          {title}
        </Txt>
        <Txt size={14} color="mute" numberOfLines={1}>
          {cat?.icon} {cat?.[lang]}
          {waitingTap ? ` · 📶 ${t('reelTapToPlay')}` : ''}
        </Txt>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={() => onSave(reel)} style={[styles.action, { borderColor: saved ? c.chilli : c.line, backgroundColor: c.card }]}>
            <Txt size={16} weight="bold">
              {saved ? '❤️' : '🤍'} {t(saved ? 'reelSavedBtn' : 'reelSave')}
            </Txt>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onShare(reel)} style={[styles.action, { borderColor: c.leaf, backgroundColor: c.leafSoft }]}>
            <Txt size={16} weight="bold">
              📤 {t('reelShare')}
            </Txt>
          </Pressable>
          {hasNext ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('reelNext')} onPress={() => onNext(index)} style={[styles.action, styles.next, { borderColor: c.line, backgroundColor: c.card }]}>
              <Txt size={18} weight="bold">
                ⌄
              </Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 4 },
  info: { paddingTop: 10, gap: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  action: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  next: { flex: 0, paddingHorizontal: 16 },
});
