import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupsApi, QueryBackupParams } from '../api/backups.api';
import { Message } from '@arco-design/web-react';

export const useBackupsQuery = (params?: QueryBackupParams) => {
  return useQuery({
    queryKey: ['backups', params],
    queryFn: () => backupsApi.getBackups(params),
  });
};

export const useBackupStatsQuery = () => {
  return useQuery({
    queryKey: ['backups-stats'],
    queryFn: () => backupsApi.getStats(),
  });
};

export const useCreateBackupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => backupsApi.createBackup(notes),
    onSuccess: () => {
      Message.success('Yangi zaxira nusxasi muvaffaqiyatli yaratildi!');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backups-stats'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Zaxira yaratishda xatolik yuz berdi!');
    },
  });
};

export const useRestoreBackupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmation }: { id: string; confirmation: string }) =>
      backupsApi.restoreBackup(id, confirmation),
    onSuccess: () => {
      Message.success('Baza zaxira nusxasidan muvaffaqiyatli tiklandi!');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backups-stats'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Zaxirani tiklashda xatolik yuz berdi!');
    },
  });
};

export const useDeleteBackupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backupsApi.deleteBackup(id),
    onSuccess: () => {
      Message.success('Zaxira nusxasi o‘chirildi!');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backups-stats'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Zaxirani o‘chirishda xatolik yuz berdi!');
    },
  });
};
