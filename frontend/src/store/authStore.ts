import { create } from 'zustand';
import type { User } from '../types';
import { apiClient } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDarkMode: boolean;

  login: (token: string, user: User) => void;
  logout: () => void;
  setPasswordChanged: () => void;
  toggleDarkMode: () => void;
  checkAuth: () => Promise<void>;
}

const savedToken = localStorage.getItem('uwms_token');
const savedUser = localStorage.getItem('uwms_user')
  ? JSON.parse(localStorage.getItem('uwms_user')!)
  : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: savedUser,
  token: savedToken,
  isAuthenticated: !!savedToken,
  isLoading: false,
  isDarkMode: false,

  login: (token: string, user: User) => {
    localStorage.setItem('uwms_token', token);
    localStorage.setItem('uwms_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  setPasswordChanged: () => {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, mustChangePassword: false };
      localStorage.setItem('uwms_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  logout: () => {
    localStorage.removeItem('uwms_token');
    localStorage.removeItem('uwms_user');
    set({ token: null, user: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      if (next) {
        document.body.setAttribute('arco-theme', 'dark');
      } else {
        document.body.removeAttribute('arco-theme');
      }
      return { isDarkMode: next };
    }),

  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      set({ isLoading: true });
      const res = await apiClient.get('/auth/me');
      set({ user: res.data, isAuthenticated: true, isLoading: false });
      localStorage.setItem('uwms_user', JSON.stringify(res.data));
    } catch {
      localStorage.removeItem('uwms_token');
      localStorage.removeItem('uwms_user');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
