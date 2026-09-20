import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import type { StockItem, LowStockItem } from '../types';
import { Message } from '@arco-design/web-react';

export function useWarehouseQuery(params?: { search?: string; categoryId?: string; fundingSource?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();

  const stocksQuery = useQuery({
    queryKey: ['stocks', params],
    queryFn: async () => {
      const res = await apiClient.get<any>(API_ENDPOINTS.WAREHOUSE.STOCKS, { params });
      return res.data;
    },
  });

  const replenishMutation = useMutation({
    mutationFn: async ({
      stockId,
      amount,
      fundingSource,
    }: {
      stockId: string;
      amount: number;
      fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';
    }) => {
      const idempotencyKey = crypto.randomUUID();
      const res = await apiClient.post(
        API_ENDPOINTS.WAREHOUSE.REPLENISH(stockId),
        { amount, fundingSource },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      return res.data;
    },
    onSuccess: () => {
      Message.success('Ombor zaxirasi muvaffaqiyatli to‘ldirildi va kirim qayd etildi!');
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Zaxirani to‘ldirishda xatolik yuz berdi!');
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async (dto: {
      supplierId: string;
      invoiceNumber?: string;
      fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';
      note?: string;
      items: Array<{
        name: string;
        model?: string;
        categoryName?: string;
        type: 'FIXED_ASSET' | 'CONSUMABLE';
        quantity: number;
        unit?: string;
        purchasePrice?: number;
      }>;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      const res = await apiClient.post(API_ENDPOINTS.WAREHOUSE.INGEST, dto, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(data.message || 'Kirim muvaffaqiyatli bajarildi!');
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Kirim qilishda xatolik yuz berdi!');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (dto: {
      fromWarehouseId: string;
      toWarehouseId: string;
      itemId: string;
      quantity: number;
      note?: string;
    }) => {
      const res = await apiClient.post(API_ENDPOINTS.WAREHOUSE.TRANSFER, dto);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`Omborlararo ko‘chirish muvaffaqiyatli bajarildi (${data.movementNumber})!`);
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Omborlararo ko‘chirishda xatolik yuz berdi!');
    },
  });

  const rawStocks = stocksQuery.data;
  const stocks: StockItem[] = Array.isArray(rawStocks) ? rawStocks : (rawStocks?.data || []);
  const total: number = Array.isArray(rawStocks) ? rawStocks.length : (rawStocks?.total ?? stocks.length);

  return {
    stocks,
    total,
    isLoading: stocksQuery.isLoading,
    isFetching: stocksQuery.isFetching,
    isError: stocksQuery.isError,
    error: stocksQuery.error,
    refetch: stocksQuery.refetch,
    replenishStock: replenishMutation.mutateAsync,
    isReplenishing: replenishMutation.isPending,
    ingestStock: ingestMutation.mutateAsync,
    isIngesting: ingestMutation.isPending,
    transferStock: transferMutation.mutateAsync,
    isTransferring: transferMutation.isPending,
  };
}

export interface WarehouseItem {
  id: string;
  name: string;
  code?: string | null;
  buildingId?: string | null;
  building?: {
    id: string;
    name: string;
    code?: string | null;
    floorsCount?: number;
  } | null;
  location?: string | null;
  managerId?: string | null;
  manager?: {
    id: string;
    fullName: string;
    username?: string;
    phone?: string | null;
    role?: string;
  } | null;
  isMain: boolean;
  _count?: {
    stocks: number;
  };
  deletedAt?: string | null;
}

export function useWarehousesQuery(showDeleted?: boolean) {
  const warehousesQuery = useQuery({
    queryKey: ['warehouses', showDeleted],
    queryFn: async () => {
      const res = await apiClient.get<WarehouseItem[]>(API_ENDPOINTS.WAREHOUSE.LIST, {
        params: { showDeleted },
      });
      return res.data;
    },
  });

  return {
    warehouses: warehousesQuery.data || [],
    isLoading: warehousesQuery.isLoading,
    refetch: warehousesQuery.refetch,
  };
}

export function useCreateWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      code?: string;
      buildingId?: string;
      location?: string;
      managerId?: string;
      isMain?: boolean;
    }) => {
      const res = await apiClient.post(API_ENDPOINTS.WAREHOUSE.CREATE, data);
      return res.data;
    },
    onSuccess: (wh) => {
      Message.success(`'${wh.name}' omborxonasi muvaffaqiyatli yaratildi!`);
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Omborxona yaratishda xatolik yuz berdi!');
    },
  });
}

export function useUpdateWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        code?: string;
        buildingId?: string;
        location?: string;
        managerId?: string;
        isMain?: boolean;
      };
    }) => {
      const res = await apiClient.put(API_ENDPOINTS.WAREHOUSE.UPDATE(id), data);
      return res.data;
    },
    onSuccess: (wh) => {
      Message.success(`'${wh.name}' omborxonasi muvaffaqiyatli yangilandi!`);
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Omborxonani yangilashda xatolik yuz berdi!');
    },
  });
}

export function useDeleteWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(API_ENDPOINTS.WAREHOUSE.DELETE(id));
      return res.data;
    },
    onSuccess: (res) => {
      Message.success(res.message || 'Omborxona muvaffaqiyatli o‘chirildi!');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Omborxonani o‘chirishda xatolik yuz berdi!');
    },
  });
}

export function useRestoreWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(API_ENDPOINTS.WAREHOUSE.RESTORE(id));
      return res.data;
    },
    onSuccess: () => {
      Message.success('Omborxona muvaffaqiyatli qayta tiklandi!');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Omborni tiklashda xatolik yuz berdi!');
    },
  });
}


export function useMovementsQuery(params?: { search?: string; type?: string; fundingSource?: string; page?: number; limit?: number }) {
  const movementsQuery = useQuery({
    queryKey: ['movements', params],
    queryFn: async () => {
      const res = await apiClient.get<any>(API_ENDPOINTS.WAREHOUSE.MOVEMENTS, { params });
      return res.data;
    },
  });

  const rawMovements = movementsQuery.data;
  const movements = Array.isArray(rawMovements) ? rawMovements : (rawMovements?.data || []);
  const total = Array.isArray(rawMovements) ? rawMovements.length : (rawMovements?.total ?? movements.length);

  return {
    movements,
    total,
    isLoading: movementsQuery.isLoading,
    isFetching: movementsQuery.isFetching,
    isError: movementsQuery.isError,
    refetch: movementsQuery.refetch,
  };
}

export function useLowStockQuery() {
  const query = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const res = await apiClient.get<LowStockItem[]>(API_ENDPOINTS.WAREHOUSE.LOW_STOCK);
      return res.data;
    },
    refetchInterval: 60000,
  });

  return {
    lowStockItems: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

