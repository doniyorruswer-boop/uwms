import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export interface RepairItem {
  id: string;
  repairNumber: string;
  assetId: string;
  asset: {
    id: string;
    inventoryNumber: string;
    serialNumber?: string;
    status: string;
    item: {
      name: string;
      model?: string;
      category: { name: string };
    };
    room?: {
      number: string;
      name: string;
    };
    responsibleUser?: {
      fullName: string;
    };
    depreciation?: {
      annualRate: number;
      ageYears: number;
      accumulatedDepreciation: number;
      currentBookValue: number;
    };
  };
  issueDescription: string;
  status: 'PENDING' | 'IN_REPAIR' | 'COMPLETED' | 'UNREPAIRABLE';
  serviceProvider?: string;
  cost?: number;
  startDate?: string;
  completionDate?: string;
  actNumber?: string;
  notes?: string;
  requestedBy: { id: string; fullName: string; role: string };
  approvedBy?: { id: string; fullName: string; role: string };
  createdAt: string;
  updatedAt: string;
}

export function useRepairsQuery(params?: { status?: string; assetId?: string }) {
  const queryClient = useQueryClient();

  const repairsQuery = useQuery({
    queryKey: ['repairs', params],
    queryFn: async () => {
      const res = await apiClient.get<RepairItem[]>(API_ENDPOINTS.REPAIRS.BASE, { params });
      return res.data;
    },
  });

  const createRepairMutation = useMutation({
    mutationFn: async (data: {
      assetId: string;
      issueDescription: string;
      serviceProvider?: string;
      cost?: number;
      notes?: string;
    }) => {
      const res = await apiClient.post(API_ENDPOINTS.REPAIRS.BASE, data);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`Ta’mirlash talabnomasi ro‘yxatga olindi (${data.repairNumber})!`);
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ta’mir talabnomasini yuborishda xatolik yuz berdi!');
    },
  });

  const updateRepairStatusMutation = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      status: 'PENDING' | 'IN_REPAIR' | 'COMPLETED' | 'UNREPAIRABLE';
      serviceProvider?: string;
      cost?: number;
      actNumber?: string;
      notes?: string;
    }) => {
      const res = await apiClient.patch(API_ENDPOINTS.REPAIRS.STATUS(id), body);
      return res.data;
    },
    onSuccess: (data) => {
      if (data.status === 'COMPLETED') {
        Message.success(`Uskuna ta’mirdan qaytarildi va foydalanishga topshirildi!`);
      } else if (data.status === 'UNREPAIRABLE') {
        Message.warning(`Uskuna yaroqsiz deb topildi va spisaniega tavsiya etildi.`);
      } else {
        Message.info(`Ta’mirlash holati yangilandi: ${data.status}`);
      }
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Holatni yangilashda xatolik yuz berdi!');
    },
  });

  return {
    repairs: repairsQuery.data || [],
    isLoading: repairsQuery.isLoading,
    isError: repairsQuery.isError,
    refetch: repairsQuery.refetch,
    createRepair: createRepairMutation.mutateAsync,
    isCreating: createRepairMutation.isPending,
    updateRepairStatus: updateRepairStatusMutation.mutateAsync,
    isUpdating: updateRepairStatusMutation.isPending,
  };
}
