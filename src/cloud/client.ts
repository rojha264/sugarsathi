import { createMMKV } from 'react-native-mmkv';

/** Sugar Saathi API base URL; without it the app runs fully offline and account features are hidden. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const cloudEnabled = !!API_URL;

export type Session = { accessToken: string; refreshToken: string; user: { id: string; phone: string | null; name: string; lang: string } };

/** Login tokens, kept apart from app data so Restart and backups never touch them. */
const authStore = createMMKV({ id: 'glucobuddy-auth' });
const KEY = 'session';

export function getSession(): Session | null {
  try {
    const raw = authStore.getString(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function setSession(s: Session | null) {
  if (s) authStore.set(KEY, JSON.stringify(s));
  else authStore.remove(KEY);
}
export const signedIn = () => cloudEnabled && !!getSession();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const s = getSession();
  if (!s) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) })
    .then(async (res) => {
      if (res.status === 401) setSession(null); // refresh token revoked or expired: sign in again
      if (!res.ok) return false;
      const t = (await res.json()) as Pick<Session, 'accessToken' | 'refreshToken'>;
      setSession({ ...s, ...t });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** JSON request with the user's token; refreshes it once on 401. Throws ApiError (status 0 = offline). */
export async function api<T = unknown>(path: string, init: { method?: string; json?: unknown } = {}, retry = true): Promise<T> {
  if (!cloudEnabled) throw new ApiError(0, 'offline');
  const s = getSession();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.json !== undefined ? 'POST' : 'GET'),
      headers: { ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(s ? { Authorization: `Bearer ${s.accessToken}` } : {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  if (res.status === 401 && retry && s && (await refresh())) return api<T>(path, init, false);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? String(res.status)));
  return body as T;
}

/** The signed-in user id, or null (kept for callers written against the old anonymous login). */
export async function ensureSession(): Promise<string | null> {
  return getSession()?.user.id ?? null;
}
