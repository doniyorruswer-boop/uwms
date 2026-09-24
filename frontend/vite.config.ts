import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'UWMS — Universitet Ombor va Inventar Tizimi',
        short_name: 'UWMS',
        description: 'Universitet ombori, moddiy aktivlari va oflayn QR-inventarizatsiya tizimi',
        theme_color: '#165dff',
        background_color: '#17171a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/api\/(rooms|buildings|departments|categories)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-metadata-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@arco-design/web-react/icon')) {
              return 'vendor-arco-icons';
            }
            if (id.includes('@arco-design')) {
              return 'vendor-arco';
            }
            if (id.includes('lodash')) {
              return 'vendor-lodash';
            }
            if (id.includes('dayjs')) {
              return 'vendor-dayjs';
            }
            if (id.includes('xlsx')) {
              return 'vendor-excel';
            }
            if (id.includes('qrcode') || id.includes('html5-qrcode')) {
              return 'vendor-qr';
            }
            if (id.includes('@tanstack') || id.includes('axios')) {
              return 'vendor-network';
            }
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
            if (id.includes('i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('zustand')) {
              return 'vendor-state';
            }
          }
        },
      },
    },
  },
});
