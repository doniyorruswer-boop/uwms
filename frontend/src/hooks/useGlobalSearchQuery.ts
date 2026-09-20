import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';

export type SearchResultType = 'ASSET' | 'ROOM' | 'USER' | 'REQUEST';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

export const useGlobalSearchQuery = (term: string, limit: number = 20) => {
  const cleanTerm = term.trim();

  return useQuery<SearchResultItem[]>({
    queryKey: ['global-search', cleanTerm, limit],
    queryFn: async () => {
      if (cleanTerm.length < 2) return [];
      const res = await apiClient.get<SearchResultItem[]>(API_ENDPOINTS.SEARCH.BASE, {
        params: { q: cleanTerm, limit },
      });
      return res.data;
    },
    enabled: cleanTerm.length >= 2,
    staleTime: 20000,
  });
};
