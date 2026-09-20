import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export type FundingSourceType = 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';

export interface FundingSummaryParams {
  from?: string;
  to?: string;
  departmentId?: string;
  fundingSource?: FundingSourceType;
}

export interface FundingSourceBreakdown {
  source: FundingSourceType;
  label: string;
  assetsCount: number;
  purchaseValue: number;
  totalValue: number;
  movementsCount: number;
  percentage: number;
}

export interface FundingCategoryStat {
  categoryName: string;
  count: number;
  totalValue: number;
  byudjetCount: number;
  kontraktCount: number;
  grantCount: number;
}

export interface FundingDepartmentStat {
  departmentId: string;
  departmentName: string;
  assetsCount: number;
  totalValue: number;
  byudjetCount: number;
  kontraktCount: number;
  grantCount: number;
}

export interface FundingSummaryResponse {
  totals: {
    totalAssetsCount: number;
    totalPurchaseValue: number;
    totalCurrentBookValue: number;
    totalMovementsCount: number;
  };
  byFundingSource: FundingSourceBreakdown[];
  byCategory: FundingCategoryStat[];
  byDepartment: FundingDepartmentStat[];
}

export interface FundingMovementsParams {
  from?: string;
  to?: string;
  departmentId?: string;
  fundingSource?: FundingSourceType;
  movementType?: string;
  page?: number;
  limit?: number;
}

export interface MovementItemDto {
  id: string;
  movementNumber: string;
  movementType: string;
  fundingSource: FundingSourceType;
  referenceDoc?: string | null;
  note?: string | null;
  createdAt: string;
  executedBy?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
  fromRoom?: {
    id: string;
    number: string;
    name: string;
    department?: { id: string; name: string } | null;
  } | null;
  toRoom?: {
    id: string;
    number: string;
    name: string;
    department?: { id: string; name: string } | null;
  } | null;
  fromWarehouse?: { id: string; name: string } | null;
  toWarehouse?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    note?: string | null;
    item?: {
      id: string;
      name: string;
      unit: string;
      category?: { id: string; name: string } | null;
    } | null;
  }>;
}

export interface FundingMovementsResponse {
  items: MovementItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FundingExportParams {
  from?: string;
  to?: string;
  departmentId?: string;
  fundingSource?: FundingSourceType;
  type?: 'assets' | 'movements' | 'summary';
  format?: 'xlsx' | 'csv';
}

export const useFundingSummaryQuery = (params: FundingSummaryParams) => {
  return useQuery<FundingSummaryResponse>({
    queryKey: ['reports', 'funding-summary', params],
    queryFn: async () => {
      const res = await apiClient.get(API_ENDPOINTS.REPORTS.FUNDING_SUMMARY, {
        params,
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
};

export const useFundingMovementsQuery = (params: FundingMovementsParams) => {
  return useQuery<FundingMovementsResponse>({
    queryKey: ['reports', 'funding-movements', params],
    queryFn: async () => {
      const res = await apiClient.get(API_ENDPOINTS.REPORTS.FUNDING_MOVEMENTS, {
        params,
      });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
};

export const useExportFundingReportMutation = () => {
  return useMutation({
    mutationFn: async (params: FundingExportParams) => {
      const format = params.format || 'xlsx';
      const type = params.type || 'assets';
      const response = await apiClient.get(API_ENDPOINTS.REPORTS.FUNDING_EXPORT, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type:
          format === 'csv'
            ? 'text/csv;charset=utf-8;'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `UWMS_Funding_${type}_${timestamp}.${format}`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return filename;
    },
    onSuccess: (filename) => {
      Message.success(`Hisobot muvaffaqiyatli yuklab olindi: ${filename}`);
    },
    onError: (err: any) => {
      Message.error(
        err?.response?.data?.message || 'Hisobotni yuklab olishda xatolik yuz berdi!',
      );
    },
  });
};
