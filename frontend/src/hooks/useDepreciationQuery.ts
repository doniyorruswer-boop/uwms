import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export interface DepreciationRunItem {
  id: string;
  batchNumber: string;
  period: string;
  totalAssetsCount: number;
  totalDepreciationAmount: number;
  totalBookValue: number;
  status: string;
  notes?: string;
  executedByName: string;
  executedByRole: string;
  createdAt: string;
}

export interface DepreciationRunsResponse {
  data: DepreciationRunItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DepreciationPreviewItem {
  assetId: string;
  inventoryNumber: string;
  itemName: string;
  categoryName: string;
  fundingSource: string;
  initialCost: number;
  openingBookValue: number;
  monthlyDepreciation: number;
  closingBookValue: number;
  accumulatedTotal: number;
  annualRate: number;
  isFullyDepreciated: boolean;
  isAlreadyDepreciatedInPeriod: boolean;
}

export interface DepreciationPreviewResponse {
  period: string;
  totalAssetsCount: number;
  alreadyDepreciatedCount: number;
  newlyEligibleCount: number;
  fullyDepreciatedCount: number;
  totalInitialCost: number;
  totalProjectedDepreciation: number;
  totalProjectedBookValue: number;
  items: DepreciationPreviewItem[];
}

export interface AssetDepreciationHistoryResponse {
  asset: {
    id: string;
    inventoryNumber: string;
    itemName: string;
    categoryName: string;
    purchasePrice: number;
    currentBookValue: number;
    accumulatedDepreciation: number;
    depreciationRate: number;
    lastDepreciatedAt?: string;
  };
  history: Array<{
    id: string;
    period: string;
    batchNumber: string;
    initialCost: number;
    openingBookValue: number;
    depreciationAmount: number;
    closingBookValue: number;
    accumulatedTotal: number;
    calculatedAt: string;
  }>;
}

export interface DepreciationStatementResponse {
  period: string;
  documentName: string;
  standardRef: string;
  generatedDate: string;
  totals: {
    totalAssets: number;
    initialCost: number;
    openingBookValue: number;
    monthlyDepreciation: number;
    closingBookValue: number;
    accumulatedDepreciation: number;
  };
  categorySummary: Array<{
    categoryName: string;
    annualRate: number;
    count: number;
    initialCost: number;
    openingBookValue: number;
    depreciationAmount: number;
    closingBookValue: number;
    accumulatedTotal: number;
  }>;
  fundingSummary: Array<{
    fundingSource: string;
    count: number;
    initialCost: number;
    depreciationAmount: number;
    closingBookValue: number;
  }>;
}

export function useDepreciationRunsQuery(params?: {
  period?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery<DepreciationRunsResponse>({
    queryKey: ['depreciation-runs', params],
    queryFn: async () => {
      const res = await apiClient.get<DepreciationRunsResponse>(API_ENDPOINTS.DEPRECIATION.RUNS, {
        params,
      });
      return res.data;
    },
  });
}

export function useDepreciationRunDetailsQuery(id: string | null) {
  return useQuery({
    queryKey: ['depreciation-run', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get(API_ENDPOINTS.DEPRECIATION.RUN_BY_ID(id));
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useDepreciationPreviewQuery(
  params: { period: string; categoryIds?: string[] },
  enabled = true,
) {
  return useQuery<DepreciationPreviewResponse>({
    queryKey: ['depreciation-preview', params.period, params.categoryIds],
    queryFn: async () => {
      const res = await apiClient.get<DepreciationPreviewResponse>(
        API_ENDPOINTS.DEPRECIATION.PREVIEW,
        {
          params,
        },
      );
      return res.data;
    },
    enabled: Boolean(params.period) && enabled,
  });
}

export interface RunDepreciationResponse {
  success: boolean;
  message: string;
  run: {
    id: string;
    batchNumber: string;
    period: string;
    totalAssetsCount: number;
    totalDepreciationAmount: number;
    totalBookValue: number;
    status: string;
    createdAt?: string;
  };
}

export function useRunDepreciationMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    RunDepreciationResponse,
    any,
    {
      period: string;
      categoryIds?: string[];
      notes?: string;
    }
  >({
    mutationFn: async (dto) => {
      const res = await apiClient.post<RunDepreciationResponse>(API_ENDPOINTS.DEPRECIATION.RUN, dto);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(data?.message || 'Amortizatsiya hisobi muvaffaqiyatli yakunlandi!');
      queryClient.invalidateQueries({ queryKey: ['depreciation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-run'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-preview'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-statement'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
    onError: (err: any) => {
      Message.error(
        err.response?.data?.message || 'Amortizatsiyani hisoblashda xatolik yuz berdi!',
      );
    },
  });
}

export function useAssetDepreciationHistoryQuery(assetId: string | null) {
  return useQuery<AssetDepreciationHistoryResponse>({
    queryKey: ['asset-depreciation-history', assetId],
    queryFn: async () => {
      if (!assetId) return null as any;
      const res = await apiClient.get<AssetDepreciationHistoryResponse>(
        API_ENDPOINTS.DEPRECIATION.ASSET_HISTORY(assetId),
      );
      return res.data;
    },
    enabled: Boolean(assetId),
  });
}

export function useDepreciationStatementQuery(period: string, enabled = true) {
  return useQuery<DepreciationStatementResponse>({
    queryKey: ['depreciation-statement', period],
    queryFn: async () => {
      const res = await apiClient.get<DepreciationStatementResponse>(
        API_ENDPOINTS.DEPRECIATION.STATEMENT(period),
      );
      return res.data;
    },
    enabled: Boolean(period) && enabled,
  });
}
