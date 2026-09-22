import React, { useState, useMemo } from 'react';
import {
  Card,
  Tag,
  Input,
  Select,
  Space,
  Button,
  Message,
  Alert,
  Tooltip,
  Badge,
} from '@arco-design/web-react';
import {
  IconSearch,
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconSwap,
  IconImport,
  IconDelete,
  IconArchive,
  IconFilter,
  IconCheckCircle,
  IconClockCircle,
  IconCloseCircle,
  IconFile,
  IconEye,
  IconUser,
  IconHistory,
} from '@arco-design/web-react/icon';
import { useMovementsQuery } from '../../hooks/useWarehouseQuery';
import { useHandoversQuery, type HandoverDocumentResponse } from '../../hooks/useHandoverQuery';
import { HandoverReviewModal } from '../../components/Inbox/HandoverReviewModal';
import { HandoverAuditDrawer } from '../../components/Movements/HandoverAuditDrawer';
import { HandoverDocModal } from '../../components/Movements/HandoverDocModal';
import type {
  StockMovement,
  MovementType,
  ResponsibilityHandover,
  HandoverType,
  HandoverStatus,
} from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { StatusTag } from '../../components/Common/StatusTag';
import {
  API_ENDPOINTS,
  getStatusSelectOptions,
  getStatusLabel,
} from '../../constants';
import { apiClient } from '../../api/client';

