import { matchScore } from '@shared/search';

/** An antd option that can be found by any of these texts (English, Hindi, Hinglish aliases, id). */
export type Searchable = { search?: (string | null | undefined)[] };

/**
 * Spread into an antd Select so typing in Hindi or English (or Hinglish: "chawal", "panir") finds the
 * option, best match first. Each option needs a `search` list.
 */
export const bilingual = {
  showSearch: true,
  filterOption: (input: string, o?: Searchable) => matchScore(input, o?.search ?? []) > 0,
  filterSort: (a: Searchable, b: Searchable, info: { searchValue: string }) => matchScore(info.searchValue, b.search ?? []) - matchScore(info.searchValue, a.search ?? []),
};

export const foodSearch = (f: { id: string; nameEn: string; nameHi: string; aliases?: string[] }) => [f.nameEn, f.nameHi, f.id, ...(f.aliases ?? [])];
