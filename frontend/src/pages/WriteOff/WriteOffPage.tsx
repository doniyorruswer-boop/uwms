import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Tag,
  Badge,
  Space,
  Input,
  Modal,
  Form,
  Radio,
  Typography,
  Card,
  Grid,
  Alert,
  Drawer,
  Descriptions,
  Tabs,
  Progress,
  Tooltip,
  Notification,
} from '@arco-design/web-react';
import { useSocket } from '../../hooks/useSocket';
import {
  IconPlus,
  IconSearch,
  IconFile,
  IconDownload,
  IconRefresh,
  IconThumbUp,
  IconPrinter,
  IconEye,
  IconQrcode,
} from '@arco-design/web-react/icon';
import { useWriteOffQuery, type WriteOffItem, type WriteOffMember } from '../../hooks/useWriteOffQuery';
import { CreateWriteOffModal } from '../../components/WriteOff/CreateWriteOffModal';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { useAuthStore } from '../../store/authStore';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { StandardTable } from '../../components/Common/StandardTable';
import { exportToExcel } from '../../utils/exportExcel';
import { TableActions } from '../../components/Common/TableActions';
import { QRPairingModal } from '../../components/Common/QRPairingModal';
import { StatusTag } from '../../components/Common/StatusTag';
import { getStatusLabel } from '../../constants/status.constants';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const { TextArea } = Input;
const TabPane = Tabs.TabPane;

