import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Grid,
  Tag,
  Typography,
  Popconfirm,
  Empty,
  Alert,
  Modal,
  Form,
  DatePicker,
  Select,
  Progress,
  Drawer,
  Badge,
  Spin,
  Tooltip,
  Message,
  Notification,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconPlayArrow,
  IconCheckCircle,
  IconCloseCircle,
  IconEye,
  IconFile,
  IconDownload,
  IconCalendar,
  IconRight,
  IconExclamationCircle,
  IconUserGroup,
  IconScan,
  IconRefresh,
  IconQrcode,
  IconWifi,
} from '@arco-design/web-react/icon';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAuditCampaignsQuery,
  useAuditCampaignProgressQuery,
  useAuditCampaignMissingReportQuery,
  useCreateCampaignMutation,
  useStartCampaignMutation,
  useCompleteCampaignMutation,
  useCancelCampaignMutation,
  downloadCampaignExcel,
  AuditCampaignItem,
  CampaignStatus,
  CompleteCampaignParams,
} from '../../hooks/useAuditCampaignsQuery';
import { useSocket } from '../../hooks/useSocket';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';
import { useAuthStore } from '../../store/authStore';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { DocType } from '../../constants';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
import { QRPairingModal } from '../../components/Common/QRPairingModal';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { StatusTag } from '../../components/Common/StatusTag';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

