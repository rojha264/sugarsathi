import { youtubeEmbed, youtubeId } from '@shared/youtube';

const ID = 'dQw4w9WgXcQ';

describe('youtubeId', () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`https://m.youtube.com/watch?feature=share&v=${ID}`],
    [`https://youtu.be/${ID}?si=abc123`],
    [`youtu.be/${ID}`],
    [`https://www.youtube.com/embed/${ID}?start=10`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/live/${ID}?feature=share`],
    [`<iframe width="560" height="315" src="https://www.youtube.com/embed/${ID}?si=x" title="YouTube video player" allowfullscreen></iframe>`],
    [`  ${ID}  `],
  ])('reads %s', (input) => {
    expect(youtubeId(input)).toBe(ID);
  });

  it.each([[''], ['hello'], ['https://vimeo.com/12345'], ['https://www.youtube.com/channel/UC123'], ['https://youtu.be/short'], [null], [undefined]])('rejects %s', (input) => {
    expect(youtubeId(input as string)).toBeNull();
  });

  it('builds the embed url', () => {
    expect(youtubeEmbed(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?playsinline=1&rel=0&modestbranding=1`);
  });
});

describe('parseVideos', () => {
  const { parseVideos } = jest.requireActual('@shared/youtube') as typeof import('@shared/youtube');
  it('keeps titles, drops empty rows and duplicates', () => {
    expect(parseVideos([{ url: `https://youtu.be/${ID}`, title: ' Seated ' }, { url: '' }, { url: ID, title: 'again' }, { url: 'https://youtu.be/F-07iLFA9_k', title: 'Standing' }])).toEqual({
      videos: [{ id: ID, title: 'Seated' }, { id: 'F-07iLFA9_k', title: 'Standing' }],
    });
  });
  it('points at the bad row', () => {
    expect(parseVideos([{ url: ID }, { url: 'https://vimeo.com/1' }])).toEqual({ badRow: 1 });
  });
});
