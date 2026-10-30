import { useCallback } from 'react';

import { useApp } from '@/store/useApp';
import { translate, translateList, type TextKey } from './strings';

export function useT() {
  const lang = useApp((s) => s.lang);
  const t = useCallback((key: TextKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const tl = useCallback((key: 'lowS' | 'highS') => translateList(lang, key), [lang]);
  return { t, tl, lang };
}
