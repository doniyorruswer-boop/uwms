import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';

export interface DashboardSummary {
  totalAssets: number;
  totalInitialCost: number;
  totalDepreciated: number;
  totalNetBookValue: number;
  depreciationPercentage: number;
  totalStockUnits: number;
  lowStockCount: number;
  pendingRequestsCount: number;
  pendingTransfersCount?: number;
  activeRepairsCount?: number;
  pendingWriteOffsCount?: number;
  molsCount?: number;
  suppliersCount: number;
  userRole?: string;
  userDepartmentId?: string | null;
  userDepartmentAssetCount?: number;
  userDepartmentBookValue?: number;
  statusCounts: {
    NEW: number;
    IN_USE: number;
    IN_REPAIR: number;
    WRITTEN_OFF: number;
  };
}

export interface NeedsAttentionData {
  lowStockCount: number;
  pendingRequestsCount: number;
  pendingTransfersCount: number;
  activeRepairsCount: number;
  pendingWriteOffsCount: number;
  totalAttentionItems: number;
}

export interface FundingSourceItem {
  key: string;
  name: string;
  count: number;
  initialCost: number;
  netBookValue: number;
  percentage: number;
}

export interface CategoryBreakdownItem {
  name: string;
  count: number;
  initialCost: number;
  netBookValue: number;
  percentage: number;
}

export interface DepartmentBreakdownItem {
  id?: string;
  name: string;
  facultyName?: string;
  count: number;
  initialCost: number;
  netBookValue: number;
  percentage: number;
}

export interface RecentMovementItem {
  id: string;
  movementNumber: string;
  movementType: string;
  itemSummary: string;
  targetLocation: string;
  createdAt: string;
}

export interface RecentRequestItem {
  id: string;
  requestNumber: string;
  requesterName: string;
  departmentName?: string;
  purpose: string;
  status: string;
  approvalNote?: string | null;
  approvedByName?: string | null;
  approvalMethod?: string;
  createdAt: string;
}

export interface LowStockItem {
  id: string;
  itemId?: string;
  name: string;
  sku?: string;
  categoryName?: string;
  quantity: number;
  unit: string;
  minLimit: number;
  deficit?: number;
  percentage?: number;
}

export interface DashboardAnalyticsData {
  summary: DashboardSummary;
  needsAttention?: NeedsAttentionData;
  fundingSources: FundingSourceItem[];
  categories: CategoryBreakdownItem[];
  departments: DepartmentBreakdownItem[];
  recentMovements: RecentMovementItem[];
  recentRequests: RecentRequestItem[];
  lowStockItems: LowStockItem[];
}

export function useDashboardAnalyticsQuery() {
  const query = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardAnalyticsData>(API_ENDPOINTS.DASHBOARD.ANALYTICS);
      return res.data;
    },
    refetchInterval: 10000, // Background poll every 10s for live data
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  return {
    analytics: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
