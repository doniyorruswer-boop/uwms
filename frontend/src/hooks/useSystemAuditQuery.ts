import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api.constants';
import { SystemAuditLogItem } from '../types';

export interface QuerySystemAuditParams {
  action?: string;
  entity?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface SystemAuditResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: SystemAuditLogItem[];
}

export const useSystemAuditQuery = (params?: QuerySystemAuditParams) => {
  return useQuery<SystemAuditResponse>({
    queryKey: ['systemAudit', params],
    queryFn: async () => {
      const response = await apiClient.get<SystemAuditResponse>(API_ENDPOINTS.SYSTEM_AUDIT.BASE, {
        params,
      });
      return response.data;
    },
  });
};
