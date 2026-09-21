import axios from 'axios';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  // Agar aniq belgilangan bo'lsa va localhost bo'lmasa (masalan: '/api' yoki tashqi API URL)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    const hostname = window.location.hostname;
    // 1. Agar lokal Wi-Fi tarmoq IP manzili bo'lsa (masalan: 192.168.1.10)
    const isLanIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) && hostname !== '127.0.0.1';
    if (isLanIp) {
      return `${window.location.protocol}//${hostname}:4000/api`;
    }

    // 2. Agar localhost bo'lsa (mahalliy ishlab chiqish)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return envUrl || 'http://localhost:4000/api';
    }

    // 3. Agar real internet domeni (Railway, production, edu.uz) bo'lsa:
    // Har doim Nginx orqali proksi qilinuvchi nisbiy '/api' ishlatiladi
    return '/api';
  }

  return envUrl || '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// In-Memory Access Token (XSS xavfini to‘liq bartaraf etish uchun)
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  // Xavfsizlik: access token hech qachon localStorage da saqlanmaydi
  localStorage.removeItem('uwms_token');
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 Auto-Refresh Mutex & Queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Agar 401 xatolik bo'lsa va bu login/refresh so'rovi bo'lmasa
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const refreshToken = localStorage.getItem('uwms_refresh_token');

      if (!refreshToken) {
        setAccessToken(null);
        localStorage.removeItem('uwms_refresh_token');
        localStorage.removeItem('uwms_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=true';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;

        setAccessToken(newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('uwms_refresh_token', newRefreshToken);
        }

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        localStorage.removeItem('uwms_refresh_token');
        localStorage.removeItem('uwms_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=true';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);


