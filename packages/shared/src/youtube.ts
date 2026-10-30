/** A YouTube video id is 11 characters of letters, digits, "-" and "_". */
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts what an admin is likely to paste and returns the bare video id, or null:
 * a plain id, youtube.com/watch?v=…, youtu.be/…, /embed/…, /shorts/…, /live/…, m. / music. / nocookie hosts,
 * with or without extra parameters (t=, si=, list=) or an <iframe> embed snippet.
 */
export function youtubeId(input: string | null | undefined): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  if (ID.test(s)) return s;
  // An <iframe src="…"> snippet: use the src.
  const src = /src=["']([^"']+)["']/i.exec(s)?.[1];
  const raw = src ?? s;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}

export const youtubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/** Privacy-enhanced player URL (no tracking cookies until play). */
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;

/** A sample video attached to an exercise. */
export type ExerciseVideo = { id: string; title: string };
export const MAX_VIDEOS = 5;

/**
 * Normalises what the admin entered (each row: a link / id / embed code, plus a title).
 * Empty rows are dropped; returns the index of the first bad link instead of guessing.
 */
export function parseVideos(rows: { url?: string | null; id?: string | null; title?: string | null }[]): { videos: ExerciseVideo[] } | { badRow: number } {
  const videos: ExerciseVideo[] = [];
  for (const [i, r] of rows.entries()) {
    const raw = (r.url ?? r.id ?? '').trim();
    if (!raw) continue;
    const id = youtubeId(raw);
    if (!id) return { badRow: i };
    if (!videos.some((v) => v.id === id)) videos.push({ id, title: (r.title ?? '').trim().slice(0, 80) });
  }
  return { videos: videos.slice(0, MAX_VIDEOS) };
}
