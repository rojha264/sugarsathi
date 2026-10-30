/**
 * Reels: short diabetes videos (YouTube) that staff curate in admin and patients watch in a swipe feed.
 * Plain TypeScript shared by the app, the API and the admin panel.
 */
import { youtubeId } from './youtube';

export const REEL_CATEGORIES = ['learn', 'recipe', 'exercise', 'myth', 'story'] as const;
export type ReelCategory = (typeof REEL_CATEGORIES)[number];

/** Label for each category, English and Hindi. */
export const REEL_CATEGORY_LABEL: Record<ReelCategory, { en: string; hi: string; icon: string }> = {
  learn: { en: 'Learn', hi: 'जानिए', icon: '📘' },
  recipe: { en: 'Recipes', hi: 'रेसिपी', icon: '🍲' },
  exercise: { en: 'Exercise', hi: 'व्यायाम', icon: '🧘' },
  myth: { en: 'Myths & facts', hi: 'भ्रम और सच', icon: '❓' },
  story: { en: 'Real stories', hi: 'सच्ची कहानियाँ', icon: '💬' },
};

/** Spoken language of the video: Hindi, English, or both / no speech. */
export const REEL_LANGS = ['hi', 'en', 'both'] as const;
export type ReelLang = (typeof REEL_LANGS)[number];

export const REEL_TITLE_MAX = 90;

export type ReelInput = { url?: string; youtubeId?: string; titleEn?: string; titleHi?: string; category?: string; lang?: string; featured?: boolean; active?: boolean };
export type ReelFields = { youtubeId: string; titleEn: string; titleHi: string; category: ReelCategory; lang: ReelLang; featured: boolean; active: boolean };

/** Checks what an admin entered; returns the clean fields or the problem ("bad_youtube", "no_title", …). */
export function parseReel(b: ReelInput): { reel: ReelFields } | { error: string } {
  const id = youtubeId(b.url ?? b.youtubeId ?? '');
  if (!id) return { error: 'bad_youtube' };
  const titleEn = (b.titleEn ?? '').trim().slice(0, REEL_TITLE_MAX);
  if (!titleEn) return { error: 'no_title' };
  const category = (REEL_CATEGORIES as readonly string[]).includes(b.category ?? '') ? (b.category as ReelCategory) : null;
  if (!category) return { error: 'bad_category' };
  const lang = (REEL_LANGS as readonly string[]).includes(b.lang ?? '') ? (b.lang as ReelLang) : 'both';
  return { reel: { youtubeId: id, titleEn, titleHi: (b.titleHi ?? '').trim().slice(0, REEL_TITLE_MAX), category, lang, featured: !!b.featured, active: b.active ?? true } };
}

/**
 * Feed order for a viewer: featured first, then the viewer's language (and "both"), then the rest;
 * inside each group the order staff set.
 */
export function reelOrder<T extends { lang: string; featured: boolean; sort: number }>(reels: readonly T[], viewerLang: 'en' | 'hi'): T[] {
  const rank = (r: T) => (r.featured ? 0 : r.lang === viewerLang || r.lang === 'both' ? 1 : 2);
  return [...reels].sort((a, b) => rank(a) - rank(b) || a.sort - b.sort);
}
