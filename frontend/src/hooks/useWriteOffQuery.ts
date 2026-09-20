import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export interface WriteOffMember {
  id: string;
  writeOffId: string;
  userId: string;
  roleName: string;
  vote: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  votedAt?: string;
  user: {
    id: string;
    fullName: string;
    role: string;
    email?: string;
  };
}

export interface WriteOffItem {
  id: string;
  actNumber: string;
  assetId: string;
  asset: {
    id: string;
    inventoryNumber: string;
    serialNumber?: string;
    status: string;
    purchasePrice?: number;
    fundingSource?: string;
    item: {
      name: string;
      model?: string;
      category: { name: string };
    };
    room?: {
      number: string;
      name: string;
    };
    responsibleUser?: {
      fullName: string;
    };
    depreciation?: {
      annualRate: number;
      ageYears: number;
      accumulatedDepreciation: number;
      currentBookValue: number;
    };
  };
  reason: string;
  technicalConclusion?: string;
  status: 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  approvedAt?: string;
  hasWormStamp?: boolean;
  stamp?: {
    id: string;
    docNumber: string;
    docType: string;
    isValid: boolean;
    signerName: string;
    signerRole?: string;
  } | null;
  createdBy: { id: string; fullName: string; role: string };
  members: WriteOffMember[];
  createdAt: string;
  updatedAt: string;
}

export function useWriteOffQuery(params?: { status?: string; assetId?: string }) {
  const queryClient = useQueryClient();

  const writeOffsQuery = useQuery({
    queryKey: ['writeOffs', params],
    queryFn: async () => {
      const res = await apiClient.get<WriteOffItem[]>(API_ENDPOINTS.WRITE_OFFS.BASE, { params });
      return res.data;
    },
  });

  const createWriteOffMutation = useMutation({
    mutationFn: async (data: {
      assetId: string;
      reason: string;
      technicalConclusion?: string;
      members?: Array<{ userId: string; roleName: string }>;
    }) => {
      const res = await apiClient.post(API_ENDPOINTS.WRITE_OFFS.BASE, data);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`Hisobdan chiqarish arizasi yaratildi (${data.actNumber}). Komissiya ko‘rigiga yuborildi!`);
      queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Spisanie arizasini yaratishda xatolik yuz berdi!');
    },
  });

  const voteWriteOffMutation = useMutation({
    mutationFn: async ({
      id,
      vote,
      comment,
      signatureHash,
      signerName,
      signerRole,
    }: {
      id: string;
      vote: 'APPROVED' | 'REJECTED';
      comment?: string;
      signatureHash?: string;
      signerName?: string;
      signerRole?: string;
    }) => {
      const res = await apiClient.post(API_ENDPOINTS.WRITE_OFFS.VOTE(id), {
        vote,
        comment,
        signatureHash,
        signerName,
        signerRole,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.status === 'APPROVED') {
        Message.success(`Komissiyaning barcha a’zolari tasdiqladi! OS-4 dalolatnomasi kuchga kirdi va ashyo hisobdan chiqarildi.`);
      } else if (data.status === 'REJECTED') {
        Message.warning(`Komissiya a’zosi tomonidan rad etildi.`);
      } else {
        Message.success(`Ovozingiz muvaffaqiyatli qabul qilindi!`);
      }
      queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ovoz berishda xatolik yuz berdi!');
    },
  });

  return {
    writeOffs: writeOffsQuery.data || [],
    isLoading: writeOffsQuery.isLoading,
    isError: writeOffsQuery.isError,
    refetch: writeOffsQuery.refetch,
    createWriteOff: createWriteOffMutation.mutateAsync,
    isCreating: createWriteOffMutation.isPending,
    voteWriteOff: voteWriteOffMutation.mutateAsync,
    isVoting: voteWriteOffMutation.isPending,
  };
}
