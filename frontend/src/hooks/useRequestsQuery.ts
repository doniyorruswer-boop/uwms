import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import type { RequestRecord, RequestStatus } from '../types';
import { Message } from '@arco-design/web-react';

export function useRequestsQuery() {
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const res = await apiClient.get<RequestRecord[]>(API_ENDPOINTS.REQUESTS.BASE);
      return res.data;
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: {
      purpose: string;
      items: { itemId?: string; itemName: string; quantity: number; unit?: string }[];
    }) => {
      const res = await apiClient.post(API_ENDPOINTS.REQUESTS.BASE, data);
      return res.data;
    },
    onSuccess: () => {
      Message.success('Talabnoma muvaffaqiyatli yuborildi!');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Talabnomani yuborishda xatolik yuz berdi!');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: RequestStatus;
      note?: string;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      const res = await apiClient.patch(
        API_ENDPOINTS.REQUESTS.STATUS(id),
        { status, note },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'FULFILLED') {
        Message.success('Talabnoma qondirildi va ombor qoldig‘idan yechildi!');
        queryClient.invalidateQueries({ queryKey: ['stocks'] });
      } else {
        Message.success('Talabnoma holati yangilandi!');
      }
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Holatni yangilashda xatolik yuz berdi!');
    },
  });

  const advanceWorkflowMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      note,
      fundingSource,
      subAccountCode,
      allocatedAmount,
      commendantId,
      targetRoomId,
    }: {
      id: string;
      status: RequestStatus;
      note?: string;
      fundingSource?: string;
      subAccountCode?: string;
      allocatedAmount?: number;
      commendantId?: string;
      targetRoomId?: string;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      const res = await apiClient.post(
        API_ENDPOINTS.REQUESTS.WORKFLOW_ADVANCE(id),
        {
          status,
          note,
          fundingSource,
          subAccountCode,
          allocatedAmount,
          commendantId,
          targetRoomId,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      Message.success('Xarid zanjiri navbatdagi bosqichga muvaffaqiyatli o‘tkazildi!');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      if (variables.status === 'FULFILLED' || variables.status === 'RECEIVED_AT_WAREHOUSE') {
        queryClient.invalidateQueries({ queryKey: ['stocks'] });
      }
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Bosqichni yangilashda xatolik yuz berdi!');
    },
  });

  return {
    requests: requestsQuery.data || [],
    isLoading: requestsQuery.isLoading,
    isFetching: requestsQuery.isFetching,
    isError: requestsQuery.isError,
    error: requestsQuery.error,
    refetch: requestsQuery.refetch,
    createRequest: createRequestMutation.mutateAsync,
    updateRequestStatus: updateStatusMutation.mutateAsync,
    advanceWorkflow: advanceWorkflowMutation.mutateAsync,
  };
}
