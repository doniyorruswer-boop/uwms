import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from '@arco-design/web-react';
import { queryClient } from './api/queryClient';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';
import { useLanguageStore } from './store/languageStore';
import { getArcoLocale } from './locales/arcoLocales';
import './locales/i18n';

export function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const language = useLanguageStore((s) => s.language);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const currentArcoLocale = getArcoLocale(language);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={currentArcoLocale}
        componentConfig={{
          Card: {
            style: { borderRadius: 0 },
          },
          Button: {
            style: { borderRadius: 0 },
          },
          Table: {
            pagination: {
              sizeCanChange: true,
              sizeOptions: [10, 20, 50, 100],
              showTotal: (total: number, range: number[]) => {
                if (!total || total === 0) return '0/0';
                const to = range ? Math.min(range[1], total) : total;
                return `${to}/${total}`;
              },
            },
          },
        }}
      >
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;

