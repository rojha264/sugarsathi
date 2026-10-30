import { parseReel } from '@shared/reels';
import { feedFor, liveReels, reelTitle, type ServerReel } from '../reels';

const r = (id: string, o: Partial<ServerReel> = {}): ServerReel => ({ id, youtubeId: 'abcdefghijk', titleEn: id, titleHi: '', category: 'learn', lang: 'both', featured: false, active: true, sort: 0, deletedAt: null, ...o });

describe('reels', () => {
  it('drops deleted and hidden reels and keeps staff order', () => {
    const live = liveReels({ a: r('a', { sort: 2 }), b: r('b', { sort: 1 }), c: r('c', { deletedAt: '2026-10-27' }), d: r('d', { active: false }) });
    expect(live.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('puts featured, then the viewer language, first; filters by category and saved', () => {
    const all = [r('en', { lang: 'en', sort: 0 }), r('hi', { lang: 'hi', sort: 1 }), r('star', { lang: 'en', featured: true, sort: 2 }), r('food', { category: 'recipe', sort: 3 })];
    expect(feedFor(all, 'hi', 'all', []).map((x) => x.id)).toEqual(['star', 'hi', 'food', 'en']);
    expect(feedFor(all, 'en', 'recipe', []).map((x) => x.id)).toEqual(['food']);
    expect(feedFor(all, 'hi', 'saved', ['food', 'gone', 'en']).map((x) => x.id)).toEqual(['food', 'en']);
  });

  it('shows the Hindi title when there is one', () => {
    expect(reelTitle({ titleEn: 'Walk', titleHi: 'सैर' }, 'hi')).toBe('सैर');
    expect(reelTitle({ titleEn: 'Walk', titleHi: '' }, 'hi')).toBe('Walk');
  });

  it('checks what staff enter', () => {
    expect(parseReel({ url: 'https://youtube.com/shorts/abcdefghijk', titleEn: 'Hi', category: 'learn' })).toMatchObject({ reel: { youtubeId: 'abcdefghijk', lang: 'both' } });
    expect(parseReel({ url: 'nope', titleEn: 'x', category: 'learn' })).toEqual({ error: 'bad_youtube' });
    expect(parseReel({ url: 'abcdefghijk', titleEn: 'x', category: 'dance' })).toEqual({ error: 'bad_category' });
  });
});
