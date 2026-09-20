import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export type CampaignStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AuditCampaignScope {
  id: string;
  roomId: string;
  room: {
    id: string;
    number: string;
    name: string;
    building?: string;
    department?: {
      name: string;
    };
    responsibleUser?: {
      id: string;
      fullName: string;
      phone?: string;
    };
  };
}

export interface AuditCampaignItem {
  id: string;
  campaignNumber: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: CampaignStatus;
  notes?: string;
  orderNumber?: string;
  orderDate?: string;
  assignedAuditorId?: string;
  assignedAuditor?: {
    id: string;
    fullName: string;
    username?: string;
  };
  approvedById?: string;
  approvedBy?: {
    id: string;
    fullName: string;
    username?: string;
  };
  approvedAt?: string;
  signatureHash?: string;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  };
  totalRooms: number;
  completedRooms: number;
  progressPercent: number;
  matchedCount: number;
  missingCount: number;
  relocatedCount: number;
  scopes?: AuditCampaignScope[];
  hasWormStamp?: boolean;
  stamp?: {
    id: string;
    docNumber: string;
    docType: string;
    signerName: string;
    signerRole?: string;
    isValid: boolean;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomProgressItem {
  roomId: string;
  roomNumber: string;
  roomName: string;
  building?: string;
  departmentName: string;
  responsibleMOL: string;
  responsiblePhone: string;
  expectedCount: number;
  matchedCount: number;
  missingCount: number;
  relocatedCount: number;
  totalScanned: number;
  auditStatus: string;
  auditId?: string | null;
  isCompleted: boolean;
}

export interface CampaignProgressData {
  campaignId: string;
  campaignNumber: string;
  title: string;
  status: CampaignStatus;
  totals: {
    totalRooms: number;
    completedRooms: number;
    totalExpected: number;
    totalMatched: number;
    totalMissing: number;
    totalRelocated: number;
    progressPercent: number;
  };
  rooms: RoomProgressItem[];
}

export interface MissingReportItem {
  id: string;
  inventoryNumber: string;
  serialNumber: string;
  name: string;
  model: string;
  purchasePrice: number;
  expectedRoomNumber: string;
  expectedRoomName: string;
  responsibleMOL?: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
  } | null;
  scannedAt: string;
  notes: string;
}

export interface CampaignMissingReportData {
  campaignId: string;
  campaignNumber: string;
  title: string;
  totalMissingCount: number;
  totalMissingValue: number;
  items: MissingReportItem[];
}

export function useAuditCampaignsQuery(search?: string, status?: CampaignStatus) {
  return useQuery({
    queryKey: ['audit-campaigns', search, status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await apiClient.get<AuditCampaignItem[]>(API_ENDPOINTS.AUDITS.CAMPAIGNS.BASE, {
        params,
      });
      return res.data;
    },
  });
}

export function useAuditCampaignDetailQuery(id: string | null) {
  return useQuery({
    queryKey: ['audit-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<AuditCampaignItem>(API_ENDPOINTS.AUDITS.CAMPAIGNS.BY_ID(id));
      return res.data;
    },
    enabled: !!id,
  });
}

export function useAuditCampaignProgressQuery(id: string | null) {
  return useQuery({
    queryKey: ['audit-campaign-progress', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<CampaignProgressData>(API_ENDPOINTS.AUDITS.CAMPAIGNS.PROGRESS(id));
      return res.data;
    },
    enabled: !!id,
  });
}

export function useAuditCampaignMissingReportQuery(id: string | null) {
  return useQuery({
    queryKey: ['audit-campaign-missing', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<CampaignMissingReportData>(
        API_ENDPOINTS.AUDITS.CAMPAIGNS.MISSING_REPORT(id),
      );
      return res.data;
    },
    enabled: !!id,
  });
}

export interface CreateCampaignPayload {
  title: string;
  periodStart: string;
  periodEnd: string;
  roomIds: string[];
  notes?: string;
  orderNumber?: string;
  orderDate?: string;
  assignedAuditorId?: string;
}

export function useCreateCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCampaignPayload) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.CAMPAIGNS.BASE, dto);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`"${data.title}" inventarizatsiya kampaniyasi muvaffaqiyatli rejalashtirildi!`);
      queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Kampaniya yaratishda xatolik yuz berdi!');
    },
  });
}

export interface StartCampaignParams {
  id: string;
  signatureHash?: string;
  signerName?: string;
  signerRole?: string;
  notes?: string;
}

export function useStartCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: StartCampaignParams) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.CAMPAIGNS.START(id), dto);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`"${data.title || 'Kampaniya'}" Rektor farmoyishi bilan rasman tasdiqlandi va boshlandi!`);
      queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaign-progress'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Kampaniyani boshlashda xatolik!');
    },
  });
}

export interface CompleteCampaignParams {
  id: string;
  notes?: string;
  signerName?: string;
  signerRole?: string;
  signatureHash?: string;
  committeeMembers?: string[];
}

export function useCompleteCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: CompleteCampaignParams) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.CAMPAIGNS.COMPLETE(id), dto);
      return res.data;
    },
    onSuccess: () => {
      Message.success('Inventarizatsiya kampaniyasi tekshiruvchi imzosi bilan muvaffaqiyatli yakunlandi va rasmiy INV-19 muhrlandi!');
      queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaign-progress'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaign-missing'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Kampaniyani yakunlashda xatolik!');
    },
  });
}

export async function downloadCampaignExcel(id: string, campaignNumber?: string) {
  try {
    Message.info('Rasmiy INV-19 Excel hisoboti shakllanmoqda...');
    const response = await apiClient.get(API_ENDPOINTS.AUDITS.CAMPAIGNS.EXPORT_EXCEL(id), {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UWMS_INV19_${campaignNumber || id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    Message.success('INV-19 Excel hisoboti muvaffaqiyatli yuklab olindi!');
  } catch (err: any) {
    Message.error(err?.response?.data?.message || 'Excel hisobotini yuklab olishda xatolik yuz berdi!');
  }
}


export function useCancelCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.CAMPAIGNS.CANCEL(id), { reason });
      return res.data;
    },
    onSuccess: () => {
      Message.warning('Inventarizatsiya kampaniyasi bekor qilindi!');
      queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaign'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Kampaniyani bekor qilishda xatolik!');
    },
  });
}
