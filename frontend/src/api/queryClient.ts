import { QueryClient, keepPreviousData } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutes - instant memory cache on tab/page switches
      gcTime: 1000 * 60 * 10, // 10 minutes cache retention
      retry: 1,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData, // Seamless background updates without UI flashing
    },
  },
});
