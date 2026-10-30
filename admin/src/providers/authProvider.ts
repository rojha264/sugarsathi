import type { AuthProvider } from '@refinedev/core';

import { api, session, type Session } from './api';

/** Staff (dietitian / owner) sign in with email and password. */
export const authProvider: AuthProvider = {
  async login({ email, password }) {
    try {
      const s = await api<Session>('/auth/staff/login', { method: 'POST', json: { email, password } }, false);
      session.set(s);
      return { success: true, redirectTo: '/' };
    } catch {
      return { success: false, error: { name: 'Login failed', message: 'Wrong email or password' } };
    }
  },
  async logout() {
    const s = session.get();
    if (s) await api('/auth/logout', { method: 'POST', json: { refreshToken: s.refreshToken } }, false).catch(() => {});
    session.set(null);
    return { success: true, redirectTo: '/login' };
  },
  async check() {
    return session.get() ? { authenticated: true } : { authenticated: false, redirectTo: '/login' };
  },
  async getIdentity() {
    return session.get()?.user ?? null;
  },
  async getPermissions() {
    return session.get()?.user.role ?? null;
  },
  async onError(error) {
    if (error?.status === 401) return { logout: true, redirectTo: '/login' };
    return { error };
  },
};

export const isOwner = () => session.get()?.user.role === 'OWNER';
