import { apiClient } from './client';

export interface BackupItem {
  id: string;
  filename: string;
  filePath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  backupType: 'AUTOMATIC' | 'MANUAL';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'RESTORED';
  checksum?: string;
  notes?: string;
  triggeredById?: string;
  triggeredBy?: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  };
  createdAt: string;
  completedAt?: string;
}

export interface BackupStats {
  totalCount: number;
  automaticCount: number;
  manualCount: number;
  totalStorageBytes: number;
  totalStorageFormatted: string;
  latestBackupDate: string | null;
  schedulerActive: boolean;
  schedulerSchedule: string;
}

export interface QueryBackupParams {
  page?: number;
  limit?: number;
  backupType?: string;
  status?: string;
  search?: string;
}

export interface BackupListResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: BackupItem[];
}

export const backupsApi = {
  getBackups: async (params?: QueryBackupParams): Promise<BackupListResponse> => {
    const res = await apiClient.get('/backups', { params });
    return res.data;
  },

  getStats: async (): Promise<BackupStats> => {
    const res = await apiClient.get('/backups/stats');
    return res.data;
  },

  createBackup: async (notes?: string): Promise<BackupItem> => {
    const res = await apiClient.post('/backups', { notes });
    return res.data;
  },

  restoreBackup: async (id: string, confirmation: string): Promise<{ message: string; backup: BackupItem }> => {
    const res = await apiClient.post(`/backups/${id}/restore`, { confirmation });
    return res.data;
  },

  deleteBackup: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/backups/${id}`);
    return res.data;
  },

  downloadBackup: async (id: string, filename: string): Promise<void> => {
    const res = await apiClient.get(`/backups/${id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