export const AuditCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuditorOrAdmin =
    user?.role === 'AUDITOR' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'HEAD_WAREHOUSE';
  const isRectorOrProrector =
    user?.role === 'RECTOR' || user?.role === 'VICE_RECTOR_FINANCE';
  const canViewCampaigns =
    isAuditorOrAdmin || isRectorOrProrector || user?.role === 'CHIEF_ACCOUNTANT';

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<CampaignStatus | 'ALL'>('ALL');

  const { data: campaigns = [], isLoading, isError, refetch } = useAuditCampaignsQuery(
    search.trim() || undefined,
    statusTab === 'ALL' ? undefined : statusTab,
  );

  const { rooms = [] } = useOrganizationQuery();
  const { data: usersData, isLoading: isLoadingUsers } = useUsersQuery({
    role: 'AUDITOR',
    pageSize: 100,
    isActive: true,
  });
  const auditors = (usersData?.items || []).filter((u) => u.role === 'AUDITOR');

  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [progressDrawerVisible, setProgressDrawerVisible] = useState(false);
  const [missingDrawerVisible, setMissingDrawerVisible] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Official document modal state
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docModalType, setDocModalType] = useState<DocType>('AUDIT');
  const [activeDocCampaign, setActiveDocCampaign] = useState<AuditCampaignItem | null>(null);

  // Dynamic QR-Pairing signing modal state
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrModalMode, setQrModalMode] = useState<'START' | 'COMPLETE'>('COMPLETE');
  const [signingCampaign, setSigningCampaign] = useState<AuditCampaignItem | null>(null);

  // Form for creating campaign
  const [form] = Form.useForm();

  // Mutations
  const createCampaignMutation = useCreateCampaignMutation();
  const startCampaignMutation = useStartCampaignMutation();
  const completeCampaignMutation = useCompleteCampaignMutation();
  const cancelCampaignMutation = useCancelCampaignMutation();

  // Progress and Missing details queries
  const { data: progressData, isLoading: isLoadingProgress } =
    useAuditCampaignProgressQuery(selectedCampaignId);
  const { data: missingData, isLoading: isLoadingMissing } =
    useAuditCampaignMissingReportQuery(selectedCampaignId);

  // Real-Time Monitoring & Multi-Auditor Sync Socket Integration
  const queryClient = useQueryClient();
  const { socket, isConnected: isSocketConnected, joinRoom, leaveRoom } = useSocket();

  // Faol kampaniyalar va tanlangan monitoring kampaniyasi xonalariga a'zo bo'lish
  useEffect(() => {
    if (!socket || !isSocketConnected) return;

    if (selectedCampaignId) {
      joinRoom(`campaign:${selectedCampaignId}`);
    }

    campaigns
      .filter((c) => c.status === 'IN_PROGRESS')
      .forEach((c) => {
        joinRoom(`campaign:${c.id}`);
      });

    return () => {
      if (selectedCampaignId) {
        leaveRoom(`campaign:${selectedCampaignId}`);
      }
      campaigns
        .filter((c) => c.status === 'IN_PROGRESS')
        .forEach((c) => {
          leaveRoom(`campaign:${c.id}`);
        });
    };
  }, [socket, isSocketConnected, selectedCampaignId, campaigns, joinRoom, leaveRoom]);

  // Real-time skanlarni qabul qilib, StockLevelGauge va xonalar holatini jonli yangilash
  useEffect(() => {
    if (!socket) return;

    const handleAssetScanned = (payload: any) => {
      // 1. Markaziy bildirishnoma
      Notification.info({
        title: 'Jonli Skanerlash (Real-Time)',
        content: `Auditor ${payload.asset.itemName} (${payload.asset.inventoryNumber}) vositasini ${payload.roomNumber ? payload.roomNumber + '-xona' : ''}da skanerladi`,
        duration: 4,
      });

      // 2. Monitoring draweridagi ma'lumotlarni 0ms da (optimistic) yangilash
      if (payload.campaignId) {
        queryClient.setQueryData(['audit-campaign-progress', payload.campaignId], (old: any) => {
          if (!old || !old.rooms) return old;
          const updatedRooms = old.rooms.map((r: any) => {
            if (r.roomId === payload.roomId) {
              const newMatched = payload.status === 'MATCHED' ? r.matchedCount + 1 : r.matchedCount;
              const isComplete =
                payload.roomStats?.isRoomComplete ??
                (newMatched >= r.expectedCount && r.expectedCount > 0);
              return {
                ...r,
                matchedCount: newMatched,
                totalScanned: r.totalScanned + 1,
                auditStatus: 'IN_PROGRESS',
                isCompleted: isComplete,
              };
            }
            return r;
          });

          const completedRoomsCount = updatedRooms.filter((r: any) => r.isCompleted).length;
          const totalMatchedCount = updatedRooms.reduce(
            (sum: number, r: any) => sum + r.matchedCount,
            0,
          );
          const progressPercent =
            old.totals.totalRooms > 0
              ? Math.round((completedRoomsCount / old.totals.totalRooms) * 100)
              : 0;

          return {
            ...old,
            totals: {
              ...old.totals,
              completedRooms: completedRoomsCount,
              totalMatched: totalMatchedCount,
              progressPercent,
            },
            rooms: updatedRooms,
          };
        });

        // Baza bilan to'liq solishtirish uchun fon so'rovi
        queryClient.invalidateQueries({ queryKey: ['audit-campaign-progress', payload.campaignId] });
        queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
      }
    };

    const handleRoomCompleted = (payload: any) => {
      Notification.success({
        title: 'Xona Inventarizatsiyasi Yakunlandi',
        content: `${payload.roomNumber ? payload.roomNumber + '-xona' : 'Xona'} tekshiruvi to‘liq yakunlandi va INV-19 muhrlandi.`,
        duration: 5,
      });
      if (payload.campaignId) {
        queryClient.invalidateQueries({ queryKey: ['audit-campaign-progress', payload.campaignId] });
        queryClient.invalidateQueries({ queryKey: ['audit-campaigns'] });
      }
    };

    socket.on('audit:asset_scanned', handleAssetScanned);
    socket.on('audit:room_completed', handleRoomCompleted);

    return () => {
      socket.off('audit:asset_scanned', handleAssetScanned);
      socket.off('audit:room_completed', handleRoomCompleted);
    };
  }, [socket, queryClient]);

  const handleOpenCreateModal = () => {
    form.resetFields();
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async () => {
    const values = await form.validate();
    const [start, end] = values.period;
    await createCampaignMutation.mutateAsync({
      title: values.title,
      periodStart: new Date(start).toISOString(),
      periodEnd: new Date(end).toISOString(),
      roomIds: values.roomIds,
      orderNumber: values.orderNumber,
      orderDate: values.orderDate ? new Date(values.orderDate).toISOString() : undefined,
      assignedAuditorId: values.assignedAuditorId,
      notes: values.notes,
    });
    setCreateModalVisible(false);
  };

  const handleOpenProgress = (campaign: AuditCampaignItem, e?: any) => {
    e?.stopPropagation?.();
    setSelectedCampaignId(campaign.id);
    setProgressDrawerVisible(true);
  };

  const handleOpenMissing = (campaign: AuditCampaignItem, e?: any) => {
    e?.stopPropagation?.();
    setSelectedCampaignId(campaign.id);
    setMissingDrawerVisible(true);
  };

  const handleOpenDecreeModal = (campaign: AuditCampaignItem, e?: any) => {
    e?.stopPropagation?.();
    setActiveDocCampaign(campaign);
    setDocModalType('AUDIT_DECREE');
    setDocModalVisible(true);
  };

  const handleOpenDocModal = (campaign: AuditCampaignItem, e?: any) => {
    e?.stopPropagation?.();
    setActiveDocCampaign(campaign);
    setDocModalType('AUDIT');
    setDocModalVisible(true);
  };

  const handleOpenStartQrModal = (campaign: AuditCampaignItem, e?: any) => {
    e?.stopPropagation?.();
    setSigningCampaign(campaign);
    setQrModalMode('START');
    setQrModalVisible(true);
  };

  const handleOpenCompleteQrModal = (campaign: AuditCampaignItem, e?: any) => {
    e?.stopPropagation?.();
    setSigningCampaign(campaign);
    setQrModalMode('COMPLETE');
    setQrModalVisible(true);
  };

  const handleQrSignSuccess = async (result: any) => {
    if (!signingCampaign) return;
    setQrModalVisible(false);

    if (qrModalMode === 'START') {
      try {
        await startCampaignMutation.mutateAsync({
          id: signingCampaign.id,
          signerName: result.signerName || user?.fullName || 'Universitet Rektori',
          signerRole:
            result.signerRole ||
            (user?.role === 'RECTOR'
              ? 'Universitet Rektori'
              : 'Moliya-iqtisodiyot ishlari bo‘yicha prorektor'),
          signatureHash: result.signatureHash || result.sessionId,
          notes: `Rektorat farmoyishi asosida dinamik QR-Pairing orqali tasdiqlandi (${result.biometricType || 'BIOMETRIC_VERIFIED'}).`,
        });
        setActiveDocCampaign(signingCampaign);
        setDocModalType('AUDIT_DECREE');
        setDocModalVisible(true);
        Message.success('Inventarizatsiya kampaniyasi Rektor farmoyishi bilan rasman boshlandi!');
      } catch (err: any) {
        Message.error(err?.response?.data?.message || 'Kampaniyani tasdiqlashda xatolik yuz berdi!');
      }
    } else {
      try {
        await completeCampaignMutation.mutateAsync({
          id: signingCampaign.id,
          signerName: result.signerName || user?.fullName || 'Bosh Auditor',
          signerRole: result.signerRole || 'Komissiya Raisi / Auditor',
          signatureHash: result.signatureHash || result.sessionId,
          notes: `Dinamik QR-Pairing orqali mobil telefon yordamida muvaffaqiyatli imzolandi (${result.biometricType || 'BIOMETRIC_VERIFIED'}).`,
        });
        setActiveDocCampaign(signingCampaign);
        setDocModalType('AUDIT');
        setDocModalVisible(true);
        Message.success('Dinamik QR-Pairing orqali INV-19 muvaffaqiyatli muhrlandi!');
      } catch (err: any) {
        Message.error(err?.response?.data?.message || 'Kampaniyani yakunlashda xatolik yuz berdi!');
      }
    }
  };



  const handleNavigateToScanner = (roomId: string, campaignId?: string) => {
    navigate(`/audit?roomId=${roomId}${campaignId ? `&campaignId=${campaignId}` : ''}`);
  };

  const handleExportMissingExcel = () => {
    if (!missingData || missingData.items.length === 0) return;
    const exportData = missingData.items.map((item, index) => ({
      '№': index + 1,
      'Inventar Raqami': item.inventoryNumber,
      'Seriya Raqami': item.serialNumber,
      'Ashyo Nomi': item.name,
      'Modeli': item.model,
      'Biriktirilgan Xona': `${item.expectedRoomNumber} (${item.expectedRoomName})`,
      'Mas’ul Shaxs (MOL)': item.responsibleMOL?.fullName || 'Tayinlanmagan',
      'MOL Telefoni': item.responsibleMOL?.phone || '—',
      'Xarid Qiymati': item.purchasePrice ? `${item.purchasePrice.toLocaleString()} so‘m` : '0 so‘m',
      'Holati': 'Kamomad (MISSING)',
      'Izoh': item.notes,
    }));

    exportToExcel(
      exportData,
      `Kamomad_Hisoboti_${missingData.campaignNumber}`,
      'Missing Assets',
    );
  };

  if (!canViewCampaigns) {
    return (
      <ForbiddenView
        title="Audit Kampaniyalariga Kirish Cheklangan"
        subTitle="Yalpi inventarizatsiya kampaniyalarini ko‘rish, rejalashtirish, tasdiqlash va yakunlash faqat Rektorat, Auditor, Bosh omborchi va Super Admin huquqiga ega foydalanuvchilar uchun ruxsat etilgan."
        requiredRoles={['RECTOR', 'VICE_RECTOR_FINANCE', 'AUDITOR', 'SUPER_ADMIN', 'ADMIN', 'HEAD_WAREHOUSE', 'CHIEF_ACCOUNTANT']}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Space size="medium">
          <Button
            icon={<IconRefresh />}
            onClick={() => refetch()}
            style={{ borderRadius: 0 }}
          >
            Yangilash
          </Button>
          {(isAuditorOrAdmin || isRectorOrProrector) && (
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={handleOpenCreateModal}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
            >
              Yangi Kampaniya Rejalashtirish
            </Button>
          )}
        </Space>
      </div>

      {/* Filter and Status Tabs Bar */}
      <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Input
            prefix={<IconSearch />}
            placeholder="Kampaniya nomi, kodi yoki izoh bo‘yicha qidiruv..."
            style={{ width: 360, borderRadius: 0 }}
            value={search}
            onChange={setSearch}
            allowClear
          />
          <Space size="small">
            <Button
              type={statusTab === 'ALL' ? 'primary' : 'secondary'}
              style={{ borderRadius: 0 }}
              onClick={() => setStatusTab('ALL')}
            >
              Barchasi ({campaigns.length})
            </Button>
            <Button
              type={statusTab === 'IN_PROGRESS' ? 'primary' : 'secondary'}
              style={{ borderRadius: 0 }}
              onClick={() => setStatusTab('IN_PROGRESS')}
            >
              Jarayonda
            </Button>
            <Button
              type={statusTab === 'PLANNED' ? 'primary' : 'secondary'}
              style={{ borderRadius: 0 }}
              onClick={() => setStatusTab('PLANNED')}
            >
              Rejalashtirilgan
            </Button>
            <Button
              type={statusTab === 'COMPLETED' ? 'primary' : 'secondary'}
              style={{ borderRadius: 0 }}
              onClick={() => setStatusTab('COMPLETED')}
            >
              Yakunlangan
            </Button>
          </Space>
        </div>
      </Card>

      {/* Error state */}
      {isError && (
        <Alert
          type="error"
          title="Kampaniyalarni yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzilgan yoki ruxsat cheklangan. Qaytadan urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta yuklash
            </Button>
          }
        />
      )}

      {/* Campaigns StandardTable */}
      <StandardTable<AuditCampaignItem>
        rowKey="id"
        loading={isLoading}
        data={campaigns}
        scrollX={1420}
        onRowClick={(record) => handleOpenProgress(record)}
        emptyText={search ? 'Qidiruv bo‘yicha kampaniya topilmadi' : 'Hali rejali kampaniyalar yaratilmagan'}
        columns={[
          {
            title: 'Kampaniya Kodi & Nomi',
            dataIndex: 'title',
            minWidth: 260,
            render: (title: string, record: AuditCampaignItem) => (
              <div style={{ paddingLeft: 6 }}>
                <CategoryThumbnail
                  icon={<IconCalendar />}
                  name={title}
                  tag={`Kod: ${record.campaignNumber}`}
                  color="#165DFF"
                  bg="#E8F3FF"
                />
              </div>
            ),
          },
          {
            title: 'Buyruq & Mas’ul Auditor',
            width: 220,
            render: (_, record: AuditCampaignItem) => (
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: record.orderNumber ? '#165DFF' : 'var(--color-text-3)' }}>
                  {record.orderNumber ? `Buyruq: ${record.orderNumber}` : 'Buyruq biriktirilmagan'}
                </div>
                <div style={{ color: 'var(--color-text-2)', marginTop: 2 }}>
                  Auditor: {record.assignedAuditor?.fullName || 'Tayinlanmagan'}
                </div>
                {record.approvedBy && (
                  <div style={{ color: '#00B42A', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconCheckCircle /> Rektorat tasdiqlagan
                  </div>
                )}
              </div>
            ),
          },
          {
            title: 'Reja Davri',
            width: 170,
            render: (_, record: AuditCampaignItem) => (
              <div style={{ fontSize: 12 }}>
                <div>{record.periodStart ? record.periodStart.split('T')[0] : '—'}</div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                  gacha: {record.periodEnd ? record.periodEnd.split('T')[0] : '—'}
                </div>
              </div>
            ),
          },
          {
            title: 'Qamrov',
            width: 130,
            render: (_, record: AuditCampaignItem) => (
              <div>
                <div style={{ fontWeight: 600 }}>{record.totalRooms} ta xona</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                  Bajarildi: {record.completedRooms} ta
                </div>
              </div>
            ),
          },
          {
            title: 'Progress',
            width: 180,
            render: (_, record: AuditCampaignItem) => (
              <StockLevelGauge
                percent={record.progressPercent}
                width={150}
                strokeWidth={6}
                label={
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color:
                        record.missingCount > 0
                          ? '#F53F3F'
                          : record.progressPercent === 100
                          ? '#00B42A'
                          : '#165DFF',
                    }}
                  >
                    {record.progressPercent}% ({record.completedRooms}/{record.totalRooms} xona)
                  </span>
                }
                subLabel={
                  record.missingCount > 0 ? (
                    <span style={{ color: '#F53F3F', fontWeight: 600, fontSize: 11 }}>
                      Kamomad: {record.missingCount}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                      Topildi: {record.matchedCount}
                    </span>
                  )
                }
                color={
                  record.missingCount > 0
                    ? '#F53F3F'
                    : record.progressPercent === 100
                    ? '#00B42A'
                    : '#165DFF'
                }
                status={
                  record.missingCount > 0
                    ? 'error'
                    : record.progressPercent === 100
                    ? 'success'
                    : 'normal'
                }
              />
            ),
          },
          {
            title: 'Holati',
            width: 140,
            render: (_, record: AuditCampaignItem) => (
              <StatusTag status={record.status} domain="audit" />
            ),
          },
          {
            title: 'WORM Imzo & INV-19',
            width: 175,
            render: (_, record: AuditCampaignItem) => {
              if (record.hasWormStamp) {
                return (
                  <Tooltip
                    content={
                      record.stamp?.signerName
                        ? `Imzolagan: ${record.stamp.signerName} (${record.stamp.signerRole || 'Auditor'}) • ${new Date(
                            record.stamp.createdAt,
                          ).toLocaleDateString('uz-UZ')}`
                        : 'WORM zanjirida muhrlangan'
                    }
                  >
                    <Tag
                      color="green"
                      icon={<IconCheckCircle />}
                      style={{ borderRadius: 0, fontWeight: 600 }}
                    >
                      WORM Muhrlangan
                    </Tag>
                  </Tooltip>
                );
              }
              if (record.status === 'COMPLETED') {
                return <Tag color="gold" style={{ borderRadius: 0 }}>Muhr kutilmoqda</Tag>;
              }
              if (record.status === 'IN_PROGRESS') {
                return <Tag color="arcoblue" style={{ borderRadius: 0 }}>Jarayonda</Tag>;
              }
              return <span style={{ color: 'var(--color-text-4)', fontSize: 12 }}>—</span>;
            },
          },
          {
            title: 'Amallar',
            width: 270,
            fixed: 'right' as const,
            render: (_, record: AuditCampaignItem) => (
              <TableActions rightPadding={16}>
                <Tooltip content="Xonalar va Progress">
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconEye />}
                    onClick={(e) => handleOpenProgress(record, e)}
                    style={{ borderRadius: 0 }}
                  >
                    Progress
                  </Button>
                </Tooltip>

                {record.missingCount > 0 && (
                  <Tooltip content="Kamomadlar hisoboti">
                    <Button
                      size="small"
                      type="outline"
                      status="danger"
                      icon={<IconExclamationCircle />}
                      onClick={(e) => handleOpenMissing(record, e)}
                      style={{ borderRadius: 0 }}
                    >
                      Kamomad ({record.missingCount})
                    </Button>
                  </Tooltip>
                )}

                {record.status === 'PLANNED' && (
                  isRectorOrProrector ? (
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconQrcode />}
                      loading={startCampaignMutation.isPending && signingCampaign?.id === record.id}
                      onClick={(e) => handleOpenStartQrModal(record, e)}
                      style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                    >
                      Rektor Farmoyishi (QR Imzo)
                    </Button>
                  ) : (
                    <Tooltip content="Inventarizatsiyani boshlash faqat Rektor yoki Moliya prorektori raqamli imzosi orqali amalga oshiriladi">
                      <Tag
                        color="gold"
                        icon={<IconExclamationCircle />}
                        style={{ borderRadius: 0, fontWeight: 600 }}
                      >
                        Rektor Farmoyishi Kutilmoqda
                      </Tag>
                    </Tooltip>
                  )
                )}

                {record.status === 'IN_PROGRESS' && (
                  <>
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconFile />}
                      onClick={(e) => handleOpenDecreeModal(record, e)}
                      style={{ borderRadius: 0 }}
                    >
                      Farmoyish
                    </Button>
                    {(user?.role === 'AUDITOR' || user?.role === 'SUPER_ADMIN') && (
                      <Button
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconQrcode />}
                        loading={completeCampaignMutation.isPending && signingCampaign?.id === record.id}
                        onClick={(e) => handleOpenCompleteQrModal(record, e)}
                        style={{ borderRadius: 0 }}
                      >
                        QR-Yakunlash
                      </Button>
                    )}
                  </>
                )}

                {record.status === 'COMPLETED' && (
                  <>
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconFile />}
                      onClick={(e) => handleOpenDecreeModal(record, e)}
                      style={{ borderRadius: 0 }}
                    >
                      Farmoyish
                    </Button>
                    <Tooltip content="3-varaqli rasmiy INV-19 Excel (.xlsx) hisobotini yuklab olish">
                      <Button
                        size="small"
                        type="outline"
                        status="success"
                        icon={<IconDownload />}
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadCampaignExcel(record.id, record.campaignNumber);
                        }}
                        style={{ borderRadius: 0 }}
                      >
                        Excel
                      </Button>
                    </Tooltip>
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconFile />}
                      onClick={(e) => handleOpenDocModal(record, e)}
                      style={{ borderRadius: 0 }}
                    >
                      INV-19 Akt
                    </Button>
                  </>
                )}
              </TableActions>
            ),
          },
        ]}
      />

      {/* Create Campaign Modal */}
      <Modal
        title="Yangi Rejali Inventarizatsiya Kampaniyasi Yaratish"
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateSubmit}
        confirmLoading={createCampaignMutation.isPending}
        okText="Rejalashtirish"
        cancelText="Bekor qilish"
        style={{ width: 660, borderRadius: 0 }}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="Kampaniya Nomi"
            field="title"
            rules={[{ required: true, message: 'Kampaniya nomini kiriting!' }]}
          >
            <Input placeholder="Masalan: 2026-yil 1-semestr Bosh Bino inventarizatsiyasi" style={{ borderRadius: 0 }} />
          </FormItem>

          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="Rektor Buyrug‘i Raqami"
                field="orderNumber"
                rules={[{ required: true, message: 'Rektor buyrug‘i raqamini kiriting!' }]}
              >
                <Input placeholder="Masalan: № 142-F" style={{ borderRadius: 0 }} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="Buyruq Sanasi"
                field="orderDate"
                rules={[{ required: true, message: 'Buyruq sanasini tanlang!' }]}
              >
                <DatePicker style={{ width: '100%', borderRadius: 0 }} />
              </FormItem>
            </Col>
          </Row>

          <FormItem
            label="Tayinlangan Mas’ul Auditor"
            field="assignedAuditorId"
            rules={[{ required: true, message: 'Mas’ul auditorni tanlang!' }]}
            extra="Ushbu auditor shaxsiy kabinetida (Inbox) mazkur kampaniya xonalarini ko‘radi va tekshiruvni olib boradi."
          >
            <Select
              placeholder="Mas’ul auditorni tanlang..."
              style={{ borderRadius: 0 }}
              allowClear
              loading={isLoadingUsers}
            >
              {auditors.map((auditor) => (
                <Select.Option key={auditor.id} value={auditor.id}>
                  {auditor.fullName} ({auditor.username}) — Auditor
                </Select.Option>
              ))}
            </Select>
          </FormItem>

          <FormItem
            label="Rejalashtirilgan Davr (Boshlanish va Tugash)"
            field="period"
            rules={[{ required: true, message: 'Davrni tanlang!' }]}
          >
            <DatePicker.RangePicker style={{ width: '100%', borderRadius: 0 }} />
          </FormItem>

          <FormItem
            label="Qamrov Xonalari (Scope)"
            field="roomIds"
            rules={[{ required: true, message: 'Kamida bitta xonani tanlang!' }]}
            extra="Universitetdagi inventarizatsiya o‘tkazilishi lozim bo‘lgan xonalar tanlanadi."
          >
            <Select
              mode="multiple"
              placeholder="Xonalarni tanlang yoki qidiring..."
              style={{ borderRadius: 0 }}
              allowClear
            >
              {rooms.map((room) => (
                <Select.Option key={room.id} value={room.id}>
                  {room.number}-xona: {room.name} ({room.building || 'Bosh bino'})
                </Select.Option>
              ))}
            </Select>
          </FormItem>

          <FormItem label="Qo‘shimcha Izoh va Reja Tafsilotlari" field="notes">
            <Input.TextArea rows={3} placeholder="Rektorat buyrug‘i, maqsad va mas’ul komissiya tarkibi..." style={{ borderRadius: 0 }} />
          </FormItem>
        </Form>
      </Modal>

      {/* Campaign Progress & Room-by-room Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{progressData ? `Inventarizatsiya Progressi: ${progressData.title}` : 'Kampaniya Progressi'}</span>
            {isSocketConnected && (
              <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0, fontWeight: 600 }}>
                Jonli Monitoring (Multi-Auditor Sync)
              </Tag>
            )}
          </div>
        }
        visible={progressDrawerVisible}
        onCancel={() => setProgressDrawerVisible(false)}
        footer={null}
        width={850}
      >
        {isLoadingProgress ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}><Spin dot size={20} /></div>
        ) : progressData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Quick Export toolbar in Drawer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                Reja kodi: <b>{progressData.campaignNumber}</b>
              </div>
              <Button
                type="primary"
                status="success"
                icon={<IconDownload />}
                onClick={() => downloadCampaignExcel(progressData.campaignId, progressData.campaignNumber)}
                style={{ borderRadius: 0 }}
              >
                INV-19 Excel (.xlsx) Hisoboti
              </Button>
            </div>

            {/* High level progress stats */}

            <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Title heading={6} style={{ margin: 0 }}>Umumiy Qamrov Progressi</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Jami {progressData.totals.totalRooms} ta xonadan {progressData.totals.completedRooms} tasi to‘liq tekshirildi
                  </Text>
                </div>
                <StatusTag status={progressData.status} domain="audit" />
              </div>
              <StockLevelGauge
                percent={progressData.totals.progressPercent}
                strokeWidth={8}
                label={
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color:
                        progressData.totals.totalMissing > 0 ? '#F53F3F' : '#00B42A',
                    }}
                  >
                    {progressData.totals.progressPercent}% Yakunlandi
                  </span>
                }
                subLabel={
                  progressData.totals.totalMissing > 0 ? (
                    <span style={{ color: '#F53F3F', fontWeight: 600, fontSize: 12 }}>
                      {progressData.totals.totalMissing} ta kamomad
                    </span>
                  ) : (
                    <span style={{ color: '#00B42A', fontSize: 12 }}>
                      Barcha ashyolar joyida
                    </span>
                  )
                }
                color={
                  progressData.totals.totalMissing > 0 ? '#F53F3F' : '#00B42A'
                }
                status={
                  progressData.totals.totalMissing > 0 ? 'error' : 'success'
                }
              />
              <div style={{ display: 'flex', gap: 24, marginTop: 14, fontSize: 13 }}>
                <div>Kutilgan jihozlar: <b>{progressData.totals.totalExpected} ta</b></div>
                <div style={{ color: '#00B42A' }}>Topildi: <b>{progressData.totals.totalMatched} ta</b></div>
                <div style={{ color: '#F53F3F' }}>Kamomad: <b>{progressData.totals.totalMissing} ta</b></div>
                <div style={{ color: '#FF7D00' }}>Boshqa xonadan: <b>{progressData.totals.totalRelocated} ta</b></div>
              </div>
            </Card>

            {/* Room breakdown table */}
            <Title heading={6} style={{ margin: 0 }}>Xonalar Ro‘yxati va Skanerlash Holati</Title>
            <Table
              rowKey="roomId"
              data={progressData.rooms}
              pagination={false}
              columns={[
                {
                  title: 'Xona',
                  render: (_, r) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.roomNumber}-xona ({r.roomName})</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{r.building} • {r.departmentName}</div>
                    </div>
                  ),
                },
                {
                  title: 'Mas’ul MOL',
                  render: (_, r) => (
                    <div>
                      <div>{r.responsibleMOL}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{r.responsiblePhone}</div>
                    </div>
                  ),
                },
                {
                  title: 'Holati',
                  width: 140,
                  render: (_, r) => {
                    if (r.isCompleted) return <StatusTag status="COMPLETED" domain="audit" label="Tekshirildi" />;
                    if (r.auditStatus === 'IN_PROGRESS') return <StatusTag status="IN_PROGRESS" domain="audit" />;
                    return <StatusTag status="PLANNED" domain="audit" label="Boshlanmagan" />;
                  },
                },
                {
                  title: 'Jihozlar',
                  width: 140,
                  render: (_, r) => (
                    <div style={{ fontSize: 12 }}>
                      <div>Kutilgan: <b>{r.expectedCount} ta</b></div>
                      <div style={{ color: '#00B42A' }}>Topildi: <b>{r.matchedCount} ta</b></div>
                    </div>
                  ),
                },
                {
                  title: 'Amal',
                  width: 130,
                  render: (_, r) => (
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconScan />}
                      style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                      onClick={() => handleNavigateToScanner(r.roomId, progressData.campaignId)}
                    >
                      Skanerlash
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Missing Report Drawer */}
      <Drawer
        title={missingData ? `Kamomad Hisoboti (MISSING): ${missingData.campaignNumber}` : 'Kamomad Hisoboti'}
        visible={missingDrawerVisible}
        onCancel={() => setMissingDrawerVisible(false)}
        footer={null}
        width={850}
      >
        {isLoadingMissing ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}><Spin dot size={20} /></div>
        ) : missingData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title heading={6} style={{ margin: 0, color: '#F53F3F' }}>
                  Jami Kamomad: {missingData.totalMissingCount} ta ashyo
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Umumiy yetishmayotgan qiymat: <b>{missingData.totalMissingValue.toLocaleString()} so‘m</b>
                </Text>
              </div>
              <Button
                type="primary"
                status="success"
                icon={<IconDownload />}
                style={{ borderRadius: 0 }}
                onClick={handleExportMissingExcel}
              >
                Excelga Yuklab Olish
              </Button>
            </div>

            <Table
              rowKey="id"
              data={missingData.items}
              pagination={{ pageSize: 10 }}
              noDataElement={<Empty description="Ushbu kampaniyada kamomadlar aniqlanmadi (Barcha ashyolar joyida)" />}
              columns={[
                {
                  title: 'Inventar № & Nomi',
                  render: (_, item) => (
                    <div>
                      <div style={{ fontWeight: 600, color: '#165DFF' }}>{item.inventoryNumber}</div>
                      <div>{item.name} {item.model && `(${item.model})`}</div>
                    </div>
                  ),
                },
                {
                  title: 'Xona',
                  render: (_, item) => `${item.expectedRoomNumber} (${item.expectedRoomName})`,
                },
                {
                  title: 'Javobgar Shaxs (MOL)',
                  render: (_, item) => (
                    <div>
                      <div>{item.responsibleMOL?.fullName || 'Tayinlanmagan'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{item.responsibleMOL?.phone || '—'}</div>
                    </div>
                  ),
                },
                {
                  title: 'Narxi',
                  render: (_, item) => (
                    item.purchasePrice ? `${item.purchasePrice.toLocaleString()} so‘m` : '0 so‘m'
                  ),
                },
                {
                  title: 'Holati',
                  render: () => <Tag color="red" style={{ borderRadius: 0 }}>Kamomad (MISSING)</Tag>,
                },
              ]}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Official Document Modal (Farmoyish or INV-19 Akt) */}
      {activeDocCampaign && (
        <OfficialDocModal
          visible={docModalVisible}
          onClose={() => setDocModalVisible(false)}
          docType={docModalType}
          docNumber={
            docModalType === 'AUDIT_DECREE'
              ? `${activeDocCampaign.campaignNumber}-FARMOYISH`
              : activeDocCampaign.stamp?.docNumber || activeDocCampaign.campaignNumber
          }
          date={
            docModalType === 'AUDIT_DECREE'
              ? activeDocCampaign.approvedAt
                ? new Date(activeDocCampaign.approvedAt).toISOString().split('T')[0]
                : activeDocCampaign.orderDate
                ? new Date(activeDocCampaign.orderDate).toISOString().split('T')[0]
                : new Date(activeDocCampaign.createdAt).toISOString().split('T')[0]
              : activeDocCampaign.stamp?.createdAt
              ? new Date(activeDocCampaign.stamp.createdAt).toISOString().split('T')[0]
              : new Date(activeDocCampaign.updatedAt || activeDocCampaign.createdAt).toISOString().split('T')[0]
          }
          sourceLocation={`Qamrov: ${activeDocCampaign.totalRooms} ta xona`}
          senderName={
            docModalType === 'AUDIT_DECREE'
              ? activeDocCampaign.approvedBy?.fullName || 'Universitet Rektori'
              : activeDocCampaign.totalRooms > 1
              ? `Kafedra mudirlari va moddiy javobgarlar (${activeDocCampaign.totalRooms} ta xona)`
              : 'Moddiy javobgar shaxs (MOL)'
          }
          receiverName={
            docModalType === 'AUDIT_DECREE'
              ? activeDocCampaign.assignedAuditor?.fullName || 'Tayinlangan mas’ul auditor'
              : activeDocCampaign.stamp?.signerName ||
                (activeDocCampaign.createdBy?.fullName
                  ? `${activeDocCampaign.createdBy.fullName} (Bosh Auditor)`
                  : 'Ichki Audit va Inventarizatsiya Komissiyasi')
          }
          signatures={
            docModalType === 'AUDIT_DECREE'
              ? [
                  {
                    role: 'Universitet Rektori (Farmoyish beruvchi)',
                    name: activeDocCampaign.approvedBy?.fullName || 'Universitet Rektori',
                    isSigned: Boolean(activeDocCampaign.approvedAt || activeDocCampaign.approvedById),
                    signedAt: activeDocCampaign.approvedAt
                      ? new Date(activeDocCampaign.approvedAt).toLocaleString('uz-UZ')
                      : undefined,
                    biometricType: 'FaceID (QR-Pairing)',
                  },
                  {
                    role: 'Mas’ul Bosh Auditor (Ijro uchun qabul qilgan)',
                    name: activeDocCampaign.assignedAuditor?.fullName || 'Tayinlangan Auditor',
                    isSigned: true,
                    signedAt: activeDocCampaign.createdAt
                      ? new Date(activeDocCampaign.createdAt).toLocaleString('uz-UZ')
                      : undefined,
                    biometricType: 'Tizimda tasdiqlangan',
                  },
                ]
              : [
                  {
                    role: 'Moddiy Javobgar Shaxslar',
                    name:
                      activeDocCampaign.totalRooms > 1
                        ? `Kafedra mudirlari va mas’ullar (${activeDocCampaign.totalRooms} ta xona)`
                        : 'Moddiy javobgar shaxs (MOL)',
                    isSigned: true,
                    signedAt: activeDocCampaign.updatedAt
                      ? new Date(activeDocCampaign.updatedAt).toLocaleString('uz-UZ')
                      : undefined,
                    biometricType: 'FaceID (QR-Pairing)',
                  },
                  {
                    role: activeDocCampaign.stamp?.signerRole || 'Bosh Auditor',
                    name:
                      activeDocCampaign.stamp?.signerName ||
                      activeDocCampaign.createdBy?.fullName ||
                      'Ichki Auditor',
                    isSigned: true,
                    signedAt: activeDocCampaign.stamp?.createdAt
                      ? new Date(activeDocCampaign.stamp.createdAt).toLocaleString('uz-UZ')
                      : activeDocCampaign.updatedAt
                      ? new Date(activeDocCampaign.updatedAt).toLocaleString('uz-UZ')
                      : undefined,
                    biometricType: 'FaceID (QR-Pairing)',
                  },
                  {
                    role: 'Universitet Rektorati (Tasdiqladi)',
                    name: activeDocCampaign.approvedBy?.fullName || 'Universitet Rektori',
                    isSigned: Boolean(activeDocCampaign.approvedAt || activeDocCampaign.approvedById),
                    signedAt: activeDocCampaign.approvedAt
                      ? new Date(activeDocCampaign.approvedAt).toLocaleString('uz-UZ')
                      : undefined,
                    biometricType: 'FaceID (QR-Pairing)',
                  },
                ].filter((s) => s.name)
          }
          items={
            missingData?.items.map((item) => ({
              inventoryNumber: item.inventoryNumber,
              name: item.name,
              model: item.model,
              serialNumber: item.serialNumber,
              price: item.purchasePrice,
              quantity: 1,
              unit: 'dona',
            })) || []
          }
          reason={
            docModalType === 'AUDIT_DECREE'
              ? `O‘zbekiston Respublikasi Oliy ta’lim muassasalari standartlari va universitet ichki nizomiga muvofiq, moddiy boyliklar butligini ta’minlash maqsadida ${activeDocCampaign.orderNumber ? `№ ${activeDocCampaign.orderNumber} raqamli buyruq` : activeDocCampaign.campaignNumber} asosida o‘tkazilayotgan rejali inventarizatsiya tekshiruvi.`
              : `Yalpi Inventarizatsiya va Solishtirma Dalolatnomasi (INV-19) - ${activeDocCampaign.title}. Tekshiruv rasmiy yakunlandi va WORM zanjirida muhrlandi.`
          }
          entityId={
            docModalType === 'AUDIT_DECREE'
              ? `${activeDocCampaign.campaignNumber}-FARMOYISH`
              : activeDocCampaign.stamp?.id || activeDocCampaign.id
          }
        />
      )}

      {/* 60s Dynamic QR-Pairing Modal for Mobile Biometric Signing */}
      {signingCampaign && (
        <QRPairingModal
          visible={qrModalVisible}
          onClose={() => setQrModalVisible(false)}
          onSuccess={handleQrSignSuccess}
          payload={
            qrModalMode === 'START'
              ? {
                  docNumber: `${signingCampaign.campaignNumber}-FARMOYISH`,
                  docType: 'FARMOYISH',
                  title: `Rektor Farmoyishi: ${signingCampaign.title} (${signingCampaign.orderNumber || signingCampaign.campaignNumber})`,
                  departmentName: 'Rektorat Devoni',
                  itemSummary: `Reja qamrovi: ${signingCampaign.totalRooms} ta xona. Mas’ul auditor: ${signingCampaign.assignedAuditor?.fullName || 'Tayinlangan auditor'}`,
                  targetSignerRole: user?.role || 'RECTOR',
                  targetSignerName: user?.fullName || 'Universitet Rektori',
                  targetUserId: user?.id,
                  metadata: {
                    campaignId: signingCampaign.id,
                    orderNumber: signingCampaign.orderNumber,
                    orderDate: signingCampaign.orderDate,
                    assignedAuditorId: signingCampaign.assignedAuditorId,
                  },
                }
              : {
                  docNumber: signingCampaign.campaignNumber,
                  docType: 'INV_19',
                  title: `Yalpi Inventarizatsiya (INV-19) - ${signingCampaign.title}`,
                  departmentName: 'Universitet Ichki Audit va Nazorat Guruhi',
                  itemSummary: `Qamrov: ${signingCampaign.totalRooms} ta xona, ${signingCampaign.matchedCount} ta topildi, ${signingCampaign.missingCount} ta kamomad`,
                  targetSignerRole: user?.role || 'AUDITOR',
                  targetSignerName: user?.fullName || 'Bosh Auditor',
                  targetUserId: user?.id,
                  metadata: {
                    campaignId: signingCampaign.id,
                    campaignNumber: signingCampaign.campaignNumber,
                    title: signingCampaign.title,
                    totalRooms: signingCampaign.totalRooms,
                    matchedCount: signingCampaign.matchedCount,
                    missingCount: signingCampaign.missingCount,
                  },
                }
          }
        />
      )}
    </div>
  );
};