export const MovementsPage: React.FC = () => {
  const [fundingSourceFilter, setFundingSourceFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);

  // Dedicated OS-1 Document Viewer Modal State (Phase 5)
  const [handoverDocId, setHandoverDocId] = useState<string | null>(null);
  const [isHandoverDocModalVisible, setIsHandoverDocModalVisible] = useState(false);

  // Handover Review Modal State
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(null);
  const [isHandoverModalVisible, setIsHandoverModalVisible] = useState(false);

  // Handover Audit Log Drawer State
  const [auditHandoverId, setAuditHandoverId] = useState<string | null>(null);
  const [isAuditDrawerVisible, setIsAuditDrawerVisible] = useState(false);

  // Handover Registry Filters & Pagination (Phase 5)
  const [handoverPage, setHandoverPage] = useState<number>(1);
  const [handoverPageSize, setHandoverPageSize] = useState<number>(20);
  const [handoverTypeFilter, setHandoverTypeFilter] = useState<string>('ALL');
  const [handoverStatusFilter, setHandoverStatusFilter] = useState<string>('ALL');

  // Backend query with optional fundingSource filter
  const { movements, isLoading, isFetching, isError, refetch } = useMovementsQuery({
    fundingSource: fundingSourceFilter !== 'ALL' ? fundingSourceFilter : undefined,
  });

  // Handovers Query for Phase 5 OS-1 Registry
  const {
    data: handoversData,
    isLoading: isHandoversLoading,
    isFetching: isHandoversFetching,
    isError: isHandoversError,
    refetch: refetchHandovers,
  } = useHandoversQuery({
    search: searchText || undefined,
    type: handoverTypeFilter !== 'ALL' ? (handoverTypeFilter as HandoverType) : undefined,
    status: handoverStatusFilter !== 'ALL' ? (handoverStatusFilter as HandoverStatus) : undefined,
    page: handoverPage,
    pageSize: handoverPageSize,
  });
  const handovers = handoversData?.items || [];

  // Statistics calculation based on current funding source scope
  const stats = useMemo(() => {
    const total = movements.length;
    const incoming = movements.filter((m) => m.movementType === 'INCOMING').length;
    const transfer = movements.filter((m) => m.movementType === 'TRANSFER').length;
    const writeOff = movements.filter((m) => m.movementType === 'WRITE_OFF' || m.movementType === 'OUTGOING').length;
    return { total, incoming, transfer, writeOff };
  }, [movements]);

  // Client-side Filtering for search text and active tab
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesSearch =
        m.movementNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        m.itemSummary.toLowerCase().includes(searchText.toLowerCase()) ||
        (m.referenceDoc && m.referenceDoc.toLowerCase().includes(searchText.toLowerCase())) ||
        m.executedByName.toLowerCase().includes(searchText.toLowerCase());

      const matchesTab =
        activeTab === 'ALL' ||
        m.movementType === activeTab ||
        (activeTab === 'WRITE_OFF' && (m.movementType === 'WRITE_OFF' || m.movementType === 'OUTGOING'));

      return matchesSearch && matchesTab;
    });
  }, [movements, searchText, activeTab]);

  // Signature Status Helper for Phase 5 OS-1 Registry
  const getSignatureStatus = (record: ResponsibilityHandover) => {
    const isCompleted = record.status === 'COMPLETED';
    const isRejected = record.status === 'REJECTED';
    const isCancelled = record.status === 'CANCELLED';
    const isPendingAppr = record.status === 'PENDING_APPROVAL';
    const isAccRev = record.status === 'ACCOUNTANT_REVIEW';
    const isComRev = record.status === 'COMMANDANT_REVIEW';
    const isDraft = record.status === 'DRAFT';

    const depSigned = !isDraft;
    const targetSigned = isCompleted || isPendingAppr || isAccRev || isComRev;
    const comSigned = !record.commandantUserId || (isCompleted || isPendingAppr || isAccRev);
    const accSigned = !record.accountantUserId || isCompleted;

    return { depSigned, targetSigned, comSigned, accSigned, isRejected, isCancelled };
  };

  const handlePrintHandoverPdf = async (record: ResponsibilityHandover) => {
    let hideMessage: (() => void) | null = null;
    try {
      hideMessage = Message.loading({ content: 'Rasmiy OS-1 hujjati yuklanmoqda...', duration: 0 });
      const res = await apiClient.get<HandoverDocumentResponse>(API_ENDPOINTS.HANDOVERS.DOCUMENT(record.id));
      if (hideMessage) hideMessage();
      const html = res.data.contentHtml;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      } else {
        Message.warning('Brauzer chop etish oynasini ochishga to‘sqinlik qildi. Iltimos, qalqib chiquvchi oynalarga ruxsat bering.');
      }
    } catch (err: any) {
      if (hideMessage) hideMessage();
      Message.error(err?.response?.data?.message || 'Hujjatni yuklab olishda xatolik yuz berdi');
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'HANDOVERS') {
      const formattedHandovers = handovers.map((h) => {
        const sigs = getSignatureStatus(h);
        return {
          'Dalolatnoma №': h.handoverNumber,
          'Turi': getStatusLabel(h.type, 'handoverType'),
          'Topshiruvchi': h.departingUser?.fullName || '—',
          'Qabul Qiluvchi': h.targetUser?.fullName || h.targetWarehouse?.name || '—',
          'Bino': h.building?.name || '—',
          'Xona': h.room ? `${h.room.number} (${h.room.name})` : '—',
          'Aktivlar Soni': h._count?.items || 0,
          'Imzolar Holati': sigs.isRejected
            ? 'Rad etilgan'
            : `Topshiruvchi: ${sigs.depSigned ? '✓' : '⌛'} | Qabul qiluvchi: ${sigs.targetSigned ? '✓' : '⌛'} | Komendant: ${sigs.comSigned ? '✓' : '⌛'} | Buxgalter: ${sigs.accSigned ? '✓' : '⌛'}`,
          'Status': getStatusLabel(h.status, 'handover'),
          'Sana va Vaqt': new Date(h.createdAt).toLocaleString('uz-UZ'),
        };
      });
      exportToExcel(formattedHandovers, 'Topshirish_Dalolatnomalari_OS-1', 'OS-1 Arxivi');
      Message.success('Topshirish dalolatnomalari Excelga muvaffaqiyatli yuklandi!');
      return;
    }

    const formatted = filteredMovements.map((m) => ({
      'Harakat Raqami': m.movementNumber,
      'Turi': getStatusLabel(m.movementType, 'movement'),
      'Mahsulotlar': m.itemSummary,
      'Moliyalashtirish': getStatusLabel(m.fundingSource, 'funding'),
      'Qayerdan': m.sourceLocation || '—',
      'Qayerga': m.targetLocation || '—',
      'Asos Hujjati': m.referenceDoc || '—',
      'WORM Holati': m.hasWormStamp || m.stamp?.isValid ? 'WORM Muhrlangan' : 'Muhrlanmagan',
      'Ijrochi': m.executedByName,
      'Sana': m.createdAt,
    }));
    exportToExcel(formatted, 'Ombor_Harakatlari_Auditi', 'Audit Log');
    Message.success('Harakatlar jurnali Excelga muvaffaqiyatli yuklandi!');
  };

  const handleOpenDoc = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setIsDocModalVisible(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ERROR UX STATE (Rule 6.3) */}
      {activeTab === 'HANDOVERS' ? (
        isHandoversError && (
          <Alert
            type="error"
            title="Topshirish dalolatnomalari (OS-1) reyestrini yuklashda xatolik yuz berdi"
            action={
              <Button size="small" type="primary" status="danger" onClick={() => refetchHandovers()}>
                Qayta yuklash
              </Button>
            }
            style={{ borderRadius: 0 }}
          />
        )
      ) : (
        isError && (
          <Alert
            type="error"
            title="Ombor harakatlari audit jurnalini yuklashda xatolik yuz berdi"
            action={
              <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
                Qayta yuklash
              </Button>
            }
            style={{ borderRadius: 0 }}
          />
        )
      )}

      {/* Tabs */}
      <PageTabs
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setSearchText('');
        }}
        tabs={[
          { key: 'ALL', title: 'Barcha Harakatlar', count: stats.total },
          { key: 'INCOMING', title: 'Kirim Fakturalari', count: stats.incoming },
          { key: 'TRANSFER', title: 'Ichki Siljishlar', count: stats.transfer },
          { key: 'WRITE_OFF', title: 'Chiqim va Spisanie', count: stats.writeOff },
          { key: 'HANDOVERS', title: 'Topshirish Dalolatnomalari (OS-1 Hujjatlari)', count: handoversData?.total ?? handovers.length },
        ]}
      />

      {/* Toolbar */}
      <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
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
              placeholder={activeTab === 'HANDOVERS' ? 'Dalolatnoma №, F.I.Sh., izoh...' : 'Hujjat raqami, vosita, ijrochi...'}
              style={{ width: 280, borderRadius: 0 }}
              value={searchText}
              onChange={(val) => {
                setSearchText(val);
                if (activeTab === 'HANDOVERS') setHandoverPage(1);
              }}
              allowClear
            />
            {activeTab === 'HANDOVERS' ? (
              <>
                <Select
                  value={handoverTypeFilter}
                  onChange={(val) => {
                    setHandoverTypeFilter(val);
                    setHandoverPage(1);
                  }}
                  style={{ width: 220, borderRadius: 0 }}
                >
                  {getStatusSelectOptions('handoverType', true, 'Barcha topshirish turlari').map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
                <Select
                  value={handoverStatusFilter}
                  onChange={(val) => {
                    setHandoverStatusFilter(val);
                    setHandoverPage(1);
                  }}
                  style={{ width: 190, borderRadius: 0 }}
                >
                  {getStatusSelectOptions('handover', true, 'Barcha holatlar').map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </>
            ) : (
              <Select
                value={fundingSourceFilter}
                onChange={setFundingSourceFilter}
                style={{ width: 220, borderRadius: 0 }}
              >
                {getStatusSelectOptions('funding', true, 'Barcha manbalar').map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            )}
          </Space>

          <Space size="small">
            <Button
              type="outline"
              icon={<IconDownload />}
              onClick={handleExportExcel}
              style={{ borderRadius: 0 }}
            >
              Excel Eksport
            </Button>
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                refetch();
                refetchHandovers();
              }}
              loading={isFetching || isHandoversFetching}
              style={{ borderRadius: 0 }}
            >
              Yangilash
            </Button>
          </Space>
        </div>
      </Card>

      {/* TAB: HANDOVERS (OS-1 Topsirish Dalolatnomalari Yagona Reyestri) */}
      {activeTab === 'HANDOVERS' ? (
        <StandardTable
          rowKey="id"
          loading={isHandoversLoading || isHandoversFetching}
          data={handovers}
          scrollX={1420}
          emptyText="Topshirish dalolatnomalari mavjud emas"
          pagination={{
            current: handoverPage,
            pageSize: handoverPageSize,
            total: handoversData?.total || handovers.length,
            sizeCanChange: true,
            sizeOptions: [10, 20, 50, 100],
            onChange: (page: number, pageSize: number) => {
              setHandoverPage(page);
              setHandoverPageSize(pageSize);
            },
          }}
          columns={[
            {
              title: 'Dalolatnoma raqami',
              dataIndex: 'handoverNumber',
              width: 175,
              render: (val: string) => (
                <Tag color="arcoblue" icon={<IconFile />} style={{ borderRadius: 0, fontWeight: 600 }}>
                  {val}
                </Tag>
              ),
            },
            {
              title: 'Sana va vaqt',
              dataIndex: 'createdAt',
              width: 145,
              render: (d: string) => {
                const dateObj = new Date(d);
                return (
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ color: 'var(--color-text-1)', fontSize: 12, fontWeight: 500 }}>
                      {dateObj.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </div>
                    <div style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                      {dateObj.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              },
            },
            {
              title: 'Topshirish turi',
              dataIndex: 'type',
              width: 165,
              render: (type: string) => <StatusTag domain="handoverType" status={type} />,
            },
            {
              title: 'Topshiruvchi va Qabul qiluvchi',
              width: 280,
              render: (_, record: ResponsibilityHandover) => (
                <div style={{ lineHeight: 1.4 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Topshiruvchi:{' '}
                    <span style={{ color: 'var(--color-text-1)', fontWeight: 500 }}>
                      {record.departingUser?.fullName || '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Qabul qiluvchi:{' '}
                    <span style={{ color: '#165DFF', fontWeight: 600 }}>
                      {record.targetUser?.fullName || record.targetWarehouse?.name || 'Omborxona'}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              title: 'Bino va xona',
              width: 190,
              render: (_, record: ResponsibilityHandover) => (
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 500 }}>{record.building?.name || '—'}</div>
                  {record.room ? (
                    <div style={{ color: 'var(--color-text-3)', marginTop: 2 }}>
                      {record.room.number}-xona ({record.room.name})
                    </div>
                  ) : (
                    <div style={{ color: 'var(--color-text-3)', fontSize: 11 }}>Umumiy bino</div>
                  )}
                </div>
              ),
            },
            {
              title: 'Imzolar holati',
              width: 290,
              render: (_, record: ResponsibilityHandover) => {
                const { depSigned, targetSigned, comSigned, accSigned, isRejected } = getSignatureStatus(record);

                if (isRejected) {
                  return (
                    <Tag color="red" size="small" icon={<IconCloseCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
                      Rad etilgan ✕
                    </Tag>
                  );
                }

                return (
                  <Space size={4} wrap>
                    <Tooltip content={`Topshiruvchi: ${record.departingUser?.fullName || 'MOL'} (${depSigned ? 'Imzolagan' : 'Kutilmoqda'})`}>
                      <Tag
                        color={depSigned ? 'green' : 'orange'}
                        size="small"
                        style={{ borderRadius: 0, padding: '0 6px', fontSize: 11 }}
                      >
                        Topshiruvchi {depSigned ? '✓' : '⌛'}
                      </Tag>
                    </Tooltip>

                    <Tooltip content={`Qabul qiluvchi: ${record.targetUser?.fullName || record.targetWarehouse?.name || 'MOL'} (${targetSigned ? 'Imzolagan' : 'Kutilmoqda'})`}>
                      <Tag
                        color={targetSigned ? 'green' : 'orange'}
                        size="small"
                        style={{ borderRadius: 0, padding: '0 6px', fontSize: 11 }}
                      >
                        Qabul qiluvchi {targetSigned ? '✓' : '⌛'}
                      </Tag>
                    </Tooltip>

                    {record.commandantUserId && (
                      <Tooltip content={`Bino komendanti: ${record.commandantUser?.fullName || 'Komendant'} (${comSigned ? 'Imzolagan' : 'Kutilmoqda'})`}>
                        <Tag
                          color={comSigned ? 'green' : 'orange'}
                          size="small"
                          style={{ borderRadius: 0, padding: '0 6px', fontSize: 11 }}
                        >
                          Komendant {comSigned ? '✓' : '⌛'}
                        </Tag>
                      </Tooltip>
                    )}

                    <Tooltip content={`Buxgalteriya: ${record.accountantUser?.fullName || 'Moddiy hisobchi'} (${accSigned ? 'Imzolagan' : 'Kutilmoqda'})`}>
                      <Tag
                        color={accSigned ? 'green' : 'orange'}
                        size="small"
                        style={{ borderRadius: 0, padding: '0 6px', fontSize: 11 }}
                      >
                        Buxgalter {accSigned ? '✓' : '⌛'}
                      </Tag>
                    </Tooltip>
                  </Space>
                );
              },
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 155,
              render: (st: string) => <StatusTag domain="handover" status={st} />,
            },
            {
              title: 'Amallar',
              width: 250,
              fixed: 'right' as const,
              render: (_, record: ResponsibilityHandover) => (
                <TableActions rightPadding={16}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<IconEye />}
                    onClick={() => {
                      setHandoverDocId(record.id);
                      setIsHandoverDocModalVisible(true);
                    }}
                    style={{ borderRadius: 0, fontWeight: 500 }}
                  >
                    Ko‘rish
                  </Button>
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconPrinter />}
                    onClick={() => handlePrintHandoverPdf(record)}
                    style={{ borderRadius: 0 }}
                  >
                    PDF
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    icon={<IconHistory />}
                    onClick={() => {
                      setAuditHandoverId(record.id);
                      setIsAuditDrawerVisible(true);
                    }}
                    style={{ borderRadius: 0, color: '#165DFF', fontWeight: 500 }}
                  >
                    Audit Log
                  </Button>
                </TableActions>
              ),
            },
          ]}
        />
      ) : (
        /* STANDARD MOVEMENTS TABLE */
        <StandardTable
          rowKey="id"
          loading={isLoading}
          data={filteredMovements}
          scrollX={1420}
          emptyText="Audit harakatlari topilmadi"
          columns={[
            {
              title: 'Hujjat №',
              dataIndex: 'movementNumber',
              width: 160,
              render: (num: string) => (
                <div style={{ paddingLeft: 8 }}>
                  <b style={{ color: '#165DFF', whiteSpace: 'nowrap' }}>{num}</b>
                </div>
              ),
            },
            {
              title: 'Harakat Turi',
              dataIndex: 'movementType',
              width: 140,
              render: (type: MovementType) => <StatusTag domain="movement" status={type} />,
            },
            {
              title: 'Mahsulotlar / Aktivlar',
              dataIndex: 'itemSummary',
              width: 250,
              render: (text: string) => (
                <Tooltip content={text}>
                  <div style={{ maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {text}
                  </div>
                </Tooltip>
              ),
            },
            {
              title: 'Moliyalashtirish Manbasi',
              dataIndex: 'fundingSource',
              width: 180,
              render: (source: string) => <StatusTag domain="funding" status={source} />,
            },
            {
              title: 'Yo‘nalish (Chiqish ➔ Kirish)',
              width: 260,
              render: (_, record: StockMovement) => (
                <div style={{ lineHeight: 1.35 }}>
                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-3)', minWidth: 48, whiteSpace: 'nowrap' }}>Chiqish:</span>
                    <span style={{ color: 'var(--color-text-2)', wordBreak: 'break-word' }}>
                      {record.sourceLocation || '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: '#165DFF', fontWeight: 600, minWidth: 48, whiteSpace: 'nowrap', marginTop: 1 }}>Kirish:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-1)', wordBreak: 'break-word' }}>
                      {record.targetLocation || '—'}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              title: 'WORM Imzo Holati',
              width: 180,
              render: (_, record: StockMovement) => {
                if (record.hasWormStamp || record.stamp?.isValid) {
                  const docTypeName =
                    record.stamp?.docType ||
                    (record.movementType === 'INCOMING' ? 'OS-1' : record.movementType === 'WRITE_OFF' ? 'OS-4' : 'OS-2');
                  return (
                    <Tooltip
                      content={`WORM Muhrlangan: ${record.stamp?.docNumber || record.referenceDoc || record.movementNumber}. Imzolovchi: ${record.stamp?.signerName || 'Elektron Imzo'}`}
                    >
                      <Tag
                        color="green"
                        icon={<IconCheckCircle />}
                        style={{ borderRadius: 0, fontWeight: 500 }}
                      >
                        WORM Muhrlangan ({docTypeName})
                      </Tag>
                    </Tooltip>
                  );
                }
                return (
                  <Tooltip content="Ushbu harakat uchun rasmiy WORM raqamli shtampi hali tasdiqlanmagan">
                    <Tag color="gray" icon={<IconClockCircle />} style={{ borderRadius: 0 }}>
                      Muhrlanmagan
                    </Tag>
                  </Tooltip>
                );
              },
            },
            {
              title: 'Ijrochi (Mas’ul)',
              dataIndex: 'executedByName',
              width: 140,
              render: (name: string) => <span style={{ whiteSpace: 'nowrap' }}>{name}</span>,
            },
            {
              title: 'Sana va Vaqt',
              dataIndex: 'createdAt',
              width: 115,
              render: (date: string) => {
                const parts = date ? date.split(' ') : [];
                return (
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ color: 'var(--color-text-1)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {parts[0]}
                    </div>
                    <div style={{ color: 'var(--color-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {parts[1] || ''}
                    </div>
                  </div>
                );
              },
            },
            {
              title: 'Amallar',
              width: 130,
              fixed: 'right' as const,
              render: (_, record: StockMovement) => (
                <TableActions rightPadding={16}>
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconPrinter />}
                    onClick={() => handleOpenDoc(record)}
                    style={{ borderRadius: 0, padding: '0 10px' }}
                  >
                    Rasmiy Akt
                  </Button>
                </TableActions>
              ),
            },
          ]}
        />
      )}

      {/* OFFICIAL DOCUMENT MODAL */}
      {selectedMovement && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          entityId={selectedMovement.stamp?.id || selectedMovement.id}
          docType={
            selectedMovement.movementType === 'INCOMING'
              ? 'KIRIM'
              : selectedMovement.movementType === 'WRITE_OFF'
              ? 'SPISANIE'
              : 'TRANSFER'
          }
          docNumber={selectedMovement.stamp?.docNumber || selectedMovement.referenceDoc || selectedMovement.movementNumber}
          date={selectedMovement.createdAt.substring(0, 10)}
          sourceLocation={selectedMovement.sourceLocation}
          targetLocation={selectedMovement.targetLocation}
          senderName={
            selectedMovement.movementType === 'INCOMING'
              ? selectedMovement.sourceLocation || selectedMovement.executedByName
              : selectedMovement.executedByName
          }
          receiverName={
            selectedMovement.movementType === 'INCOMING'
              ? selectedMovement.executedByName
              : selectedMovement.targetLocation || selectedMovement.executedByName
          }
          supervisorName={
            selectedMovement.stamp?.signerName ||
            (selectedMovement.movementType === 'INCOMING'
              ? "Bosh buxgalter"
              : selectedMovement.movementType === 'WRITE_OFF'
              ? "Moliya va iqtisod bo‘yicha prorektor"
              : "Moddiy hisob buxgalteri")
          }
          reason={selectedMovement.referenceDoc || undefined}
          items={
            selectedMovement.items && selectedMovement.items.length > 0
              ? selectedMovement.items.map((it, idx) => ({
                  inventoryNumber: `${selectedMovement.movementNumber}-${idx + 1}`,
                  name: it.name,
                  quantity: it.quantity,
                  unit: it.unit || 'DONA',
                  price: 0,
                }))
              : [
                  {
                    inventoryNumber: selectedMovement.movementNumber,
                    name: selectedMovement.itemSummary,
                    quantity: 1,
                    unit: 'DONA',
                    price: 0,
                  },
                ]
          }
        />
      )}

      {/* DEDICATED OFFICIAL OS-1 DOCUMENT MODAL (Phase 5) */}
      <HandoverDocModal
        visible={isHandoverDocModalVisible}
        handoverId={handoverDocId}
        onClose={() => {
          setIsHandoverDocModalVisible(false);
          setHandoverDocId(null);
        }}
        onOpenAudit={(id) => {
          setAuditHandoverId(id);
          setIsAuditDrawerVisible(true);
        }}
      />

      {/* HANDOVER REVIEW AND SIGN MODAL */}
      <HandoverReviewModal
        visible={isHandoverModalVisible}
        handoverId={selectedHandoverId}
        onClose={() => {
          setIsHandoverModalVisible(false);
          setSelectedHandoverId(null);
        }}
        onSuccess={() => {
          refetchHandovers();
          refetch();
        }}
      />

      {/* HANDOVER AUDIT LOG DRAWER (Phase 5) */}
      <HandoverAuditDrawer
        visible={isAuditDrawerVisible}
        handoverId={auditHandoverId}
        onClose={() => {
          setIsAuditDrawerVisible(false);
          setAuditHandoverId(null);
        }}
      />
    </div>
  );
};

export default MovementsPage;
