import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Message } from '@arco-design/web-react';
import { API_ENDPOINTS } from '../constants';
import type {
  UserPermissionsData,
  PermissionsCatalogResponse,
} from '../types';

export const useUserPermissionsQuery = (userId?: string) => {
  return useQuery<UserPermissionsData>({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      const response = await apiClient.get<UserPermissionsData>(
        API_ENDPOINTS.USERS.PERMISSIONS(userId!),
      );
      return response.data;
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2, // 2 daqiqa kesh
  });
};

export const usePermissionsCatalogQuery = () => {
  return useQuery<PermissionsCatalogResponse>({
    queryKey: ['permissions-catalog'],
    queryFn: async () => {
      const response = await apiClient.get<PermissionsCatalogResponse>(
        API_ENDPOINTS.USERS.PERMISSIONS_CATALOG,
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 daqiqa kesh
  });
};

export const useUpdateUserPermissionsMutation = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (permissions: string[]) => {
      const response = await apiClient.put(
        API_ENDPOINTS.USERS.PERMISSIONS(userId),
        { permissions },
      );
      return response.data;
    },
    onSuccess: () => {
      Message.success('Foydalanuvchi huquqlari muvaffaqiyatli saqlandi!');
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (error: any) => {
      const msg =
        error.response?.data?.message ||
        'Huquqlarni saqlashda xatolik yuz berdi!';
      Message.error(msg);
    },
  });
};
