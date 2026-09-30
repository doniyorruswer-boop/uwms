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
  Dropdown,
  Menu,
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
  IconDown,
  IconSend,
  IconEdit,
  IconPhone,
  IconTool,
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
import { TechnicalInspectionModal } from '../../components/Requests/TechnicalInspectionModal';
import { StatusTag } from '../../components/Common/StatusTag';
import { getStatusLabel, getStatusSelectOptions } from '../../constants/status.constants';

const FormItem = Form.Item;
const Step = Steps.Step;
const { Row, Col } = Grid;

export const RequestsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const {
    requests,
    isLoading,
    isFetching,
    isError,
    refetch,
    createRequest,
    updateRequestStatus,
    advanceWorkflow,
    submitTechnicalInspection,
  } = useRequestsQuery();
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

  // Texnik Ko‘rik (AKT-TEX) State
  const [isInspectionModalVisible, setIsInspectionModalVisible] = useState<boolean>(false);
  const [selectedInspectionRequest, setSelectedInspectionRequest] = useState<RequestRecord | null>(null);
  const [isSubmittingInspection, setIsSubmittingInspection] = useState<boolean>(false);
  const [pendingInspectionAction, setPendingInspectionAction] = useState<{ req: RequestRecord; checklist: any } | null>(null);

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
    socket.on('request:created', handleRequestCreated);
    socket.on('REQUEST_UPDATED', handleRequestUpdated);
    socket.on('request:updated', handleRequestUpdated);

    return () => {
      socket.off('REQUEST_CREATED', handleRequestCreated);
      socket.off('request:created', handleRequestCreated);
      socket.off('REQUEST_UPDATED', handleRequestUpdated);
      socket.off('request:updated', handleRequestUpdated);
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
      case 'APPROVED_BY_HEAD':
        return 2;
      case 'APPROVED_BY_PRORECTOR':
        return 3;
      case 'APPROVED_BY_RECTOR':
        return 4;
      case 'FINANCED_BY_ACCOUNTANT':
        return 5;
      case 'RECEIVED_AT_WAREHOUSE':
      case 'APPROVED_BY_WAREHOUSE':
        return 6;
      case 'HANDED_TO_COMMENDANT':
        return 7;
      case 'FULFILLED':
        return 8;
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
      case 'APPROVED_BY_HEAD':
        return {
          step: 2,
          total: 7,
          percent: 14,
          title: '2/7: Prorektor Vizasi',
          currentActor: record?.prorektorApprovedByName
            ? `Moliya-iqtisod prorektori (${record.prorektorApprovedByName})`
            : 'Moliya-iqtisod prorektori',
          color: '#ff7d00',
          badgeStatus: 'warning' as const,
          description: 'Talabnoma topshirilgan, Moliya-iqtisod prorektori vizasi kutilmoqda',
        };
      case 'APPROVED_BY_PRORECTOR':
        return {
          step: 3,
          total: 7,
          percent: 28,
          title: '3/7: Rektor Vizasi',
          currentActor: record?.rectorApprovedByName
            ? `Universitet Rektori (${record.rectorApprovedByName})`
            : 'Universitet Rektori',
          color: '#722ed1',
          badgeStatus: 'processing' as const,
          description: 'Prorektor viza berdi, Universitet Rektori tasdig‘i kutilmoqda',
        };
      case 'APPROVED_BY_RECTOR':
        return {
          step: 4,
          total: 7,
          percent: 42,
          title: '4/7: Bosh Hisobchi Moliyalash',
          currentActor: record?.accountantFinancedByName
            ? `Bosh hisobchi (${record.accountantFinancedByName})`
            : 'Bosh hisobchi',
          color: '#165dff',
          badgeStatus: 'processing' as const,
          description: 'Rektor ruxsat berdi, byudjet/kontrakt smetasi va sub-hisob biriktirilmoqda',
        };
      case 'FINANCED_BY_ACCOUNTANT':
        return {
          step: 5,
          total: 7,
          percent: 57,
          title: '5/7: Ombor Kirimi (OS-1)',
          currentActor: record?.warehouseReceivedByName
            ? `Bosh ombor mudiri (${record.warehouseReceivedByName})`
            : 'Bosh ombor mudiri',
          color: '#00b42a',
          badgeStatus: 'processing' as const,
          description: 'Mablag‘ ajratildi, tovarlar xarid qilinib omborga qabul qilinishi kutilmoqda',
        };
      case 'RECEIVED_AT_WAREHOUSE':
      case 'APPROVED_BY_WAREHOUSE': {
        if (record?.requiresTechnicalInspection && !record?.engineerInspectedAt) {
          return {
            step: 6,
            total: 7,
            percent: 64,
            title: '6/7: Mas’ul Injener Texnik Ko‘rigi (AKT-TEX)',
            currentActor: record?.assignedEngineerName
              ? `Mas’ul Injener (${record.assignedEngineerName})`
              : 'Mas’ul Texnik Injener',
            color: '#165DFF',
            badgeStatus: 'processing' as const,
            description: 'Tovarlar omborda (OS-1). Topshirishdan oldin mas’ul injener tomonidan 5 bosqichli xavfsizlik va sozlik ko‘rigi (AKT-TEX) o‘tkazilishi kutilmoqda',
          };
        }
        const hasRoom = Boolean(record?.targetRoomId || record?.targetRoomName || record?.targetRoomNumber);
        return {
          step: 6,
          total: 7,
          percent: 71,
          title: hasRoom ? '6/7: Komendantga Topshirish (OS-2)' : '6/7: Bo‘lim Mas’uliga Topshirish (OS-2 — Komendantsiz)',
          currentActor: hasRoom
            ? (record?.commendantHandedByName || record?.commendantName
                ? `Bosh omborchi va Bino komendanti (${record.commendantHandedByName || record.commendantName})`
                : 'Bosh omborchi va Bino komendanti')
            : (record?.requesterName ? `Bosh omborchi va Bo‘lim mas’uli (${record.requesterName})` : 'Bosh omborchi va Bo‘lim mas’uli'),
          color: '#0fc6c2',
          badgeStatus: 'processing' as const,
          description: hasRoom
            ? (record?.requiresTechnicalInspection ? 'Texnik ko‘rikdan o‘tgan (Soz). Bino komendantiga OS-2 nakladnoy bilan topshirilishi kutilmoqda' : 'Mahsulot omborga keldi (OS-1). Bino komendantiga OS-2 nakladnoy bilan topshirilishi kutilmoqda')
            : (record?.requiresTechnicalInspection ? 'Texnik ko‘rikdan o‘tgan (Soz). Bo‘lim mas’uliga to‘g‘ridan-to‘g‘ri (komendantsiz) OS-2 bilan topshirilishi kutilmoqda' : 'Mahsulot omborga keldi (OS-1). Bo‘lim mas’uliga to‘g‘ridan-to‘g‘ri (komendantsiz) OS-2 bilan topshirilishi kutilmoqda'),
        };
      }
      case 'HANDED_TO_COMMENDANT':
        return {
          step: 7,
          total: 7,
          percent: 86,
          title: '7/7: Xonada Qabul Qilish',
          currentActor: record?.requesterName
            ? `Bino komendanti va Talabgor (${record.requesterName})`
            : 'Bino komendanti va Talabgor',
          color: '#fa8c16',
          badgeStatus: 'processing' as const,
          description: 'Ashyolar binoga yetkazildi (OS-2). Komendant bilan xonada o‘zaro qabul qilib imzolash kutilmoqda',
        };
      case 'FULFILLED': {
        const isDirect = !record?.commendantHandedAt;
        return {
          step: 7,
          total: 7,
          percent: 100,
          title: isDirect ? 'To‘liq Topshirildi (Komendantsiz)' : '7/7: To‘liq Topshirildi (Balansda)',
          currentActor: record?.requesterName || 'Talabgor (Mas’ul)',
          color: '#00b42a',
          badgeStatus: 'success' as const,
          description: isDirect
            ? 'Ashyolar ombordan to‘g‘ridan-to‘g‘ri bo‘limga topshirildi va balansga o‘tdi (Komendantsiz)'
            : 'Ashyolar kafedraga topshirildi, yakuniy dalolatnoma imzolandi va balansga o‘tdi',
        };
      }
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

  const handleDirectHandover = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setPendingWorkflowAction({
      req,
      targetStatus: 'FULFILLED',
      payload: { note: 'Ombordan to‘g‘ridan-to‘g‘ri bo‘lim mas’uliga topshirildi (Komendantsiz)' },
    });
    setQrSignPayload({
      docNumber: `${req.requestNumber}-OS2`,
      docType: 'OS_2',
      title: `Bo‘limga To‘g‘ridan-to‘g‘ri Topshirish (OS-2 Chiqim: ${req.requestNumber})`,
      departmentName: req.departmentName || undefined,
      itemSummary: req.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerName: req.requesterName || 'Bo‘lim mas’ul xodimi',
      targetSignerRole: (req as any).requesterPosition || req.requesterRole || 'Bo‘lim mas’uli',
      metadata: {
        stage: 'DIRECT_DEPARTMENT_HANDOVER',
        reqId: req.id,
        sender: 'Bosh ombor mudiri',
        receiver: req.requesterName,
      },
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

  const handleOpenInspectionModal = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setSelectedInspectionRequest(req);
    setIsInspectionModalVisible(true);
  };

  const handleConfirmInspection = async (checklist: any) => {
    if (!selectedInspectionRequest) return;
    setIsInspectionModalVisible(false);
    setPendingInspectionAction({
      req: selectedInspectionRequest,
      checklist,
    });
    setQrSignPayload({
      docNumber: `${selectedInspectionRequest.requestNumber}-AKT-TEX`,
      docType: 'AKT_TEX',
      title: `Texnik Ko‘rik va Sozlik Dalolatnomasi (AKT-TEX: ${selectedInspectionRequest.requestNumber})`,
      departmentName: selectedInspectionRequest.departmentName || undefined,
      itemSummary: selectedInspectionRequest.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join(', '),
      targetSignerName: selectedInspectionRequest.assignedEngineerName || user?.fullName || 'Mas’ul Injener',
      targetSignerRole: (user as any)?.position || 'Mas’ul Injener / IT Mutaxassisi',
      metadata: {
        stage: 'ENGINEER_INSPECTION',
        reqId: selectedInspectionRequest.id,
        engineerId: user?.id,
        checklist,
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
    } else if (pendingInspectionAction) {
      const targetReq = pendingInspectionAction.req;
      try {
        setIsSubmittingInspection(true);
        await submitTechnicalInspection({
          id: targetReq.id,
          checklist: pendingInspectionAction.checklist,
        });
        // Ssenariy 5: Muhrlangan rasmiy elektron AKT-TEX hujjatini avtomatik ochish
        setSelectedDocRequest({
          ...targetReq,
          engineerInspectedAt: new Date().toISOString(),
          engineerInspectedByName: user?.fullName || targetReq.assignedEngineerName || 'Mas’ul Injener',
        });
        setDocModalType('AKT_TEX');
        setIsDocModalVisible(true);
      } catch (err: any) {
        Message.error(err?.response?.data?.message || 'Texnik ko‘rikni tasdiqlashda xatolik yuz berdi');
      } finally {
        setIsSubmittingInspection(false);
        setPendingInspectionAction(null);
      }
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
      const hasRoom = Boolean(selectedDocRequest.targetRoomId || selectedDocRequest.targetRoomName || selectedDocRequest.targetRoomNumber);
      const isDirect = !hasRoom || (!selectedDocRequest.commendantHandedAt && selectedDocRequest.status === 'FULFILLED');
      const isSigned =
        Boolean(selectedDocRequest.commendantHandedAt) ||
        ['HANDED_TO_COMMENDANT', 'FULFILLED'].includes(selectedDocRequest.status);
      const signTime = selectedDocRequest.fulfilledAt || selectedDocRequest.commendantHandedAt;
      return [
        {
          role: 'Topshiruvchi bosh ombor mudiri',
          name: (selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri',
          isSigned,
          signedAt: signTime ? new Date(signTime).toLocaleString('uz-UZ') : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
        {
          role: isDirect ? `Qabul qiluvchi mas'ul (${(selectedDocRequest as any).requesterPosition || 'Bo‘lim mas’uli'})` : 'Qabul qiluvchi bino komendanti',
          name: isDirect ? selectedDocRequest.requesterName : (selectedDocRequest.commendantName || 'Bino komendanti'),
          isSigned,
          signedAt: signTime ? new Date(signTime).toLocaleString('uz-UZ') : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
      ];
    }

    if (docModalType === 'KAFEDRA_HANDOVER') {
      const hasRoom = Boolean(selectedDocRequest.targetRoomId || selectedDocRequest.targetRoomName || selectedDocRequest.targetRoomNumber);
      const isDirect = !hasRoom || (!selectedDocRequest.commendantHandedAt && selectedDocRequest.status === 'FULFILLED');
      const isSigned = Boolean(selectedDocRequest.fulfilledAt) || selectedDocRequest.status === 'FULFILLED';
      return [
        {
          role: isDirect ? 'Topshiruvchi bosh ombor mudiri' : 'Topshiruvchi bino komendanti',
          name: isDirect
            ? ((selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri')
            : (selectedDocRequest.commendantName || (selectedDocRequest as any).commendantHandedByName || 'Bino komendanti'),
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

    if (docModalType === 'AKT_TEX') {
      const isSigned = Boolean(selectedDocRequest.engineerInspectedAt);
      return [
        {
          role: 'Topshiruvchi / Saqlovchi: Bosh ombor mudiri',
          name: (selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri',
          isSigned: Boolean(selectedDocRequest.warehouseReceivedAt),
          signedAt: selectedDocRequest.warehouseReceivedAt
            ? new Date(selectedDocRequest.warehouseReceivedAt).toLocaleString('uz-UZ')
            : undefined,
          biometricType: 'Dinamik Mobil QR-Pairing (Biometrik Tasdiq)',
        },
        {
          role: 'Texnik ko‘rikdan o‘tkazgan: Mas’ul Texnik Injener',
          name:
            selectedDocRequest.assignedEngineerName ||
            selectedDocRequest.engineerInspectedByName ||
            (selectedDocRequest as any).assignedEngineer?.name ||
            'Mas’ul Injener',
          isSigned,
          signedAt: selectedDocRequest.engineerInspectedAt
            ? new Date(selectedDocRequest.engineerInspectedAt).toLocaleString('uz-UZ')
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
      // Keshni tozalab, darhol qayta yuklash (staleTime dan qat'iy nazar)
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      await refetch();
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

  const handleCloneOrResubmit = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    const clonedItems = req.items.map((i) => ({
      itemId: i.itemId || undefined,
      itemName: i.itemName,
      quantity: i.requestedQty,
      unit: i.unit,
    }));
    setDraftItems(clonedItems);
    setInitialPurpose(req.purpose || '');
    setIsDetailModalVisible(false);
    setIsNewModalVisible(true);
  };

  const handleNewRequestSubmit = async (payload: {
    purpose: string;
    targetRoomId?: string;
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
      <Card className="uwms-card" bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space size="small" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="Zayavka raqami, talabgor, bo‘lim yoki mahsulot bo‘yicha qidirish..."
              style={{ width: 380, borderRadius: 0 }}
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
            {isSocketConnected ? (
              <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Live Workflow Sync (Faol)
              </Tag>
            ) : (
              <Tag color="gray" style={{ borderRadius: 0, whiteSpace: 'nowrap' }}>Offline</Tag>
            )}
          </Space>

          <Space size="small" wrap>
            <Button
              icon={<IconRefresh />}
              onClick={() => refetch()}
              style={{ borderRadius: 0, whiteSpace: 'nowrap' }}
            >
              Yangilash
            </Button>
            <Button icon={<IconDownload />} onClick={handleExportExcel} style={{ borderRadius: 0, whiteSpace: 'nowrap' }}>
              Export
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF', whiteSpace: 'nowrap' }}
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
        scrollX={1420}
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
            width: 200,
            render: (name: string, record: RequestRecord) => (
              <div style={{ paddingLeft: 8 }}>
                <CategoryThumbnail
                  icon={<IconUserGroup />}
                  name={name}
                  tag={record.requestNumber}
                  color="#165DFF"
                  bg="#E8F3FF"
                />
                {record.requesterPhone && (
                  <div style={{ marginTop: 3, fontSize: 11, color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconPhone style={{ fontSize: 11, color: '#165DFF' }} />
                    <a
                      href={`tel:${record.requesterPhone}`}
                      style={{ color: '#165DFF', textDecoration: 'none', fontWeight: 500 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {record.requesterPhone}
                    </a>
                  </div>
                )}
              </div>
            ),
          },
          {
            title: 'Bo‘lim / Kafedra',
            dataIndex: 'departmentName',
            width: 220,
            render: (deptName: string, record: RequestRecord) => {
              const hasRoom = Boolean(record.targetRoomId || record.targetRoomName || record.targetRoomNumber);
              const roomLabel = record.targetRoomNumber ? `${record.targetRoomNumber}-xona` : record.targetRoomName;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {deptName || '—'}
                  </div>
                  {hasRoom ? (
                    <Tag size="small" color="arcoblue" style={{ width: 'fit-content', borderRadius: 2, fontSize: 10, padding: '0 4px' }}>
                      🏛 Komendant orqali ({roomLabel || 'Xona'})
                    </Tag>
                  ) : (
                    <Tag size="small" color="green" style={{ width: 'fit-content', borderRadius: 2, fontSize: 10, padding: '0 4px' }}>
                      ⚡ To‘g‘ridan-to‘g‘ri (Obyekt / Xonasiz)
                    </Tag>
                  )}
                </div>
              );
            },
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
            title: 'Hujjatlar',
            width: 140,
            render: (_, record: RequestRecord) => {
              const hasOS1 =
                record.status === 'RECEIVED_AT_WAREHOUSE' ||
                record.status === 'HANDED_TO_COMMENDANT' ||
                record.status === 'FULFILLED';
              const hasOS2 =
                record.status === 'HANDED_TO_COMMENDANT' ||
                record.status === 'FULFILLED';
              const hasHandover = record.status === 'FULFILLED';
              const hasAktTex = Boolean(record.engineerInspectedAt);
              const hasDocs = hasOS1 || hasOS2 || hasHandover || hasAktTex;

              if (!hasDocs) {
                return (
                  <span style={{ color: 'var(--color-text-4)', fontSize: 13, paddingLeft: 6 }}>
                    —
                  </span>
                );
              }

              const docMenuList = (
                <Menu onClickMenuItem={(_, e) => e?.stopPropagation?.()}>
                  {hasOS1 && (
                    <Menu.Item
                      key="doc-os1"
                      onClick={(e) => handleOpenDocModal(record, 'KIRIM', e)}
                    >
                      <Space size={8}>
                        <IconFile style={{ color: '#165DFF' }} />
                        <span>OS-1 Ombor Kirim Akti</span>
                      </Space>
                    </Menu.Item>
                  )}
                  {hasAktTex && (
                    <Menu.Item
                      key="doc-akt-tex"
                      onClick={(e) => handleOpenDocModal(record, 'AKT_TEX', e)}
                    >
                      <Space size={8}>
                        <IconTool style={{ color: '#0fc6c2' }} />
                        <span>AKT-TEX Sozlik Dalolatnomasi</span>
                      </Space>
                    </Menu.Item>
                  )}
                  {hasOS2 && (
                    <Menu.Item
                      key="doc-os2"
                      onClick={(e) => handleOpenDocModal(record, 'TRANSFER', e)}
                    >
                      <Space size={8}>
                        <IconFile style={{ color: '#ff7d00' }} />
                        <span>
                          {record.targetRoomId || record.targetRoomName || record.targetRoomNumber
                            ? 'OS-2 Ombordan Binoga Chiqim'
                            : 'OS-2 Ombordan Bo‘limga Chiqim (Komendantsiz)'}
                        </span>
                      </Space>
                    </Menu.Item>
                  )}
                  {hasHandover && (
                    <Menu.Item
                      key="doc-handover"
                      onClick={(e) => handleOpenDocModal(record, 'KAFEDRA_HANDOVER', e)}
                    >
                      <Space size={8}>
                        <IconFile style={{ color: '#00b42a' }} />
                        <span>
                          {record.targetRoomId || record.targetRoomName || record.targetRoomNumber
                            ? 'Xonada Qabul Qilish Akti'
                            : 'Bo‘lim Qabul Qilish Akti'}
                        </span>
                      </Space>
                    </Menu.Item>
                  )}
                </Menu>
              );

              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown droplist={docMenuList} trigger="click" position="bl">
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconFile />}
                      style={{
                        borderRadius: 0,
                        padding: '0 8px',
                        color: '#165DFF',
                        borderColor: '#94BFFF',
                      }}
                    >
                      Hujjatlar <IconDown style={{ fontSize: 10, marginLeft: 2 }} />
                    </Button>
                  </Dropdown>
                </div>
              );
            },
          },
          {
            title: 'Amallar',
            width: 160,
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

              const hasRoomForRecord = Boolean(record.targetRoomId || record.targetRoomName || record.targetRoomNumber);

              const isInspectionPending = Boolean(record.requiresTechnicalInspection && !record.engineerInspectedAt);
              const isAssignedEngineer = Boolean(
                user?.id === record.assignedEngineerId ||
                /injener|muhandis|texnik/i.test(user?.position || '') ||
                user?.role === 'SUPER_ADMIN' ||
                user?.role === 'ADMIN'
              );
              const canInspect =
                isInspectionPending &&
                record.status === 'RECEIVED_AT_WAREHOUSE' &&
                isAssignedEngineer;

              const canWarehouseDirectHandover =
                record.status === 'RECEIVED_AT_WAREHOUSE' &&
                (user?.role === 'HEAD_WAREHOUSE' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN');

              const canCommendantHandover =
                record.status === 'RECEIVED_AT_WAREHOUSE' &&
                hasRoomForRecord &&
                (user?.role === 'COMMENDANT' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN');

              const isRequester = user?.id === record.requesterId;
              const isDeptMol =
                user?.role === 'MOL' &&
                (!user?.departmentId || user?.departmentId === record.departmentId);

              const canMudirFulfill =
                record.status === 'HANDED_TO_COMMENDANT' &&
                user?.role !== 'COMMENDANT' &&
                (isRequester || isDeptMol);

              const canMudirDirectFulfill =
                record.status === 'RECEIVED_AT_WAREHOUSE' &&
                !hasRoomForRecord &&
                user?.role !== 'COMMENDANT' &&
                user?.role !== 'HEAD_WAREHOUSE' &&
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

              const actionButton = (() => {
                if (canProrektorApprove) {
                  return (
                    <Tooltip content="1-Viza: Prorektor elektron imzosi (QR)">
                      <Button
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconCheck />}
                        onClick={(e) => handleProrektorApprove(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        1-Viza
                      </Button>
                    </Tooltip>
                  );
                }
                if (canRectorApprove) {
                  return (
                    <Tooltip content="2-Viza: Rektor elektron imzosi (QR)">
                      <Button
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconCheck />}
                        onClick={(e) => handleRectorApprove(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        2-Viza
                      </Button>
                    </Tooltip>
                  );
                }
                if (canAccountantFinance) {
                  return (
                    <Tooltip content="Moliya va Sub-hisob belgilash (QR)">
                      <Button
                        size="small"
                        type="primary"
                        icon={<IconCheckCircle />}
                        onClick={(e) => handleOpenFinanceModal(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px', background: '#722ed1', borderColor: '#722ed1' }}
                      >
                        Moliyalash
                      </Button>
                    </Tooltip>
                  );
                }
                if (canWarehouseReceive) {
                  return (
                    <Tooltip content="Ombor kirim aktini tasdiqlash (OS-1 QR)">
                      <Button
                        size="small"
                        type="primary"
                        icon={<IconArchive />}
                        onClick={(e) => handleWarehouseReceive(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Ombor Kirimi
                      </Button>
                    </Tooltip>
                  );
                }
                if (canInspect) {
                  return (
                    <Tooltip content={`Mas’ul injener ko‘rigi (AKT-TEX): 5 bosqichli xavfsizlik va sozlik tekshiruvi. ${record.assignedEngineerName ? `Biriktirilgan: ${record.assignedEngineerName}` : ''}`}>
                      <Button
                        size="small"
                        type="primary"
                        icon={<IconTool />}
                        onClick={(e) => handleOpenInspectionModal(record, e)}
                        style={{
                          borderRadius: 0,
                          padding: '0 8px',
                          background: '#0fc6c2',
                          borderColor: '#0fc6c2',
                        }}
                      >
                        Texnik Ko‘rik
                      </Button>
                    </Tooltip>
                  );
                }
                const hasRoom = Boolean(record.targetRoomId || record.targetRoomName || record.targetRoomNumber);

                if (canWarehouseDirectHandover && user?.role === 'HEAD_WAREHOUSE') {
                  return (
                    <Space size={4}>
                      <Tooltip content={isInspectionPending ? "Diqqat: Mas’ul injener tomonidan texnik ko‘rik (AKT-TEX) o‘tkazilishi kutilmoqda! Topshirish bloklangan." : "Komendantsiz: to‘g‘ridan-to‘g‘ri bo‘lim mas’uliga topshirish (Obyekt/Sarf)"}>
                        <Button
                          disabled={isInspectionPending}
                          size="small"
                          type={!hasRoom ? 'primary' : 'outline'}
                          icon={<IconSend />}
                          onClick={(e) => handleDirectHandover(record, e)}
                          style={{
                            borderRadius: 0,
                            padding: '0 6px',
                            background: !isInspectionPending && !hasRoom ? '#00b42a' : undefined,
                            borderColor: '#00b42a',
                            color: !isInspectionPending && !hasRoom ? '#fff' : '#00b42a',
                          }}
                        >
                          Bo‘limga
                        </Button>
                      </Tooltip>
                      <Tooltip content={isInspectionPending ? "Diqqat: Mas’ul injener tomonidan texnik ko‘rik (AKT-TEX) o‘tkazilishi kutilmoqda! Topshirish bloklangan." : "Binoga qabul / Bino komendantiga topshirish (Xona aktivlari uchun)"}>
                        <Button
                          disabled={isInspectionPending}
                          size="small"
                          type={hasRoom ? 'primary' : 'outline'}
                          icon={<IconCheck />}
                          onClick={(e) => handleCommendantHandover(record, e)}
                          style={{
                            borderRadius: 0,
                            padding: '0 6px',
                            background: !isInspectionPending && hasRoom ? '#ff7d00' : undefined,
                            borderColor: '#ff7d00',
                            color: !isInspectionPending && hasRoom ? '#fff' : '#ff7d00',
                          }}
                        >
                          Binoga
                        </Button>
                      </Tooltip>
                    </Space>
                  );
                }
                if (canCommendantHandover && user?.role === 'COMMENDANT') {
                  return (
                    <Tooltip content={isInspectionPending ? "Diqqat: Mas’ul injener tomonidan texnik ko‘rik (AKT-TEX) o‘tkazilishi kutilmoqda! Topshirish bloklangan." : "Binoga qabul qilib olish (OS-2 QR)"}>
                      <Button
                        disabled={isInspectionPending}
                        size="small"
                        type="primary"
                        icon={<IconCheck />}
                        onClick={(e) => handleCommendantHandover(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px', background: '#ff7d00', borderColor: '#ff7d00' }}
                      >
                        Binoga Qabul
                      </Button>
                    </Tooltip>
                  );
                }
                if (canMudirDirectFulfill) {
                  return (
                    <Tooltip content={isInspectionPending ? "Diqqat: Mas’ul injener tomonidan texnik ko‘rik (AKT-TEX) kutilmoqda" : "Ombordan to‘g‘ridan-to‘g‘ri qabul qilib olish (Komendantsiz)"}>
                      <Button
                        disabled={isInspectionPending}
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconCheckCircle />}
                        onClick={(e) => handleDirectHandover(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Ombordan qabul
                      </Button>
                    </Tooltip>
                  );
                }
                if (canWarehouseDirectHandover && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN')) {
                  return (
                    <Space size={4}>
                      <Tooltip content={isInspectionPending ? "Diqqat: Mas’ul injener tomonidan texnik ko‘rik (AKT-TEX) kutilmoqda" : "Komendantsiz: to‘g‘ridan-to‘g‘ri bo‘lim mas’uliga topshirish"}>
                        <Button
                          disabled={isInspectionPending}
                          size="small"
                          type="primary"
                          icon={<IconSend />}
                          onClick={(e) => handleDirectHandover(record, e)}
                          style={{ borderRadius: 0, padding: '0 6px', background: '#00b42a', borderColor: '#00b42a' }}
                        >
                          Bo‘limga
                        </Button>
                      </Tooltip>
                      <Tooltip content={isInspectionPending ? "Diqqat: Mas’ul injener tomonidan texnik ko‘rik (AKT-TEX) kutilmoqda" : "Binoga qabul (OS-2 QR)"}>
                        <Button
                          disabled={isInspectionPending}
                          size="small"
                          type="primary"
                          icon={<IconCheck />}
                          onClick={(e) => handleCommendantHandover(record, e)}
                          style={{ borderRadius: 0, padding: '0 6px', background: '#ff7d00', borderColor: '#ff7d00' }}
                        >
                          Binoga
                        </Button>
                      </Tooltip>
                    </Space>
                  );
                }
                if (canMudirFulfill) {
                  return (
                    <Tooltip content="Xonaga qabul qilib olish (Yakuniy QR)">
                      <Button
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconCheckCircle />}
                        onClick={(e) => handleMudirFulfill(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Qabul qilish
                      </Button>
                    </Tooltip>
                  );
                }
                if (record.status === 'REJECTED' && (user?.id === record.requesterId || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN')) {
                  return (
                    <Tooltip content="Zayavka rad etilgan: xatolarini to‘g‘rilab qayta yuborish">
                      <Button
                        size="small"
                        type="primary"
                        status="warning"
                        icon={<IconEdit />}
                        onClick={(e) => handleCloneOrResubmit(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Qayta tuzatish
                      </Button>
                    </Tooltip>
                  );
                }
                return null;
              })();

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'nowrap',
                    justifyContent: 'flex-start',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Ustma-ust blok: Agar jarayon amali bo'lsa, u tepada, Batafsil esa bir xil standart o'lchamda pastda turadi */}
                  {actionButton ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      {actionButton}
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
                    </div>
                  ) : (
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
                </div>
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
                {selectedRequest.targetRoomId || selectedRequest.targetRoomName || selectedRequest.targetRoomNumber
                  ? 'OS-2 Nakladnoy (Binoga)'
                  : 'OS-2 Chiqim Yuk Xati (Bo‘limga)'}
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
                {selectedRequest.targetRoomId || selectedRequest.targetRoomName || selectedRequest.targetRoomNumber
                  ? 'Xonada Qabul Dalolatnomasi'
                  : 'Bo‘lim Qabul Dalolatnomasi'}
              </Button>
            )}
            {selectedRequest?.status === 'REJECTED' &&
              (user?.id === selectedRequest.requesterId || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
              <Button
                type="primary"
                status="warning"
                icon={<IconEdit />}
                onClick={() => handleCloneOrResubmit(selectedRequest)}
              >
                Tahrirlash va Qayta Yuborish
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
          const hasRoom = Boolean(selectedRequest.targetRoomId || selectedRequest.targetRoomName || selectedRequest.targetRoomNumber);
          const roomLabel = selectedRequest.targetRoomNumber ? `${selectedRequest.targetRoomNumber}-xona` : selectedRequest.targetRoomName;
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
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-2)' }}>
                <b>Hozirgi mas’ul:</b> {stageDetails.currentActor}
              </div>
              {selectedRequest.status === 'REJECTED' && selectedRequest.approvalNote && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#ffece8', border: '1px solid #ff7d00', borderRadius: 4, color: '#f53f3f', fontSize: 13 }}>
                  <b>Rad etilish sababi / Izoh:</b> {selectedRequest.approvalNote}
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-2)' }}>
                    Xatoliklarni to‘g‘rilab, yangi talabnoma sifatida qayta yuborish uchun pastdagi <b>"Tahrirlash va Qayta Yuborish"</b> tugmasidan foydalanishingiz mumkin.
                  </div>
                </div>
              )}
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
                      {selectedRequest.requesterPhone && (
                        <div style={{ marginTop: 3 }}>
                          <b>Bog‘lanish (Telefon):</b>{' '}
                          <a
                            href={`tel:${selectedRequest.requesterPhone}`}
                            style={{
                              color: '#165DFF',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconPhone style={{ fontSize: 13 }} />
                            {selectedRequest.requesterPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  }
                />
                <Step
                  title="2. Moliya-iqtisod Prorektori Vizasi"
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {selectedRequest.prorektorApprovedAt || getStepCurrent(selectedRequest.status) > 2 ? '✅ Viza berildi (QR Biometrik)' : '⏳ Prorektor vizasi kutilmoqda'}</div>
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
                      <div><b>Holat:</b> {selectedRequest.rectorApprovedAt || getStepCurrent(selectedRequest.status) > 3 ? '✅ Ruxsat berildi va imzolandi' : getStepCurrent(selectedRequest.status) === 3 ? '⏳ Rektor qabulida (Tasdiq kutilmoqda)' : '⏳ Kutilmoqda'}</div>
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
                      <div><b>Holat:</b> {selectedRequest.accountantFinancedAt || getStepCurrent(selectedRequest.status) > 4 ? '✅ Moliyalashtirildi va sub-hisob biriktirildi' : getStepCurrent(selectedRequest.status) === 4 ? '⏳ Moliyaviy tasdiq kutilmoqda' : '⏳ Kutilmoqda'}</div>
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
                      <div><b>Holat:</b> {selectedRequest.warehouseReceivedAt || getStepCurrent(selectedRequest.status) > 5 ? '✅ Mahsulot omborga qabul qilindi (OS-1 muhrlandi)' : getStepCurrent(selectedRequest.status) === 5 ? '⏳ Xarid va ombor kirimi kutilmoqda' : '⏳ Kutilmoqda'}</div>
                      {selectedRequest.warehouseReceivedAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.warehouseReceivedAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
                <Step
                  title={
                    !hasRoom
                      ? "6. Bo‘lim Mas’uliga To‘g‘ridan-to‘g‘ri Topshirish (OS-2 Chiqim — Komendantsiz)"
                      : "6. Bino Komendantiga Topshirish (OS-2 Nakladnoy)"
                  }
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {
                        !hasRoom
                          ? (selectedRequest.status === 'FULFILLED'
                              ? '✅ Ombordan to‘g‘ridan-to‘g‘ri bo‘lim mas’uliga topshirildi (Komendant ishtirok etmadi)'
                              : getStepCurrent(selectedRequest.status) === 6
                              ? '⏳ Ombordan to‘g‘ridan-to‘g‘ri bo‘lim mas’uliga topshirish kutilmoqda (Komendantsiz)'
                              : '⏳ Kutilmoqda (Komendant ishtirok etmaydi, to‘g‘ridan-to‘g‘ri bo‘limga)')
                          : (selectedRequest.commendantHandedAt || getStepCurrent(selectedRequest.status) > 6
                              ? '✅ Omborchi va Komendant o‘rtasida OS-2 nakladnoyi imzolandi'
                              : getStepCurrent(selectedRequest.status) === 6
                              ? '⏳ Ombordan bino komendantiga topshirish kutilmoqda'
                              : '⏳ Kutilmoqda')
                      }</div>
                      {(selectedRequest.commendantHandedAt || (!selectedRequest.commendantHandedAt && selectedRequest.fulfilledAt)) && (
                        <div><b>Sana:</b> {new Date(selectedRequest.commendantHandedAt || selectedRequest.fulfilledAt!).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
                <Step
                  title={
                    !hasRoom
                      ? `7. ${selectedRequest.requesterName || 'Bo‘lim Mas’uli'} — Balansga Biriktirish va Yakunlash`
                      : `7. ${selectedRequest.requesterName || 'Mas\'ul Xodim'} — Xonada Qabul Qilish Dalolatnomasi`
                  }
                  description={
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <div><b>Holat:</b> {
                        selectedRequest.status === 'FULFILLED'
                          ? (!selectedRequest.commendantHandedAt
                              ? '🎉 Ombordan to‘g‘ridan-to‘g‘ri qabul qilib olindi va bo‘lim balansiga biriktirildi'
                              : '🎉 Komendant va Talabgor o‘rtasida o‘zaro topshirish-qabul qilish dalolatnomasi imzolandi')
                          : getStepCurrent(selectedRequest.status) === 7
                          ? '⏳ Qabul qilib olish va tasdiqlash kutilmoqda'
                          : (!hasRoom ? '⏳ Kutilmoqda (Ombordan qabul qilingach avtomatik yakunlanadi)' : '⏳ Kutilmoqda')
                      }</div>
                      {selectedRequest.fulfilledAt && (
                        <div><b>Sana:</b> {new Date(selectedRequest.fulfilledAt).toLocaleString()}</div>
                      )}
                    </div>
                  }
                />
              </Steps>
            </div>

            {/* Texnik Ko‘rik (Injener) Maxsus Xavfsizlik Nazorati Kartasi */}
            {selectedRequest.requiresTechnicalInspection && (
              <div
                style={{
                  marginBottom: 24,
                  padding: '16px 20px',
                  borderRadius: 4,
                  background: selectedRequest.engineerInspectedAt ? 'rgba(0, 180, 42, 0.05)' : 'rgba(255, 125, 0, 0.05)',
                  border: `1px solid ${selectedRequest.engineerInspectedAt ? '#00b42a' : '#ff7d00'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                  <Space size={8}>
                    <IconTool style={{ fontSize: 18, color: selectedRequest.engineerInspectedAt ? '#00b42a' : '#ff7d00' }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-1)' }}>
                      {selectedRequest.engineerInspectedAt
                        ? '✅ 5/5 Texnik Ko‘rikdan Muvaffaqiyatli O‘tgan (AKT-TEX Rasmiylashtirilgan)'
                        : '⚠️ Mas’ul Injener Texnik Ko‘rigi Kutilmoqda (Majburiy Xavfsizlik Nazorati)'}
                    </span>
                  </Space>
                  {selectedRequest.engineerInspectedAt ? (
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconFile />}
                      onClick={() => handleOpenDocModal(selectedRequest, 'AKT_TEX')}
                      style={{ borderColor: '#00b42a', color: '#00b42a', fontWeight: 600 }}
                    >
                      AKT-TEX Hujjatini Ko‘rish
                    </Button>
                  ) : (
                    (user?.id === selectedRequest.assignedEngineerId ||
                     user?.role === 'SUPER_ADMIN' ||
                     user?.role === 'ADMIN' ||
                     /injener|muhandis|texnik/i.test(user?.position || '')) &&
                    selectedRequest.status === 'RECEIVED_AT_WAREHOUSE' && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<IconTool />}
                        onClick={() => handleOpenInspectionModal(selectedRequest)}
                        style={{ background: '#0fc6c2', borderColor: '#0fc6c2', fontWeight: 600 }}
                      >
                        Texnik Ko‘rikni Boshlash (5/5 Checklist)
                      </Button>
                    )
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                  <div>
                    <b>Mas’ul Texnik Injener:</b>{' '}
                    <Tag color="cyan">
                      {selectedRequest.assignedEngineerName || (selectedRequest as any).assignedEngineer?.name || 'Biriktirilgan mutaxassis'}
                    </Tag>
                  </div>
                  {selectedRequest.engineerInspectedAt ? (
                    <div style={{ color: '#00b42a', marginTop: 4 }}>
                      <b>Ko‘rik xulosasi va sana:</b> {new Date(selectedRequest.engineerInspectedAt).toLocaleString('uz-UZ')} · 5 ta xavfsizlik va sozlik talabi (qadoq, komplektatsiya, elektr/yong‘in xavfsizligi, seriya raqami, texnik parametrlar) bo‘yicha to‘liq soz deb topilgan.
                    </div>
                  ) : (
                    <div style={{ color: '#d46b08', marginTop: 4 }}>
                      Ushbu uskunalar xonaga yoki bo‘limga topshirilishidan oldin omborda mas’ul injener tomonidan 5 bosqichli ko‘rikdan o‘tkazilishi va AKT-TEX tuzilishi shart. Injener xulosasisiz topshirish bloklanadi.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Details Table */}
            <Descriptions
              column={1}
              border
              data={[
                { label: 'Talabnoma Raqami', value: selectedRequest.requestNumber },
                {
                  label: 'Talabgor Xodim',
                  value: (
                    <Space size={10} wrap align="center">
                      <span style={{ fontWeight: 600 }}>{selectedRequest.requesterName}</span>
                      {(selectedRequest as any).requesterPosition && (
                        <Tag color="arcoblue">{(selectedRequest as any).requesterPosition}</Tag>
                      )}
                      {selectedRequest.requesterPhone ? (
                        <a
                          href={`tel:${selectedRequest.requesterPhone}`}
                          style={{
                            color: '#165DFF',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            background: '#E8F3FF',
                            borderRadius: 4,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconPhone />
                          {selectedRequest.requesterPhone}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-4)', fontSize: 12 }}>
                          (Telefon raqami kiritilmagan)
                        </span>
                      )}
                    </Space>
                  ),
                },
                { label: 'Bo‘lim / Kafedra', value: selectedRequest.departmentName || '—' },
                {
                  label: 'Topshirish Marshruti',
                  value: hasRoom ? (
                    <Tag color="arcoblue">
                      🏛 Bino komendanti orqali ({roomLabel || 'Xonaga biriktirish'})
                    </Tag>
                  ) : (
                    <Tag color="green">
                      ⚡ To‘g‘ridan-to‘g‘ri bo‘lim mas’uliga (Obyekt / Xonasiz sarf — Komendantsiz)
                    </Tag>
                  ),
                },
                ...(selectedRequest.requiresTechnicalInspection
                  ? [
                      {
                        label: 'Texnik Ko‘rik (Injener)',
                        value: (
                          <Space size={8} wrap align="center">
                            <Tag color={selectedRequest.engineerInspectedAt ? 'green' : 'orange'}>
                              <IconTool style={{ marginRight: 4 }} />
                              {selectedRequest.engineerInspectedAt
                                ? 'Texnik ko‘rikdan o‘tgan (AKT-TEX)'
                                : 'Injener ko‘rigi talab etiladi'}
                            </Tag>
                            {selectedRequest.assignedEngineerName && (
                              <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                                Mas’ul: <b>{selectedRequest.assignedEngineerName}</b>
                              </span>
                            )}
                            {selectedRequest.engineerInspectedAt && (
                              <Button
                                size="mini"
                                type="outline"
                                icon={<IconFile />}
                                onClick={() => handleOpenDocModal(selectedRequest, 'AKT_TEX')}
                              >
                                AKT-TEX Hujjat
                              </Button>
                            )}
                          </Space>
                        ),
                      },
                    ]
                  : []),
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
      {selectedDocRequest && (() => {
        const hasRoomDoc = Boolean(selectedDocRequest.targetRoomId || selectedDocRequest.targetRoomName || selectedDocRequest.targetRoomNumber);
        const isDirectDoc = !hasRoomDoc || (!selectedDocRequest.commendantHandedAt && selectedDocRequest.status === 'FULFILLED');
        return (
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
                : docModalType === 'AKT_TEX'
                ? `${selectedDocRequest.requestNumber}-AKT-TEX`
                : `${selectedDocRequest.requestNumber}-AKT`
            }
            date={selectedDocRequest.createdAt}
            sourceLocation={
              docModalType === 'KIRIM'
                ? "Ta'minotchi / Yetkazib beruvchi"
                : docModalType === 'AKT_TEX'
                ? 'Universitet Bosh Ombori (Texnik Nazorat Maydoni)'
                : docModalType === 'TRANSFER' || isDirectDoc
                ? 'Universitet Bosh Ombori'
                : (selectedDocRequest.commendantName ? `${selectedDocRequest.commendantName} (Bino komendanti)` : 'Bino komendantligi')
            }
            targetLocation={
              docModalType === 'KIRIM'
                ? 'Universitet Bosh Ombori'
                : docModalType === 'AKT_TEX'
                ? 'Texnik Ko‘rik va Ekspertiza Xulosasi (AKT-TEX)'
                : isDirectDoc
                ? `${selectedDocRequest.departmentName || 'Bo‘lim'} (To‘g‘ridan-to‘g‘ri bo‘lim mas’uliga)`
                : docModalType === 'TRANSFER'
                ? (selectedDocRequest.commendantName ? `${selectedDocRequest.commendantName} (Bino)` : 'Bino komendanti')
                : `${selectedDocRequest.departmentName || 'Kafedra / Bo‘lim'}${selectedDocRequest.targetRoomNumber ? ` (${selectedDocRequest.targetRoomNumber}-xona)` : ''}`
            }
            senderName={
              docModalType === 'KIRIM'
                ? "Yetkazib beruvchi tashkilot vakili"
                : docModalType === 'AKT_TEX'
                ? ((selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri')
                : docModalType === 'TRANSFER' || isDirectDoc
                ? ((selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri')
                : (selectedDocRequest.commendantName || 'Bino komendanti')
            }
            receiverName={
              docModalType === 'KIRIM'
                ? ((selectedDocRequest as any).warehouseReceivedByName || 'Bosh ombor mudiri')
                : docModalType === 'AKT_TEX'
                ? (selectedDocRequest.assignedEngineerName || selectedDocRequest.engineerInspectedByName || (selectedDocRequest as any).assignedEngineer?.name || 'Mas’ul Texnik Injener')
                : isDirectDoc
                ? `${selectedDocRequest.requesterName} (Bo‘lim mas’uli)`
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
        );
      })()}

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

      {/* 5 Bosqichli Texnik Ko‘rik va Sozlik Nazorati Modali (AKT-TEX) */}
      <TechnicalInspectionModal
        visible={isInspectionModalVisible}
        onClose={() => {
          setIsInspectionModalVisible(false);
          setSelectedInspectionRequest(null);
        }}
        request={selectedInspectionRequest}
        onConfirm={handleConfirmInspection}
        loading={isSubmittingInspection}
      />
    </div>
  );
};
