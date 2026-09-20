import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
