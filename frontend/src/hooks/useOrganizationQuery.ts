import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';
import type { Department, Room } from '../types';

export interface DepartmentItem {
  id: string;
  name: string;
  code?: string | null;
  type: string;
  parentId?: string | null;
  parent?: {
    id: string;
    name: string;
    type: string;
  } | null;
  children?: DepartmentItem[];
  _count?: {
    children: number;
    rooms: number;
    users: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomItem extends Room {
  responsibleUserPhone?: string | null;
  itemCount: number;
}

export interface CreateDepartmentData {
  name: string;
  code?: string;
  type?: string;
  parentId?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  type?: string;
  parentId?: string | null;
}

export interface CreateRoomData {
  number: string;
  name: string;
  floor: number;
  building: string;
  departmentId?: string;
  responsibleUserId?: string;
}

export interface UpdateRoomData {
  number?: string;
  name?: string;
  floor?: number;
  building?: string;
  departmentId?: string | null;
  responsibleUserId?: string | null;
}

export function useOrganizationQuery() {
  const treeQuery = useQuery({
    queryKey: ['organization', 'tree'],
    queryFn: async () => {
      const res = await apiClient.get<Department[]>(API_ENDPOINTS.ORGANIZATION.TREE);
      return res.data;
    },
  });

  const roomsQuery = useQuery({
    queryKey: ['organization', 'rooms'],
    queryFn: async () => {
      const res = await apiClient.get<RoomItem[]>(API_ENDPOINTS.ORGANIZATION.ROOMS);
      return res.data;
    },
  });

  const departmentsListQuery = useQuery({
    queryKey: ['organization', 'departments-list'],
    queryFn: async () => {
      const res = await apiClient.get<DepartmentItem[]>(API_ENDPOINTS.ORGANIZATION.DEPARTMENTS);
      return res.data;
    },
  });

  return {
    departments: treeQuery.data || [],
    allDepartments: departmentsListQuery.data || [],
    rooms: roomsQuery.data || [],
    isLoading: treeQuery.isLoading || roomsQuery.isLoading || departmentsListQuery.isLoading,
    isError: treeQuery.isError || roomsQuery.isError || departmentsListQuery.isError,
    refetch: () => {
      treeQuery.refetch();
      roomsQuery.refetch();
      departmentsListQuery.refetch();
    },
  };
}

export function useRoomDetailsQuery(roomId: string | null) {
  return useQuery({
    queryKey: ['organization', 'room-details', roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const res = await apiClient.get(API_ENDPOINTS.ORGANIZATION.ROOM_BY_ID(roomId));
      return res.data;
    },
    enabled: !!roomId,
  });
}

export function useCreateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDepartmentData) => {
      const res = await apiClient.post(API_ENDPOINTS.ORGANIZATION.DEPARTMENTS, data);
      return res.data;
    },
    onSuccess: (dept) => {
      Message.success(`'${dept.name}' bo‘limi muvaffaqiyatli yaratildi!`);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Bo‘lim yaratishda xatolik yuz berdi');
    },
  });
}

export function useUpdateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDepartmentData }) => {
      const res = await apiClient.put(API_ENDPOINTS.ORGANIZATION.DEPARTMENT_BY_ID(id), data);
      return res.data;
    },
    onSuccess: (dept) => {
      Message.success(`'${dept.name}' bo‘limi muvaffaqiyatli yangilandi!`);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Bo‘limni yangilashda xatolik yuz berdi');
    },
  });
}

export function useDeleteDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(API_ENDPOINTS.ORGANIZATION.DEPARTMENT_BY_ID(id));
      return res.data;
    },
    onSuccess: (res) => {
      Message.success(res?.message || 'Bo‘lim muvaffaqiyatli o‘chirildi');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Bo‘limni o‘chirishda xatolik yuz berdi');
    },
  });
}

export function useCreateRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateRoomData) => {
      const res = await apiClient.post(API_ENDPOINTS.ORGANIZATION.ROOMS, data);
      return res.data;
    },
    onSuccess: (room) => {
      Message.success(`'${room.number}-xona (${room.name})' muvaffaqiyatli qo‘shildi!`);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Xona qo‘shishda xatolik yuz berdi');
    },
  });
}

export function useUpdateRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRoomData }) => {
      const res = await apiClient.put(API_ENDPOINTS.ORGANIZATION.ROOM_BY_ID(id), data);
      return res.data;
    },
    onSuccess: (room) => {
      Message.success(`'${room.number}-xona' ma’lumotlari muvaffaqiyatli yangilandi!`);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Xonani yangilashda xatolik yuz berdi');
    },
  });
}

export function useDeleteRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(API_ENDPOINTS.ORGANIZATION.ROOM_BY_ID(id));
      return res.data;
    },
    onSuccess: (res) => {
      Message.success(res?.message || 'Xona muvaffaqiyatli o‘chirildi');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Xonani o‘chirishda xatolik yuz berdi');
    },
  });
}
