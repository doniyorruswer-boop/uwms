import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api.constants';
import { NotificationItem } from '../types';

export interface NotificationsResponse {
  unreadCount: number;
  items: NotificationItem[];
}

export const useNotificationsQuery = () => {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiClient.get<NotificationsResponse>(API_ENDPOINTS.NOTIFICATIONS.BASE);
      return response.data;
    },
    refetchInterval: 30000, // Poll har 30 soniyada yangilanadi
  });
};

export const useMarkAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(API_ENDPOINTS.NOTIFICATIONS.READ_BY_ID(id));
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(API_ENDPOINTS.NOTIFICATIONS.READ_ALL);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
