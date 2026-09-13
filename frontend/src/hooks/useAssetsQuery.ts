import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import type { ItemInstance } from '../types';
import { Message } from '@arco-design/web-react';

export function useAssetsQuery(params?: { search?: string; status?: string; roomId?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: ['assets', params],
    queryFn: async () => {
      const res = await apiClient.get<any>(API_ENDPOINTS.ASSETS.BASE, { params });
      return res.data;
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(API_ENDPOINTS.ASSETS.BASE, data);
      return res.data;
    },
    onSuccess: () => {
      Message.success('Yangi asosiy vosita muvaffaqiyatli ro‘yxatga olindi!');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Aktivni kirim qilishda xatolik yuz berdi!');
    },
  });

  const transferAssetMutation = useMutation({
    mutationFn: async ({ id, toRoomId, note }: { id: string; toRoomId: string; note?: string }) => {
      const res = await apiClient.patch(API_ENDPOINTS.ASSETS.TRANSFER(id), { toRoomId, note });
      return res.data;
    },
    onSuccess: () => {
      Message.success('Asosiy vosita yangi xonaga muvaffaqiyatli ko‘chirildi!');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ko‘chirishda xatolik yuz berdi!');
    },
  });

  const batchTransferMutation = useMutation({
    mutationFn: async (data: { assetIds: string[]; toRoomId: string; note?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.ASSETS.BATCH_TRANSFER, data);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`${data.count} ta asosiy vosita muvaffaqiyatli ko‘chirildi!`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ommaviy ko‘chirishda xatolik yuz berdi!');
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.patch(API_ENDPOINTS.ASSETS.WRITE_OFF(id), { reason });
      return res.data;
    },
    onSuccess: () => {
      Message.success('Asosiy vosita hisobdan chiqarildi (spisanie qilindi)!');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Hisobdan chiqarishda xatolik yuz berdi!');
    },
  });

  const importExcelMutation = useMutation({
    mutationFn: async (rows: Array<{
      itemName: string;
      model?: string;
      categoryName?: string;
      inventoryNumber?: string;
      serialNumber?: string;
      purchasePrice?: number;
      fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';
      roomNumber?: string;
      warrantyMonths?: number;
    }>) => {
      const res = await apiClient.post(API_ENDPOINTS.ASSETS.IMPORT_EXCEL, { rows });
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`${data.importedCount} ta asosiy vosita muvaffaqiyatli import qilindi!`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Excel import qilishda xatolik yuz berdi!');
    },
  });

  const returnAssetMutation = useMutation({
    mutationFn: async (data: { assetId: string; warehouseId?: string; reason: string; note?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.ASSETS.RETURN, data);
      return res.data;
    },
    onSuccess: () => {
      Message.success('Uskunani omborga qaytarish arizasi yuborildi! Bosh omborchi qabul qilishi kutilmoqda.');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Qaytarish arizasini yuborishda xatolik yuz berdi!');
    },
  });

  const massMolHandoffMutation = useMutation({
    mutationFn: async (data: { fromUserId: string; toUserId: string; roomId?: string; note?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.ASSETS.MASS_MOL_HANDOFF, data);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`MOL yalpi almashinuvi yakunlandi: ${data.transferredCount} ta jihoz o‘tkazildi (${data.actNumber})!`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'MOL yalpi almashinuvida xatolik yuz berdi!');
    },
  });

  const rawData = assetsQuery.data;
  const assets: ItemInstance[] = Array.isArray(rawData) ? rawData : (rawData?.data || []);
  const total: number = Array.isArray(rawData) ? rawData.length : (rawData?.total ?? assets.length);

  return {
    assets,
    total,
    isLoading: assetsQuery.isLoading,
    isFetching: assetsQuery.isFetching,
    isError: assetsQuery.isError,
    error: assetsQuery.error,
    refetch: assetsQuery.refetch,
    createAsset: createAssetMutation.mutateAsync,
    transferAsset: transferAssetMutation.mutateAsync,
    batchTransfer: batchTransferMutation.mutateAsync,
    writeOffAsset: writeOffMutation.mutateAsync,
    importExcelAssets: importExcelMutation.mutateAsync,
    isImporting: importExcelMutation.isPending,
    returnAsset: returnAssetMutation.mutateAsync,
    isReturning: returnAssetMutation.isPending,
    massMolHandoff: massMolHandoffMutation.mutateAsync,
    isHandoffPending: massMolHandoffMutation.isPending,
  };
}

export interface TransferItem {
  id: string;
  assetId: string;
  assetName: string;
  assetModel?: string;
  inventoryNumber: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  isReturn?: boolean;
  note?: string;
  fromRoomName: string;
  toRoomName: string;
  toRoomId?: string;
  toWarehouseId?: string;
  senderName: string;
  receiverName: string;
  receiverId?: string;
  createdAt: string;
  acceptedAt?: string;
}

export function useTransfersQuery(params?: { status?: string; receiverId?: string }) {
  const queryClient = useQueryClient();

  const transfersQuery = useQuery({
    queryKey: ['transfers', params],
    queryFn: async () => {
      const res = await apiClient.get<TransferItem[]>(API_ENDPOINTS.ASSETS.TRANSFERS, { params });
      return res.data;
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: 'ACCEPTED' | 'REJECTED'; note?: string }) => {
      const res = await apiClient.patch(API_ENDPOINTS.ASSETS.TRANSFER_RESPOND(id), { status, note });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.status === 'ACCEPTED') {
        Message.success('Uskuna qabul qilindi va hisobga olindi!');
      } else {
        Message.info('Ko‘chirish arizasi rad etildi!');
      }
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Qabul qilishda xatolik yuz berdi!');
    },
  });

  return {
    transfers: transfersQuery.data || [],
    isLoading: transfersQuery.isLoading,
    isError: transfersQuery.isError,
    refetch: transfersQuery.refetch,
    respondTransfer: respondMutation.mutateAsync,
  };
}
