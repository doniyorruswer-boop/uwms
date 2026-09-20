import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export type FundingSourceType = 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';

export interface ChiefAccountantReceiptItem {
  id: string;
  requestNumber: string;
  os1DocNumber: string;
  receiptDate: string;
  purpose: string;
  fundingSource: FundingSourceType;
  subAccountCode: string;
  allocatedAmount: number;
  supplierName: string;
  departmentName: string;
  requesterName: string;
  itemsCount: number;
  items: Array<{ name: string; quantity: number; unit: string }>;
  hasStamp: boolean;
  stampHash: string | null;
  signedByName: string;
}

export interface ChiefAccountantReceiptsSummary {
  totalReceiptsCount: number;
  totalReceiptsAmount: number;
  totalItemsCount: number;
  byFundingSource: Record<string, { count: number; amount: number }>;
  bySubAccount: Record<string, { count: number; amount: number }>;
}

export interface ChiefAccountantReceiptsResponse {
  period?: string;
  fundingSource?: string;
  subAccountCode?: string;
  summary: ChiefAccountantReceiptsSummary;
  data: ChiefAccountantReceiptItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ChiefAccountantReceiptsParams {
  period?: string;
  fundingSource?: FundingSourceType;
  subAccountCode?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ChiefAccountantMolBalanceItem {
  molId: string;
  molFullName: string;
  molUsername: string;
  departmentName: string;
  roomsCount: number;
  fixedAssetsCount: number;
  fixedAssetsTotalValue: number;
  consumablesCount: number;
  lastOs2DocNumber: string | null;
  lastOs2Date: string | null;
}

export interface ChiefAccountantHandoverSummary {
  totalMolsCount: number;
  totalAssignedValue: number;
  totalFixedAssetsCount: number;
  totalConsumablesCount: number;
}

export interface ChiefAccountantHandoverResponse {
  summary: ChiefAccountantHandoverSummary;
  data: ChiefAccountantMolBalanceItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ChiefAccountantHandoverParams {
  search?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export interface ChiefAccountantMolDetailsResponse {
  mol: {
    id: string;
    fullName: string;
    username: string;
    department: string;
    role: string;
  };
  totalAssetsCount: number;
  totalValue: number;
  items: Array<{
    id: string;
    inventoryNumber: string;
    serialNumber: string | null;
    name: string;
    category: string;
    status: string;
    purchasePrice: number;
    subAccountCode: string;
    roomName: string;
    roomNumber: string;
    commissioningDate: string | null;
  }>;
}

export type StateExportFormat = 'EXCEL_3SHEET' | 'UZASBO_XML' | '1C_ENTERPRISE_XML';

export interface StateExportParams {
  format: StateExportFormat;
  period?: string;
  fundingSource?: FundingSourceType;
}

/**
 * 1. Kirim Izi: OS-1 Reestri
 */
export const useChiefAccountantReceipts = (params?: ChiefAccountantReceiptsParams) => {
  return useQuery<ChiefAccountantReceiptsResponse>({
    queryKey: ['chief-accountant-receipts', params],
    queryFn: async () => {
      const response = await apiClient.get<ChiefAccountantReceiptsResponse>(
        API_ENDPOINTS.REPORTS.CHIEF_ACCOUNTANT_RECEIPTS,
        { params },
      );
      return response.data;
    },
    staleTime: 60 * 1000,
  });
};

/**
 * 2. Chiqim Izi & MOL Aylanma Balansi: OS-2 Reestri
 */
export const useChiefAccountantHandoverBalance = (params?: ChiefAccountantHandoverParams) => {
  return useQuery<ChiefAccountantHandoverResponse>({
    queryKey: ['chief-accountant-handover-balance', params],
    queryFn: async () => {
      const response = await apiClient.get<ChiefAccountantHandoverResponse>(
        API_ENDPOINTS.REPORTS.CHIEF_ACCOUNTANT_HANDOVER_BALANCE,
        { params },
      );
      return response.data;
    },
    staleTime: 60 * 1000,
  });
};

/**
 * MOL bo'yicha 1 soniyalik drill-down aktivlar ro'yxati
 */
export const useChiefAccountantMolDetails = (userId?: string) => {
  return useQuery<ChiefAccountantMolDetailsResponse>({
    queryKey: ['chief-accountant-mol-details', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID kiritilishi shart');
      const response = await apiClient.get<ChiefAccountantMolDetailsResponse>(
        API_ENDPOINTS.REPORTS.CHIEF_ACCOUNTANT_MOL_DETAILS(userId),
      );
      return response.data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
};

/**
 * 3. Bitta Tugmali Davlat Eksport Markazi (Excel, UzASBO XML, 1C OTM)
 */
export const useChiefAccountantExport = () => {
  return useMutation({
    mutationFn: async (params: StateExportParams) => {
      const response = await apiClient.get(API_ENDPOINTS.REPORTS.CHIEF_ACCOUNTANT_EXPORT, {
        params,
        responseType: 'blob',
      });

      const dateStr = params.period || new Date().toISOString().slice(0, 7);
      let filename = `Davlat_Hisoboti_${dateStr}.xlsx`;
      let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (params.format === 'EXCEL_3SHEET') {
        filename = `Davlat_Hisoboti_3Sheet_OS1_OS2_MOL_${dateStr}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (params.format === 'UZASBO_XML') {
        filename = `UzASBO_Kirim_OS1_OS2_${dateStr}.xml`;
        mimeType = 'application/xml';
      } else if (params.format === '1C_ENTERPRISE_XML') {
        filename = `1C_OTM_Kirim_OS1_OS2_${dateStr}.xml`;
        mimeType = 'application/xml';
      }

      const blob = new Blob([response.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return { filename, success: true };
    },
    onSuccess: (res) => {
      Message.success(`${res.filename} muvaffaqiyatli yuklab olindi`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Eksportda xatolik yuz berdi';
      Message.error(`Eksport xatosi: ${msg}`);
    },
  });
};
