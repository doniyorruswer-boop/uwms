import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../constants';
import { Message } from '@arco-design/web-react';

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount?: number | string | null;
  notes?: string | null;
  supplierId?: string | null;
  createdAt: string;
  _count?: {
    instances: number;
  };
}

export interface SupplierItem {
  id: string;
  name: string;
  inn?: string | null;
  contractNumber?: string | null;
  contractDate?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  invoices?: InvoiceItem[];
  _count?: {
    itemInstances: number;
    invoices: number;
    movements: number;
  };
}

export interface SupplierDetail extends SupplierItem {
  invoices: (InvoiceItem & { _count?: { instances: number } })[];
  itemInstances: {
    id: string;
    inventoryNumber: string;
    serialNumber?: string | null;
    qrCode: string;
    status: string;
    purchasePrice?: number | null;
    createdAt: string;
    item: {
      name: string;
      model?: string | null;
      unit: string;
    };
    room?: {
      number: string;
      name: string;
      building?: string | null;
    } | null;
  }[];
  movements: {
    id: string;
    movementNumber: string;
    movementType: string;
    createdAt: string;
    toWarehouse?: {
      name: string;
    } | null;
  }[];
}

export interface SupplierStats {
  totalSuppliers: number;
  activeContractsCount: number;
  totalInvoices: number;
  totalInvoiceAmount: number;
}

export interface NextCodesData {
  nextInn: string;
  nextINN?: string;
  nextContractNumber: string;
  nextInvoiceNumber: string;
}

export function useSuppliersQuery(search?: string) {
  const queryClient = useQueryClient();

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', search],
    queryFn: async () => {
      const res = await apiClient.get<SupplierItem[]>(API_ENDPOINTS.SUPPLIERS.BASE, {
        params: search ? { search } : undefined,
      });
      return res.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ['suppliers-stats'],
    queryFn: async () => {
      const res = await apiClient.get<SupplierStats>(API_ENDPOINTS.SUPPLIERS.STATS);
      return res.data;
    },
  });

  const nextCodesQuery = useQuery({
    queryKey: ['suppliers-next-codes'],
    queryFn: async () => {
      const res = await apiClient.get<NextCodesData>(API_ENDPOINTS.SUPPLIERS.NEXT_CODES);
      return {
        ...res.data,
        nextINN: res.data.nextInn || (res.data as any).nextINN,
      };
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (dto: {
      name: string;
      inn?: string;
      contractNumber?: string;
      contractDate?: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
    }) => {
      const res = await apiClient.post<SupplierItem>(API_ENDPOINTS.SUPPLIERS.BASE, dto);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`Ta’minotchi "${data.name}" muvaffaqiyatli ro‘yxatdan o‘tkazildi!`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-next-codes'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ta’minotchi qo‘shishda xatolik!');
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: {
        name?: string;
        inn?: string;
        contractNumber?: string;
        contractDate?: string;
        contactPerson?: string;
        phone?: string;
        email?: string;
        notes?: string;
      };
    }) => {
      const res = await apiClient.put<SupplierItem>(API_ENDPOINTS.SUPPLIERS.BY_ID(id), dto);
      return res.data;
    },
    onSuccess: (data) => {
      Message.success(`Ta’minotchi "${data.name}" ma’lumotlari yangilandi!`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', data.id] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ta’minotchini yangilashda xatolik!');
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(API_ENDPOINTS.SUPPLIERS.BY_ID(id));
      return res.data;
    },
    onSuccess: () => {
      Message.success('Ta’minotchi muvaffaqiyatli o‘chirildi!');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-next-codes'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Ta’minotchini o‘chirishda xatolik!');
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async ({
      supplierId,
      dto,
    }: {
      supplierId: string;
      dto: {
        invoiceNumber: string;
        invoiceDate?: string;
        totalAmount?: number;
        notes?: string;
      };
    }) => {
      const res = await apiClient.post<InvoiceItem>(
        API_ENDPOINTS.SUPPLIERS.INVOICES(supplierId),
        dto,
      );
      return res.data;
    },
    onSuccess: (_, vars) => {
      Message.success('Hisob-faktura muvaffaqiyatli biriktirildi!');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', vars.supplierId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-next-codes'] });
    },
    onError: (err: any) => {
      Message.error(err.response?.data?.message || 'Fakturani biriktirishda xatolik!');
    },
  });

  return {
    suppliers: suppliersQuery.data || [],
    isLoading: suppliersQuery.isLoading,
    isFetching: suppliersQuery.isFetching,
    isError: suppliersQuery.isError,
    refetch: suppliersQuery.refetch,
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    nextCodes: nextCodesQuery.data,
    isLoadingCodes: nextCodesQuery.isLoading,
    refetchCodes: nextCodesQuery.refetch,
    createSupplier: createSupplierMutation.mutateAsync,
    isCreatingSupplier: createSupplierMutation.isPending,
    updateSupplier: updateSupplierMutation.mutateAsync,
    isUpdatingSupplier: updateSupplierMutation.isPending,
    deleteSupplier: deleteSupplierMutation.mutateAsync,
    isDeletingSupplier: deleteSupplierMutation.isPending,
    createInvoice: createInvoiceMutation.mutateAsync,
    isCreatingInvoice: createInvoiceMutation.isPending,
  };
}

export function useSupplierDetailQuery(id: string | null) {
  return useQuery({
    queryKey: ['supplier-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<SupplierDetail>(API_ENDPOINTS.SUPPLIERS.BY_ID(id));
      return res.data;
    },
    enabled: !!id,
  });
}
