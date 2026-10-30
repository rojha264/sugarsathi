/** Thin fetch wrapper: adds the staff token, refreshes it once on 401, throws readable errors. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

const KEY = 'gb-admin-auth';
export type Session = { accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: 'DIETITIAN' | 'OWNER' } };

export const session = {
  get(): Session | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  set(s: Session | null) {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A server error in words staff understand (codes like foods_not_in_diet:chicken become sentences). */
export function humanError(e: ApiError): string {
  const m = e.message || '';
  if (e.status === 0) return 'No connection to the server. Check the internet and try again.';
  if (e.status === 401) return 'Your session ended. Please sign in again.';
  if (e.status === 403) return 'You do not have access to this (it belongs to another dietitian, or needs the owner).';
  if (e.status === 404) return 'Not found. It may have been deleted. Refresh the page.';
  if (m.startsWith('foods_not_in_diet')) return `These foods do not fit the patient's diet: ${m.split(':')[1] ?? ''}`;
  if (m.startsWith('foods_not_verified') || m.startsWith('foods_not_available')) return `These foods are hidden or not verified yet: ${m.split(':')[1] ?? ''}`;
  if (e.status >= 500) return 'Something went wrong on the server. Please try again; if it keeps happening, tell the team.';
  return `Could not save: ${m.replace(/_/g, ' ')}`;
}

async function refresh(): Promise<boolean> {
  const s = session.get();
  if (!s) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) });
  if (!res.ok) return false;
  const t = await res.json();
  session.set({ ...s, ...t });
  return true;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const { json, ...rest } = init;
  const s = session.get();
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(s ? { Authorization: `Bearer ${s.accessToken}` } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && retry && (await refresh())) return api<T>(path, init, false);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? res.statusText);
  return body as T;
}

/** Query string from an object, skipping empty values. */
export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
