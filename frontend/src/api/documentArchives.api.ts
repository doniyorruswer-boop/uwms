import { apiClient } from './client';

export interface DocumentArchiveItem {
  id: string;
  docType: string;
  entityId: string;
  docNumber: string;
  title: string;
  version: number;
  status: 'DRAFT' | 'SIGNED' | 'CANCELLED' | 'ARCHIVED';
  pdfPath?: string;
  fileSize?: number;
  checksum?: string;
  metadata?: Record<string, any>;
  stampId?: string;
  signedById?: string;
  signedBy?: {
    id: string;
    fullName: string;
    role: string;
    position?: string;
  };
  signedAt?: string;
  cancelledById?: string;
  cancelledBy?: {
    id: string;
    fullName: string;
    role: string;
    position?: string;
  };
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  stamp?: any;
}

export interface GenerateArchivePayload {
  docType: string;
  entityId: string;
  docNumber: string;
  title: string;
  metadata?: Record<string, any>;
  htmlContent?: string;
}

export const documentArchivesApi = {
  /**
   * Generates a new archive version on the server.
   */
  generateArchive: async (payload: GenerateArchivePayload): Promise<DocumentArchiveItem> => {
    const { data } = await apiClient.post('/document-archives/generate', payload);
    return data;
  },

  /**
   * Retrieves archive version history.
   */
  getHistory: async (params: {
    entityId?: string;
    docType?: string;
    docNumber?: string;
  }): Promise<DocumentArchiveItem[]> => {
    const { data } = await apiClient.get('/document-archives', { params });
    return data;
  },

  /**
   * Cancels an archived document.
   */
  cancelArchive: async (id: string, reason: string): Promise<DocumentArchiveItem> => {
    const { data } = await apiClient.post(`/document-archives/${id}/cancel`, { reason });
    return data;
  },

  /**
   * Downloads an archived document file.
   */
  downloadArchive: async (id: string, defaultFilename: string = 'document.html') => {
    const response = await apiClient.get(`/document-archives/${id}/download`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: (response.headers['content-type'] as string) || 'text/html;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', defaultFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
