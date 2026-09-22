import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';

export interface InboxSummary {
  totalPendingCount: number;
  pendingTransfersCount: number;
  pendingRequestsCount: number;
  pendingWriteOffVotesCount: number;
  openAuditsCount: number;
  lowStockAlertsCount: number;
  overQuotaRequestsCount: number;
  pendingHandoversCount?: number;
}

export interface PendingHandoverItem {
  id: string;
  handoverNumber: string;
  type: string;
  status: string;
  departingUserId?: string;
  targetUserId?: string | null;
  commandantUserId?: string | null;
  accountantUserId?: string | null;
  departingUser: {
    id: string;
    fullName: string;
    role: string;
    position?: string;
    department?: { id: string; name: string } | null;
  };
  targetUser?: {
    id: string;
    fullName: string;
    role: string;
    position?: string;
    department?: { id: string; name: string } | null;
  } | null;
  commandantUser?: { id: string; fullName: string; role: string; position?: string } | null;
  accountantUser?: { id: string; fullName: string; role: string; position?: string } | null;
  building?: { id: string; name: string; code?: string } | null;
  room?: { id: string; number: string; name: string } | null;
  targetWarehouse?: { id: string; name: string } | null;
  items?: any[];
  _count?: { items: number };
  createdAt: string;
  note?: string | null;
}

export interface PendingTransferItem {
  id: string;
  assetId: string;
  status: string;
  isReturn: boolean;
  note?: string | null;
  createdAt: string;
  asset?: {
    id: string;
    inventoryNumber: string;
    serialNumber?: string | null;
    item?: {
      id: string;
      name: string;
      model?: string | null;
    } | null;
  } | null;
  fromRoom?: {
    id: string;
    number: string;
    name: string;
    department?: { id: string; name: string } | null;
  } | null;
  toRoom?: {
    id: string;
    number: string;
    name: string;
    department?: { id: string; name: string } | null;
  } | null;
  toWarehouse?: { id: string; name: string } | null;
  sender?: { id: string; fullName: string; username: string } | null;
  receiver?: { id: string; fullName: string; username: string } | null;
}

export interface PendingRequestItem {
  id: string;
  requestNumber: string;
  purpose: string;
  status: string;
  isOverQuota: boolean;
  specialApprovalNeeded: boolean;
  notes?: string | null;
  createdAt: string;
  requester?: {
    id: string;
    fullName: string;
    department?: { id: string; name: string } | null;
  } | null;
  department?: { id: string; name: string } | null;
  items?: Array<{
    id: string;
    requestedQty: number;
    approvedQty?: number | null;
    item?: {
      id: string;
      name: string;
      unit: string;
    } | null;
  }>;
}

export interface PendingWriteOffVoteItem {
  id: string;
  writeOffId: string;
  userId?: string;
  roleName: string;
  vote: string;
  comment?: string | null;
  user?: { id: string; fullName: string; role: string } | null;
  writeOffRequest: {
    id: string;
    actNumber: string;
    reason: string;
    technicalConclusion?: string | null;
    status: string;
    createdAt: string;
    asset?: {
      id: string;
      inventoryNumber: string;
      item?: { id: string; name: string; model?: string | null } | null;
    } | null;
    createdBy?: { id: string; fullName: string } | null;
  };
}

export interface OpenAuditItem {
  type: 'CAMPAIGN' | 'ROOM_AUDIT';
  id: string;
  number: string;
  title: string;
  status?: string;
  orderNumber?: string;
  roomName?: string;
  auditorName?: string;
  auditorId?: string;
  startDate?: string;
  endDate?: string;
  scopesCount?: number;
  auditsCount?: number;
  scannedCount?: number;
  createdAt: string;
}

export interface LowStockAlertItem {
  id: string;
  warehouseName: string;
  itemId: string;
  itemName: string;
  sku?: string | null;
  unit: string;
  categoryName?: string;
  currentQuantity: number;
  minLimit: number;
  shortage: number;
}

export interface OverQuotaRequestItem extends PendingRequestItem {}

export interface InboxResponse {
  summary: InboxSummary;
  pendingTransfers: PendingTransferItem[];
  pendingRequests: PendingRequestItem[];
  pendingWriteOffVotes: PendingWriteOffVoteItem[];
  openAudits: OpenAuditItem[];
  lowStockAlerts: LowStockAlertItem[];
  overQuotaRequests: OverQuotaRequestItem[];
  pendingHandovers?: PendingHandoverItem[];
}

export const useInboxQuery = (options?: { refetchInterval?: number; scope?: 'personal' | 'all' }) => {
  const scope = options?.scope ?? 'personal';
  return useQuery<InboxResponse>({
    queryKey: ['inbox', scope],
    queryFn: async () => {
      const res = await apiClient.get<InboxResponse>(API_ENDPOINTS.INBOX.BASE, {
        params: { scope },
      });
      return res.data;
    },
    refetchInterval: options?.refetchInterval ?? 60000,
    staleTime: 30000,
  });
};
