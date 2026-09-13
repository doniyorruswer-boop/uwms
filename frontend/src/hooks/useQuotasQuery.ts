import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api.constants';
import { DepartmentQuota } from '../types';

export interface QueryQuotaParams {
  departmentId?: string;
  itemId?: string;
  period?: string;
}

export interface SetQuotaPayload {
  departmentId: string;
  itemId: string;
  monthlyLimit: number;
  period?: string;
  notes?: string;
}

export interface UpdateQuotaPayload {
  monthlyLimit?: number;
  notes?: string;
}

export interface CheckQuotaResult {
  hasLimit: boolean;
  isExceeded: boolean;
  monthlyLimit: number | null;
  usedQuantity: number;
  remaining: number | null;
  requestedQty: number;
  period: string;
}

export const useQuotasQuery = (params?: QueryQuotaParams) => {
  return useQuery<DepartmentQuota[]>({
    queryKey: ['quotas', params],
    queryFn: async () => {
      const response = await apiClient.get<DepartmentQuota[]>(API_ENDPOINTS.QUOTAS.BASE, {
        params,
      });
      return response.data;
    },
  });
};

export const useSetQuotaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SetQuotaPayload) => {
      const response = await apiClient.post<DepartmentQuota>(API_ENDPOINTS.QUOTAS.BASE, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
    },
  });
};

export const useUpdateQuotaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateQuotaPayload }) => {
      const response = await apiClient.patch<DepartmentQuota>(
        API_ENDPOINTS.QUOTAS.BY_ID(id),
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
    },
  });
};

export const useCheckQuotaQuery = (
  params: { departmentId?: string; itemId?: string; requestedQty?: number },
  enabled = true,
) => {
  return useQuery<CheckQuotaResult>({
    queryKey: ['checkQuota', params],
    queryFn: async () => {
      const response = await apiClient.get<CheckQuotaResult>(API_ENDPOINTS.QUOTAS.CHECK, {
        params,
      });
      return response.data;
    },
    enabled: enabled && !!params.departmentId && !!params.itemId && typeof params.requestedQty === 'number',
  });
};
