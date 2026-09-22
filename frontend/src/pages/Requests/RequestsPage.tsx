import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Message,
  Notification,
  Badge,
  Steps,
  Descriptions,
  Grid,
  Alert,
  Tooltip,
  Progress,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconCheck,
  IconClose,
  IconCheckCircle,
  IconEye,
  IconDownload,
  IconFile,
  IconArchive,
  IconSearch,
  IconRefresh,
  IconUserGroup,
  IconMobile,
  IconWifi,
} from '@arco-design/web-react/icon';
import { useQueryClient } from '@tanstack/react-query';
import { useRequestsQuery } from '../../hooks/useRequestsQuery';
import { useWarehouseQuery } from '../../hooks/useWarehouseQuery';
import { useSocket } from '../../hooks/useSocket';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { StandardTable } from '../../components/Common/StandardTable';
import { RejectReasonModal } from '../../components/Common/RejectReasonModal';
import { useAuthStore } from '../../store/authStore';
import type { RequestRecord, RequestStatus, InitSigningSessionPayload } from '../../types';
import type { DocType } from '../../constants';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { TableActions } from '../../components/Common/TableActions';
import { QRPairingModal } from '../../components/Common/QRPairingModal';
import { NewRequestModal } from '../../components/Requests/NewRequestModal';
import { StatusTag } from '../../components/Common/StatusTag';
import { getStatusLabel, getStatusSelectOptions } from '../../constants/status.constants';

const FormItem = Form.Item;
const Step = Steps.Step;
const { Row, Col } = Grid;

