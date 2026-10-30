import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * Local persistence. Everything lives on the device for the offline MVP.
 * A sync layer (Supabase or the Node API) can wrap this later: every log row
 * already carries id / createdAt / updatedAt for upserts.
 */
export interface Repo extends StateStorage {
  clear(): void;
}

const mmkv = createMMKV({ id: 'glucobuddy' });

export const repo: Repo = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
  clear: () => mmkv.clearAll(),
};
