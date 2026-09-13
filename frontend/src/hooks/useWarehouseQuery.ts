import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import type { StockItem } from '../types';
import { Message } from '@arco-design/web-react';

export function useWarehouseQuery(params?: { search?: string; categoryId?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();

  const stocksQuery = useQuery({
    queryKey: ['stocks', params],
    queryFn: async () => {
      const res = await apiClient.get<any>(API_ENDPOINTS.WAREHOUSE.STOCKS, { params });
      return res.data;
    },
  });

  const replenishMutation = useMutation({
    mutationFn: async ({ stockId, amount }: { stockId: string; amount: number }) => {
      const res = await apiClient.post(API_ENDPOINTS.WAREHOUSE.REPLENISH(stockId), { amount });
      return res.data;
    },
    onSuccess: () => {
      Message.success('Ombor zaxirasi muvaffaqiyatli to‘ldirildi va kirim qayd etildi!');
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
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
      const res = await apiClient.post(API_ENDPOINTS.WAREHOUSE.INGEST, dto);
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

export function useWarehousesQuery() {
  const warehousesQuery = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>(API_ENDPOINTS.WAREHOUSE.WAREHOUSES);
      return res.data;
    },
  });

  return {
    warehouses: warehousesQuery.data || [],
    isLoading: warehousesQuery.isLoading,
    refetch: warehousesQuery.refetch,
  };
}


export function useMovementsQuery(params?: { search?: string; type?: string; page?: number; limit?: number }) {
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

