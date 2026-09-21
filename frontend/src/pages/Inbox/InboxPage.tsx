import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Badge,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Empty,
  Tooltip,
  Popconfirm,
  Message,
  Radio,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconRefresh,
  IconSwap,
  IconFile,
  IconDelete,
  IconScan,
  IconExclamationCircle,
  IconArchive,
  IconRight,
  IconUser,
  IconCalendar,
  IconSafe,
  IconQrcode,
  IconMobile,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  useInboxQuery,
  type PendingTransferItem,
  type PendingRequestItem,
  type PendingWriteOffVoteItem,
  type OpenAuditItem,
  type LowStockAlertItem,
  type OverQuotaRequestItem,
  type PendingHandoverItem,
} from '../../hooks/useInboxQuery';
import { useTransfersQuery } from '../../hooks/useAssetsQuery';
import { useRequestsQuery } from '../../hooks/useRequestsQuery';
import { useWriteOffQuery } from '../../hooks/useWriteOffQuery';
import { useStartCampaignMutation } from '../../hooks/useAuditCampaignsQuery';
import { QRPairingModal } from '../../components/Common/QRPairingModal';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ROLE_CONFIG } from '../../constants/roles.constants';
import { RoleType, type RequestStatus } from '../../types';
import { RejectReasonModal } from '../../components/Common/RejectReasonModal';
import { RectorVisaModal } from './RectorVisaModal';
import { HandoverReviewModal } from '../../components/Inbox/HandoverReviewModal';

const { Title, Text, Paragraph } = Typography;
const TabPane = Tabs.TabPane;

