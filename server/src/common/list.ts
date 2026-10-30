import { searchRank } from '@shared/search';

/** Query params for admin tables: ?page=1&pageSize=20&sort=name&order=asc&q=text */
export type ListQuery = { page?: string; pageSize?: string; sort?: string; order?: string; q?: string };

/** Big enough for the whole food / ingredient catalog (pickers load it all at once). */
const MAX_PAGE = 2000;

export function paging(q: ListQuery, sortable: string[], fallback: string) {
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), MAX_PAGE);
  const page = Math.max(Number(q.page) || 1, 1);
  const sort = q.sort && sortable.includes(q.sort) ? q.sort : fallback;
  return { skip: (page - 1) * pageSize, take: pageSize, orderBy: { [sort]: q.order === 'desc' ? 'desc' : 'asc' } as Record<string, 'asc' | 'desc'> };
}


/**
 * Hindi / English search for small tables (foods, ingredients, exercises, tips): every row is read,
 * matched with the shared matcher ("chawal" finds चावल, "रोटी" finds Roti), best match first, then paged.
 */
export function rankPage<T>(rows: T[], q: ListQuery, fields: (row: T) => (string | null | undefined)[]) {
  const ranked = searchRank(rows, q.q ?? '', fields);
  const { skip, take } = paging(q, [], 'id');
  return { data: ranked.slice(skip, skip + take), total: ranked.length };
}
