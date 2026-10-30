import { AutoComplete, Input } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export type Suggestion = { value: string; label: ReactNode };

/** How long typing must pause before the list filters and suggestions load. */
const DEBOUNCE_MS = 250;

/**
 * Search box with autocomplete, used on every admin list. Typing in Hindi or English (or Hinglish)
 * filters the list as you type and shows the best matches underneath; picking one opens it.
 * Works as a controlled form field too (`value` / `onChange`).
 */
export function SearchBox({ placeholder = 'Search in Hindi or English', value, onChange, onSearch, suggest, onPick, width = 300 }: {
  placeholder?: string;
  value?: string;
  onChange?(q: string): void;
  /** Called (debounced) while typing and on Enter: filter the list. */
  onSearch?(q: string): void;
  /** Best matches for the dropdown. */
  suggest?(q: string): Promise<Suggestion[]> | Suggestion[];
  onPick?(value: string): void;
  width?: number | string;
}) {
  const [text, setText] = useState(value ?? '');
  const [options, setOptions] = useState<Suggestion[]>([]);
  const latest = useRef('');
  // The list is already loaded on open; only search once the user types.
  const typed = useRef(false);
  useEffect(() => {
    if (value !== undefined) setText(value);
  }, [value]);

  useEffect(() => {
    if (!typed.current) return;
    const q = text.trim();
    latest.current = q;
    const t = setTimeout(async () => {
      onSearch?.(q);
      if (!suggest || !q) return setOptions([]);
      const found = await Promise.resolve(suggest(q)).catch(() => []);
      // Ignore answers for text the user has already changed.
      if (latest.current === q) setOptions(found);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AutoComplete
      value={text}
      options={options}
      style={{ width }}
      popupMatchSelectWidth={Math.max(Number(width) || 0, 360)}
      onChange={(v) => {
        typed.current = true;
        setText(v);
        onChange?.(v);
      }}
      onSelect={(v) => {
        setOptions([]);
        onPick?.(String(v));
      }}>
      <Input.Search allowClear placeholder={placeholder} onSearch={(q) => onSearch?.(q.trim())} />
    </AutoComplete>
  );
}
