import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants/api.constants';
import { Message } from '@arco-design/web-react';

export interface TwoFactorStatusResponse {
  enabled: boolean;
  recoveryCodesCount: number;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUri: string;
  recoveryCodes: string[];
}

export function useTwoFactorStatusQuery() {
  return useQuery({
    queryKey: ['two-factor-status'],
    queryFn: async (): Promise<TwoFactorStatusResponse> => {
      const res = await apiClient.get<TwoFactorStatusResponse>(
        API_ENDPOINTS.AUTH.TWO_FACTOR_STATUS,
      );
      return res.data;
    },
    staleTime: 30000,
  });
}

export function useSetupTwoFactorMutation() {
  return useMutation({
    mutationFn: async (): Promise<TwoFactorSetupResponse> => {
      const res = await apiClient.post<TwoFactorSetupResponse>(
        API_ENDPOINTS.AUTH.TWO_FACTOR_SETUP,
      );
      return res.data;
    },
    onError: (err: any) => {
      Message.error(
        err.response?.data?.message ||
          'Google Authenticator sozlamasini olishda xatolik yuz berdi!',
      );
    },
  });
}

export function useEnableTwoFactorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { secret: string; code: string }) => {
      const res = await apiClient.post(
        API_ENDPOINTS.AUTH.TWO_FACTOR_ENABLE,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      Message.success('Google Authenticator (2FA) muvaffaqiyatli yoqildi!');
      queryClient.invalidateQueries({ queryKey: ['two-factor-status'] });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err: any) => {
      Message.error(
        err.response?.data?.message ||
          'Google Authenticator kodini tasdiqlashda xatolik yuz berdi!',
      );
    },
  });
}

export function useDisableTwoFactorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { password?: string; code?: string }) => {
      const res = await apiClient.post(
        API_ENDPOINTS.AUTH.TWO_FACTOR_DISABLE,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      Message.success('Google Authenticator (2FA) himoyasi o‘chirildi!');
      queryClient.invalidateQueries({ queryKey: ['two-factor-status'] });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err: any) => {
      Message.error(
        err.response?.data?.message ||
          '2FA himoyasini o‘chirishda xatolik yuz berdi!',
      );
    },
  });
}
