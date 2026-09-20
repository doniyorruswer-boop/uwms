import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export function useAuditsQuery() {
  const auditsQuery = useQuery({
    queryKey: ['audits'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>(API_ENDPOINTS.AUDITS.BASE);
      return res.data;
    },
  });

  const startAuditMutation = useMutation({
    mutationFn: async ({ roomId, campaignId }: { roomId: string; campaignId?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.START, { roomId, campaignId });
      return res.data;
    },
    onSuccess: () => {
      Message.success('Xona inventarizatsiyasi boshlandi!');
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Auditni boshlashda xatolik yuz berdi!');
    },
  });

  const scanCodeMutation = useMutation({
    mutationFn: async ({ roomId, qrCode, campaignId }: { roomId: string; qrCode: string; campaignId?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.SCAN, { roomId, qrCode, campaignId });
      return res.data;
    },
  });

  const batchScanMutation = useMutation({
    mutationFn: async (items: Array<{ roomId: string; qrCode: string; campaignId?: string }>) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.BATCH_SCAN, { items });
      return res.data;
    },
  });

  const completeAuditMutation = useMutation({
    mutationFn: async ({ auditId, notes }: { auditId: string; notes?: string }) => {
      const res = await apiClient.post(API_ENDPOINTS.AUDITS.COMPLETE(auditId), { notes });
      return res.data;
    },
    onSuccess: () => {
      Message.success('Inventarizatsiya yakunlandi va INV-19 rasmiylashtirildi!');
      auditsQuery.refetch();
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Auditni yakunlashda xatolik yuz berdi!');
    },
  });

  return {
    audits: auditsQuery.data || [],
    isLoadingAudits: auditsQuery.isLoading,
    refetchAudits: auditsQuery.refetch,
    startAudit: startAuditMutation.mutateAsync,
    scanCode: scanCodeMutation.mutateAsync,
    isScanning: scanCodeMutation.isPending,
    batchScan: batchScanMutation.mutateAsync,
    isBatchScanning: batchScanMutation.isPending,
    completeAudit: completeAuditMutation.mutateAsync,
    isCompleting: completeAuditMutation.isPending,
  };
}

export function useAuditDetailQuery(auditId?: string | null) {
  return useQuery({
    queryKey: ['audit-detail', auditId],
    queryFn: async () => {
      if (!auditId) return null;
      const res = await apiClient.get<any>(API_ENDPOINTS.AUDITS.BY_ID(auditId));
      return res.data;
    },
    enabled: !!auditId,
  });
}