export const WriteOffPage: React.FC = () => {
  const { user } = useAuthStore();
  const canCreateWriteOff = ['MOL', 'HEAD_WAREHOUSE', 'COMMENDANT', 'SUPER_ADMIN'].includes(
    user?.role || '',
  );

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Voting modal state
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [selectedWriteOff, setSelectedWriteOff] = useState<WriteOffItem | null>(null);
  const [voteForm] = Form.useForm();

  // Dynamic QR-Pairing voting state
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [pendingQrVote, setPendingQrVote] = useState<{
    writeOff: WriteOffItem;
    vote: 'APPROVED' | 'REJECTED';
    comment?: string;
  } | null>(null);

  // Passport Drawer state (opens on row click)
  const [isPassportDrawerVisible, setIsPassportDrawerVisible] = useState(false);
  const [selectedPassportItem, setSelectedPassportItem] = useState<WriteOffItem | null>(null);

  const handleOpenPassport = (record: WriteOffItem) => {
    setSelectedPassportItem(record);
    setIsPassportDrawerVisible(true);
  };

  // Official document modal state
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [activeDocData, setActiveDocData] = useState<any>(null);

  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const { writeOffs, isLoading, isError, refetch, voteWriteOff, isVoting } = useWriteOffQuery({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  // Real-Time Socket.io Tandem (Live Quorum Voting & OS-4 Finalization)
  useEffect(() => {
    if (!socket) return;

    const handleQuorumUpdated = (data: {
      writeOffId: string;
      actNumber: string;
      votedCount: number;
      totalCount: number;
      percentage: number;
      status: string;
      vote: string;
      allApproved: boolean;
      hasRejection: boolean;
    }) => {
      // Invalidate writeOffs query so that table progress gauge moves smoothly (3/5 -> 4/5)
      queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });

      // If user has the passport drawer open for this write-off, refresh selected item
      if (selectedPassportItem && selectedPassportItem.id === data.writeOffId) {
        setSelectedPassportItem((prev) =>
          prev ? { ...prev, status: data.status as any } : null
        );
      }

      if (data.hasRejection) {
        Notification.warning({
          title: 'Komissiya Ovozi: Rad Etildi',
          content: `${data.actNumber}: Komissiya a’zosi tomonidan rad etildi. Jarayon to‘xtatildi.`,
          duration: 6,
        });
      } else if (!data.allApproved) {
        Notification.info({
          title: 'Jonli Kvorum Yangilanishi',
          content: `${data.actNumber}: Kvorum ${data.votedCount}/${data.totalCount} (${data.percentage}%) ga yetdi.`,
          duration: 4,
        });
      }
    };

    const handleFinalized = (data: {
      writeOffId: string;
      actNumber: string;
      assetName?: string;
      inventoryNumber?: string;
      message?: string;
    }) => {
      queryClient.invalidateQueries({ queryKey: ['writeOffs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });

      Notification.success({
        title: 'OS-4 Dalolatnomasi Qulflanib Muhrlandi!',
        content:
          data.message ||
          `${data.actNumber} bo‘yicha to‘liq kvorum yig‘ildi. WORM SHA-256 tamg‘asi bosildi!`,
        duration: 8,
      });
    };

    socket.on('writeoff:quorum_updated', handleQuorumUpdated);
    socket.on('writeoff:finalized', handleFinalized);

    return () => {
      socket.off('writeoff:quorum_updated', handleQuorumUpdated);
      socket.off('writeoff:finalized', handleFinalized);
    };
  }, [socket, queryClient, selectedPassportItem]);

  // Calculate metrics dynamically from real PostgreSQL records
  const totalCount = writeOffs.length;
  const inReviewCount = useMemo(
    () => writeOffs.filter((w) => w.status === 'IN_REVIEW').length,
    [writeOffs],
  );
  const approvedCount = useMemo(
    () => writeOffs.filter((w) => w.status === 'APPROVED').length,
    [writeOffs],
  );
  const rejectedCount = useMemo(
    () => writeOffs.filter((w) => w.status === 'REJECTED').length,
    [writeOffs],
  );

  const filteredWriteOffs = useMemo(() => {
    return writeOffs.filter((w) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        w.actNumber.toLowerCase().includes(q) ||
        w.asset.inventoryNumber.toLowerCase().includes(q) ||
        w.asset.item.name.toLowerCase().includes(q) ||
        w.reason.toLowerCase().includes(q)
      );
    });
  }, [writeOffs, search]);

  const handleOpenVote = (w: WriteOffItem) => {
    setSelectedWriteOff(w);
    voteForm.setFieldsValue({
      vote: 'APPROVED',
      comment: '',
    });
    setVoteModalVisible(true);
  };

  const handleInitiateQrVote = async () => {
    if (!selectedWriteOff) return;
    try {
      const values = await voteForm.validate();
      setPendingQrVote({
        writeOff: selectedWriteOff,
        vote: values.vote,
        comment: values.comment ? String(values.comment).trim() : undefined,
      });
      setVoteModalVisible(false);
      setQrModalVisible(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQrVoteSuccess = async (result: any) => {
    if (!pendingQrVote) return;
    const votedItem = pendingQrVote.writeOff;
    setQrModalVisible(false);
    try {
      await voteWriteOff({
        id: votedItem.id,
        vote: pendingQrVote.vote,
        comment: pendingQrVote.comment,
        signatureHash: result.signatureHash || result.sessionId,
        signerName: result.signerName || user?.fullName || 'Komissiya A’zosi',
        signerRole: result.signerRole || user?.role || 'Komissiya A’zosi',
      });
      setPendingQrVote(null);
      setSelectedWriteOff(null);

      // Ssenariy 5: Muhrlangan OS-4 rasmiy elektron hujjatini darhol ochish
      handleOpenDoc(votedItem);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDoc = (w: WriteOffItem) => {
    const item = {
      inventoryNumber: w.asset.inventoryNumber,
      name: w.asset.item.name,
      model: w.asset.item.model,
      serialNumber: w.asset.serialNumber,
      price: w.asset.purchasePrice || 0,
      quantity: 1,
      unit: 'dona',
    };

    const memberSignatures =
      w.members && w.members.length > 0
        ? [
            {
              role: 'Tashabbuskor Mas’ul',
              name: w.createdBy?.fullName || '',
              isSigned: true,
              signedAt: w.createdAt ? new Date(w.createdAt).toLocaleString('uz-UZ') : undefined,
              biometricType: 'FaceID (QR-Pairing)',
            },
            ...w.members.map((m) => ({
              role: m.roleName || 'Komissiya a’zosi',
              name: m.user?.fullName || '',
              isSigned: m.vote === 'APPROVED',
              signedAt: m.votedAt ? new Date(m.votedAt).toLocaleString('uz-UZ') : undefined,
              biometricType: m.vote === 'APPROVED' ? 'FaceID (QR-Pairing)' : undefined,
            })),
          ].filter((s) => s.name)
        : undefined;

    setActiveDocData({
      docType: 'SPISANIE',
      entityId: w.stamp?.id || w.id,
      docNumber: w.stamp?.docNumber || w.actNumber,
      date: (w.approvedAt || w.createdAt).substring(0, 10),
      sourceLocation: w.asset.room ? `${w.asset.room.number}-xona: ${w.asset.room.name}` : '',
      targetLocation: 'Davlat reyestridan hisobdan chiqarildi',
      senderName: w.createdBy?.fullName || '',
      receiverName: 'Hisobdan chiqarish komissiyasi',
      signatures: memberSignatures,
      items: [item],
      reason: `${w.reason}. Xulosa: ${w.technicalConclusion || ''}`,
    });
    setDocModalVisible(true);
  };

  const handleExportExcel = () => {
    const exportData = filteredWriteOffs.map((w) => {
      const bookVal =
        w.asset.depreciation?.currentBookValue ?? w.asset.purchasePrice ?? 0;
      return {
        'Dalolatnoma №': w.actNumber,
        'Asosiy Vosita': w.asset.item.name,
        'Inventar Raqami': w.asset.inventoryNumber,
        'Model': w.asset.item.model || '-',
        'Kategoriya': w.asset.item.category?.name || '-',
        'Xarid Narxi (so‘m)': w.asset.purchasePrice || 0,
        'Qoldiq Balans Qiymati (so‘m)': bookVal,
        'Eskirish Holati': bookVal === 0 ? 'To‘liq eskirgan (100%)' : 'Chala eskirgan (Qoldiq > 0)',
        'Hisobdan Chiqarish Sababi': w.reason,
        'Ekspertiza Xulosasi': w.technicalConclusion || '-',
        'Holati': getStatusLabel(w.status, 'writeOff'),
        'WORM Tamg‘asi': w.hasWormStamp ? 'WORM Muhrlangan' : 'Muhrlanmagan',
        'Tasdiqlagan A’zolar': `${w.members.filter((m) => m.vote === 'APPROVED').length}/${w.members.length}`,
        'Ariza Sanasi': w.createdAt ? w.createdAt.substring(0, 10) : '-',
      };
    });
    exportToExcel(exportData, 'Spisanie_Hisobdan_Chiqarish_OS4');
  };

  const columns = [
    {
      title: 'Vosita & Dalolatnoma №',
      dataIndex: 'asset',
      width: 220,
      render: (_: any, record: WriteOffItem) => (
        <div style={{ paddingLeft: 8 }}>
          <CategoryThumbnail
            icon={<IconFile />}
            name={record.asset?.item?.name || 'Asosiy vosita'}
            tag={record.actNumber}
            color="#F53F3F"
            bg="#FFECE8"
          />
        </div>
      ),
    },
    {
      title: 'Chiqarish Sababi & Qoldiq Qiymat',
      dataIndex: 'reason',
      minWidth: 240,
      render: (val: string, record: WriteOffItem) => {
        const bookVal =
          record.asset?.depreciation?.currentBookValue ?? record.asset?.purchasePrice ?? 0;
        const isDepreciated = bookVal === 0;

        return (
          <div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-1)',
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {val}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 4,
                fontSize: 12,
                color: 'var(--color-text-3)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>
                Qoldiq qiymat:{' '}
                <b style={{ color: isDepreciated ? '#00B42A' : '#F53F3F' }}>
                  {Number(bookVal).toLocaleString()} so‘m
                </b>
              </span>
              {isDepreciated ? (
                <Tag
                  color="green"
                  size="small"
                  style={{ borderRadius: 0, fontSize: 10, padding: '0 4px' }}
                >
                  To‘liq eskirgan (100%)
                </Tag>
              ) : (
                <Tooltip
                  content={`Eskirish muddati to‘liq tugamagan (${Number(bookVal).toLocaleString()} so‘m qoldiq qiymat mavjud). Hisobdan chiqarilganda OTM zarari/xarajati sifatida qayd etiladi.`}
                >
                  <Tag
                    color="magenta"
                    size="small"
                    style={{ borderRadius: 0, fontSize: 10, padding: '0 4px', cursor: 'help' }}
                  >
                    Chala eskirgan (Qoldiq {'>'} 0)
                  </Tag>
                </Tooltip>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Komissiya Ovozlari & Kvorum',
      dataIndex: 'members',
      width: 200,
      render: (members: WriteOffMember[], record: WriteOffItem) => {
        const mApproved = members?.filter((m) => m.vote === 'APPROVED').length || 0;
        const mRejected = members?.filter((m) => m.vote === 'REJECTED').length || 0;
        const total = members?.length || 0;
        const percent = Math.round((mApproved / (total || 1)) * 100);

        let badgeColor: 'green' | 'red' | 'arcoblue' = 'arcoblue';
        let badgeText = `Kvorum: ${mApproved}/${total}`;
        if (record.status === 'APPROVED') {
          badgeColor = 'green';
          badgeText = 'Kvorum 100% (Tasdiq)';
        } else if (record.status === 'REJECTED' || mRejected > 0) {
          badgeColor = 'red';
          badgeText = `Rad etildi (${mRejected})`;
        }

        return (
          <div style={{ width: '100%', maxWidth: 180 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {mApproved}/{total} a’zo
              </span>
              <Tag
                color={badgeColor}
                size="small"
                style={{ borderRadius: 0, fontSize: 10, padding: '0 4px' }}
              >
                {badgeText}
              </Tag>
            </div>
            <Progress
              percent={percent}
              status={
                record.status === 'REJECTED' || mRejected > 0
                  ? 'error'
                  : percent === 100
                  ? 'success'
                  : 'normal'
              }
              size="small"
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
              {record.status === 'APPROVED'
                ? '100% kvorum — akt tasdiqlangan'
                : record.status === 'REJECTED'
                ? 'Rad etilganligi sababli to‘xtatildi'
                : `${total - mApproved} ta ovoz kutilmoqda`}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Tashabbuskor & Sana',
      width: 140,
      render: (_: any, record: WriteOffItem) => (
        <div style={{ lineHeight: 1.35, maxWidth: 130 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={record.createdBy?.fullName || record.asset?.responsibleUser?.fullName || '—'}
          >
            {record.createdBy?.fullName || record.asset?.responsibleUser?.fullName || '—'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-3)',
              marginTop: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {record.createdAt?.substring(0, 10)}
          </div>
        </div>
      ),
    },
    {
      title: 'Bosqich',
      dataIndex: 'status',
      width: 165,
      render: (status: string) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <StatusTag status={status} domain="writeOff" mode="badge" />
        </div>
      ),
    },
    {
      title: 'Amallar',
      dataIndex: 'actions',
      width: 250,
      fixed: 'right' as const,
      render: (_: any, record: WriteOffItem) => {
        const isUserMember = record.members?.some((m) => m.userId === user?.id);
        const userVote = record.members?.find((m) => m.userId === user?.id);
        const hasVoted = userVote && userVote.vote !== 'PENDING';

        return (
          <TableActions rightPadding={0} gap={6}>
            <Button
              size="small"
              type="outline"
              icon={<IconEye />}
              style={{ borderRadius: 0, padding: '0 7px', whiteSpace: 'nowrap' }}
              onClick={(e) => {
                e?.stopPropagation?.();
                handleOpenPassport(record);
              }}
            >
              Pasport
            </Button>

            {record.status === 'IN_REVIEW' ? (
              isUserMember ? (
                hasVoted ? (
                  <Tag
                    color="green"
                    size="small"
                    style={{ borderRadius: 0, padding: '0 6px', fontSize: 11 }}
                  >
                    Ovozingiz berilgan
                  </Tag>
                ) : (
                  <Button
                    type="primary"
                    status="success"
                    size="small"
                    icon={<IconQrcode />}
                    style={{ borderRadius: 0, padding: '0 8px', whiteSpace: 'nowrap' }}
                    onClick={(e) => {
                      e?.stopPropagation?.();
                      handleOpenVote(record);
                    }}
                  >
                    QR-Ovoz Berish
                  </Button>
                )
              ) : (
                <Tooltip content="Siz ushbu hisobdan chiqarish komissiyasi tarkibida emassiz. Ovoz berish huquqi faqat rasmiy komissiya a’zolarida mavjud.">
                  <Button
                    size="small"
                    disabled
                    icon={<IconQrcode />}
                    style={{ borderRadius: 0, padding: '0 7px', whiteSpace: 'nowrap' }}
                  >
                    Ovoz Berish
                  </Button>
                </Tooltip>
              )
            ) : (
              <Button
                size="small"
                type={record.status === 'APPROVED' ? 'primary' : 'outline'}
                status={record.status === 'APPROVED' ? 'success' : 'default'}
                icon={<IconPrinter />}
                style={{ borderRadius: 0, padding: '0 7px', whiteSpace: 'nowrap' }}
                onClick={(e) => {
                  e?.stopPropagation?.();
                  handleOpenDoc(record);
                }}
              >
                OS-4 Akti {record.hasWormStamp ? '(WORM)' : ''}
              </Button>
            )}
          </TableActions>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Real-time Status Indicator (Rule 4.2 & Faza 5) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: -6 }}>
        <Space size="small">
          <Tag color={isConnected ? 'green' : 'orange'} icon={<IconRefresh spin={!isConnected} />}>
            {isConnected ? 'Live Quorum Sync (Faol)' : 'Sinxronizatsiya kutilmoqda'}
          </Tag>
          <Tag color="arcoblue">
            5-A’zoli OS-4 Kvorum (0ms)
          </Tag>
        </Space>
      </div>

      {/* Tabs Filter */}
      <PageTabs
        activeTab={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { key: 'ALL', title: 'Barcha Holatlar', count: totalCount },
          {
            key: 'IN_REVIEW',
            title: 'Komissiya Ko‘rigida',
            count: inReviewCount,
          },
          {
            key: 'APPROVED',
            title: 'Tasdiqlangan (OS-4)',
            count: approvedCount,
          },
          {
            key: 'REJECTED',
            title: 'Rad Etilgan',
            count: rejectedCount,
          },
        ]}
      />

      {/* Actions Toolbar */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space size="medium" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="Dalolatnoma №, inv № yoki sabab..."
              style={{ width: 320, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconRefresh />}
              style={{ borderRadius: 0 }}
              onClick={() => refetch()}
            >
              Yangilash
            </Button>
            <Button
              icon={<IconDownload />}
              style={{ borderRadius: 0 }}
              onClick={handleExportExcel}
            >
              Excel
            </Button>
            {canCreateWriteOff ? (
              <Button
                type="primary"
                icon={<IconPlus />}
                style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                onClick={() => setCreateModalVisible(true)}
              >
                Yangi Spisanie Talabnomasi
              </Button>
            ) : (
              <Tooltip content="Spisanie talabnomasini faqat mas’ul xodimlar (MOL, Omborchi, Komendant) kiritishi mumkin">
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  disabled
                  style={{ borderRadius: 0 }}
                >
                  Yangi Spisanie Talabnomasi
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>
      </Card>

      {/* Error State (Rule 6.3) */}
      {isError && (
        <Alert
          type="error"
          title="Hisobdan chiqarish ma’lumotlarini yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzildi. Iltimos qayta urinib ko‘ring."
          action={
            <Button
              size="small"
              type="primary"
              status="danger"
              onClick={() => refetch()}
              style={{ borderRadius: 0 }}
            >
              Qayta Urinish
            </Button>
          }
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Universal StandardTable Component (Rule 4.2) */}
      <StandardTable<WriteOffItem>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        data={filteredWriteOffs}
        scrollX={1220}
        onRowClick={(record) => handleOpenPassport(record)}
        emptyText={
          search
            ? `«${search}» bo‘yicha hisobdan chiqarish arizalari topilmadi`
            : 'Hisobdan chiqarish dalolatnomalari mavjud emas'
        }
        expandedRowRender={(record: WriteOffItem) => {
          const mApproved = record.members?.filter((m) => m.vote === 'APPROVED').length || 0;
          const total = record.members?.length || 0;
          const percent = Math.round((mApproved / (total || 1)) * 100);

          return (
            <Card
              className="uwms-card"
              style={{ borderRadius: 0, backgroundColor: 'var(--color-fill-1)', border: 'none' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              {/* Kvorum Banner */}
              <Alert
                type={
                  record.status === 'APPROVED'
                    ? 'success'
                    : record.status === 'REJECTED'
                    ? 'error'
                    : 'info'
                }
                title={`Davlat Hisobdan Chiqarish Komissiyasi Kvorumi: ${mApproved}/${total} tasdiqladi (${percent}%)`}
                content={
                  record.status === 'APPROVED'
                    ? 'Barcha komissiya a’zolari bir ovozdan ma’qullagan. OS-4 dalolatnomasi avtomatik ravishda tasdiqlangan va elektron tamg‘a (WORM) bilan muhrlangan.'
                    : record.status === 'REJECTED'
                    ? 'Komissiya a’zosi tomonidan rad etilganligi sababli hisobdan chiqarish to‘xtatildi.'
                    : 'Komissiyaning barcha a’zolari (100% kvorum) ovoz berib bo‘lgach, tizim avtomatik ravishda OS-4 aktini tasdiqlaydi va vositani hisobdan chiqaradi.'
                }
                style={{ marginBottom: 14, borderRadius: 0 }}
              />

              <Row gutter={[12, 12]}>
                {record.members.map((m) => {
                  let badgeColor = 'orange';
                  let badgeText = 'Kutilmoqda';
                  if (m.vote === 'APPROVED') {
                    badgeColor = 'green';
                    badgeText = 'Ma’qullandi';
                  } else if (m.vote === 'REJECTED') {
                    badgeColor = 'red';
                    badgeText = 'Rad etildi';
                  }

                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
                      <Card
                        style={{
                          borderRadius: 0,
                          backgroundColor: 'var(--color-bg-2)',
                          border: '1px solid var(--color-border-2)',
                        }}
                        bodyStyle={{ padding: '12px 14px' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <Tag color={badgeColor} style={{ borderRadius: 0, fontSize: 11 }}>
                            {badgeText}
                          </Tag>
                          <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                            {m.roleName}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>
                          {m.user?.fullName}
                        </div>
                        {m.comment && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--color-text-2)',
                              marginTop: 6,
                              fontStyle: 'italic',
                              wordBreak: 'break-word',
                            }}
                          >
                            «{m.comment}»
                          </div>
                        )}
                        {m.votedAt && (
                          <div
                            style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 4 }}
                          >
                            Sana: {m.votedAt.replace('T', ' ').substring(0, 16)}
                          </div>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          );
        }}
      />

      {/* Create Modal */}
      <CreateWriteOffModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />

      {/* Voting Modal */}
      <Modal
        title={
          <Space>
            <IconThumbUp style={{ color: '#165DFF' }} />
            <span>Komissiya A’zosi Sifatida Elektron Ovoz Berish</span>
          </Space>
        }
        visible={voteModalVisible}
        onCancel={() => setVoteModalVisible(false)}
        style={{ width: 560, borderRadius: 0 }}
        footer={
          <Space>
            <Button onClick={() => setVoteModalVisible(false)} style={{ borderRadius: 0 }}>
              Bekor Qilish
            </Button>
            <Button
              type="primary"
              status="success"
              icon={<IconQrcode />}
              loading={isVoting}
              onClick={handleInitiateQrVote}
              style={{ borderRadius: 0 }}
            >
              Dinamik QR-Pairing Bilan Imzolash va Ovoz Berish
            </Button>
          </Space>
        }
      >
        {selectedWriteOff && (
          <div style={{ marginBottom: 16 }}>
            <Card
              className="uwms-card"
              style={{ borderRadius: 0, backgroundColor: 'var(--color-fill-1)' }}
              bodyStyle={{ padding: 12 }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Dalolatnoma: {selectedWriteOff.actNumber}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Asosiy Vosita: <b>{selectedWriteOff.asset.item.name}</b> (Inv:{' '}
                {selectedWriteOff.asset.inventoryNumber})
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                Sabab: {selectedWriteOff.reason}
              </div>
            </Card>
          </div>
        )}

        <Form form={voteForm} layout="vertical">
          <FormItem
            label="Sizning Qaroringiz"
            field="vote"
            rules={[{ required: true, message: 'Qarorni tanlang' }]}
          >
            <Radio.Group type="button">
              <Radio value="APPROVED">Hisobdan Chiqarishni Tasdiqlayman</Radio>
              <Radio value="REJECTED">E’tirozim Bor (Rad Etaman)</Radio>
            </Radio.Group>
          </FormItem>

          <FormItem label="Ekspert Xulosasi / Izoh" field="comment">
            <TextArea
              rows={3}
              placeholder="Qaroringiz bo‘yicha daliliy izoh yoki qo‘shimcha fikringizni yozing..."
              style={{ borderRadius: 0 }}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* Official OS-4 Document Modal */}
      {activeDocData && (
        <OfficialDocModal
          visible={docModalVisible}
          onClose={() => {
            setDocModalVisible(false);
            setActiveDocData(null);
          }}
          {...activeDocData}
        />
      )}

      {/* Dynamic QR-Pairing Modal for OS-4 Commission Member Voting */}
      {pendingQrVote && (
        <QRPairingModal
          visible={qrModalVisible}
          onClose={() => {
            setQrModalVisible(false);
            setPendingQrVote(null);
          }}
          onSuccess={handleQrVoteSuccess}
          payload={{
            docNumber: pendingQrVote.writeOff.actNumber,
            docType: 'OS_4',
            title: `Hisobdan Chiqarish Komissiya Ovozi (OS-4) - ${pendingQrVote.writeOff.asset.item.name}`,
            departmentName: 'Universitet Davlat Hisobdan Chiqarish Komissiyasi',
            itemSummary: `Aktiv: ${pendingQrVote.writeOff.asset.item.name} (${pendingQrVote.writeOff.asset.inventoryNumber}), Qaror: ${pendingQrVote.vote === 'APPROVED' ? 'Hisobdan chiqarish ma’qullansin' : 'Rad etilsin'}`,
            metadata: {
              writeOffId: pendingQrVote.writeOff.id,
              actNumber: pendingQrVote.writeOff.actNumber,
              assetId: pendingQrVote.writeOff.asset.id,
              inventoryNumber: pendingQrVote.writeOff.asset.inventoryNumber,
              vote: pendingQrVote.vote,
              comment: pendingQrVote.comment,
              signerName: user?.fullName,
              signerRole: user?.role,
            },
          }}
        />
      )}

      {/* ASSET PASSPORT DRAWER (Opens on row click) */}
      <Drawer
        width={580}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {selectedPassportItem?.asset.inventoryNumber || 'Asosiy Vosita Pasporti'}
            </span>
            {selectedPassportItem && (
              <StatusTag status={selectedPassportItem.status} domain="writeOff" />
            )}
          </div>
        }
        visible={isPassportDrawerVisible}
        onCancel={() => setIsPassportDrawerVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button
              type="outline"
              icon={<IconPrinter />}
              style={{ borderRadius: 0 }}
              onClick={() => {
                if (selectedPassportItem) {
                  handleOpenDoc(selectedPassportItem);
                }
              }}
            >
              OS-4 Aktini Ko‘rish {selectedPassportItem?.hasWormStamp ? '(WORM)' : ''}
            </Button>
            <Button
              type="primary"
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => setIsPassportDrawerVisible(false)}
            >
              Yopish
            </Button>
          </div>
        }
      >
        {selectedPassportItem && (
          <Tabs defaultActiveTab="passport">
            <TabPane key="passport" title="Asosiy Pasport">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    { label: 'Jihoz Nomi', value: selectedPassportItem.asset.item.name },
                    {
                      label: 'Model / Modifikatsiya',
                      value: selectedPassportItem.asset.item.model || 'Standart',
                    },
                    {
                      label: 'Kategoriya',
                      value:
                        selectedPassportItem.asset.item.category?.name || 'Asosiy vositalar',
                    },
                    {
                      label: 'Inventar Raqami',
                      value: (
                        <b style={{ color: '#165DFF' }}>
                          {selectedPassportItem.asset.inventoryNumber}
                        </b>
                      ),
                    },
                    {
                      label: 'Seriya Raqami (SN)',
                      value: selectedPassportItem.asset.serialNumber || 'Mavjud emas',
                    },
                    {
                      label: 'Hozirgi Xonasi',
                      value: selectedPassportItem.asset.room
                        ? `${selectedPassportItem.asset.room.number}-xona: ${selectedPassportItem.asset.room.name}`
                        : 'Markaziy Ombor',
                    },
                    {
                      label: 'Moddiy Mas’ul Shaxs',
                      value:
                        selectedPassportItem.asset.responsibleUser?.fullName || 'Bosh omborchi',
                    },
                    {
                      label: 'Moliyalashtirish Manbasi',
                      value: (
                        <StatusTag
                          status={selectedPassportItem.asset.fundingSource || 'BYUDJET'}
                          domain="funding"
                        />
                      ),
                    },
                    {
                      label: 'Boshlang‘ich Balans Narxi',
                      value: `${Number(selectedPassportItem.asset.purchasePrice || 0).toLocaleString('uz-UZ')} so‘m`,
                    },
                    {
                      label: 'Hozirgi Qoldiq Qiymati',
                      value: (
                        <b
                          style={{
                            color:
                              (selectedPassportItem.asset.depreciation?.currentBookValue ??
                                selectedPassportItem.asset.purchasePrice ??
                                0) === 0
                                ? '#00B42A'
                                : '#F53F3F',
                          }}
                        >
                          {Number(
                            selectedPassportItem.asset.depreciation?.currentBookValue ??
                              selectedPassportItem.asset.purchasePrice ??
                              0,
                          ).toLocaleString('uz-UZ')}{' '}
                          so‘m
                        </b>
                      ),
                    },
                  ]}
                />

                {/* Amortizatsiya va Qoldiq Qiymat Tahlili */}
                {(selectedPassportItem.asset.depreciation?.currentBookValue ??
                  selectedPassportItem.asset.purchasePrice ??
                  0) > 0 ? (
                  <Alert
                    type="warning"
                    title="Eskirish muddati to‘liq tugamagan ashyo"
                    content={`Ushbu asosiy vositaning qoldiq balans qiymati 0 so‘m emas (${Number(selectedPassportItem.asset.depreciation?.currentBookValue ?? selectedPassportItem.asset.purchasePrice ?? 0).toLocaleString('uz-UZ')} so‘m). Qonunchilikka ko‘ra, muddatidan oldin hisobdan chiqarishda universitet moliya bo‘limi tomonidan alohida moliyaviy zarar/hisob qaydnomasi shakllantiriladi.`}
                    style={{ marginTop: 14, borderRadius: 0 }}
                  />
                ) : (
                  <Alert
                    type="success"
                    title="To‘liq eskirgan asosiy vosita (100%)"
                    content="Asosiy vositaning qoldiq balans qiymati 0 so‘mga teng. O‘rnatilgan tartibda to‘liq amortizatsiya qilingan va zararsiz hisobdan chiqariladi."
                    style={{ marginTop: 14, borderRadius: 0 }}
                  />
                )}
              </div>
            </TabPane>

            <TabPane key="writeoff" title="Spisanie & Ekspertiza">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    {
                      label: 'Dalolatnoma Raqami',
                      value: (
                        <b style={{ color: '#F53F3F', fontFamily: 'monospace' }}>
                          {selectedPassportItem.actNumber}
                        </b>
                      ),
                    },
                    { label: 'Hisobdan Chiqarish Sababi', value: selectedPassportItem.reason },
                    {
                      label: 'Texnik Ekspertiza Xulosasi',
                      value: (
                        <div style={{ color: 'var(--color-text-1)', lineHeight: 1.5 }}>
                          {selectedPassportItem.technicalConclusion ||
                            'Ekspertiza xulosasi kiritilmagan'}
                        </div>
                      ),
                    },
                    {
                      label: 'Ariza Berilgan Sana',
                      value: selectedPassportItem.createdAt
                        ? selectedPassportItem.createdAt.substring(0, 10)
                        : '—',
                    },
                    {
                      label: 'Tashabbuskor (Talabgor)',
                      value: `${selectedPassportItem.createdBy?.fullName} (${selectedPassportItem.createdBy?.role})`,
                    },
                  ]}
                />
              </div>
            </TabPane>

            <TabPane
              key="commission"
              title={`Komissiya Ovozlari (${selectedPassportItem.members.length})`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                {/* Kvorum indicator in drawer */}
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-fill-2)',
                    border: '1px solid var(--color-border-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Kvorum Ko‘rsatkichi:</span>
                    <span>
                      {
                        selectedPassportItem.members.filter((m) => m.vote === 'APPROVED').length
                      }
                      /{selectedPassportItem.members.length} a’zo tasdiqlagan
                    </span>
                  </div>
                  <Progress
                    percent={Math.round(
                      (selectedPassportItem.members.filter((m) => m.vote === 'APPROVED').length /
                        (selectedPassportItem.members.length || 1)) *
                        100,
                    )}
                    status={
                      selectedPassportItem.status === 'APPROVED'
                        ? 'success'
                        : selectedPassportItem.status === 'REJECTED'
                        ? 'error'
                        : 'normal'
                    }
                  />
                </div>

                {selectedPassportItem.members.map((m) => {
                  return (
                    <Card
                      key={m.id}
                      className="uwms-card"
                      style={{ borderRadius: 0, border: '1px solid var(--color-border-2)' }}
                      bodyStyle={{ padding: '10px 14px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <b style={{ fontSize: 13 }}>{m.user.fullName}</b>
                          <span
                            style={{ fontSize: 12, color: 'var(--color-text-3)', marginLeft: 8 }}
                          >
                            ({m.roleName})
                          </span>
                        </div>
                        <StatusTag status={m.vote} domain="general" />
                      </div>
                      {m.comment && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-2)',
                            backgroundColor: 'var(--color-fill-2)',
                            padding: '6px 8px',
                            marginTop: 6,
                            wordBreak: 'break-word',
                          }}
                        >
                          «{m.comment}»
                        </div>
                      )}
                      {m.votedAt && (
                        <div
                          style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 4 }}
                        >
                          Sana: {m.votedAt.replace('T', ' ').substring(0, 16)}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </TabPane>
          </Tabs>
        )}
      </Drawer>
    </div>
  );
};

export default WriteOffPage;
