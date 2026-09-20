import axios from 'axios';
import { create } from 'zustand';
import type { User } from '../types';
import { apiClient, setAccessToken, API_BASE_URL } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDarkMode: boolean;

  login: (accessToken: string, user: User, refreshToken?: string) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  logout: () => Promise<void>;
  setPasswordChanged: () => void;
  toggleDarkMode: () => void;
  checkAuth: () => Promise<void>;
}

const savedRefreshToken = localStorage.getItem('uwms_refresh_token');
const savedUser = localStorage.getItem('uwms_user')
  ? JSON.parse(localStorage.getItem('uwms_user')!)
  : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: savedUser,
  token: null, // Xavfsizlik: access token faqat xotirada bo'ladi
  refreshToken: savedRefreshToken,
  isAuthenticated: !!savedRefreshToken,
  isLoading: !!savedRefreshToken,
  isDarkMode: false,

  login: (accessToken: string, user: User, refreshToken?: string) => {
    setAccessToken(accessToken);
    if (refreshToken) {
      localStorage.setItem('uwms_refresh_token', refreshToken);
    }
    localStorage.setItem('uwms_user', JSON.stringify(user));
    localStorage.removeItem('uwms_token'); // Eskirgan ochiq tokenni tozalash
    set({
      token: accessToken,
      refreshToken: refreshToken || null,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setTokens: (accessToken: string, refreshToken?: string) => {
    setAccessToken(accessToken);
    if (refreshToken) {
      localStorage.setItem('uwms_refresh_token', refreshToken);
    }
    set({
      token: accessToken,
      ...(refreshToken ? { refreshToken } : {}),
    });
  },

  setPasswordChanged: () => {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, mustChangePassword: false };
      localStorage.setItem('uwms_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Sessiya allaqachon tugagan bo'lishi mumkin
    }
    setAccessToken(null);
    localStorage.removeItem('uwms_refresh_token');
    localStorage.removeItem('uwms_user');
    localStorage.removeItem('uwms_token');
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false });
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
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
    const refreshToken = localStorage.getItem('uwms_refresh_token');
    if (!refreshToken) {
      setAccessToken(null);
      set({ isAuthenticated: false, user: null, token: null, isLoading: false });
      return;
    }

    try {
      set({ isLoading: true });
      // Silent refresh: yangi in-memory access tokenni olish
      const refreshRes = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 8000 },
      );

      const newAccessToken = refreshRes.data.access_token;
      const newRefreshToken = refreshRes.data.refresh_token;

      setAccessToken(newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem('uwms_refresh_token', newRefreshToken);
      }

      // Foydalanuvchi ma'lumotlarini olish
      const meRes = await apiClient.get('/auth/me');
      set({
        token: newAccessToken,
        refreshToken: newRefreshToken || refreshToken,
        user: meRes.data,
        isAuthenticated: true,
        isLoading: false,
      });
      localStorage.setItem('uwms_user', JSON.stringify(meRes.data));
    } catch {
      setAccessToken(null);
      localStorage.removeItem('uwms_refresh_token');
      localStorage.removeItem('uwms_user');
      localStorage.removeItem('uwms_token');
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

