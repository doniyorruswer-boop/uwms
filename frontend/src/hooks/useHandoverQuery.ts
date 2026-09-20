import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';
import type {
  ResponsibilityHandover,
  PaginatedHandoversResponse,
  CreateResponsibilityHandoverPayload,
  SignHandoverPayload,
  RejectHandoverPayload,
  UserClearanceStatus,
  ClearanceCertificate,
  HandoverType,
  HandoverStatus,
} from '../types';

export interface QueryHandoversParams {
  page?: number;
  pageSize?: number;
  type?: HandoverType;
  status?: HandoverStatus;
  departingUserId?: string;
  targetUserId?: string;
  buildingId?: string;
  search?: string;
}

export interface InitiateSigningPayload {
  handoverId: string;
  signatoryRole: 'DEPARTING' | 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT';
}

export interface HandoverSigningSessionResponse {
  sessionId: string;
  sessionToken: string;
  qrPayloadUrl: string;
  expiresAt: string;
  remainingSeconds: number;
  expectedSignerRole: string;
  expectedSignerName: string;
  handoverNumber: string;
}

export interface HandoverDocumentResponse {
  handoverId: string;
  handoverNumber: string;
  documentHash: string;
  qrPayloadUrl: string;
  pdfUrl?: string | null;
  contentHtml: string;
  isFullySigned: boolean;
  signatories: Array<{
    role: string;
    label: string;
    userId: string;
    fullName: string;
    signed: boolean;
    signedAt?: string | null;
    signatureType?: string | null;
  }>;
}

/**
 * Moddiy topshirish arizalari ro‘yxatini olish (Filtr va sahifalash bilan)
 */
export function useHandoversQuery(params: QueryHandoversParams = {}, options?: { enabled?: boolean }) {
  return useQuery<PaginatedHandoversResponse>({
    queryKey: ['handovers', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedHandoversResponse>(API_ENDPOINTS.HANDOVERS.BASE, {
        params,
      });
      return res.data;
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Bitta moddiy topshirish dalolatnomasining to‘liq tafsilotlarini olish
 */
export function useHandoverDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<ResponsibilityHandover>({
    queryKey: ['handover-detail', id],
    queryFn: async () => {
      const res = await apiClient.get<ResponsibilityHandover>(API_ENDPOINTS.HANDOVERS.BY_ID(id));
      return res.data;
    },
    enabled: !!id && (options?.enabled ?? true),
  });
}

/**
 * Xodimning moddiy javobgarlikdan ozod qilinish (Clearance) holatini tekshirish
 */
export function useUserClearanceStatusQuery(userId: string, enabled = true) {
  return useQuery<UserClearanceStatus>({
    queryKey: ['user-clearance-status', userId],
    queryFn: async () => {
      const res = await apiClient.get<UserClearanceStatus>(API_ENDPOINTS.USERS.CLEARANCE_STATUS(userId));
      return res.data;
    },
    enabled: !!userId && enabled,
  });
}

/**
 * Yangi moddiy topshirish arizasini yaratish
 */
export function useCreateHandoverMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateResponsibilityHandoverPayload) => {
      const res = await apiClient.post<ResponsibilityHandover>(API_ENDPOINTS.HANDOVERS.BASE, payload);
      return res.data;
    },
    onSuccess: (handover) => {
      Message.success(`'${handover.handoverNumber}' moddiy topshirish arizasi muvaffaqiyatli rasmiylashtirildi!`);
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      queryClient.invalidateQueries({ queryKey: ['user-clearance-status', handover.departingUserId] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Topshirish arizasini yaratishda xatolik yuz berdi');
    },
  });
}

/**
 * Dalolatnoma uchun dinamik 60s mobil QR imzolash sessiyasini ochish
 */
export function useInitiateHandoverSigningMutation() {
  return useMutation({
    mutationFn: async ({ handoverId, signatoryRole }: InitiateSigningPayload) => {
      const res = await apiClient.post<HandoverSigningSessionResponse>(
        API_ENDPOINTS.HANDOVERS.INITIATE_SIGNING(handoverId),
        { signatoryRole }
      );
      return res.data;
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Imzolash sessiyasini ochishda xatolik yuz berdi');
    },
  });
}

/**
 * Dalolatnomani to‘g‘ridan-to‘g‘ri tasdiqlash / imzolash
 */
export function useSignHandoverMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: SignHandoverPayload }) => {
      const res = await apiClient.post<ResponsibilityHandover>(API_ENDPOINTS.HANDOVERS.SIGN(id), payload);
      return res.data;
    },
    onSuccess: (handover) => {
      Message.success(`'${handover.handoverNumber}' dalolatnomasi muvaffaqiyatli imzolandi!`);
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      queryClient.invalidateQueries({ queryKey: ['handover-detail', handover.id] });
      queryClient.invalidateQueries({ queryKey: ['handover-document', handover.id] });
      queryClient.invalidateQueries({ queryKey: ['user-clearance-status', handover.departingUserId] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Dalolatnomani imzolashda xatolik yuz berdi');
    },
  });
}

/**
 * Dalolatnomani rad etish
 */
export function useRejectHandoverMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RejectHandoverPayload }) => {
      const res = await apiClient.post<ResponsibilityHandover>(API_ENDPOINTS.HANDOVERS.REJECT(id), payload);
      return res.data;
    },
    onSuccess: (handover) => {
      Message.warning(`'${handover.handoverNumber}' dalolatnomasi rad etildi`);
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      queryClient.invalidateQueries({ queryKey: ['handover-detail', handover.id] });
      queryClient.invalidateQueries({ queryKey: ['user-clearance-status', handover.departingUserId] });
    },
    onError: (err: any) => {
      Message.error(err?.response?.data?.message || 'Dalolatnomani rad etishda xatolik yuz berdi');
    },
  });
}

/**
 * Dalolatnomaning rasmiy OS-1 elektron hujjatini olish
 */
export function useHandoverDocumentQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<HandoverDocumentResponse>({
    queryKey: ['handover-document', id],
    queryFn: async () => {
      const res = await apiClient.get<HandoverDocumentResponse>(API_ENDPOINTS.HANDOVERS.DOCUMENT(id));
      return res.data;
    },
    enabled: !!id && (options?.enabled ?? true),
  });
}

/**
 * Xodimning rasmiy elektron Aylanma Varaqasini (Clearance Certificate) olish
 */
export function useClearanceCertificateQuery(userId: string, options?: { enabled?: boolean }) {
  return useQuery<ClearanceCertificate>({
    queryKey: ['clearance-certificate', userId],
    queryFn: async () => {
      const res = await apiClient.get<ClearanceCertificate>(
        API_ENDPOINTS.REPORTS.CLEARANCE_CERTIFICATE(userId)
      );
      return res.data;
    },
    enabled: !!userId && (options?.enabled ?? true),
  });
}

