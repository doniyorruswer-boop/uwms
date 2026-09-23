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
  buildingId?: string | null;
  building?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
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
  deletedAt?: string | null;
}

export interface BuildingItem {
  id: string;
  name: string;
  code?: string | null;
  floorsCount: number;
  address?: string | null;
  description?: string | null;
  commendantId?: string | null;
  commendant?: {
    id: string;
    fullName: string;
    phone?: string | null;
    username?: string | null;
    position?: string | null;
  } | null;
  departments?: {
    id: string;
    name: string;
    type: string;
    code?: string | null;
    parentId?: string | null;
  }[];
  _count?: {
    rooms: number;
    warehouses: number;
    departments?: number;
  };
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBuildingData {
  name: string;
  code?: string;
  floorsCount?: number;
  address?: string;
  description?: string;
  commendantId?: string;
  departmentIds?: string[];
}

export interface UpdateBuildingData {
  name?: string;
  code?: string;
  floorsCount?: number;
  address?: string;
  description?: string;
  commendantId?: string | null;
  departmentIds?: string[];
}

export interface RoomItem extends Room {
  responsibleUserPhone?: string | null;
  itemCount: number;
  buildingId?: string | null;
  buildingCode?: string | null;
  buildingFloorsCount?: number;
  deletedAt?: string | null;
}

export interface CreateDepartmentData {
  name: string;
  code?: string;
  type?: string;
  parentId?: string;
  buildingId?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  type?: string;
  parentId?: string | null;
  buildingId?: string | null;
}

export interface CreateRoomData {
  number?: string;
  name: string;
  floor: number;
  buildingId?: string;
  building?: string;
  departmentId?: string;
  responsibleUserId?: string;
}

export interface UpdateRoomData {
  number?: string;
  name?: string;
  floor?: number;
  buildingId?: string | null;
  building?: string;
  departmentId?: string | null;
  responsibleUserId?: string | null;
}

export function useOrganizationQuery(showDeleted?: boolean) {
  const treeQuery = useQuery({
    queryKey: ['organization', 'tree'],
    queryFn: async () => {
      const res = await apiClient.get<Department[]>(API_ENDPOINTS.ORGANIZATION.TREE);
      return res.data;
    },
  });

  const roomsQuery = useQuery({
    queryKey: ['organization', 'rooms', showDeleted],
    queryFn: async () => {
      const res = await apiClient.get<RoomItem[]>(API_ENDPOINTS.ORGANIZATION.ROOMS, {
        params: { showDeleted },
      });
      return res.data;
    },
  });

  const departmentsListQuery = useQuery({
    queryKey: ['organization', 'departments-list', showDeleted],
    queryFn: async () => {
      const res = await apiClient.get<DepartmentItem[]>(API_ENDPOINTS.ORGANIZATION.DEPARTMENTS, {
        params: { showDeleted },
      });
      return res.data;
    },
  });

  const buildingsQuery = useQuery({
    queryKey: ['organization', 'buildings', showDeleted],
    queryFn: async () => {
      const res = await apiClient.get<BuildingItem[]>(API_ENDPOINTS.ORGANIZATION.BUILDINGS, {
        params: { showDeleted },
      });
      return res.data;
    },
  });

  return {
    buildings: buildingsQuery.data || [],
    departments: treeQuery.data || [],
    allDepartments: departmentsListQuery.data || [],
    rooms: roomsQuery.data || [],
    isLoading: treeQuery.isLoading || roomsQuery.isLoading || departmentsListQuery.isLoading || buildingsQuery.isLoading,
    isError: treeQuery.isError || roomsQuery.isError || departmentsListQuery.isError || buildingsQuery.isError,
    refetch: () => {
      buildingsQuery.refetch();
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

export function useRestoreDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/organization/departments/${id}/restore`);
      return res.data;
    },
    onSuccess: () => {
      Message.success('Bo‘lim muvaffaqiyatli qayta tiklandi (Restore)');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Bo‘limni qayta tiklashda xatolik yuz berdi');
    },
  });
}

export function useRestoreRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/organization/rooms/${id}/restore`);
      return res.data;
    },
    onSuccess: () => {
      Message.success('Xona muvaffaqiyatli qayta tiklandi (Restore)');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Xonani qayta tiklashda xatolik yuz berdi');
    },
  });
}

export function useCreateBuildingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBuildingData) => {
      const res = await apiClient.post(API_ENDPOINTS.ORGANIZATION.BUILDINGS, data);
      return res.data;
    },
    onSuccess: (b) => {
      Message.success(`'${b.name}' binosi muvaffaqiyatli yaratildi!`);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Bino yaratishda xatolik yuz berdi');
    },
  });
}

export function useUpdateBuildingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBuildingData }) => {
      const res = await apiClient.put(API_ENDPOINTS.ORGANIZATION.BUILDING_BY_ID(id), data);
      return res.data;
    },
    onSuccess: (b) => {
      Message.success(`'${b.name}' binosi muvaffaqiyatli yangilandi!`);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Binoni yangilashda xatolik yuz berdi');
    },
  });
}

export function useDeleteBuildingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(API_ENDPOINTS.ORGANIZATION.BUILDING_BY_ID(id));
      return res.data;
    },
    onSuccess: (res) => {
      Message.success(res?.message || 'Bino muvaffaqiyatli o‘chirildi');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Binoni o‘chirishda xatolik yuz berdi');
    },
  });
}

export function useRestoreBuildingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(API_ENDPOINTS.ORGANIZATION.BUILDING_RESTORE(id));
      return res.data;
    },
    onSuccess: () => {
      Message.success('Bino muvaffaqiyatli qayta tiklandi (Restore)');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Binoni qayta tiklashda xatolik yuz berdi');
    },
  });
}