export const RequestsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { requests, isLoading, isFetching, isError, refetch, createRequest, updateRequestStatus, advanceWorkflow } = useRequestsQuery();
  const { stocks } = useWarehouseQuery();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isNewModalVisible, setIsNewModalVisible] = useState(false);
  const [draftItems, setDraftItems] = useState<Array<{
    itemId?: string;
    itemName: string;
    quantity: number;
    unit: string;
    currentQuantity?: number;
    minStockLimit?: number;
  }>>([]);
  const [selectedDocRequest, setSelectedDocRequest] = useState<RequestRecord | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [initialPurpose, setInitialPurpose] = useState<string>('');
  const [isQrModalVisible, setIsQrModalVisible] = useState<boolean>(false);
  const [qrSignPayload, setQrSignPayload] = useState<InitSigningSessionPayload | null>(null);
  
  // Phase L1: Workflow & Finance State
  const [isFinanceModalVisible, setIsFinanceModalVisible] = useState<boolean>(false);
  const [requestToFinance, setRequestToFinance] = useState<RequestRecord | null>(null);
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<{
    req: RequestRecord;
    targetStatus: RequestStatus;
    payload?: any;
  } | null>(null);
  const [docModalType, setDocModalType] = useState<DocType>('TRANSFER');

  // Reject Reason Modal State (Rule 4.1 & Rule 5.4)
  const [isRejectModalVisible, setIsRejectModalVisible] = useState<boolean>(false);
  const [requestToReject, setRequestToReject] = useState<RequestRecord | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const [form] = Form.useForm();
  const [financeForm] = Form.useForm();

  // Real-Time Live Approval Workflow Socket Integration
  const queryClient = useQueryClient();
  const { socket, isConnected: isSocketConnected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleRequestCreated = (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });

      if (
        user?.role === 'VICE_RECTOR_FINANCE' ||
        user?.role === 'RECTOR' ||
        user?.role === 'HEAD_WAREHOUSE' ||
        user?.role === 'SUPER_ADMIN'
      ) {
        Notification.info({
          title: 'Yangi Talabnoma Kiritildi',
          content: `${payload.requestNumber}: ${payload.purpose}`,
          duration: 5,
        });
      }
    };

    const handleRequestUpdated = (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });

      // Ochiq turgan 7-bosqichli Stepper komponenti jonli oldinga siljiydi
      setSelectedRequest((prev) => {
        if (prev && prev.id === payload.id) {
          return {
            ...prev,
            ...payload,
          };
        }
        return prev;
      });

      // Roli bo‘yicha mas’ul xodimga real-time bildirishnoma
      if (
        payload.status === 'APPROVED_BY_PRORECTOR' &&
        (user?.role === 'RECTOR' || user?.role === 'SUPER_ADMIN')
      ) {
        Notification.info({
          title: 'Rektor Vizasi Kutilmoqda',
          content: `${payload.requestNumber} talabnomasiga Prorektor viza berdi. Yakuniy ruxsat berishingiz kutilmoqda.`,
          duration: 5,
        });
      } else if (
        payload.status === 'APPROVED_BY_RECTOR' &&
        (user?.role === 'CHIEF_ACCOUNTANT' || user?.role === 'SUPER_ADMIN')
      ) {
        Notification.info({
          title: 'Moliyalashtirish Kutilmoqda (Bosh Hisobchi)',
          content: `${payload.requestNumber} talabnomasi Rektor tomonidan tasdiqlandi. Sub-hisob biriktirishingiz kutilmoqda.`,
          duration: 5,
        });
      } else if (
        payload.status === 'FINANCED_BY_ACCOUNTANT' &&
        (user?.role === 'HEAD_WAREHOUSE' || user?.role === 'SUPER_ADMIN')
      ) {
        Notification.info({
          title: 'Ombor Kirimi Kutilmoqda (OS-1)',
          content: `${payload.requestNumber} talabnomasi moliyalashtirildi. Tovar keltirilgach qabul qilinishi lozim.`,
          duration: 5,
        });
      } else if (
        payload.status === 'RECEIVED_AT_WAREHOUSE' &&
        (user?.role === 'COMMENDANT' || user?.role === 'SUPER_ADMIN')
      ) {
        Notification.info({
          title: 'Binoga Qabul Qilish Kutilmoqda (Komendant)',
          content: `${payload.requestNumber} mahsulotlari omborga yetib keldi. Binoga qabul qilib olishingiz so‘raladi.`,
          duration: 5,
        });
      } else if (user?.id === payload.requesterId) {
        Notification.success({
          title: 'Talabnomangiz Holati Yangilandi',
          content: `${payload.requestNumber} talabnomasi yangi bosqichga o‘tdi.`,
          duration: 4,
        });
      }
    };

    socket.on('REQUEST_CREATED', handleRequestCreated);
    socket.on('REQUEST_UPDATED', handleRequestUpdated);

    return () => {
      socket.off('REQUEST_CREATED', handleRequestCreated);
      socket.off('REQUEST_UPDATED', handleRequestUpdated);
    };
  }, [socket, user, queryClient]);

  // Support prefilled draft items from Low-Stock assistant (Warehouse or Inbox)
  useEffect(() => {
    const isCreate = searchParams.get('create') === 'true';
    const stateDraft = (location.state as any)?.draftItems;
    const defaultPurpose = (location.state as any)?.defaultPurpose;

    if (stateDraft && Array.isArray(stateDraft) && stateDraft.length > 0) {
      setDraftItems(stateDraft);
      setInitialPurpose(defaultPurpose || 'Minimal me’yordan kam qolgan sarf tovarlari zaxirasini to‘ldirish uchun talabnoma');
      setIsNewModalVisible(true);
    } else if (isCreate) {
      setIsNewModalVisible(true);
    }
  }, [searchParams, location.state]);

  // 7-step Purchase Chain Progress calculation
  const getStepCurrent = (status: RequestStatus) => {
    switch (status) {
      case 'SUBMITTED':
      case 'PENDING':
        return 1;
      case 'APPROVED_BY_PRORECTOR':
        return 2;
      case 'APPROVED_BY_RECTOR':
        return 3;
      case 'FINANCED_BY_ACCOUNTANT':
        return 4;
      case 'RECEIVED_AT_WAREHOUSE':
        return 5;
      case 'HANDED_TO_COMMENDANT':
        return 6;
      case 'FULFILLED':
        return 7;
      case 'REJECTED':
      case 'CANCELLED':
        return 1;
      default:
        return 1;
    }
  };

  const getStageDetails = (status: RequestStatus, record?: RequestRecord | null) => {
    switch (status) {
      case 'SUBMITTED':
      case 'PENDING':
        return {
          step: 1,
          total: 7,
          percent: 14,
          title: '1/7: Prorektor Vizasi',
          currentActor: record?.prorektorApprovedByName
            ? `Moliya-iqtisod prorektori (${record.prorektorApprovedByName})`
            : 'Moliya-iqtisod prorektori',
          color: '#ff7d00',
          badgeStatus: 'warning' as const,
          description: 'Talabnoma arizasi yuborilgan, prorektor ko‘rib chiqishi kutilmoqda',
        };
      case 'APPROVED_BY_PRORECTOR':
        return {
          step: 2,
          total: 7,
          percent: 28,
          title: '2/7: Rektor Vizasi',
          currentActor: record?.rectorApprovedByName
            ? `Universitet Rektori (${record.rectorApprovedByName})`
            : 'Universitet Rektori',
          color: '#165dff',
          badgeStatus: 'processing' as const,
          description: 'Prorektor viza berdi, Rektor xaridga yakuniy ruxsat berishi kutilmoqda',
        };
      case 'APPROVED_BY_RECTOR':
        return {
          step: 3,
          total: 7,
          percent: 42,
          title: '3/7: Moliyalashtirish',
          currentActor: record?.accountantFinancedByName
            ? `Bosh hisobchi (${record.accountantFinancedByName})`
            : 'Bosh hisobchi',
          color: '#722ed1',
          badgeStatus: 'processing' as const,
          description: 'Rektor ruxsat berdi, byudjet/kontrakt smetasi va sub-hisob biriktirilmoqda',
        };
      case 'FINANCED_BY_ACCOUNTANT':
        return {
          step: 4,
          total: 7,
          percent: 57,
          title: '4/7: Ombor Kirimi (OS-1)',
          currentActor: record?.warehouseReceivedByName
            ? `Bosh ombor mudiri (${record.warehouseReceivedByName})`
            : 'Bosh ombor mudiri',
          color: '#00b42a',
          badgeStatus: 'processing' as const,
          description: 'Mablag‘ ajratildi, tovarlar xarid qilinib omborga qabul qilinishi kutilmoqda',
        };
      case 'RECEIVED_AT_WAREHOUSE':
        return {
          step: 5,
          total: 7,
          percent: 71,
          title: '5/7: Binoga Topshirish (OS-2)',
          currentActor: record?.commendantHandedByName || record?.commendantName
            ? `Bosh omborchi va Bino komendanti (${record.commendantHandedByName || record.commendantName})`
            : 'Bosh omborchi va Bino komendanti',
          color: '#0fc6c2',
          badgeStatus: 'processing' as const,
          description: 'Mahsulot bosh omborga keldi (OS-1). Bino komendantiga topshirish kutilmoqda',
        };
      case 'HANDED_TO_COMMENDANT':
        return {
          step: 6,
          total: 7,
          percent: 85,
          title: '6/7: Xonada Qabul Qilish',
          currentActor: record?.requesterName
            ? `Bino komendanti va Talabgor (${record.requesterName})`
            : 'Bino komendanti va Talabgor',
          color: '#fa8c16',
          badgeStatus: 'processing' as const,
          description: 'Ashyolar binoga yetkazildi (OS-2). Komendant bilan xonada o‘zaro qabul qilib imzolash kutilmoqda',
        };
      case 'FULFILLED':
        return {
          step: 7,
          total: 7,
          percent: 100,
          title: '7/7: To‘liq Topshirildi (Balansda)',
          currentActor: record?.requesterName || 'Talabgor (Mas’ul)',
          color: '#00b42a',
          badgeStatus: 'success' as const,
          description: 'Ashyolar kafedraga topshirildi, yakuniy dalolatnoma imzolandi va balansga o‘tdi',
        };
      case 'REJECTED':
        return {
          step: 1,
          total: 7,
          percent: 100,
          title: 'Rad Etildi',
          currentActor: 'Rad etilgan',
          color: '#f53f3f',
          badgeStatus: 'error' as const,
          description: record?.approvalNote || 'Asossizligi yoki limit yetishmasligi sababli rad etildi',
        };
      default:
        return {
          step: 1,
          total: 7,
          percent: 14,
          title: String(status),
          currentActor: 'Mas’ul xodim',
          color: '#86909c',
          badgeStatus: 'default' as const,
          description: '',
        };
    }
  };

  const myActionCount = requests.filter((r) => {
    if (user?.role === 'VICE_RECTOR_FINANCE') return r.status === 'SUBMITTED' || r.status === 'PENDING' || r.status === 'APPROVED_BY_HEAD';
    if (user?.role === 'RECTOR') return r.status === 'APPROVED_BY_PRORECTOR';
    if (user?.role === 'CHIEF_ACCOUNTANT') return r.status === 'APPROVED_BY_RECTOR';
    if (user?.role === 'HEAD_WAREHOUSE') return r.status === 'FINANCED_BY_ACCOUNTANT';
    if (user?.role === 'COMMENDANT') return r.status === 'RECEIVED_AT_WAREHOUSE';
    if (user?.role === 'MOL') return r.status === 'HANDED_TO_COMMENDANT';
    if (user?.role === 'SUPER_ADMIN') return false;
    return false;
  }).length;

  const inProgressCount = requests.filter(
    (r) => r.status !== 'FULFILLED' && r.status !== 'REJECTED' && r.status !== 'CANCELLED',
  ).length;
  const fulfilledCount = requests.filter((r) => r.status === 'FULFILLED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length;

  const filteredRequests = requests.filter((r) => {
    let matchesTab = true;
    if (activeTab === 'MY_ACTION') {
      if (user?.role === 'VICE_RECTOR_FINANCE') matchesTab = r.status === 'SUBMITTED' || r.status === 'PENDING' || r.status === 'APPROVED_BY_HEAD';
      else if (user?.role === 'RECTOR') matchesTab = r.status === 'APPROVED_BY_PRORECTOR';
      else if (user?.role === 'CHIEF_ACCOUNTANT') matchesTab = r.status === 'APPROVED_BY_RECTOR';
      else if (user?.role === 'HEAD_WAREHOUSE') matchesTab = r.status === 'FINANCED_BY_ACCOUNTANT';
      else if (user?.role === 'COMMENDANT') matchesTab = r.status === 'RECEIVED_AT_WAREHOUSE';
      else if (user?.role === 'MOL') matchesTab = r.status === 'HANDED_TO_COMMENDANT';
      else matchesTab = false;
    } else if (activeTab === 'IN_PROGRESS') {
      matchesTab = r.status !== 'FULFILLED' && r.status !== 'REJECTED' && r.status !== 'CANCELLED';
    } else if (activeTab === 'FULFILLED') {
      matchesTab = r.status === 'FULFILLED';
    } else if (activeTab === 'REJECTED') {
      matchesTab = r.status === 'REJECTED' || r.status === 'CANCELLED';
    }

    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      !searchText ||
      r.requestNumber.toLowerCase().includes(searchLower) ||
      r.requesterName.toLowerCase().includes(searchLower) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(searchLower)) ||
      r.purpose.toLowerCase().includes(searchLower) ||
      r.items.some((i) => i.itemName.toLowerCase().includes(searchLower));

    return matchesTab && matchesSearch;
  });

  const handleProrektorApprove = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setPendingWorkflowAction({
      req,
      targetStatus: 'APPROVED_BY_PRORECTOR',
      payload: { note: 'Moliya-iqtisod prorektori tomonidan viza qo‘yildi' },
    });
    setQrSignPayload({
      docNumber: req.requestNumber,
      docType: 'OS_1',
      title: `Prorektor Vizasi (${req.departmentName || 'Kafedra'})`,
      departmentName: req.departmentName || undefined,
      itemSummary: req.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerRole: 'VICE_RECTOR_FINANCE',
      targetSignerName: user?.fullName,
      metadata: { stage: 'PROREKTOR_VIZA', reqId: req.id },
    });
    setIsQrModalVisible(true);
  };

  const handleRectorApprove = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setPendingWorkflowAction({
      req,
      targetStatus: 'APPROVED_BY_RECTOR',
      payload: { note: 'Universitet Rektori tomonidan xaridga ruxsat etildi (viza)' },
    });
    setQrSignPayload({
      docNumber: req.requestNumber,
      docType: 'OS_1',
      title: `Rektor Vizasi va Farmoyishi (${req.departmentName || 'Kafedra'})`,
      departmentName: req.departmentName || undefined,
      itemSummary: req.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerRole: 'RECTOR',
      targetSignerName: user?.fullName,
      metadata: { stage: 'RECTOR_VIZA', reqId: req.id },
    });
    setIsQrModalVisible(true);
  };

  const handleOpenFinanceModal = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setRequestToFinance(req);
    financeForm.setFieldsValue({
      fundingSource: req.fundingSource || 'BYUDJET',
      subAccountCode: req.subAccountCode || '013',
      allocatedAmount: req.allocatedAmount || undefined,
      note: req.approvalNote || '',
    });
    setIsFinanceModalVisible(true);
  };

  const handleFinanceSubmit = () => {
    financeForm.validate().then((values) => {
      if (!requestToFinance) return;
      setPendingWorkflowAction({
        req: requestToFinance,
        targetStatus: 'FINANCED_BY_ACCOUNTANT',
        payload: {
          fundingSource: values.fundingSource,
          subAccountCode: values.subAccountCode,
          allocatedAmount: Number(values.allocatedAmount),
          note: values.note || 'Bosh hisobchi tomonidan moliyalashtirildi',
        },
      });
      setQrSignPayload({
        docNumber: requestToFinance.requestNumber,
        docType: 'OS_1',
        title: `Moliya & Sub-hisob (${values.fundingSource} / ${values.subAccountCode})`,
        departmentName: requestToFinance.departmentName || undefined,
        itemSummary: requestToFinance.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
        metadata: {
          stage: 'FINANCED_BY_ACCOUNTANT',
          fundingSource: values.fundingSource,
          subAccountCode: values.subAccountCode,
          allocatedAmount: values.allocatedAmount,
        },
      });
      setIsFinanceModalVisible(false);
      setIsQrModalVisible(true);
    });
  };

  const handleWarehouseReceive = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setPendingWorkflowAction({
      req,
      targetStatus: 'RECEIVED_AT_WAREHOUSE',
      payload: { note: 'Mahsulotlar omborga kirim qilindi (OS-1 shakllantirildi)' },
    });
    setQrSignPayload({
      docNumber: req.requestNumber,
      docType: 'OS_1',
      title: `Ombor Kirimi va OS-1 Akti (${req.requestNumber})`,
      departmentName: req.departmentName || undefined,
      itemSummary: req.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerRole: 'Bosh ombor mudiri',
      metadata: { stage: 'WAREHOUSE_RECEIPT', reqId: req.id },
    });
    setIsQrModalVisible(true);
  };

  const handleCommendantHandover = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setPendingWorkflowAction({
      req,
      targetStatus: 'HANDED_TO_COMMENDANT',
      payload: { note: 'Komendant binoga qabul qildi (OS-2 nakladnoy shakllandi)' },
    });
    setQrSignPayload({
      docNumber: req.requestNumber,
      docType: 'OS_2',
      title: `Binoga Qabul Qilish (OS-2 Nakladnoy: ${req.requestNumber})`,
      departmentName: req.departmentName || undefined,
      itemSummary: req.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerName: req.commendantName || 'Bino komendanti',
      targetSignerRole: 'Bino komendanti',
      metadata: { stage: 'COMMENDANT_HANDOVER', reqId: req.id },
    });
    setIsQrModalVisible(true);
  };

  const handleMudirFulfill = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setPendingWorkflowAction({
      req,
      targetStatus: 'FULFILLED',
      payload: { note: 'Komendant va talabnoma kiritgan shaxs o‘rtasida o‘zaro topshirish-qabul qilish dalolatnomasi imzolandi' },
    });
    setQrSignPayload({
      docNumber: `${req.requestNumber}-AKT`,
      docType: 'OS_2',
      title: `Bo'lim/Xona Qabul Qilish Dalolatnomasi (${req.requestNumber})`,
      departmentName: req.departmentName || undefined,
      itemSummary: req.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerName: req.requesterName || 'Mas\'ul xodim',
      targetSignerRole: (req as any).requesterPosition || req.requesterRole || 'Mas\'ul Xodim',

      metadata: {
        stage: 'KAFEDRA_HANDOVER',
        reqId: req.id,
        sender: req.commendantName || req.commendantHandedByName || 'Bino komendanti',
        receiver: req.requesterName,
      },
    });
    setIsQrModalVisible(true);
  };

  const handleQrSignSuccess = async () => {
    if (pendingWorkflowAction) {
      const targetReq = pendingWorkflowAction.req;
      const targetDocType: DocType =
        pendingWorkflowAction.targetStatus === 'RECEIVED_AT_WAREHOUSE'
          ? 'KIRIM'
          : 'TRANSFER';

      try {
        await advanceWorkflow({
          id: pendingWorkflowAction.req.id,
          status: pendingWorkflowAction.targetStatus,
          note: pendingWorkflowAction.payload?.note,
          fundingSource: pendingWorkflowAction.payload?.fundingSource,
          subAccountCode: pendingWorkflowAction.payload?.subAccountCode,
          allocatedAmount: pendingWorkflowAction.payload?.allocatedAmount,
        });
        Message.success('Bosqich QR-kod orqali muvaffaqiyatli imzolandi va keyingi bosqichga o‘tkazildi!');

        // Ssenariy 5: Muhrlangan rasmiy elektron hujjatni (OS-1 / OS-2) avtomatik ochish
        setSelectedDocRequest(targetReq);
        setDocModalType(targetDocType);
        setIsDocModalVisible(true);
      } catch (err: any) {
        Message.error(err?.response?.data?.message || 'Bosqichni o‘tkazishda xatolik yuz berdi');
      }
      setPendingWorkflowAction(null);
    }
    setIsQrModalVisible(false);
    refetch();
  };

  const computedDocSignatures = useMemo(() => {
    if (!selectedDocRequest) return undefined;

    if (docModalType === 'KIRIM') {
      const isSigned =
        Boolean(selectedDocRequest.warehouseReceivedAt) ||
        ['RECEIVED_AT_WAREHOUSE', 'HANDED_TO_COMMENDANT', 'FULFILLED'].includes(selectedDocRequest.status);
      return [
        {
          role: 'Topshiruvchi / Qabul qiluvchi bosh ombor mudiri',
          name: (selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri',
          isSigned,
          signedAt: selectedDocRequest.warehouseReceivedAt
            ? new Date(selectedDocRequest.warehouseReceivedAt).toLocaleString('uz-UZ')
            : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
      ];
    }

    if (docModalType === 'TRANSFER') {
      const isSigned =
        Boolean(selectedDocRequest.commendantHandedAt) ||
        ['HANDED_TO_COMMENDANT', 'FULFILLED'].includes(selectedDocRequest.status);
      return [
        {
          role: 'Topshiruvchi bosh ombor mudiri',
          name: (selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri',
          isSigned,
          signedAt: selectedDocRequest.commendantHandedAt
            ? new Date(selectedDocRequest.commendantHandedAt).toLocaleString('uz-UZ')
            : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
        {
          role: 'Qabul qiluvchi bino komendanti',
          name: selectedDocRequest.commendantName || 'Bino komendanti',
          isSigned,
          signedAt: selectedDocRequest.commendantHandedAt
            ? new Date(selectedDocRequest.commendantHandedAt).toLocaleString('uz-UZ')
            : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
      ];
    }

    if (docModalType === 'KAFEDRA_HANDOVER') {
      const isSigned = Boolean(selectedDocRequest.fulfilledAt) || selectedDocRequest.status === 'FULFILLED';
      return [
        {
          role: 'Topshiruvchi bino komendanti',
          name: selectedDocRequest.commendantName || (selectedDocRequest as any).commendantHandedByName || 'Bino komendanti',
          isSigned,
          signedAt: selectedDocRequest.fulfilledAt
            ? new Date(selectedDocRequest.fulfilledAt).toLocaleString('uz-UZ')
            : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
        {
          role: `Qabul qiluvchi mas'ul: ${(selectedDocRequest as any).requesterPosition || 'Bo\'lim / Kafedra Boshlig\'i / Xodim'}`,

          name: selectedDocRequest.requesterName,
          isSigned,
          signedAt: selectedDocRequest.fulfilledAt
            ? new Date(selectedDocRequest.fulfilledAt).toLocaleString('uz-UZ')
            : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
      ];
    }

    return undefined;
  }, [selectedDocRequest, docModalType]);

  const handleOpenDocModal = (req: RequestRecord, type: DocType, e?: any) => {
    e?.stopPropagation?.();
    setSelectedDocRequest(req);
    setDocModalType(type);
    setIsDocModalVisible(true);
  };

  const handleOpenRejectModal = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setRequestToReject(req);
    setIsRejectModalVisible(true);
  };

  const handleConfirmReject = async (reason: string) => {
    if (!requestToReject) return;
    try {
      setIsRejecting(true);
      await updateRequestStatus({
        id: requestToReject.id,
        status: 'REJECTED',
        note: reason,
      });
      Message.success(`Talabnoma #${requestToReject.requestNumber} muvaffaqiyatli rad etildi`);
      setIsRejectModalVisible(false);
      setRequestToReject(null);
      refetch();
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Talabnomani rad etishda xatolik yuz berdi');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleOpenDetail = (req: RequestRecord) => {
    setSelectedRequest(req);
    setIsDetailModalVisible(true);
  };

  const handleNewRequestSubmit = async (payload: {
    purpose: string;
    items: Array<{ itemId?: string; itemName: string; quantity: number; unit?: string }>;
  }) => {
    await createRequest(payload);
    setIsNewModalVisible(false);
    setDraftItems([]);
    setInitialPurpose('');
    if (searchParams.get('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams);
    }
  };

  const handleExportExcel = () => {
    const formatted = requests.map((r) => ({
      'Zayavka Raqami': r.requestNumber,
      'Talabgor': r.requesterName,
      'Bo‘lim / Kafedra': r.departmentName || '',
      'Maqsad': r.purpose,
      'Mahsulotlar': r.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join('; '),
      'Holati': getStatusLabel(r.status, 'request'),
      'Izoh': r.approvalNote || '',
      'Sana': r.createdAt,
    }));
    exportToExcel(formatted, 'Talabnomalar_Reestri', 'Talabnomalar');
    Message.success('Talabnomalar hisoboti Excelga yuklandi!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Error UX State (Rule 6.3) */}
      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ borderRadius: 0 }}
          title="Talabnomalarni yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzildi yoki tarmoqda muammo yuzaga keldi. Iltimos, qayta urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()} style={{ borderRadius: 0 }}>
              Qayta yuklash
            </Button>
          }
        />
      )}

      {/* Tabs Filter */}
      <PageTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'ALL', title: 'Barcha Zayavkalar', count: requests.length },
          { key: 'MY_ACTION', title: 'Mening Vizam Kutilmoqda', count: myActionCount },
          { key: 'IN_PROGRESS', title: 'Jarayonda (7 Bosqich)', count: inProgressCount },
          { key: 'FULFILLED', title: 'Yakunlangan (Balansda)', count: fulfilledCount },
          { key: 'REJECTED', title: 'Rad Etilganlar', count: rejectedCount },
        ]}
      />

      {/* Actions Toolbar */}
      <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space size="medium" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="Zayavka raqami, talabgor, bo‘lim yoki mahsulot bo‘yicha qidirish..."
              style={{ width: 380, borderRadius: 0 }}
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
            {isSocketConnected ? (
              <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0, fontWeight: 600 }}>
                Live Workflow Sync (Faol)
              </Tag>
            ) : (
              <Tag color="gray" style={{ borderRadius: 0 }}>Offline</Tag>
            )}
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconRefresh />}
              onClick={() => refetch()}
              style={{ borderRadius: 0 }}
            >
              Yangilash
            </Button>
            <Button icon={<IconDownload />} onClick={handleExportExcel} style={{ borderRadius: 0 }}>
              Excelga Yuklash
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => {
                form.setFieldsValue({ unit: 'PACHKA', quantity: 5 });
                setIsNewModalVisible(true);
              }}
            >
              Yangi Zayavka Yaratish
            </Button>
          </Space>
        </div>
      </Card>

      {/* Requests Standard Table */}
      <StandardTable<RequestRecord>
        rowKey="id"
        loading={isLoading || isFetching}
        data={filteredRequests}
        scrollX={1350}
        onRowClick={(record) => handleOpenDetail(record)}
        emptyText={
          isError
            ? 'Server bilan aloqa uzilganligi sababli ma’lumotlar yuklanmadi. Iltimos, qayta yuklash tugmasini bosing.'
            : searchText
            ? 'Qidiruv bo‘yicha talabnoma topilmadi'
            : 'Talabnomalar mavjud emas'
        }
        columns={[
          {
            title: 'Talabgor & Zayavka №',
            dataIndex: 'requesterName',
            width: 220,
            render: (name: string, record: RequestRecord) => (
              <div style={{ paddingLeft: 8 }}>
                <CategoryThumbnail
                  icon={<IconUserGroup />}
                  name={name}
                  subtitle={record.departmentName || undefined}
                  tag={record.requestNumber}
                  color="#165DFF"
                  bg="#E8F3FF"
                />
              </div>
            ),
          },
          {
            title: 'So‘ralayotgan Mahsulotlar',
            minWidth: 360,
            render: (_, record: RequestRecord) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                {record.items.map((i) => (
                  <Tag
                    key={i.id}
                    color="arcoblue"
                    style={{
                      borderRadius: 0,
                      fontSize: 12,
                      lineHeight: 1.4,
                      height: 'auto',
                      padding: '3px 8px',
                      display: 'inline-block',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      maxWidth: '100%',
                    }}
                  >
                    <span>{i.itemName}:</span>
                    <b style={{ fontWeight: 700, marginLeft: 5, whiteSpace: 'nowrap' }}>
                      {i.requestedQty} {i.unit}
                    </b>
                  </Tag>
                ))}
              </div>
            ),
          },
          {
            title: 'Maqsad',
            dataIndex: 'purpose',
            width: 200,
            render: (purpose: string) => (
              <div style={{ fontSize: 13, color: 'var(--color-text-1)', wordBreak: 'break-word', lineHeight: 1.35 }}>
                {purpose}
              </div>
            ),
          },
          {
            title: 'Jarayon Bosqichi (7-Qadam)',
            dataIndex: 'status',
            width: 270,
            render: (status: RequestStatus, record: RequestRecord) => {
              const stage = getStageDetails(status, record);
              return (
                <Tooltip content="Jarayon tafsilotlari va 7-bosqichli xronologiyani ko‘rish uchun bosing">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '4px 0',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetail(record);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Badge status={stage.badgeStatus} text={stage.title} style={{ fontWeight: 600, fontSize: 12 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: stage.color }}>{stage.percent}%</span>
                    </div>
                    <Progress
                      percent={stage.percent}
                      status={status === 'REJECTED' ? 'error' : status === 'FULFILLED' ? 'success' : 'normal'}
                      size="small"
                      showText={false}
                      color={stage.color}
                      style={{ margin: '2px 0' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.3 }}>
                      <span style={{ color: 'var(--color-text-2)', fontWeight: 500 }}>Hozirgi mas’ul: </span>
                      {stage.currentActor}
                    </div>
                  </div>
                </Tooltip>
              );
            },
          },
          {
            title: 'Amallar',
            width: 330,
            fixed: 'right' as const,
            render: (_, record: RequestRecord) => {
              const canProrektorApprove =
                (record.status === 'SUBMITTED' ||
                 record.status === 'PENDING' ||
                 record.status === 'APPROVED_BY_HEAD') &&
                user?.role === 'VICE_RECTOR_FINANCE';

              const canRectorApprove =
                record.status === 'APPROVED_BY_PRORECTOR' &&
                user?.role === 'RECTOR';

              const canAccountantFinance =
                record.status === 'APPROVED_BY_RECTOR' &&
                user?.role === 'CHIEF_ACCOUNTANT';

              const canWarehouseReceive =
                record.status === 'FINANCED_BY_ACCOUNTANT' &&
                user?.role === 'HEAD_WAREHOUSE';

              const canCommendantHandover =
                record.status === 'RECEIVED_AT_WAREHOUSE' &&
                user?.role === 'COMMENDANT';

              const isRequester = user?.id === record.requesterId;
              const isDeptMol =
                user?.role === 'MOL' &&
                (!user?.departmentId || user?.departmentId === record.departmentId);

              const canMudirFulfill =
                record.status === 'HANDED_TO_COMMENDANT' &&
                user?.role !== 'COMMENDANT' &&
                (isRequester || isDeptMol);

              const canReject =
                (((record.status === 'SUBMITTED' ||
                   record.status === 'PENDING' ||
                   record.status === 'APPROVED_BY_HEAD') &&
                  user?.role === 'VICE_RECTOR_FINANCE') ||
                 (record.status === 'APPROVED_BY_PRORECTOR' &&
                  user?.role === 'RECTOR') ||
                 (record.status === 'APPROVED_BY_RECTOR' &&
                  user?.role === 'CHIEF_ACCOUNTANT') ||
                 (record.status === 'FINANCED_BY_ACCOUNTANT' &&
                  user?.role === 'HEAD_WAREHOUSE'));

              return (
                <TableActions rightPadding={16} gap={5}>
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconEye />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetail(record);
                    }}
                    style={{ borderRadius: 0, padding: '0 8px' }}
                  >
                    Batafsil
                  </Button>

                  {/* Step 2: Prorektor Vizasi */}
                  {canProrektorApprove && (
                    <Button
                      size="small"
                      type="primary"
                      status="success"
                      icon={<IconCheck />}
                      onClick={(e) => handleProrektorApprove(record, e)}
                      style={{ borderRadius: 0, padding: '0 8px' }}
                    >
                      1-Viza (Prorektor QR)
                    </Button>
                  )}

                  {/* Step 3: Rektor Vizasi */}
                  {canRectorApprove && (
                    <Button
                      size="small"
                      type="primary"
                      status="success"
                      icon={<IconCheck />}
                      onClick={(e) => handleRectorApprove(record, e)}
                      style={{ borderRadius: 0, padding: '0 8px' }}
                    >
                      2-Viza (Rektor QR)
                    </Button>
                  )}

                  {/* Step 4: Bosh Hisobchi Moliyalash */}
                  {canAccountantFinance && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconCheckCircle />}
                      onClick={(e) => handleOpenFinanceModal(record, e)}
                      style={{ borderRadius: 0, padding: '0 8px', background: '#722ed1', borderColor: '#722ed1' }}
                    >
                      Moliya & Sub-hisob (QR)
                    </Button>
                  )}

                  {/* Step 5: Ombor Kirimi (OS-1) */}
                  {canWarehouseReceive && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconArchive />}
                      onClick={(e) => handleWarehouseReceive(record, e)}
                      style={{ borderRadius: 0, padding: '0 8px' }}
                    >
                      Ombor Kirimi (OS-1 QR)
                    </Button>
                  )}

                  {/* Step 6: Komendant Binoga Qabul (OS-2) */}
                  {canCommendantHandover && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconCheck />}
                      onClick={(e) => handleCommendantHandover(record, e)}
                      style={{ borderRadius: 0, padding: '0 8px', background: '#ff7d00', borderColor: '#ff7d00' }}
                    >
                      Binoga Qabul (OS-2 QR)
                    </Button>
                  )}

                  {/* Step 7: Mudir Yakuniy Qabul */}
                  {canMudirFulfill && (
                    <Button
                      size="small"
                      type="primary"
                      status="success"
                      icon={<IconCheckCircle />}
                      onClick={(e) => handleMudirFulfill(record, e)}
                      style={{ borderRadius: 0, padding: '0 8px' }}
                    >
                      Xonaga Qabul (Yakuniy QR)
                    </Button>
                  )}

                  {/* Documents: OS-1 Kirim Akti */}
                  {(record.status === 'RECEIVED_AT_WAREHOUSE' ||
                    record.status === 'HANDED_TO_COMMENDANT' ||
                    record.status === 'FULFILLED') && (
                    <Tooltip content="OS-1 Ombor Kirim Aktini ko‘rish">
                      <Button
                        size="small"
                        type="outline"
                        icon={<IconFile />}
                        onClick={(e) => handleOpenDocModal(record, 'KIRIM', e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        OS-1
                      </Button>
                    </Tooltip>
                  )}

                  {/* Documents: OS-2 Chiqim Nakladnoyi */}
                  {(record.status === 'HANDED_TO_COMMENDANT' || record.status === 'FULFILLED') && (
                    <Tooltip content="OS-2 Ombordan Binoga Chiqim Nakladnoyini ko‘rish (Bosh omborchi + Bino komendanti)">
                      <Button
                        size="small"
                        type="outline"
                        icon={<IconFile />}
                        onClick={(e) => handleOpenDocModal(record, 'TRANSFER', e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        OS-2
                      </Button>
                    </Tooltip>
                  )}

                  {/* Documents: Kafedra / Bo'lim Qabuli va Topshirish Dalolatnomasi (Faqat yakuniy qabul qilib olingach: 7-bosqich) */}
                  {record.status === 'FULFILLED' && (
                    <Tooltip content="Kafedra/Bo‘lim topshirish-qabul qilish dalolatnomasini ko‘rish (Komendant + Talabgor)">
                      <Button
                        size="small"
                        type="outline"
                        icon={<IconFile />}
                        onClick={(e) => handleOpenDocModal(record, 'KAFEDRA_HANDOVER', e)}
                        style={{
                          borderRadius: 0,
                          padding: '0 8px',
                          color: '#096dd9',
                          borderColor: '#91d5ff',
                          backgroundColor: '#e6f7ff',
                        }}
                      >
                        Dalolatnoma (Akt)
                      </Button>
                    </Tooltip>
                  )}

                  {/* Rad etish */}
                  {canReject && (
                    <Tooltip content="Rad etish">
                      <Button
                        size="small"
                        type="secondary"
                        status="danger"
                        icon={<IconClose />}
                        onClick={(e) => handleOpenRejectModal(record, e)}
                        style={{ borderRadius: 0 }}
                      />
                    </Tooltip>
                  )}
                </TableActions>
              );
            },
          },
        ]}
      />

      {/* ARCO STEPS: REQUEST DETAIL MODAL */}
      <Modal
        style={{ width: 720 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Talabnoma Holati va 7-Bosqichli Xarid Zanjiri: {selectedRequest?.requestNumber}</span>
            {isSocketConnected && (
              <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0, fontWeight: 600 }}>
                Jonli Stepper (0ms)
              </Tag>
            )}
          </div>
        }
        visible={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={
          <Space>
            {(selectedRequest?.status === 'RECEIVED_AT_WAREHOUSE' ||
              selectedRequest?.status === 'HANDED_TO_COMMENDANT' ||
              selectedRequest?.status === 'FULFILLED') && (
              <Button
                type="outline"
                icon={<IconFile />}
                onClick={() => {
                  if (selectedRequest) handleOpenDocModal(selectedRequest, 'KIRIM');
                }}
              >
                OS-1 Kirim Akti
              </Button>
            )}
            {(selectedRequest?.status === 'HANDED_TO_COMMENDANT' ||
              selectedRequest?.status === 'FULFILLED') && (
              <Button
                type="outline"
                icon={<IconFile />}
                onClick={() => {
                  if (selectedRequest) handleOpenDocModal(selectedRequest, 'TRANSFER');
                }}
              >
                OS-2 Nakladnoy
              </Button>
            )}
            {selectedRequest?.status === 'FULFILLED' && (
              <Button
                type="outline"
                icon={<IconFile />}
                onClick={() => {
                  if (selectedRequest) handleOpenDocModal(selectedRequest, 'KAFEDRA_HANDOVER');
                }}
                style={{ color: '#096dd9', borderColor: '#91d5ff', backgroundColor: '#e6f7ff' }}
              >
                Qabul Dalolatnomasi (Akt)
              </Button>
            )}
            <Button type="primary" onClick={() => setIsDetailModalVisible(false)}>
              Yopish
            </Button>
          </Space>
        }
      >
        {selectedRequest && (() => {
          const stageDetails = getStageDetails(selectedRequest.status, selectedRequest);
          return (
          <div>
            {/* Live Progress Hero Banner */}
            <div
              style={{
                marginBottom: 20,
                padding: '14px 18px',
                background:
                  selectedRequest.status === 'REJECTED'
                    ? '#FFF2F0'
                    : selectedRequest.status === 'FULFILLED'
                    ? '#F6FFED'
                    : '#E8F3FF',
                border: `1px solid ${stageDetails.color}`,
                borderRadius: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={stageDetails.color} style={{ fontWeight: 700, borderRadius: 2 }}>
                    {stageDetails.title.toUpperCase()}
                  </Tag>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {stageDetails.description}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: stageDetails.color }}>
                  Jarayon: {stageDetails.percent}%
                </div>
              </div>
              <Progress
                percent={stageDetails.percent}
                status={selectedRequest.status === 'REJECTED' ? 'error' : selectedRequest.status === 'FULFILLED' ? 'success' : 'normal'}
                size="small"
                showText={false}
                color={stageDetails.color}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--color-text-2)', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <b>Hozirgi mas’ul:</b> {stageDetails.currentActor}
                </div>
                {selectedRequest.status !== 'FULFILLED' && selectedRequest.status !== 'REJECTED' && (
                  <div style={{ color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                    Keyingi bosqich mas’uliga tizim avtomatik bildirishnoma yuborgan
                  </div>
                )}
              </div>
            </div>

            {/* 7-Step Workflow Tracker */}
            <div style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--color-fill-1)', borderRadius: 4 }}>
              <Steps
                direction="vertical"
                current={getStepCurrent(selectedRequest.status)}
                status={selectedRequest.status === 'REJECTED' ? 'error' : 'process'}
              >
                <Step
                  title={`1. Xodim Talabnomasi (${(selectedRequest as any).requesterPosition || selectedRequest.requesterRole || 'Mas\'ul Xodim'})`}
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Yuborilgan sana:</b> {selectedRequest.submittedAt ? new Date(selectedRequest.submittedAt).toLocaleString() : selectedRequest.createdAt}</div>
                      <div><b>Tashabbuskor:</b> {selectedRequest.requesterName} · {(selectedRequest as any).requesterPosition || 'Xodim'} ({selectedRequest.departmentName || 'Bo\'lim'})</div>
                    </div>
                  }
                />
                <Step
                  title="2. Moliya-iqtisod Prorektori Vizasi"
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {getStepCurrent(selectedRequest.status) > 1 ? '✅ Viza berildi (QR Biometrik)' : '⏳ Viza kutilmoqda'}</div>
                      {selectedRequest.prorektorApprovedAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.prorektorApprovedAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
                <Step
                  title="3. Universitet Rektori Vizasi"
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {getStepCurrent(selectedRequest.status) > 2 ? '✅ Ruxsat berildi va imzolandi' : '⏳ Rektor qabulida'}</div>
                      {selectedRequest.rectorApprovedAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.rectorApprovedAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
                <Step
                  title="4. Bosh Hisobchi Moliyaviy Tasdig‘i"
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {getStepCurrent(selectedRequest.status) > 3 ? '✅ Moliyalashtirildi va sub-hisob biriktirildi' : '⏳ Moliyaviy tasdiq kutilmoqda'}</div>
                      {selectedRequest.accountantFinancedAt && (
                        <div style={{ marginTop: 4 }}>
                          <Tag color="purple" style={{ marginRight: 6 }}>Manba: {selectedRequest.fundingSource || 'BYUDJET'}</Tag>
                          <Tag color="cyan" style={{ marginRight: 6 }}>Sub-hisob: {selectedRequest.subAccountCode || '013'}</Tag>
                          {selectedRequest.allocatedAmount && (
                            <Tag color="green">Ajratilgan: {Number(selectedRequest.allocatedAmount).toLocaleString()} so‘m</Tag>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                            Sana: {new Date(selectedRequest.accountantFinancedAt).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  }
                />
                <Step
                  title="5. Ombor Kirimi (OS-1 Kirim Akti)"
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {getStepCurrent(selectedRequest.status) > 4 ? '✅ Mahsulot omborga qabul qilindi (OS-1 muhrlandi)' : '⏳ Xarid va ombor kirimi kutilmoqda'}</div>
                      {selectedRequest.warehouseReceivedAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.warehouseReceivedAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
                <Step
                  title="6. Bino Komendantiga Topshirish (OS-2 Nakladnoy)"
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {getStepCurrent(selectedRequest.status) > 5 ? '✅ Omborchi va Komendant o‘rtasida OS-2 nakladnoyi imzolandi' : '⏳ Ombordan binoga topshirish kutilmoqda'}</div>
                      {selectedRequest.commendantHandedAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.commendantHandedAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
                <Step
                  title={`7. ${selectedRequest.requesterName || 'Mas\'ul Xodim'} — Bo'lim Qabul Qilish Dalolatnomasi`}
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {selectedRequest.status === 'FULFILLED' ? '🎉 Komendant va Talabgor o‘rtasida o‘zaro topshirish-qabul qilish dalolatnomasi imzolandi' : '⏳ Mudir xonasida o‘zaro topshirish-qabul qilish kutilmoqda'}</div>
                      {selectedRequest.fulfilledAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.fulfilledAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
              </Steps>
            </div>

            {/* Details Table */}
            <Descriptions
              column={1}
              border
              data={[
                { label: 'Talabnoma Raqami', value: selectedRequest.requestNumber },
                { label: 'Talabgor Xodim', value: selectedRequest.requesterName },
                { label: 'Bo‘lim / Kafedra', value: selectedRequest.departmentName || '—' },
                { label: 'Ehtiyoj Asosi / Maqsad', value: selectedRequest.purpose },
                {
                  label: 'So‘ralgan Mahsulotlar',
                  value: (
                    <div>
                      {selectedRequest.items.map((i) => (
                        <div key={i.id} style={{ fontWeight: 600 }}>
                          • {i.itemName}: {i.requestedQty} {i.unit}
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  label: 'Moliyalashtirish Holati',
                  value: selectedRequest.fundingSource ? (
                    <div>
                      <StatusTag status={selectedRequest.fundingSource} domain="funding" />{' '}
                      <Tag color="cyan">Sub-hisob: {selectedRequest.subAccountCode}</Tag>{' '}
                      {selectedRequest.allocatedAmount && (
                        <Tag color="green">{Number(selectedRequest.allocatedAmount).toLocaleString()} so‘m</Tag>
                      )}
                    </div>
                  ) : 'Moliyalashtirish kutilmoqda',
                },
                { label: 'Tasdiqlovchi Izohi', value: selectedRequest.approvalNote || 'Kiritilmagan' },
              ]}
            />
            </div>
          );
        })()}
      </Modal>

      {/* TAKOMILLASHTIRILGAN YANGI TALABNOMA MODALI */}
      <NewRequestModal
        visible={isNewModalVisible}
        onClose={() => {
          setIsNewModalVisible(false);
          setDraftItems([]);
          setInitialPurpose('');
          if (searchParams.get('create')) {
            searchParams.delete('create');
            setSearchParams(searchParams);
          }
        }}
        onSubmit={handleNewRequestSubmit}
        initialDraftItems={draftItems}
        initialPurpose={initialPurpose}
      />

      {/* PHASE L1: CHIEF ACCOUNTANT FINANCE MODAL */}
      <Modal
        title={`Bosh Hisobchi: Moliyalashtirish va Sub-hisob Biriktirish (${requestToFinance?.requestNumber})`}
        visible={isFinanceModalVisible}
        style={{ width: 560 }}
        onOk={handleFinanceSubmit}
        onCancel={() => {
          setIsFinanceModalVisible(false);
          setRequestToFinance(null);
        }}
        okText="Tasdiqlash va QR-Imzolashga O‘tish"
        cancelText="Bekor qilish"
      >
        <Alert
          type="info"
          style={{ marginBottom: 16, borderRadius: 0 }}
          title="O‘zbekiston Oliy Ta’lim Standartlari Bo‘yicha Sub-hisoblar"
          content="Mazkur xarid uchun smetadan tegishli mablag‘ manbasi va buxgalteriya sub-hisob kodini tanlang. Tasdiqlash QR-Pairing orqali biometrik imzolanadi."
        />
        <Form form={financeForm} layout="vertical">
          <FormItem
            label="Mablag‘ Manbasi (Funding Source)"
            field="fundingSource"
            rules={[{ required: true, message: 'Mablag‘ manbasini tanlang!' }]}
          >
            <Select
              placeholder="Mablag‘ manbasini tanlang"
              options={getStatusSelectOptions('funding')}
            />
          </FormItem>

          <FormItem
            label="Buxgalteriya Sub-hisob Kodi"
            field="subAccountCode"
            rules={[{ required: true, message: 'Sub-hisob kodini tanlang!' }]}
          >
            <Select placeholder="Sub-hisob kodini tanlang">
              <Select.Option value="013">013 — Mashina va asbob-uskunalar (Asosiy vositalar)</Select.Option>
              <Select.Option value="060">060 — Materiallar va xo‘jalik sarf tovarlari</Select.Option>
              <Select.Option value="212">212 — Boshqa xo‘jalik va inventar jihozlari</Select.Option>
            </Select>
          </FormItem>

          <FormItem
            label="Ajratilayotgan Mablag‘ (so‘m)"
            field="allocatedAmount"
            rules={[{ required: true, message: 'Mablag‘ miqdorini kiriting!' }]}
          >
            <InputNumber
              min={1000}
              max={1000000000}
              step={100000}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            />
          </FormItem>

          <FormItem label="Bosh Hisobchi Xulosasi / Izohi" field="note">
            <Input.TextArea
              placeholder="Masalan: Smeta doirasida to‘lov ma’qullandi, yetkazib beruvchi bilan shartnoma tuzishga ruxsat etiladi"
              rows={2}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* RASMIY HUJJAT (OS-1 / OS-2 / KAFEDRA_HANDOVER) MODAL */}
      {selectedDocRequest && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType={docModalType}
          entityId={selectedDocRequest.id}
          docNumber={
            docModalType === 'KIRIM'
              ? `${selectedDocRequest.requestNumber}-OS1`
              : docModalType === 'TRANSFER'
              ? `${selectedDocRequest.requestNumber}-OS2`
              : `${selectedDocRequest.requestNumber}-AKT`
          }
          date={selectedDocRequest.createdAt}
          sourceLocation={
            docModalType === 'KIRIM'
              ? "Ta'minotchi / Yetkazib beruvchi"
              : docModalType === 'TRANSFER'
              ? 'Universitet Bosh Ombori'
              : (selectedDocRequest.commendantName ? `${selectedDocRequest.commendantName} (Bino komendanti)` : 'Bino komendantligi')
          }
          targetLocation={
            docModalType === 'KIRIM'
              ? 'Universitet Bosh Ombori'
              : docModalType === 'TRANSFER'
              ? (selectedDocRequest.commendantName ? `${selectedDocRequest.commendantName} (Bino)` : 'Bino komendanti')
              : `${selectedDocRequest.departmentName || 'Kafedra / Bo‘lim'}${selectedDocRequest.targetRoomNumber ? ` (${selectedDocRequest.targetRoomNumber}-xona)` : ''}`
          }
          senderName={
            docModalType === 'KIRIM'
              ? "Yetkazib beruvchi tashkilot vakili"
              : docModalType === 'TRANSFER'
              ? ((selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri')
              : (selectedDocRequest.commendantName || 'Bino komendanti')
          }
          receiverName={
            docModalType === 'KIRIM'
              ? ((selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri')
              : docModalType === 'TRANSFER'
              ? (selectedDocRequest.commendantName || 'Bino komendanti')
              : `${selectedDocRequest.requesterName} (${selectedDocRequest.requesterRole === 'VICE_RECTOR_FINANCE' ? 'Prorektor' : 'Kafedra mudiri / Mas’ul'})`
          }
          items={selectedDocRequest.items.map((i, idx) => ({
            inventoryNumber: `SRF-${idx + 1}`,
            name: i.itemName,
            quantity: i.requestedQty,
            unit: i.unit,
          }))}
          reason={selectedDocRequest.purpose}
          signatures={computedDocSignatures}
        />
      )}

      {/* 60s Dynamic QR-Pairing Modal for Mobile Biometric Signing */}
      {qrSignPayload && (
        <QRPairingModal
          visible={isQrModalVisible}
          onClose={() => setIsQrModalVisible(false)}
          onSuccess={handleQrSignSuccess}
          payload={qrSignPayload}
        />
      )}

      {/* Reject Reason Modal (Rule 4.1 & Rule 5.4) */}
      <RejectReasonModal
        visible={isRejectModalVisible}
        onClose={() => {
          setIsRejectModalVisible(false);
          setRequestToReject(null);
        }}
        onConfirm={handleConfirmReject}
        loading={isRejecting}
        itemIdentifier={requestToReject?.requestNumber}
      />
    </div>
  );
};
