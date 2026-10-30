import { DEFAULT_PREFS, type Lang } from '@shared/family';
import { api, cloudEnabled, getSession } from './client';
import { useCloud, type Follow, type Remote } from './store';

const HOURS_48 = 48 * 3600 * 1000;

export type Member = { user_id: string; name: string; status: 'pending' | 'active' };

// ---------- Patient side ----------

/** Starts sharing (creates the family circle) and returns a fresh 6-digit code. */
export async function startSharing(_name?: string, _phone?: string): Promise<string> {
  const r = await api<{ circleId: string; code: string; expiresAt: string }>('/family/share', { json: {} });
  useCloud.setState({ circleId: r.circleId, code: { value: r.code, expires: Date.parse(r.expiresAt) || Date.now() + HOURS_48 } });
  return r.code;
}
export const newCode = () => startSharing();

export async function members(): Promise<Member[]> {
  const rows = await api<{ userId: string; name: string; status: 'pending' | 'active' }[]>('/family/members');
  return rows.map((m) => ({ user_id: m.userId, name: m.name, status: m.status }));
}

const dropRequest = (userId: string) => useCloud.setState((s) => ({ requests: s.requests.filter((r) => r.userId !== userId) }));

export async function approve(userId: string) {
  await api(`/family/members/${userId}/approve`, { json: {} });
  dropRequest(userId);
}

export async function removeMember(userId: string) {
  await api(`/family/members/${userId}`, { method: 'DELETE' });
  dropRequest(userId);
}

/** Stops sharing with everyone; followers lose access at once. */
export async function stopSharing() {
  await api('/family/share', { method: 'DELETE' });
  useCloud.setState({ circleId: null, code: null, inbox: [], requests: [] });
}

export async function markRead(msgId: string) {
  useCloud.setState((s) => ({ inbox: s.inbox.filter((m) => m.id !== msgId) }));
  await api(`/family/messages/${msgId}/read`, { json: {} }).catch(() => {});
}

// ---------- Caregiver side ----------

/** Asks to follow with a code; the patient sees the request and approves it. */
export async function join(code: string, myName: string, lang: Lang): Promise<Follow> {
  try {
    const r = await api<{ patientId: string; name: string }>('/family/join', { json: { code: code.trim(), name: myName.trim(), lang } });
    const follow: Follow = { patientId: r.patientId, name: r.name, phone: '', status: 'pending', prefs: { ...DEFAULT_PREFS, lang } };
    useCloud.setState((s) => ({ myName: myName.trim(), following: [...s.following.filter((f) => f.patientId !== follow.patientId), follow] }));
    return follow;
  } catch (e) {
    const m = (e as Error).message;
    throw new Error(m.includes('bad_code') ? 'bad_code' : m.includes('own_circle') ? 'own_circle' : 'failed');
  }
}

export async function savePrefs(f: Follow) {
  await api(`/family/${f.patientId}`, { method: 'PATCH', json: { mutedAlerts: f.prefs.off, lang: f.prefs.lang } });
  useCloud.setState((s) => ({ following: s.following.map((x) => (x.patientId === f.patientId ? f : x)) }));
}

export async function unfollow(patientId: string) {
  await api(`/family/${patientId}`, { method: 'DELETE' }).catch(() => {});
  useCloud.setState((s) => {
    const { [patientId]: _, ...remote } = s.remote;
    return { following: s.following.filter((f) => f.patientId !== patientId), remote };
  });
}

/** Approval status, names and phones of everyone this phone follows (the server is the source of truth). */
export async function refreshFollowing() {
  if (!cloudEnabled || !getSession()) return;
  const rows = await api<{ patientId: string; name: string; phone: string | null; status: 'pending' | 'active'; mutedAlerts: string[]; lang: string }[]>('/family/following');
  useCloud.setState((s) => {
    const known = new Map(s.following.map((f) => [f.patientId, f]));
    const following: Follow[] = rows.map((r) => ({
      patientId: r.patientId, name: r.name, phone: r.phone ?? '', status: r.status,
      prefs: { ...(known.get(r.patientId)?.prefs ?? DEFAULT_PREFS), off: r.mutedAlerts as Follow['prefs']['off'], lang: r.lang === 'hi' ? 'hi' : 'en' },
    }));
    // Follows the server no longer has were removed by the patient.
    for (const f of s.following) if (!following.some((x) => x.patientId === f.patientId)) following.push({ ...f, status: 'gone' });
    return { following };
  });
}

/** Everything the caregiver screen shows for one elder; also kept in the local cache. */
export async function loadRemote(patientId: string): Promise<Remote | null> {
  try {
    const r = await api<Omit<Remote, 'fetchedAt'>>(`/family/${patientId}/day`);
    const remote: Remote = { ...r, fetchedAt: Date.now() };
    useCloud.setState((s) => ({ remote: { ...s.remote, [patientId]: remote } }));
    return remote;
  } catch {
    return null;
  }
}

/** Refreshes approval status and every approved elder's day (Family tab, caregiver home). */
export async function refreshAllRemote() {
  await refreshFollowing();
  const active = useCloud.getState().following.filter((f) => f.status === 'active');
  await Promise.all(active.map((f) => loadRemote(f.patientId)));
}

export async function sendMessage(patientId: string, kind: 'cheer' | 'remind', text = '') {
  await api(`/family/${patientId}/message`, { json: { kind, text } });
}

// ---------- Dietitian inbox ----------

export async function readNotice(id: string) {
  useCloud.setState((s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) }));
  await api(`/me/inbox/${id}/read`, { json: {} }).catch(() => {});
}