export const InboxPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Action Center In-Place Modals State
  const [selectedOverQuota, setSelectedOverQuota] = useState<OverQuotaRequestItem | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<PendingRequestItem | null>(null);
  const [rejectingTransfer, setRejectingTransfer] = useState<PendingTransferItem | null>(null);
  const [rejectingVote, setRejectingVote] = useState<PendingWriteOffVoteItem | null>(null);
  const [signingCampaignItem, setSigningCampaignItem] = useState<OpenAuditItem | null>(null);
  const [isCampaignQrModalVisible, setIsCampaignQrModalVisible] = useState(false);
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(null);
  const [isHandoverModalVisible, setIsHandoverModalVisible] = useState(false);

  // QR-Pairing Mobile Signing States
  const [signingTransferItem, setSigningTransferItem] = useState<PendingTransferItem | null>(null);
  const [isTransferQrModalVisible, setIsTransferQrModalVisible] = useState(false);
  const [signingRequestItem, setSigningRequestItem] = useState<PendingRequestItem | null>(null);
  const [isRequestQrModalVisible, setIsRequestQrModalVisible] = useState(false);
  const [signingVoteItem, setSigningVoteItem] = useState<PendingWriteOffVoteItem | null>(null);
  const [isVoteQrModalVisible, setIsVoteQrModalVisible] = useState(false);

  // Mutations
  const { respondTransfer } = useTransfersQuery();
  const { updateRequestStatus } = useRequestsQuery();
  const { voteWriteOff } = useWriteOffQuery();
  const startCampaignMutation = useStartCampaignMutation();

  const handleCampaignQrSignSuccess = async (result: any) => {
    if (!signingCampaignItem) return;
    setIsCampaignQrModalVisible(false);
    try {
      await startCampaignMutation.mutateAsync({
        id: signingCampaignItem.id,
        signerName: result.signerName || user?.fullName || 'Universitet Rektori',
        signerRole:
          result.signerRole ||
          (user?.role === RoleType.RECTOR
            ? 'Universitet Rektori'
            : 'Moliya-iqtisodiyot ishlari bo‘yicha prorektor'),
        signatureHash: result.signatureHash || result.sessionId,
        notes: `Rektorat farmoyishi asosida dinamik QR-Pairing orqali tasdiqlandi (${result.biometricType || 'BIOMETRIC_VERIFIED'}).`,
      });
      Message.success('Inventarizatsiya kampaniyasi Rektor farmoyishi bilan rasman boshlandi!');
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Kampaniyani tasdiqlashda xatolik yuz berdi!');
    }
  };

  const roleMeta = user?.role ? ROLE_CONFIG[user.role as RoleType] : null;
  const roleLabel = roleMeta?.label || user?.role || '';

  // RBAC checks
  const isSuperAdmin = user?.role === RoleType.SUPER_ADMIN;
  const [viewScope, setViewScope] = useState<'personal' | 'all'>('personal');

  const { data: inbox, isLoading, isError, refetch, isFetching } = useInboxQuery({
    refetchInterval: 60000,
    scope: isSuperAdmin ? viewScope : 'personal',
  });

  const summary = inbox?.summary;
  const totalCount = summary?.totalPendingCount || 0;

  const canGiveRectorVisa =
    !isSuperAdmin &&
    (user?.role === RoleType.RECTOR || user?.role === RoleType.VICE_RECTOR_FINANCE);

  const canApproveRequest = (item: PendingRequestItem) => {
    if (isSuperAdmin) return false;
    if (
      user?.role === RoleType.VICE_RECTOR_FINANCE &&
      (item.status === 'SUBMITTED' || item.status === 'PENDING' || item.status === 'APPROVED_BY_HEAD')
    ) {
      return true;
    }
    if (user?.role === RoleType.RECTOR && item.status === 'APPROVED_BY_PRORECTOR') return true;
    return false;
  };

  const canAcceptTransfer = (item: PendingTransferItem) => {
    if (isSuperAdmin) return false;
    if (item.isReturn) {
      return user?.role === RoleType.HEAD_WAREHOUSE;
    }
    return item.receiver?.id === user?.id;
  };

  // 1. Transfer QR Sign Handlers
  const handleOpenTransferQrSign = (item: PendingTransferItem) => {
    setSigningTransferItem(item);
    setIsTransferQrModalVisible(true);
  };

  const handleTransferQrSignSuccess = async (result: any) => {
    if (!signingTransferItem) return;
    const item = signingTransferItem;
    setIsTransferQrModalVisible(false);
    setSigningTransferItem(null);

    try {
      await respondTransfer({
        id: item.id,
        status: 'ACCEPTED',
        note: `Mobil QR-imzo orqali qabul qilindi (Sessiya: ${result.sessionId || 'MOBI_SIGN'}, Imzo: ${result.signatureHash?.slice(0, 8) || 'VERIFIED'})`,
      });
      Message.success('Ashyo mobil QR-imzo orqali muvaffaqiyatli qabul qilindi va hisobingizga biriktirildi!');
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      refetch();
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Ashyoni qabul qilishda xatolik yuz berdi!');
    }
  };

  const handleConfirmRejectTransfer = async (reason: string) => {
    if (!rejectingTransfer) return;
    try {
      await respondTransfer({ id: rejectingTransfer.id, status: 'REJECTED', note: reason });
      Message.info('Ko‘chirish rad etildi');
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setRejectingTransfer(null);
      refetch();
    } catch {
      // Error handled by mutation
    }
  };

  // 2. Request Approval QR Sign Handlers
  const handleOpenRequestQrSign = (item: PendingRequestItem) => {
    setSigningRequestItem(item);
    setIsRequestQrModalVisible(true);
  };

  const handleRequestQrSignSuccess = async (result: any) => {
    if (!signingRequestItem) return;
    const item = signingRequestItem;
    setIsRequestQrModalVisible(false);
    setSigningRequestItem(null);

    let nextStatus: RequestStatus = 'APPROVED_BY_PRORECTOR';
    if (user?.role === RoleType.RECTOR) {
      nextStatus = 'APPROVED_BY_RECTOR';
    } else if (user?.role === RoleType.VICE_RECTOR_FINANCE) {
      nextStatus = 'APPROVED_BY_PRORECTOR';
    } else {
      Message.error('Sizda ushbu talabnomani tasdiqlash huquqi yo‘q!');
      return;
    }

    try {
      await updateRequestStatus({
        id: item.id,
        status: nextStatus,
        note: `${user?.role === RoleType.RECTOR ? 'Rektor' : 'Moliya-iqtisod prorektori'} tomonidan mobil QR-imzo orqali tasdiqlandi (Sessiya: ${result.sessionId || 'MOBI_SIGN'})`,
      });
      Message.success('Talabnoma mobil QR-imzo orqali navbatdagi bosqichga tasdiqlandi!');
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      refetch();
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Talabnomani tasdiqlashda xatolik yuz berdi!');
    }
  };

  const handleConfirmRejectRequest = async (reason: string) => {
    if (!rejectingRequest) return;
    if (!canApproveRequest(rejectingRequest)) {
      Message.error('Sizda ushbu talabnomani rad etish vakolati yo‘q!');
      return;
    }
    try {
      await updateRequestStatus({
        id: rejectingRequest.id,
        status: 'REJECTED',
        note: reason,
      });
      Message.warning('Talabnoma rad etildi');
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setRejectingRequest(null);
      refetch();
    } catch {
      // Error handled by mutation
    }
  };

  // 3. Write-Off Vote QR Sign Handlers
  const handleOpenVoteQrSign = (item: PendingWriteOffVoteItem) => {
    setSigningVoteItem(item);
    setIsVoteQrModalVisible(true);
  };

  const handleVoteQrSignSuccess = async (result: any) => {
    if (!signingVoteItem) return;
    const item = signingVoteItem;
    setIsVoteQrModalVisible(false);
    setSigningVoteItem(null);

    try {
      await voteWriteOff({
        id: item.writeOffId,
        vote: 'APPROVED',
        comment: `Mobil QR-imzo bilan rozilik ovozi berildi (Sessiya: ${result.sessionId || 'MOBI_SIGN'})`,
        signerName: user?.fullName || undefined,
        signerRole: user?.role || undefined,
      });
      Message.success('Spisanie bo‘yicha rozilik ovozingiz mobil QR-imzo orqali qabul qilindi!');
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
      refetch();
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Ovoz berishda xatolik yuz berdi!');
    }
  };

  const handleVoteWriteOff = async (
    item: PendingWriteOffVoteItem,
    vote: 'APPROVED' | 'REJECTED',
    comment?: string
  ) => {
    try {
      await voteWriteOff({
        id: item.writeOffId,
        vote,
        comment,
        signerName: user?.fullName || undefined,
        signerRole: user?.role || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
      refetch();
    } catch {
      // Error handled by mutation
    }
  };

  const handleConfirmRejectVote = async (reason: string) => {
    if (!rejectingVote) return;
    await handleVoteWriteOff(rejectingVote, 'REJECTED', reason);
    setRejectingVote(null);
  };

  // Render Handover Item Card (OS-1 Dalolatnomalari)
  const renderHandoverCard = (item: PendingHandoverItem) => {
    const isTarget = user?.id === item.targetUser?.id;
    const isCommandant = user?.id === item.commandantUser?.id || user?.role === 'COMMENDANT';
    const isAccountant = user?.id === item.accountantUser?.id || user?.role === 'CHIEF_ACCOUNTANT';

    return (
      <Card
        key={`handover-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12, borderLeft: '4px solid #165DFF' }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag color="arcoblue" icon={<IconFile />} style={{ borderRadius: 4, fontWeight: 600 }}>
                OS-1 Dalolatnomasi
              </Tag>
              <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>
                {item.handoverNumber}
              </Tag>
              <Tag color="orange" style={{ borderRadius: 4 }}>
                Tasdiqlash Kutilmoqda
              </Tag>
              {isTarget && <Tag color="green">Siz Qabul Qiluvchisiz</Tag>}
              {isCommandant && <Tag color="cyan">Bino Komendanti</Tag>}
              {isAccountant && <Tag color="purple">Moddiy Hisobchi</Tag>}
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              Moddiy Javobgarlik Topshiruvi ({item._count?.items || 0} ta aktiv)
            </Title>

            <Paragraph style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              <strong>Topshiruvchi (Eski MOL):</strong> {item.departingUser.fullName} ({item.departingUser.position || 'Xodim'}) &nbsp;➔&nbsp;{' '}
              <strong>Qabul Qiluvchi:</strong> {item.targetUser?.fullName || item.targetWarehouse?.name || 'Omborxona'}
            </Paragraph>

            <Space size="medium" style={{ fontSize: 12, color: 'var(--color-text-3)' }} wrap>
              {item.room && (
                <span>
                  Xona: <strong>{item.room.number} - {item.room.name}</strong>
                </span>
              )}
              {item.building && (
                <span>
                  Bino: <strong>{item.building.name}</strong>
                </span>
              )}
              <span>
                <IconCalendar /> {new Date(item.createdAt).toLocaleString('uz-UZ')}
              </span>
              {item.note && <span>Asos: <em>"{item.note}"</em></span>}
            </Space>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            <Button
              type="primary"
              status="success"
              icon={<IconCheckCircle />}
              style={{ flex: isMobile ? '1 1 100%' : 'none', minHeight: 38, borderRadius: 6 }}
              onClick={() => {
                setSelectedHandoverId(item.id);
                setIsHandoverModalVisible(true);
              }}
            >
              Ko‘rib Chiqish va Qabul Qilish (OS-1)
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Render Transfer Item Card
  const renderTransferCard = (item: PendingTransferItem) => {
    return (
      <Card
        key={`transfer-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12 }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag color="arcoblue" icon={<IconSwap />} style={{ borderRadius: 4, fontWeight: 600 }}>
                Ashyo Ko‘chirish
              </Tag>
              <Tag color="orange" style={{ borderRadius: 4 }}>
                Qabul kutilmoqda
              </Tag>
              {item.isReturn && (
                <Tag color="gold" style={{ borderRadius: 4 }}>
                  Omborga qaytarish
                </Tag>
              )}
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              {item.asset?.item?.name || 'Asosiy vosita'} ({item.asset?.inventoryNumber})
            </Title>

            <Paragraph style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              <strong>Qayerdan:</strong>{' '}
              {item.fromRoom
                ? `${item.fromRoom.number}-xona (${item.fromRoom.name})`
                : 'Ombor'}{' '}
              &nbsp;➔&nbsp; <strong>Qayerga:</strong>{' '}
              {item.toRoom
                ? `${item.toRoom.number}-xona (${item.toRoom.name})`
                : item.toWarehouse?.name || 'Ombor'}
            </Paragraph>

            <Space size="medium" style={{ fontSize: 12, color: 'var(--color-text-3)' }} wrap>
              <span>
                <IconUser /> Yuboruvchi: <strong>{item.sender?.fullName || '—'}</strong>
              </span>
              <span>
                <IconCalendar /> {new Date(item.createdAt).toLocaleString('uz-UZ')}
              </span>
              {item.note && <span>Izoh: <em>"{item.note}"</em></span>}
            </Space>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            {canAcceptTransfer(item) && (
              <Button
                type="primary"
                status="success"
                icon={<IconMobile />}
                style={{ flex: isMobile ? '1 1 140px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() => handleOpenTransferQrSign(item)}
              >
                QR bilan Qabul Qilish
              </Button>
            )}

            {canAcceptTransfer(item) && (
              <Button
                status="danger"
                icon={<IconCloseCircle />}
                style={{ flex: isMobile ? '1 1 120px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() => setRejectingTransfer(item)}
              >
                Rad etish
              </Button>
            )}

            {!canAcceptTransfer(item) && (
              <Tag color="orange" style={{ borderRadius: 4, padding: '4px 8px' }}>
                Kutilmoqda: {item.isReturn ? 'Bosh ombor mudiri' : item.receiver?.fullName || 'Qabul qiluvchi MOL'}
              </Tag>
            )}

            <Button
              type="secondary"
              icon={<IconRight />}
              style={{ flex: isMobile ? '1 1 100%' : 'none', minHeight: 36, borderRadius: 6 }}
              onClick={() => navigate('/assets')}
            >
              Reestrda ko‘rish
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Render Request Item Card
  const renderRequestCard = (item: PendingRequestItem) => {
    return (
      <Card
        key={`req-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12 }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag color="green" icon={<IconFile />} style={{ borderRadius: 4, fontWeight: 600 }}>
                Talabnoma
              </Tag>
              <Tag color="blue" style={{ borderRadius: 4 }}>
                {item.requestNumber}
              </Tag>
              {item.isOverQuota && (
                <Tag color="red" style={{ borderRadius: 4 }}>
                  Kvotadan oshgan
                </Tag>
              )}
              {item.specialApprovalNeeded && (
                <Tag color="gold" style={{ borderRadius: 4 }}>
                  Maxsus ruxsat talab
                </Tag>
              )}
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              Maqsad: {item.purpose}
            </Title>

            <div style={{ margin: '6px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              Tarkibi ({item.items?.length || 0} ta mahsulot):{' '}
              {item.items?.map((it, idx) => (
                <span key={idx} style={{ marginRight: 8, fontWeight: 500 }}>
                  • {it.item?.name} ({it.requestedQty} {it.item?.unit || 'dona'})
                </span>
              ))}
            </div>

            <Space size="medium" style={{ fontSize: 12, color: 'var(--color-text-3)' }} wrap>
              <span>
                <IconUser /> So‘rovchi: <strong>{item.requester?.fullName || '—'}</strong> (
                {item.department?.name || 'Kafedra'})
              </span>
              <span>
                <IconCalendar /> {new Date(item.createdAt).toLocaleString('uz-UZ')}
              </span>
            </Space>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            {canApproveRequest(item) && (
              <Button
                type="primary"
                status="success"
                icon={<IconMobile />}
                style={{ flex: isMobile ? '1 1 140px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() => handleOpenRequestQrSign(item)}
              >
                QR bilan Tasdiqlash
              </Button>
            )}

            {item.isOverQuota && canGiveRectorVisa && (
              <Button
                type="primary"
                status="warning"
                icon={<IconCheckCircle />}
                style={{ flex: isMobile ? '1 1 140px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() => setSelectedOverQuota(item)}
              >
                Rektorat Vizasi
              </Button>
            )}

            {canApproveRequest(item) && (
              <Button
                status="danger"
                icon={<IconCloseCircle />}
                style={{ flex: isMobile ? '1 1 110px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() => setRejectingRequest(item)}
              >
                Rad etish
              </Button>
            )}

            {!canApproveRequest(item) && (!item.isOverQuota || !canGiveRectorVisa) && (
              <Tag color="arcoblue" style={{ borderRadius: 4, padding: '4px 8px' }}>
                Kutilmoqda:{' '}
                {item.status === 'APPROVED_BY_PRORECTOR'
                  ? 'Universitet Rektori'
                  : item.status === 'APPROVED_BY_RECTOR'
                  ? 'Bosh Hisobchi'
                  : item.status === 'FINANCED_BY_ACCOUNTANT'
                  ? 'Bosh Ombor Mudiri'
                  : item.status === 'RECEIVED_AT_WAREHOUSE'
                  ? 'Bino Komendanti'
                  : item.status === 'HANDED_TO_COMMENDANT'
                  ? 'Mas\'ul Xodim / MOL'
                  : 'Moliya-iqtisod Prorektori'}
              </Tag>
            )}

            <Button
              type="secondary"
              icon={<IconRight />}
              style={{ flex: isMobile ? '1 1 100%' : 'none', minHeight: 36, borderRadius: 6 }}
              onClick={() => navigate('/requests')}
            >
              Batafsil ko‘rish
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Render Write-Off Vote Card
  const renderWriteOffVoteCard = (item: PendingWriteOffVoteItem) => {
    return (
      <Card
        key={`vote-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12 }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag color="red" icon={<IconDelete />} style={{ borderRadius: 4, fontWeight: 600 }}>
                OS-4 Spisanie Ovozi
              </Tag>
              <Tag color="magenta" style={{ borderRadius: 4 }}>
                {item.writeOffRequest.actNumber}
              </Tag>
              <Tag color="blue" style={{ borderRadius: 4 }}>
                Rolingiz: {item.roleName}
              </Tag>
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              Ashyo: {item.writeOffRequest.asset?.item?.name || 'Asosiy vosita'} (
              {item.writeOffRequest.asset?.inventoryNumber})
            </Title>

            <Paragraph style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              <strong>Sabab:</strong> {item.writeOffRequest.reason}
              {item.writeOffRequest.technicalConclusion && (
                <span>
                  {' '}&nbsp;|&nbsp; <strong>Texnik xulosa:</strong>{' '}
                  {item.writeOffRequest.technicalConclusion}
                </span>
              )}
            </Paragraph>

            <Space size="medium" style={{ fontSize: 12, color: 'var(--color-text-3)' }} wrap>
              <span>
                <IconUser /> Tashabbuskor:{' '}
                <strong>{item.writeOffRequest.createdBy?.fullName || '—'}</strong>
              </span>
              <span>
                <IconCalendar /> {new Date(item.writeOffRequest.createdAt).toLocaleString('uz-UZ')}
              </span>
            </Space>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            {(item.userId === user?.id || item.user?.id === user?.id) ? (
              <>
                <Button
                  type="primary"
                  status="success"
                  icon={<IconMobile />}
                  style={{ flex: isMobile ? '1 1 140px' : 'none', minHeight: 38, borderRadius: 6 }}
                  onClick={() => handleOpenVoteQrSign(item)}
                >
                  QR bilan Ma’qullash
                </Button>

                <Button
                  status="danger"
                  icon={<IconCloseCircle />}
                  style={{ flex: isMobile ? '1 1 110px' : 'none', minHeight: 38, borderRadius: 6 }}
                  onClick={() => setRejectingVote(item)}
                >
                  Rad etish
                </Button>
              </>
            ) : (
              <Tag color="red" style={{ borderRadius: 4, padding: '4px 8px' }}>
                Ovoz kutilmoqda: {item.user?.fullName || item.roleName}
              </Tag>
            )}

            <Button
              type="secondary"
              icon={<IconRight />}
              style={{ flex: isMobile ? '1 1 100%' : 'none', minHeight: 36, borderRadius: 6 }}
              onClick={() => navigate('/write-offs')}
            >
              OS-4 aktiga o‘tish
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Render Open Audit Card
  const renderAuditCard = (item: OpenAuditItem) => {
    const isCampaign = item.type === 'CAMPAIGN';
    const isPlannedCampaign =
      isCampaign &&
      (item.status === 'PLANNED' ||
        item.title.startsWith('[Farmoyish kutilmoqda]') ||
        item.title.includes('Farmoyish kutilmoqda'));
    const isAuditorOfThis =
      user?.role === RoleType.AUDITOR && (!item.auditorId || item.auditorId === user?.id);
    const canSignCampaign =
      isPlannedCampaign &&
      (user?.role === RoleType.RECTOR || user?.role === RoleType.VICE_RECTOR_FINANCE);

    return (
      <Card
        key={`audit-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12 }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag color="purple" icon={<IconScan />} style={{ borderRadius: 4, fontWeight: 600 }}>
                {isCampaign ? 'Rejali Kampaniya' : 'Xona Auditi'}
              </Tag>
              <Tag color="blue" style={{ borderRadius: 4 }}>
                {item.number}
              </Tag>
              {isPlannedCampaign ? (
                <Tag color="gold" style={{ borderRadius: 4, fontWeight: 600 }}>
                  Farmoyish kutilmoqda
                </Tag>
              ) : (
                <Tag color="green" style={{ borderRadius: 4 }}>
                  Davom etmoqda
                </Tag>
              )}
              {item.orderNumber && (
                <Tag color="cyan" style={{ borderRadius: 4 }}>
                  Buyruq: {item.orderNumber}
                </Tag>
              )}
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              {item.title}
            </Title>

            <Paragraph style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              {isCampaign ? (
                <span>
                  Qamrov: <strong>{item.scopesCount || 0} ta xona</strong>
                </span>
              ) : (
                <span>
                  Xona: <strong>{item.roomName}</strong> &nbsp;|&nbsp; Skanerlangan:{' '}
                  <strong>{item.scannedCount || 0} ta vosita</strong>
                </span>
              )}
            </Paragraph>

            <Space size="medium" style={{ fontSize: 12, color: 'var(--color-text-3)' }} wrap>
              {item.auditorName && (
                <span>
                  <IconUser /> Auditor: <strong>{item.auditorName}</strong>
                </span>
              )}
              <span>
                <IconCalendar /> Boshlangan:{' '}
                {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
              </span>
            </Space>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            {!isAuditorOfThis && !isCampaign && (
              <Tag color="purple" style={{ borderRadius: 4, padding: '4px 8px' }}>
                Mas’ul Auditor: {item.auditorName || 'Tayinlangan Auditor'}
              </Tag>
            )}

            {canSignCampaign && (
              <Button
                type="primary"
                icon={<IconQrcode />}
                style={{
                  backgroundColor: '#165DFF',
                  borderRadius: 6,
                  fontWeight: 600,
                  flex: isMobile ? '1 1 100%' : 'none',
                  minHeight: 38,
                }}
                loading={startCampaignMutation.isPending && signingCampaignItem?.id === item.id}
                onClick={() => {
                  setSigningCampaignItem(item);
                  setIsCampaignQrModalVisible(true);
                }}
              >
                Rektor Farmoyishi (QR Imzo)
              </Button>
            )}

            <Button
              type={isAuditorOfThis && !isCampaign ? 'primary' : 'secondary'}
              status={isAuditorOfThis && !isCampaign ? 'success' : 'default'}
              icon={<IconRight />}
              style={{ flex: isMobile ? '1 1 100%' : 'none', minHeight: 36, borderRadius: 6 }}
              onClick={() => navigate(isCampaign ? '/audit-campaigns' : '/audit')}
            >
              {isCampaign
                ? 'Kampaniyaga o‘tish'
                : isAuditorOfThis
                ? 'Skanerlashni davom ettirish'
                : 'Audit reestrida ko‘rish'}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Render Low Stock Alert Card
  const renderLowStockCard = (item: LowStockAlertItem) => {
    const isWarehouseRole = user?.role === RoleType.HEAD_WAREHOUSE;

    return (
      <Card
        key={`stock-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12 }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag color="orange" icon={<IconArchive />} style={{ borderRadius: 4, fontWeight: 600 }}>
                Ombor Qoldig‘i Kam
              </Tag>
              <Tag color="red" style={{ borderRadius: 4, fontWeight: 600 }}>
                Qoldiq: {item.currentQuantity} {item.unit}
              </Tag>
              <Tag color="gray" style={{ borderRadius: 4 }}>
                Limit: {item.minLimit} {item.unit}
              </Tag>
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              {item.itemName} ({item.categoryName || 'Sarf materiali'})
            </Title>

            <Paragraph style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              Ombor: <strong>{item.warehouseName}</strong> &nbsp;|&nbsp; Yetishmayotgan miqdor:{' '}
              <strong style={{ color: '#F53F3F' }}>
                +{item.shortage} {item.unit}
              </strong>
            </Paragraph>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            {!isWarehouseRole && (
              <Tag color="orange" style={{ borderRadius: 4, padding: '4px 8px' }}>
                Mas’ul: Bosh ombor mudiri
              </Tag>
            )}

            {isWarehouseRole && (
              <Button
                type="outline"
                icon={<IconFile />}
                style={{ flex: isMobile ? '1 1 140px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() =>
                  navigate('/requests?create=true', {
                    state: {
                      draftItems: [
                        {
                          itemId: item.itemId,
                          itemName: item.itemName,
                          quantity: Math.max(10, item.shortage * 2),
                          unit: item.unit,
                          currentQuantity: item.currentQuantity,
                          minStockLimit: item.minLimit,
                        },
                      ],
                      defaultPurpose: `${item.itemName} bo‘yicha minimal qoldiqni to‘ldirish talabnomasi`,
                    },
                  })
                }
              >
                Talabnoma shabloni
              </Button>
            )}

            <Button
              type={isWarehouseRole ? 'primary' : 'secondary'}
              status={isWarehouseRole ? 'warning' : 'default'}
              icon={<IconRight />}
              style={{ flex: isMobile ? '1 1 120px' : 'none', minHeight: 38, borderRadius: 6 }}
              onClick={() => navigate('/warehouse?tab=low-stock')}
            >
              Omborda ko‘rish
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Render Over Quota Card
  const renderOverQuotaCard = (item: OverQuotaRequestItem) => {
    return (
      <Card
        key={`overquota-${item.id}`}
        className="uwms-card"
        style={{ borderRadius: isMobile ? 8 : 0, marginBottom: 12 }}
        hoverable
        bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Space size="small" style={{ marginBottom: 6 }} wrap>
              <Tag
                color="gold"
                icon={<IconExclamationCircle />}
                style={{ borderRadius: 4, fontWeight: 600 }}
              >
                Kvotadan Ortgan Talabnoma
              </Tag>
              <Tag color="red" style={{ borderRadius: 4, fontWeight: 600 }}>
                Rektorat Maxsus Vizasi Kutilmoqda
              </Tag>
            </Space>

            <Title heading={6} style={{ margin: '4px 0', fontSize: isMobile ? 15 : 16 }}>
              {item.requestNumber} — {item.purpose}
            </Title>

            <Paragraph style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              Kafedra: <strong>{item.department?.name || '—'}</strong> &nbsp;|&nbsp; So‘rovchi:{' '}
              <strong>{item.requester?.fullName || '—'}</strong>
            </Paragraph>

            <div style={{ margin: '6px 0', fontSize: 13, color: 'var(--color-text-2)' }}>
              Tarkibi ({item.items?.length || 0} ta mahsulot):{' '}
              {item.items?.map((it, idx) => (
                <span key={idx} style={{ marginRight: 8, fontWeight: 500 }}>
                  • {it.item?.name} ({it.requestedQty} {it.item?.unit || 'dona'})
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
            <Tooltip
              content={
                !canGiveRectorVisa
                  ? 'Rektorat vizasini faqat Universitet Rektori yoki Moliya-iqtisod Prorektori qo‘yishi mumkin'
                  : undefined
              }
            >
              <Button
                type="primary"
                status="warning"
                icon={<IconCheckCircle />}
                style={{ flex: isMobile ? '1 1 140px' : 'none', minHeight: 38, borderRadius: 6 }}
                disabled={!canGiveRectorVisa}
                onClick={() => setSelectedOverQuota(item)}
              >
                Rektorat Vizasini Qo‘yish
              </Button>
            </Tooltip>

            {canGiveRectorVisa && (
              <Button
                status="danger"
                icon={<IconCloseCircle />}
                style={{ flex: isMobile ? '1 1 110px' : 'none', minHeight: 38, borderRadius: 6 }}
                onClick={() => setRejectingRequest(item)}
              >
                Rad etish
              </Button>
            )}

            <Button
              type="secondary"
              icon={<IconRight />}
              style={{ flex: isMobile ? '1 1 100%' : 'none', minHeight: 36, borderRadius: 6 }}
              onClick={() => navigate('/requests')}
            >
              Talabnomani ko‘rib chiqish
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Bar */}
      <Card className="uwms-card" style={{ borderRadius: isMobile ? 8 : 0 }} bodyStyle={{ padding: isMobile ? '12px 14px' : '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Space align="center" size="small">
              <Title heading={5} style={{ margin: 0 }}>
                {t('inbox.title', 'Kutilayotgan Vazifalar Markazi (Action Center)')}
              </Title>
              {totalCount > 0 ? (
                <Badge count={totalCount} maxCount={99} />
              ) : (
                <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>
                  Barcha vazifalar bajarilgan
                </Tag>
              )}
            </Space>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color={roleMeta?.color || 'arcoblue'} style={{ fontWeight: 600, borderRadius: 0 }}>
                Rol: {roleLabel}
              </Tag>
              {user?.departmentName && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  • {user.departmentName}
                </Text>
              )}
            </div>
          </div>

          <Space size="medium">
            <Button
              icon={<IconRefresh />}
              style={{ borderRadius: 0 }}
              onClick={() => refetch()}
              loading={isFetching}
            >
              Yangilash
            </Button>
          </Space>
        </div>
      </Card>

      {/* Error state */}
      {isError && (
        <Alert
          type="error"
          showIcon
          title="Vazifalar ro‘yxatini yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {/* SUPER_ADMIN Scope Switcher & Banner */}
      {isSuperAdmin && (
        <Card className="uwms-card" style={{ borderRadius: 0, marginBottom: 16 }} bodyStyle={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Ko‘rish rejimi:</span>
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                {viewScope === 'personal'
                  ? 'Faqat shaxsan sizga biriktirilgan vazifalar'
                  : 'Universitet bo‘yicha barcha kutilayotgan jarayonlar (Boshqaruv monitoringi)'}
              </Typography.Text>
            </div>
            <Radio.Group
              type="button"
              value={viewScope}
              onChange={(val) => setViewScope(val)}
            >
              <Radio value="personal">Shaxsiy Vazifalarim</Radio>
              <Radio value="all">Universitet Bo‘yicha Monitoring</Radio>
            </Radio.Group>
          </div>
          {viewScope === 'all' && (
            <Alert
              type="info"
              icon={<IconSafe />}
              style={{ marginTop: 12, borderRadius: 0 }}
              content="Monitoring rejimi: Ushbu ko‘rinishda universitetdagi barcha ochiq jarayonlar va ularning mas’ullari ko‘rsatiladi. Xavfsizlik qoidasiga ko‘ra, har bir jarayon faqat unga biriktirilgan mas’ul xodim tomonidan bajariladi."
            />
          )}
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card className="uwms-card" style={{ borderRadius: 0, textAlign: 'center', padding: '60px 0' }}>
          <Spin dot size={20} tip="Vazifalar ro‘yxati tekshirilmoqda..." />
        </Card>
      )}

      {/* Empty State Banner when 0 tasks */}
      {!isLoading && !isError && totalCount === 0 && (
        <Card className="uwms-card" style={{ borderRadius: 0, textAlign: 'center', padding: '60px 24px' }}>
          <Empty
            icon={<IconCheckCircle style={{ fontSize: 56, color: '#00B42A' }} />}
            description={
              <div>
                <Title heading={5} style={{ color: '#00B42A', marginTop: 12 }}>
                  Ajoyib! Barcha vazifalar bajarilgan
                </Title>
                <Text type="secondary">
                  Hozirda sizning tasdiqingiz, qabulingiz yoki ovozingizni kutayotgan faol topshiriqlar mavjud emas.
                </Text>
              </div>
            }
          />
        </Card>
      )}

      {/* Main Tabs Container when tasks exist */}
      {!isLoading && !isError && totalCount > 0 && (
        <Card className="uwms-card" style={{ borderRadius: isMobile ? 8 : 0 }} bodyStyle={{ padding: isMobile ? '12px 10px' : '16px 20px' }}>
          <Tabs activeTab={activeTab} onChange={setActiveTab} type="line" style={{ width: '100%', overflowX: 'auto' }}>
            {/* ALL TAB */}
            <TabPane
              key="all"
              title={
                <span>
                  Barchasi <Badge count={totalCount} style={{ marginLeft: 6 }} />
                </span>
              }
            >
              <div style={{ paddingTop: 16 }}>
                {inbox?.pendingHandovers?.map(renderHandoverCard)}
                {inbox?.pendingTransfers.map(renderTransferCard)}
                {inbox?.pendingRequests.map(renderRequestCard)}
                {inbox?.pendingWriteOffVotes.map(renderWriteOffVoteCard)}
                {inbox?.openAudits.map(renderAuditCard)}
                {inbox?.lowStockAlerts.map(renderLowStockCard)}
                {inbox?.overQuotaRequests.map(renderOverQuotaCard)}
              </div>
            </TabPane>

            {/* HANDOVERS TAB */}
            {(summary?.pendingHandoversCount || 0) > 0 && (
              <TabPane
                key="handovers"
                title={
                  <span>
                    MOL Topshirishlari (OS-1){' '}
                    <Badge count={summary?.pendingHandoversCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.pendingHandovers?.map(renderHandoverCard)}
                </div>
              </TabPane>
            )}

            {/* TRANSFERS TAB */}
            {(summary?.pendingTransfersCount || 0) > 0 && (
              <TabPane
                key="transfers"
                title={
                  <span>
                    Qabul qilish{' '}
                    <Badge count={summary?.pendingTransfersCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.pendingTransfers.map(renderTransferCard)}
                </div>
              </TabPane>
            )}

            {/* REQUESTS TAB */}
            {(summary?.pendingRequestsCount || 0) > 0 && (
              <TabPane
                key="requests"
                title={
                  <span>
                    Talabnomalar{' '}
                    <Badge count={summary?.pendingRequestsCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.pendingRequests.map(renderRequestCard)}
                </div>
              </TabPane>
            )}

            {/* WRITE-OFF VOTES TAB */}
            {(summary?.pendingWriteOffVotesCount || 0) > 0 && (
              <TabPane
                key="votes"
                title={
                  <span>
                    Komissiya ovozlari{' '}
                    <Badge count={summary?.pendingWriteOffVotesCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.pendingWriteOffVotes.map(renderWriteOffVoteCard)}
                </div>
              </TabPane>
            )}

            {/* OPEN AUDITS TAB */}
            {(summary?.openAuditsCount || 0) > 0 && (
              <TabPane
                key="audits"
                title={
                  <span>
                    Auditlar{' '}
                    <Badge count={summary?.openAuditsCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.openAudits.map(renderAuditCard)}
                </div>
              </TabPane>
            )}

            {/* LOW STOCKS TAB */}
            {(summary?.lowStockAlertsCount || 0) > 0 && (
              <TabPane
                key="stocks"
                title={
                  <span>
                    Kam qoldiqlar{' '}
                    <Badge count={summary?.lowStockAlertsCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.lowStockAlerts.map(renderLowStockCard)}
                </div>
              </TabPane>
            )}

            {/* OVER QUOTA TAB */}
            {(summary?.overQuotaRequestsCount || 0) > 0 && (
              <TabPane
                key="overquota"
                title={
                  <span>
                    Kvotadan oshgan{' '}
                    <Badge count={summary?.overQuotaRequestsCount} style={{ marginLeft: 6 }} />
                  </span>
                }
              >
                <div style={{ paddingTop: 16 }}>
                  {inbox?.overQuotaRequests.map(renderOverQuotaCard)}
                </div>
              </TabPane>
            )}
          </Tabs>
        </Card>
      )}

      {/* MODALS */}
      <RectorVisaModal
        visible={!!selectedOverQuota}
        request={selectedOverQuota}
        onClose={() => setSelectedOverQuota(null)}
        onApproved={() => refetch()}
      />

      <RejectReasonModal
        visible={!!rejectingRequest}
        title="Talabnomani Rad Etish"
        itemIdentifier={rejectingRequest?.requestNumber}
        onClose={() => setRejectingRequest(null)}
        onConfirm={handleConfirmRejectRequest}
      />

      <RejectReasonModal
        visible={!!rejectingTransfer}
        title="Ashyo Ko‘chirishni Rad Etish"
        itemIdentifier={rejectingTransfer?.asset?.inventoryNumber}
        onClose={() => setRejectingTransfer(null)}
        onConfirm={handleConfirmRejectTransfer}
      />

      <RejectReasonModal
        visible={!!rejectingVote}
        title="Spisanie (OS-4) Ovozini Rad Etish"
        itemIdentifier={rejectingVote?.writeOffRequest.actNumber}
        onClose={() => setRejectingVote(null)}
        onConfirm={handleConfirmRejectVote}
      />

      {signingCampaignItem && (
        <QRPairingModal
          visible={isCampaignQrModalVisible}
          onClose={() => {
            setIsCampaignQrModalVisible(false);
            setSigningCampaignItem(null);
          }}
          onSuccess={handleCampaignQrSignSuccess}
          payload={{
            docNumber: `${signingCampaignItem.number}-FARMOYISH`,
            docType: 'FARMOYISH',
            title: `Rektor Farmoyishi: ${signingCampaignItem.title} (${signingCampaignItem.orderNumber || signingCampaignItem.number})`,
            departmentName: 'Rektorat Devoni',
            itemSummary: `Rejali inventarizatsiya: ${signingCampaignItem.scopesCount || 0} ta xona. Mas’ul auditor: ${signingCampaignItem.auditorName || 'Tayinlangan auditor'}`,
            targetSignerRole: user?.role || 'RECTOR',
            targetSignerName: user?.fullName || 'Universitet Rektori',
            targetUserId: user?.id,
            metadata: {
              campaignId: signingCampaignItem.id,
              campaignNumber: signingCampaignItem.number,
              title: signingCampaignItem.title,
              orderNumber: signingCampaignItem.orderNumber,
            },
          }}
        />
      )}

      {/* 1. TRANSFER ACCEPTANCE QR PAIRING MODAL */}
      {signingTransferItem && (
        <QRPairingModal
          visible={isTransferQrModalVisible}
          onClose={() => {
            setIsTransferQrModalVisible(false);
            setSigningTransferItem(null);
          }}
          onSuccess={handleTransferQrSignSuccess}
          payload={{
            docNumber: signingTransferItem.asset?.inventoryNumber || '—',
            docType: signingTransferItem.isReturn ? 'OS-2_RETURN' : 'OS-2_TRANSFER',
            title: signingTransferItem.isReturn
              ? `Omborga Qaytarishni Qabul Qilish (${signingTransferItem.asset?.inventoryNumber || '—'})`
              : `Ashyoni Qabul Qilish (OS-2) — ${signingTransferItem.asset?.inventoryNumber || '—'}`,
            departmentName: signingTransferItem.toRoom
              ? `${signingTransferItem.toRoom.number}-xona (${signingTransferItem.toRoom.name})`
              : signingTransferItem.toWarehouse?.name || 'Bosh omborxona',
            itemSummary: `${signingTransferItem.asset?.item?.name || 'Ashyo'} (Inventar №: ${signingTransferItem.asset?.inventoryNumber || '—'}). Yuboruvchi: ${signingTransferItem.sender?.fullName || '—'}`,
            targetSignerRole: signingTransferItem.isReturn ? RoleType.HEAD_WAREHOUSE : (user?.role || RoleType.MOL),
            targetSignerName: user?.fullName || 'Qabul qiluvchi',
            targetUserId: user?.id,
            metadata: {
              transferId: signingTransferItem.id,
              assetId: signingTransferItem.asset?.id || signingTransferItem.assetId,
              action: 'ACCEPT_TRANSFER',
            },
          }}
        />
      )}

      {/* 2. REQUEST APPROVAL QR PAIRING MODAL */}
      {signingRequestItem && (
        <QRPairingModal
          visible={isRequestQrModalVisible}
          onClose={() => {
            setIsRequestQrModalVisible(false);
            setSigningRequestItem(null);
          }}
          onSuccess={handleRequestQrSignSuccess}
          payload={{
            docNumber: signingRequestItem.requestNumber,
            docType: 'ZAYAVKA_APPROVAL',
            title:
              user?.role === RoleType.RECTOR
                ? `Rektorat Yakuniy Tasdig‘i: Talabnoma ${signingRequestItem.requestNumber}`
                : `Moliya Prorektori Vizasi: Talabnoma ${signingRequestItem.requestNumber}`,
            departmentName: signingRequestItem.department?.name || 'Kafedra',
            itemSummary:
              signingRequestItem.items
                ?.map((i) => `${i.item?.name || 'Mahsulot'} (${i.requestedQty} ${i.item?.unit || 'dona'})`)
                .join(', ') || signingRequestItem.purpose,
            targetSignerRole: user?.role || 'VICE_RECTOR_FINANCE',
            targetSignerName: user?.fullName || 'Mas’ul Rahbar',
            targetUserId: user?.id,
            metadata: {
              requestId: signingRequestItem.id,
              action: 'APPROVE_REQUEST',
            },
          }}
        />
      )}

      {/* 3. WRITE-OFF VOTE QR PAIRING MODAL */}
      {signingVoteItem && (
        <QRPairingModal
          visible={isVoteQrModalVisible}
          onClose={() => {
            setIsVoteQrModalVisible(false);
            setSigningVoteItem(null);
          }}
          onSuccess={handleVoteQrSignSuccess}
          payload={{
            docNumber: signingVoteItem.writeOffRequest.actNumber,
            docType: 'OS-4_VOTE',
            title: `Spisanie (OS-4) Komissiya Rozilik Ovozi: ${signingVoteItem.writeOffRequest.actNumber}`,
            departmentName: 'Universitet Spisanie Komissiyasi',
            itemSummary: `${signingVoteItem.writeOffRequest.asset?.item?.name || 'Asosiy vosita'} (${signingVoteItem.writeOffRequest.asset?.inventoryNumber || '—'}). Sabab: ${signingVoteItem.writeOffRequest.reason}`,
            targetSignerRole: signingVoteItem.roleName || user?.role || 'COMMISSION_MEMBER',
            targetSignerName: user?.fullName || 'Komissiya a’zosi',
            targetUserId: user?.id,
            metadata: {
              writeOffId: signingVoteItem.writeOffId,
              vote: 'APPROVED',
            },
          }}
        />
      )}

      {/* HANDOVER REVIEW AND SIGN MODAL */}
      <HandoverReviewModal
        visible={isHandoverModalVisible}
        handoverId={selectedHandoverId}
        onClose={() => {
          setIsHandoverModalVisible(false);
          setSelectedHandoverId(null);
        }}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['inbox'] });
          queryClient.invalidateQueries({ queryKey: ['assets'] });
          queryClient.invalidateQueries({ queryKey: ['handovers'] });
        }}
      />
    </div>
  );
};
