import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';
import type { RoleType } from '../types';

export interface UserItem {
  id: string;
  fullName: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  role: RoleType;
  isActive: boolean;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code?: string | null;
    type: string;
  } | null;
  _count?: {
    responsibleRooms: number;
    responsibleInstances: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface QueryUsersParams {
  search?: string;
  role?: string;
  departmentId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedUsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateUserData {
  fullName: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  position?: string;
  role: RoleType;
  departmentId?: string;
  isActive?: boolean;
}

export interface UpdateUserData {
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;
  role?: RoleType;
  departmentId?: string | null;
  isActive?: boolean;
}

export function useUsersQuery(params?: QueryUsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedUsersResponse>(API_ENDPOINTS.USERS.BASE, {
        params,
      });
      return res.data;
    },
  });
}

export function useUserDetailQuery(id: string | null) {
  return useQuery({
    queryKey: ['user-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<UserItem>(API_ENDPOINTS.USERS.BY_ID(id));
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUserAssetsQuery(id: string | null) {
  return useQuery({
    queryKey: ['user-assets', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<{
        responsibleRooms: any[];
        responsibleAssets: any[];
        totalAssetsCount: number;
      }>(API_ENDPOINTS.USERS.ASSETS(id));
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const res = await apiClient.post<UserItem>(API_ENDPOINTS.USERS.BASE, data);
      return res.data;
    },
    onSuccess: (user) => {
      Message.success(`Xodim '${user.fullName}' muvaffaqiyatli qo‘shildi!`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Xodim qo‘shishda xatolik yuz berdi');
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }) => {
      const res = await apiClient.put<UserItem>(API_ENDPOINTS.USERS.BY_ID(id), data);
      return res.data;
    },
    onSuccess: (user) => {
      Message.success(`'${user.fullName}' ma’lumotlari yangilandi!`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-detail', user.id] });
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Ma’lumotlarni yangilashda xatolik yuz berdi');
    },
  });
}

export function useToggleUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.patch<UserItem>(API_ENDPOINTS.USERS.STATUS(id), { isActive });
      return res.data;
    },
    onSuccess: (user) => {
      Message.success(`'${user.fullName}' holati ${user.isActive ? 'FAOL' : 'NOFAOL'} ga o‘zgartirildi!`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-detail', user.id] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Holatni o‘zgartirishda xatolik yuz berdi');
    },
  });
}

export function useResetUserPasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        API_ENDPOINTS.USERS.RESET_PASSWORD(id),
        { newPassword },
      );
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(data.message || 'Parol muvaffaqiyatli yangilandi!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Parolni yangilashda xatolik yuz berdi');
    },
  });
}
