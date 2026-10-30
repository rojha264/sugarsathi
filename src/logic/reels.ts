import type { ReelCategory, ReelLang } from '@shared/reels';
import { reelOrder } from '@shared/reels';

/** A reel as /sync/pull sends it (deleted ones arrive with deletedAt so the phone drops them). */
export type ServerReel = { id: string; youtubeId: string; titleEn: string; titleHi: string; category: ReelCategory; lang: ReelLang; featured: boolean; active: boolean; sort: number; deletedAt: string | null };

/** Reels to show: active and not deleted, in staff order. */
export const liveReels = (byId: Record<string, ServerReel>): ServerReel[] =>
  Object.values(byId)
    .filter((r) => r.active && !r.deletedAt)
    .sort((a, b) => a.sort - b.sort);

/** The feed for one viewer and category ("saved" = their ❤️ list, newest saved first). */
export function feedFor(reels: readonly ServerReel[], lang: 'en' | 'hi', filter: ReelCategory | 'all' | 'saved', saved: readonly string[]): ServerReel[] {
  if (filter === 'saved') {
    const byId = new Map(reels.map((r) => [r.id, r]));
    return saved.map((id) => byId.get(id)).filter((r): r is ServerReel => !!r);
  }
  return reelOrder(filter === 'all' ? reels : reels.filter((r) => r.category === filter), lang);
}

/** Title in the viewer's language (Hindi falls back to English). */
export const reelTitle = (r: Pick<ServerReel, 'titleEn' | 'titleHi'>, lang: 'en' | 'hi') => (lang === 'hi' && r.titleHi) || r.titleEn;
