import { api, getSession, setSession, type Session } from './client';
import { resetCloud, useCloud } from './store';

/**
 * Sends the 6-digit code by SMS. Returns the number as the server normalised it (+91…), and
 * `testCode` when the server is in test mode and sends no SMS.
 */
export async function requestOtp(phone: string): Promise<{ phone: string; testCode?: string }> {
  return api<{ phone: string; testCode?: string }>('/auth/otp/request', { json: { phone } }, false);
}

/** Checks the code and signs in; `isNew` is true for a first-time phone number. */
export async function verifyOtp(phone: string, code: string): Promise<{ isNew: boolean; name: string }> {
  const r = await api<Session & { isNew: boolean }>('/auth/otp/verify', { json: { phone, code } }, false);
  setSession({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user });
  // Fresh account state: the server is the source of truth from here.
  useCloud.setState({ authed: true, skipLogin: false, sent: {}, lastPull: 0, profileSig: '', targetsSig: '' });
  return { isNew: r.isNew, name: r.user.name };
}

/** Deletes the account and every log on the server (right to erasure), then signs out. */
export async function deleteAccount() {
  await api('/me', { method: 'DELETE' });
  setSession(null);
  resetCloud();
}

export async function logout() {
  const s = getSession();
  if (s) await api('/auth/logout', { json: { refreshToken: s.refreshToken } }, false).catch(() => {});
  setSession(null);
  resetCloud();
}
