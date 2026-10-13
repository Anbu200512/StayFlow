import { create } from 'zustand';
import { authApi, clearAccessToken, getAccessToken, setAccessToken } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  login: async (email, password) => { const result = await authApi.login(email, password); setAccessToken(result.accessToken); set({ user: result.user, ready: true }); },
  hydrate: async () => { if (!getAccessToken()) { set({ ready: true }); return; } try { const result = await authApi.me(); set({ user: result.user, ready: true }); } catch { clearAccessToken(); set({ user: null, ready: true }); } },
  logout: async () => { try { await authApi.logout(); } finally { clearAccessToken(); set({ user: null, ready: true }); } },
}));
