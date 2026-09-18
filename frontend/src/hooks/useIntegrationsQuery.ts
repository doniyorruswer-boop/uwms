import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api.constants';
import { HemisStatusResult, HemisTestConnectionResult } from '../types';

export interface HemisSyncPayload {
  mode?: 'LIVE' | 'DEMO_STUB';
  hemisApiUrl?: string;
  apiKey?: string;
}

export interface HemisTestConnectionPayload {
  hemisApiUrl?: string;
  apiKey?: string;
}

export interface UzAsboExportParams {
  period?: string;
  type?: 'movements' | 'assets' | 'summary';
  format?: 'json' | 'xml';
}

export const useHemisStatusQuery = () => {
  return useQuery<HemisStatusResult>({
    queryKey: ['hemisStatus'],
    queryFn: async () => {
      const response = await apiClient.get<HemisStatusResult>(API_ENDPOINTS.INTEGRATIONS.HEMIS_STATUS);
      return response.data;
    },
  });
};

export const useHemisTestConnectionMutation = () => {
  return useMutation({
    mutationFn: async (payload: HemisTestConnectionPayload = {}) => {
      const response = await apiClient.post<HemisTestConnectionResult>(
        API_ENDPOINTS.INTEGRATIONS.HEMIS_TEST_CONNECTION,
        payload,
      );
      return response.data;
    },
  });
};

export const useHemisSyncMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: HemisSyncPayload = {}) => {
      const response = await apiClient.post(API_ENDPOINTS.INTEGRATIONS.HEMIS_SYNC, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hemisStatus'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useUzAsboExportQuery = (params?: UzAsboExportParams, enabled = false) => {
  return useQuery({
    queryKey: ['uzAsboExport', params],
    queryFn: async () => {
      const response = await apiClient.get(API_ENDPOINTS.INTEGRATIONS.UZASBO_EXPORT, {
        params,
      });
      return response.data;
    },
    enabled,
  });
};
