import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Input,
  Tag,
  Modal,
  Select,
  Message,
  Badge,
  Alert,
  Tooltip,
  Popconfirm,
  Switch,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconDownload,
  IconUserGroup,
  IconUpload,
  IconFile,
  IconSwap,
  IconExclamationCircle,
  IconArchive,
  IconPrinter,
  IconSafe,
  IconBranch,
  IconTool,
  IconSync,
  IconFilter,
  IconCheckCircle,
  IconHome,
  IconEdit,
  IconDelete,
  IconUndo,
} from '@arco-design/web-react/icon';
import {
  useWarehouseQuery,
  useMovementsQuery,
  useWarehousesQuery,
  useLowStockQuery,
  useDeleteWarehouseMutation,
  useRestoreWarehouseMutation,
  WarehouseItem,
} from '../../hooks/useWarehouseQuery';
import { useSuppliersQuery } from '../../hooks/useSuppliersQuery';
import { useRequestsQuery } from '../../hooks/useRequestsQuery';
import { useAuthStore } from '../../store/authStore';
import type { StockItem, LowStockItem } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { IngestStockModal } from '../../components/Warehouse/IngestStockModal';
import { SuppliersModal } from '../../components/Warehouse/SuppliersModal';
import { ExcelImportModal } from '../../components/Warehouse/ExcelImportModal';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { InterWarehouseTransferModal } from '../../components/Warehouse/InterWarehouseTransferModal';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { NewRequestModal } from '../../components/Requests/NewRequestModal';
import { CreateWarehouseModal } from './CreateWarehouseModal';
import { EditWarehouseModal } from './EditWarehouseModal';

const ALLOWED_WAREHOUSE_VIEW_ROLES = [
  'SUPER_ADMIN',
  'HEAD_WAREHOUSE',
  'CHIEF_ACCOUNTANT',
  'AUDITOR',
  'MOL',
  'COMMENDANT',
  'EMPLOYEE',
];

export const WarehousePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { stocks, isLoading, isFetching, isError, refetch } = useWarehouseQuery();
  const { lowStockItems, isLoading: isLowStockLoading, refetch: refetchLowStock } = useLowStockQuery();
  const { movements, isLoading: isMovementsLoading, isFetching: isMovementsFetching } = useMovementsQuery();
  const [showDeletedWarehouses, setShowDeletedWarehouses] = useState(false);
  const { warehouses: allWarehouses, isLoading: isWarehousesLoading, refetch: refetchWarehouses } = useWarehousesQuery(showDeletedWarehouses);
  const { suppliers } = useSuppliersQuery();
  const { createRequest } = useRequestsQuery();

  const deleteWarehouseMutation = useDeleteWarehouseMutation();
  const restoreWarehouseMutation = useRestoreWarehouseMutation();

  const [activeMainTab, setActiveMainTab] = useState<'STOCKS' | 'LOW_STOCK' | 'MOVEMENTS' | 'WAREHOUSES'>('STOCKS');
  const [selectedLowStockKeys, setSelectedLowStockKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [stockFilterTab, setStockFilterTab] = useState('ALL');
  const [fundingSourceFilter, setFundingSourceFilter] = useState<string>('ALL');

  // Modals state
  const [isIngestModalVisible, setIsIngestModalVisible] = useState(false);
  const [isSuppliersModalVisible, setIsSuppliersModalVisible] = useState(false);
  const [isExcelImportModalVisible, setIsExcelImportModalVisible] = useState(false);
  const [officialKirimDoc, setOfficialKirimDoc] = useState<any | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
  const [isCreateWarehouseModalVisible, setIsCreateWarehouseModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);

  // Inline request modal state (ochilib turuvchi talabnoma modali)
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
  const [requestDraftItems, setRequestDraftItems] = useState<Array<{ itemId?: string; itemName: string; quantity: number; unit: string; currentQuantity?: number; minStockLimit?: number }>>([]);
  const [requestInitialPurpose, setRequestInitialPurpose] = useState('');
  // Track item IDs for which request has been submitted (tugma rangini o'zgartirish uchun)
  const [submittedItemIds, setSubmittedItemIds] = useState<Set<string>>(new Set());

  const canManageWarehouse = user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE';
  // Moddiy javobgarlik va davlat auditi qoidasi bo'yicha talabnomani faqat rasmiy Ombor Mudiri shakllantiradi
  const canRequestReplenishment = user?.role === 'HEAD_WAREHOUSE';

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'incoming' && canManageWarehouse) {
      setIsIngestModalVisible(true);
    }
    const tab = searchParams.get('tab');
    if (tab === 'low-stock' || tab === 'lowStock') {
      setActiveMainTab('LOW_STOCK');
    }
  }, [searchParams, canManageWarehouse]);

  const filteredWarehouses = (allWarehouses || []).filter((w) => {
    if (!warehouseSearch.trim()) return true;
    const q = warehouseSearch.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      (w.code && w.code.toLowerCase().includes(q)) ||
      (w.building?.name && w.building.name.toLowerCase().includes(q)) ||
      (w.manager?.fullName && w.manager.fullName.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    const itemId = searchParams.get('itemId');
    if (itemId && stocks.length > 0) {
      const match = stocks.find((s) => s.id === itemId || (s as any).itemId === itemId);
      if (match) {
        handleCreateDraftRequest([{
          id: match.id,
          itemId: (match as any).itemId || match.id,
          itemName: match.itemName,
          categoryName: match.categoryName,
          warehouseName: match.warehouseName,
          unit: match.unit,
          quantity: match.quantity,
          minStockLimit: match.minStockLimit,
          deficit: Math.max(0, match.minStockLimit - match.quantity),
          recommendedOrderQty: Math.max(10, (match.minStockLimit - match.quantity) * 2),
          fundingSource: match.fundingSource || 'BYUDJET',
        }]);
      }
    }
  }, [searchParams, stocks]);

  // Permission Denied View (Rule 3 & 6.3)
  if (user && !ALLOWED_WAREHOUSE_VIEW_ROLES.includes(user.role)) {
    return <ForbiddenView requiredRoles={['HEAD_WAREHOUSE', 'SUPER_ADMIN', 'CHIEF_ACCOUNTANT', 'AUDITOR']} />;
  }

  const handleCreateDraftRequest = (
    itemsToRequest?: Array<
      Partial<LowStockItem> & {
        itemId: string;
        itemName: string;
        unit: string;
        quantity: number;
        minStockLimit: number;
        deficit?: number;
        recommendedOrderQty?: number;
      }
    >,
  ) => {
    if (!canRequestReplenishment) {
      Message.warning('Zaxira to‘ldirish talabnomasi faqat Ombor Mudiri (HEAD_WAREHOUSE) tomonidan shakllantiriladi!');
      return;
    }
    const targetItems =
      itemsToRequest || lowStockItems.filter((item) => selectedLowStockKeys.includes(item.id));
    if (targetItems.length === 0) {
      Message.warning('Iltimos, talabnoma shakllantirish uchun kamida bitta mahsulotni tanlang!');
      return;
    }
    const draftItems = targetItems.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      quantity: item.recommendedOrderQty || Math.max(10, (item.deficit || 1) * 2),
      unit: item.unit,
      currentQuantity: item.quantity,
      minStockLimit: item.minStockLimit,
    }));

    // Sahifa almashish o'rniga shu sahifada modal ochiladi
    setRequestDraftItems(draftItems);
    setRequestInitialPurpose('Minimal me\'yordan kam qolgan sarf tovarlari zaxirasini to\'ldirish uchun talabnoma');
    setIsRequestModalVisible(true);
  };

  const handleWarehouseRequestSubmit = async (payload: {
    purpose: string;
    items: Array<{ itemId?: string; itemName: string; quantity: number; unit?: string }>;
  }) => {
    await createRequest(payload);
    // Yuborilgan item ID'larini belgilaymiz (tugma ko'rinishini o'zgartirish)
    const submittedIds = new Set(requestDraftItems.map((d) => d.itemId || d.itemName));
    setSubmittedItemIds((prev) => new Set([...prev, ...submittedIds]));
    Message.success('Talabnoma muvaffaqiyatli yaratildi! Talabnomalar sahifasida kuzatishingiz mumkin.');
    setIsRequestModalVisible(false);
    refetchLowStock();
  };

  const handleExportLowStockExcel = () => {
    const formatted = lowStockItems.map((s) => ({
      'Mahsulot Nomi': s.itemName,
      'Kategoriya': s.categoryName,
      'Omborxona': s.warehouseName,
      'O‘lchov Birligi': s.unit,
      'Mavjud Qoldiq': s.quantity,
      'Minimal Limit': s.minStockLimit,
      'Kamomad': s.deficit,
      'Tavsiya Miqdor': s.recommendedOrderQty,
      'Moliyalashtirish': s.fundingSource === 'KONTRAKT_RIVOJLANTIRISH' ? 'To‘lov-Kontrakt' : s.fundingSource === 'GRANT' ? 'Ilmiy Grant' : 'Davlat Byudjeti',
    }));
    exportToExcel(formatted, 'Minimal_Qoldiqdan_Kam_Sarf_Tovarlari', 'Kamomad');
    Message.success('Kam qolgan tovarlar ro‘yxati Excelga yuklandi!');
  };

  // Official Category-based visual representation (Rule 4.1 & 4.2 - no substring guesses on product names)
  const getCategoryVisual = (categoryName?: string) => {
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('qog‘oz') || cat.includes('qogoz') || cat.includes('daftar') || cat.includes('fayl') || cat.includes('blanka')) {
      return { icon: <IconFile />, color: '#165DFF', bg: '#E8F3FF' };
    }
    if (cat.includes('kartridj') || cat.includes('toner') || cat.includes('printer') || cat.includes('siyoh')) {
      return { icon: <IconPrinter />, color: '#722ED1', bg: '#F5E8FF' };
    }
    if (cat.includes('kantselyariya') || cat.includes('jihoz') || cat.includes('qurol')) {
      return { icon: <IconTool />, color: '#FF7D00', bg: '#FFF7E8' };
    }
    if (cat.includes('xo‘jalik') || cat.includes('xojalik') || cat.includes('tozalash') || cat.includes('gigiyena') || cat.includes('yuvish')) {
      return { icon: <IconSafe />, color: '#00B42A', bg: '#E8FFEA' };
    }
    return { icon: <IconArchive />, color: '#4E5969', bg: '#F2F3F5' };
  };

  const filteredStocks = stocks.filter((s) => {
    const matchesSearch =
      !searchText ||
      s.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.categoryName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.warehouseName.toLowerCase().includes(searchText.toLowerCase());

    const matchesTab =
      stockFilterTab === 'ALL' ||
      (stockFilterTab === 'LOW' && s.status === 'LOW') ||
      (stockFilterTab === 'NORMAL' && s.status === 'NORMAL');

    const matchesFunding =
      fundingSourceFilter === 'ALL' ||
      s.fundingSource === fundingSourceFilter;

    return matchesSearch && matchesTab && matchesFunding;
  });

  const handleExportExcel = () => {
    const formatted = stocks.map((s) => ({
      'Mahsulot Nomi': s.itemName,
      'Kategoriya': s.categoryName,
      'Moliyalashtirish': s.fundingSource === 'KONTRAKT_RIVOJLANTIRISH' ? 'To‘lov-Kontrakt' : s.fundingSource === 'GRANT' ? 'Ilmiy Grant' : 'Davlat Byudjeti',
      'Omborxona': s.warehouseName,
      'O‘lchov Birligi': s.unit,
      'Mavjud Qoldiq': s.quantity,
      'Minimal Limit': s.minStockLimit,
      'Holati': s.status === 'LOW' ? 'Zaxira kam!' : 'Yetarli',
    }));
    exportToExcel(formatted, 'Ombor_Sarf_Tovarlari_Qoldigi', 'Qoldiqlar');
    Message.success('Ombor qoldiqlari Excelga muvaffaqiyatli yuklandi!');
  };

  const lowStockRegistryCount = stocks.filter((s) => s.status === 'LOW').length;
  const normalStockCount = stocks.length - lowStockRegistryCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ERROR UX STATE (Rule 6.3) */}
      {isError && (
        <Alert
          type="error"
          title="Ombor qoldiqlarini yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {/* Main Tabs Navigation */}
      <PageTabs
        activeTab={activeMainTab}
        onChange={(t: any) => setActiveMainTab(t)}
        tabs={[
          { key: 'STOCKS', title: 'Sarf Tovarlari Qoldiqlari (Registry)', count: stocks.length },
          { key: 'LOW_STOCK', title: 'Minimal Qoldiqdan Past (Kamomad)', count: lowStockItems.length },
          { key: 'MOVEMENTS', title: 'Ombor Harakatlari va Ko‘chirishlar (Audit Log)', count: movements.length },
          { key: 'WAREHOUSES', title: 'Omborxonalar Reestri', count: allWarehouses.length },
        ]}
      />

      {/* TAB 1: STOCKS REGISTRY */}
      {activeMainTab === 'STOCKS' && (
        <>
          {/* Top Search & Filter Toolbar */}
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space size="medium" wrap>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Sarf mahsulotini qidirish (Qog‘oz, Toner, Ruchka...)"
                  style={{ width: 280, borderRadius: 0 }}
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
                <Space size="small">
                  <Button
                    type={stockFilterTab === 'ALL' ? 'primary' : 'secondary'}
                    size="small"
                    style={{ borderRadius: 0 }}
                    onClick={() => setStockFilterTab('ALL')}
                  >
                    Barchasi ({stocks.length})
                  </Button>
                  <Button
                    type={stockFilterTab === 'LOW' ? 'primary' : 'secondary'}
                    status="danger"
                    size="small"
                    style={{ borderRadius: 0 }}
                    onClick={() => setStockFilterTab('LOW')}
                  >
                    Kam Qolganlar ({lowStockRegistryCount})
                  </Button>
                  <Button
                    type={stockFilterTab === 'NORMAL' ? 'primary' : 'secondary'}
                    status="success"
                    size="small"
                    style={{ borderRadius: 0 }}
                    onClick={() => setStockFilterTab('NORMAL')}
                  >
                    Yetarli ({normalStockCount})
                  </Button>
                </Space>

                <Select
                  value={fundingSourceFilter}
                  onChange={setFundingSourceFilter}
                  style={{ width: 180, borderRadius: 0 }}
                  prefix={<IconFilter />}
                >
                  <Select.Option value="ALL">Barcha manbalar</Select.Option>
                  <Select.Option value="BYUDJET">Davlat Byudjeti</Select.Option>
                  <Select.Option value="KONTRAKT_RIVOJLANTIRISH">To‘lov-Kontrakt</Select.Option>
                  <Select.Option value="GRANT">Ilmiy Grant</Select.Option>
                </Select>
              </Space>

              <Space size="small" wrap>
                {canManageWarehouse ? (
                  <Button
                    type="primary"
                    icon={<IconPlus />}
                    onClick={() => setIsIngestModalVisible(true)}
                    style={{ borderRadius: 0, fontWeight: 600 }}
                  >
                    Ta’minotchidan Kirim (OS-1)
                  </Button>
                ) : (
                  <Tooltip content="Kirim qilish faqat Bosh Omborchi va Admin uchun ruxsat etilgan">
                    <Button type="primary" icon={<IconPlus />} disabled style={{ borderRadius: 0 }}>
                      Ta’minotchidan Kirim (OS-1)
                    </Button>
                  </Tooltip>
                )}

                {canManageWarehouse ? (
                  <Button
                    type="outline"
                    icon={<IconSwap />}
                    onClick={() => setIsTransferModalVisible(true)}
                    style={{ borderRadius: 0, color: '#FF7D00', borderColor: '#FF7D00' }}
                  >
                    Omborlararo Ko‘chirish
                  </Button>
                ) : (
                  <Tooltip content="Ko‘chirish faqat Bosh Omborchi uchun ruxsat etilgan">
                    <Button type="outline" icon={<IconSwap />} disabled style={{ borderRadius: 0 }}>
                      Omborlararo Ko‘chirish
                    </Button>
                  </Tooltip>
                )}

                <Button
                  type="outline"
                  icon={<IconUserGroup />}
                  onClick={() => setIsSuppliersModalVisible(true)}
                  style={{ borderRadius: 0 }}
                >
                  Ta’minotchilar ({suppliers.length})
                </Button>

                {canManageWarehouse && (
                  <Button
                    type="outline"
                    icon={<IconHome />}
                    onClick={() => setIsCreateWarehouseModalVisible(true)}
                    style={{ borderRadius: 0 }}
                  >
                    + Yangi Ombor
                  </Button>
                )}

                {canManageWarehouse ? (
                  <Button
                    type="outline"
                    icon={<IconUpload />}
                    onClick={() => setIsExcelImportModalVisible(true)}
                    style={{ borderRadius: 0 }}
                  >
                    Excel Import
                  </Button>
                ) : (
                  <Tooltip content="Faqat Bosh Omborchi va Admin import qila oladi">
                    <Button type="outline" icon={<IconUpload />} disabled style={{ borderRadius: 0 }}>
                      Excel Import
                    </Button>
                  </Tooltip>
                )}

                <Button
                  icon={<IconDownload />}
                  onClick={handleExportExcel}
                  style={{ borderRadius: 0 }}
                >
                  Eksport
                </Button>
              </Space>
            </div>
          </Card>

          {/* StandardTable for Stock Items (Rule 1.1 & 4.2) */}
          <StandardTable<StockItem>
            rowKey="id"
            loading={isLoading || isFetching}
            data={filteredStocks}
            scrollX={1300}
            emptyText={searchText ? 'Qidiruv so‘rovi bo‘yicha tovar topilmadi' : 'Omborda sarf tovarlari mavjud emas'}
            columns={[
              {
                title: 'Mahsulot Nomi va Toifasi',
                dataIndex: 'itemName',
                minWidth: 260,
                render: (name: string, record: StockItem) => {
                  const visual = getCategoryVisual(record.categoryName);
                  return (
                    <CategoryThumbnail
                      icon={visual.icon}
                      name={name}
                      tag={record.categoryName}
                      color={visual.color}
                      bg={visual.bg}
                    />
                  );
                },
              },
              {
                title: 'Moliyalashtirish Manbasi',
                dataIndex: 'fundingSource',
                width: 170,
                render: (source: string) => {
                  const s = source || 'BYUDJET';
                  let color = 'blue';
                  let label = 'Davlat Byudjeti';
                  if (s === 'KONTRAKT_RIVOJLANTIRISH' || s === 'KONTRAKT') {
                    color = 'purple';
                    label = 'To‘lov-Kontrakt';
                  } else if (s === 'GRANT') {
                    color = 'green';
                    label = 'Ilmiy Grant';
                  }
                  return (
                    <Tag color={color} style={{ borderRadius: 0, fontWeight: 600 }}>
                      {label}
                    </Tag>
                  );
                },
              },
              {
                title: 'Omborxona',
                dataIndex: 'warehouseName',
                width: 200,
                render: (wh: string) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <IconBranch style={{ color: '#165DFF' }} />
                    <span>{wh || 'Markaziy Ombor'}</span>
                  </div>
                ),
              },
              {
                title: 'O‘lchov Birligi',
                dataIndex: 'unit',
                width: 120,
                render: (unit: string) => (
                  <Tag color="gray" style={{ borderRadius: 0, fontWeight: 500 }}>
                    {unit}
                  </Tag>
                ),
              },
              {
                title: 'Mavjud Qoldiq va Zaxira Shkalasi',
                dataIndex: 'quantity',
                width: 220,
                render: (qty: number, record: StockItem) => (
                  <StockLevelGauge
                    quantity={qty}
                    minLimit={record.minStockLimit}
                    unit={record.unit}
                    status={record.status}
                    maxScaleMultiplier={3}
                    width={170}
                    strokeWidth={6}
                  />
                ),
              },
              {
                title: 'Holat',
                dataIndex: 'status',
                width: 150,
                render: (status: string) => {
                  if (status === 'LOW') {
                    return <Badge status="error" text="Zaxira kritik kam!" />;
                  }
                  return <Badge status="success" text="Yetarli zaxira" />;
                },
              },
              {
                title: 'Amallar',
                width: 140,
                fixed: 'right' as const,
                render: (_, record: StockItem) => (
                  <TableActions rightPadding={16}>
                    {record.status === 'LOW' ? (
                      submittedItemIds.has((record as any).itemId || record.id) ? (
                        <Button
                          size="small"
                          type="primary"
                          status="success"
                          icon={<IconCheckCircle />}
                          style={{ borderRadius: 0, fontWeight: 600 }}
                          onClick={() => navigate('/requests')}
                        >
                          Yuborildi →
                        </Button>
                      ) : canRequestReplenishment ? (
                        <Button
                          size="small"
                          type="primary"
                          status="warning"
                          icon={<IconFile />}
                          onClick={() => {
                            handleCreateDraftRequest([{
                              id: record.id,
                              itemId: (record as any).itemId || record.id,
                              itemName: record.itemName,
                              categoryName: record.categoryName,
                              warehouseName: record.warehouseName,
                              unit: record.unit,
                              quantity: record.quantity,
                              minStockLimit: record.minStockLimit,
                              deficit: Math.max(0, record.minStockLimit - record.quantity),
                              recommendedOrderQty: Math.max(10, (record.minStockLimit - record.quantity) * 2),
                              fundingSource: record.fundingSource || 'BYUDJET',
                            }]);
                          }}
                          style={{ borderRadius: 0, fontWeight: 600 }}
                        >
                          Talabnoma
                        </Button>
                      ) : (
                        <Tooltip content="Zaxira to‘ldirish talabnomasi faqat Ombor Mudiri (HEAD_WAREHOUSE) tomonidan shakllantiriladi">
                          <Button
                            size="small"
                            type="secondary"
                            disabled
                            icon={<IconFile />}
                            style={{ borderRadius: 0 }}
                          >
                            Talabnoma
                          </Button>
                        </Tooltip>
                      )
                    ) : (
                      <span style={{ color: 'var(--color-text-3)', fontSize: 13, paddingLeft: 8 }}>—</span>
                    )}
                  </TableActions>
                ),
              },
            ]}
          />
        </>
      )}

      {/* TAB 2: LOW STOCK ASSISTANT */}
      {activeMainTab === 'LOW_STOCK' && (
        <>
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <Space size="small">
                  <Tag color="red" icon={<IconExclamationCircle />} style={{ borderRadius: 0, fontWeight: 600 }}>
                    Diqqat Talab Qoldiqlar: {lowStockItems.length} ta
                  </Tag>
                  {selectedLowStockKeys.length > 0 && (
                    <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                      Tanlandi: <b>{selectedLowStockKeys.length}</b> ta mahsulot
                    </Tag>
                  )}
                </Space>
                <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 6 }}>
                  Ushbu tovarlar zaxirasi belgilangan xavfsizlik me’yoridan kamaygan. Kerakli mahsulotlarni tanlab, bir tugma bilan talabnoma (zayavka) shablonini shakllantiring.
                </div>
              </div>

              <Space size="medium" wrap>
                {canRequestReplenishment ? (
                  <>
                    <Button
                      type="primary"
                      icon={<IconFile />}
                      disabled={selectedLowStockKeys.length === 0}
                      onClick={() => handleCreateDraftRequest()}
                      style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                    >
                      Tanlanganlardan Talabnoma Yaratish ({selectedLowStockKeys.length})
                    </Button>
                    <Button
                      type="outline"
                      icon={<IconPlus />}
                      disabled={lowStockItems.length === 0}
                      onClick={() => handleCreateDraftRequest(lowStockItems)}
                      style={{ borderRadius: 0 }}
                    >
                      Barchasiga Talabnoma ({lowStockItems.length})
                    </Button>
                  </>
                ) : (
                  <Tooltip content="Zaxira to‘ldirish talabnomasi faqat Ombor Mudiri (HEAD_WAREHOUSE) tomonidan shakllantiriladi">
                    <Button
                      type="secondary"
                      disabled
                      icon={<IconFile />}
                      style={{ borderRadius: 0 }}
                    >
                      Talabnoma Yaratish (Faqat Ombor Mudiri)
                    </Button>
                  </Tooltip>
                )}
                <Button
                  icon={<IconDownload />}
                  onClick={handleExportLowStockExcel}
                  style={{ borderRadius: 0 }}
                >
                  Excelga
                </Button>
                <Button
                  icon={<IconSync />}
                  onClick={() => refetchLowStock()}
                  style={{ borderRadius: 0 }}
                >
                  Yangilash
                </Button>
              </Space>
            </div>
          </Card>

          {/* StandardTable for Low Stock Items */}
          <StandardTable<LowStockItem>
            rowKey="id"
            loading={isLowStockLoading}
            data={lowStockItems}
            scrollX={1150}
            emptyText="Minimal qoldiqdan kamaygan sarf tovarlari mavjud emas. Barcha zaxiralar yetarli!"
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedLowStockKeys,
              onChange: (keys) => setSelectedLowStockKeys(keys as string[]),
            }}
            columns={[
              {
                title: 'Mahsulot Nomi',
                minWidth: 260,
                render: (_, record: LowStockItem) => {
                  const visual = getCategoryVisual(record.categoryName);
                  return (
                    <CategoryThumbnail
                      icon={visual.icon}
                      name={record.itemName}
                      subtitle={`${record.categoryName} ${record.model ? `| ${record.model}` : ''}`}
                      color={visual.color}
                      bg={visual.bg}
                      tag={record.fundingSource || 'BYUDJET'}
                    />
                  );
                },
              },
              {
                title: 'Moliyalashtirish Manbasi',
                dataIndex: 'fundingSource',
                width: 170,
                render: (source: string) => {
                  const s = source || 'BYUDJET';
                  let color = 'blue';
                  let label = 'Davlat Byudjeti';
                  if (s === 'KONTRAKT_RIVOJLANTIRISH' || s === 'KONTRAKT') {
                    color = 'purple';
                    label = 'To‘lov-Kontrakt';
                  } else if (s === 'GRANT') {
                    color = 'green';
                    label = 'Ilmiy Grant';
                  }
                  return (
                    <Tag color={color} style={{ borderRadius: 0, fontWeight: 600 }}>
                      {label}
                    </Tag>
                  );
                },
              },
              {
                title: 'Omborxona',
                dataIndex: 'warehouseName',
                width: 170,
                render: (val: string) => val || 'Markaziy Ombor',
              },
              {
                title: 'Mavjud Qoldiq',
                width: 140,
                render: (_, record: LowStockItem) => (
                  <Tag color="red" style={{ borderRadius: 0, fontWeight: 700 }}>
                    {record.quantity} {record.unit}
                  </Tag>
                ),
              },
              {
                title: 'Min Me’yor',
                width: 130,
                render: (_, record: LowStockItem) => (
                  <span style={{ color: 'var(--color-text-2)' }}>
                    {record.minStockLimit} {record.unit}
                  </span>
                ),
              },
              {
                title: 'Kamomad',
                width: 130,
                render: (_, record: LowStockItem) => (
                  <Tag color="orange" style={{ borderRadius: 0, fontWeight: 600 }}>
                    +{record.deficit} {record.unit}
                  </Tag>
                ),
              },
              {
                title: 'Tavsiya Miqdor',
                width: 150,
                render: (_, record: LowStockItem) => (
                  <Tag color="blue" style={{ borderRadius: 0, fontWeight: 700 }}>
                    {record.recommendedOrderQty} {record.unit}
                  </Tag>
                ),
              },
              {
                title: 'Amallar',
                width: 140,
                fixed: 'right' as const,
                render: (_, record: LowStockItem) => (
                  canRequestReplenishment ? (
                    <Button
                      size="small"
                      type="primary"
                      status="warning"
                      icon={<IconFile />}
                      onClick={() => handleCreateDraftRequest([record])}
                      style={{ borderRadius: 0 }}
                    >
                      Talabnoma
                    </Button>
                  ) : (
                    <Tooltip content="Zaxira to‘ldirish talabnomasi faqat Ombor Mudiri (HEAD_WAREHOUSE) tomonidan shakllantiriladi">
                      <Button
                        size="small"
                        type="secondary"
                        disabled
                        icon={<IconFile />}
                        style={{ borderRadius: 0 }}
                      >
                        Talabnoma
                      </Button>
                    </Tooltip>
                  )
                ),
              },
            ]}
          />
        </>
      )}

      {/* TAB 3: WAREHOUSE MOVEMENTS AUDIT LOG */}
      {activeMainTab === 'MOVEMENTS' && (
        <StandardTable<any>
          rowKey="id"
          loading={isMovementsLoading || isMovementsFetching}
          data={movements}
          scrollX={1150}
          emptyText="Ombor harakatlari jurnali bo‘sh"
          columns={[
            {
              title: 'Harakat №',
              dataIndex: 'movementNumber',
              width: 150,
              render: (num: string) => <b style={{ color: '#165DFF' }}>{num}</b>,
            },
            {
              title: 'Turi',
              dataIndex: 'movementType',
              width: 120,
              render: (type: string) => {
                if (type === 'INCOMING') return <Tag color="blue" style={{ borderRadius: 0 }}>Kirim</Tag>;
                if (type === 'TRANSFER') return <Tag color="cyan" style={{ borderRadius: 0 }}>Siljish</Tag>;
                if (type === 'WRITE_OFF') return <Tag color="red" style={{ borderRadius: 0 }}>Spisanie</Tag>;
                if (type === 'RETURN') return <Tag color="orange" style={{ borderRadius: 0 }}>Qaytarish</Tag>;
                return <Tag style={{ borderRadius: 0 }}>{type}</Tag>;
              },
            },
            {
              title: 'Moliyalashtirish',
              dataIndex: 'fundingSource',
              width: 150,
              render: (source: string) => {
                const s = source || 'BYUDJET';
                let color = 'blue';
                let label = 'Byudjet';
                if (s === 'KONTRAKT_RIVOJLANTIRISH' || s === 'KONTRAKT') {
                  color = 'purple';
                  label = 'Kontrakt';
                } else if (s === 'GRANT') {
                  color = 'green';
                  label = 'Grant';
                }
                return (
                  <Tag color={color} size="small" style={{ borderRadius: 0 }}>
                    {label}
                  </Tag>
                );
              },
            },
            {
              title: 'Mahsulotlar va Miqdori',
              minWidth: 240,
              render: (_, r: any) => {
                const itemsList =
                  r.items?.map((it: any) => `${it.name || it.item?.name} (${it.quantity} ${it.unit || 'dona'})`).join(', ') ||
                  r.itemSummary ||
                  'Mahsulot';
                return <div style={{ fontWeight: 500 }}>{itemsList}</div>;
              },
            },
            {
              title: 'Qayerdan / Qayerga',
              minWidth: 240,
              render: (_, r: any) => (
                <div style={{ fontSize: 12 }}>
                  <div>Chiqish: {r.sourceLocation || r.fromWarehouse?.name || (r.fromRoom ? `${r.fromRoom?.number}-xona` : 'Tashqi ta’minotchi')}</div>
                  <div style={{ fontWeight: 600, color: '#165DFF' }}>
                    Kirish: {r.targetLocation || r.toWarehouse?.name || (r.toRoom ? `${r.toRoom?.number}-xona` : 'Markaziy ombor')}
                  </div>
                </div>
              ),
            },
            {
              title: 'Ijrochi (Mas’ul)',
              width: 170,
              render: (_, r: any) => <span>{r.executedByName || r.executedBy?.fullName || 'Tizim xodimi'}</span>,
            },
            {
              title: 'Sana',
              dataIndex: 'createdAt',
              width: 130,
              render: (d: string) => <span style={{ color: 'var(--color-text-3)', fontSize: 12 }}>{d ? d.split('T')[0] : '—'}</span>,
            },
          ]}
        />
      )}

      {/* TAB 4: WAREHOUSES MANAGEMENT */}
      {activeMainTab === 'WAREHOUSES' && (
        <>
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space size="medium" wrap>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Ombor nomi, kodi yoki binosi bo‘yicha qidirish..."
                  style={{ width: 320, borderRadius: 0 }}
                  value={warehouseSearch}
                  onChange={setWarehouseSearch}
                  allowClear
                />
                <Space size="small">
                  <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>O‘chirilganlarni ko‘rsatish:</span>
                  <Switch
                    checked={showDeletedWarehouses}
                    onChange={setShowDeletedWarehouses}
                    size="small"
                  />
                </Space>
              </Space>

              <Space size="small" wrap>
                {canManageWarehouse && (
                  <Button
                    type="primary"
                    icon={<IconPlus />}
                    onClick={() => setIsCreateWarehouseModalVisible(true)}
                    style={{ borderRadius: 0, fontWeight: 600 }}
                  >
                    Yangi Ombor Qo‘shish
                  </Button>
                )}
                <Button
                  icon={<IconSync />}
                  onClick={() => refetchWarehouses()}
                  style={{ borderRadius: 0 }}
                >
                  Yangilash
                </Button>
              </Space>
            </div>
          </Card>

          <StandardTable<WarehouseItem>
            rowKey="id"
            loading={isWarehousesLoading}
            data={filteredWarehouses}
            scrollX={1050}
            emptyText="Omborxonalar mavjud emas"
            columns={[
              {
                title: 'Ombor Nomi va Kodi',
                minWidth: 260,
                render: (_, record) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-1)', fontSize: 14 }}>{record.name}</span>
                      {record.isMain && (
                        <Tag color="arcoblue" size="small" style={{ borderRadius: 0 }}>Markaziy Ombor</Tag>
                      )}
                    </div>
                    {record.code && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                        Kod: {record.code}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                title: 'Bino va Korpus',
                width: 250,
                render: (_, record) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-1)' }}>
                      {record.building?.name || <span style={{ color: 'var(--color-text-4)' }}>Bino biriktirilmagan</span>}
                    </span>
                    {record.location && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                        Joylashuvi: {record.location}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                title: 'Ombor Mudiri (Mas’ul)',
                width: 220,
                render: (_, record) => (
                  record.manager ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 500 }}>{record.manager.fullName}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                        {record.manager.phone || record.manager.username}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-4)', fontSize: 13 }}>Tayinlanmagan</span>
                  )
                ),
              },
              {
                title: 'Tovar Turlari',
                width: 140,
                render: (_, record) => (
                  <Tag color="cyan" style={{ borderRadius: 0, fontWeight: 600 }}>
                    {record._count?.stocks ?? 0} xil tovar
                  </Tag>
                ),
              },
              {
                title: 'Holati',
                width: 120,
                render: (_, record) => (
                  record.deletedAt ? (
                    <Badge status="error" text="O‘chirilgan" />
                  ) : (
                    <Badge status="success" text="Faol" />
                  )
                ),
              },
              {
                title: 'Amallar',
                width: 150,
                fixed: 'right' as const,
                render: (_, record) => (
                  <TableActions rightPadding={16}>
                    {!record.deletedAt ? (
                      <>
                        {canManageWarehouse && (
                          <Button
                            size="small"
                            type="text"
                            icon={<IconEdit />}
                            onClick={() => setEditingWarehouse(record)}
                          >
                            Tahrirlash
                          </Button>
                        )}
                        {user?.role === 'SUPER_ADMIN' && (
                          <Popconfirm
                            title="Omborni o‘chirish"
                            content="Haqiqatan ham ushbu omborni o‘chirmoqchimisiz? (Eslatma: Qoldig‘i bor omborni o‘chirish taqiqlanadi)"
                            okText="O‘chirish"
                            cancelText="Bekor qilish"
                            okButtonProps={{ status: 'danger' }}
                            onOk={async () => {
                              await deleteWarehouseMutation.mutateAsync(record.id);
                            }}
                          >
                            <Button
                              size="small"
                              type="text"
                              status="danger"
                              icon={<IconDelete />}
                            />
                          </Popconfirm>
                        )}
                      </>
                    ) : (
                      user?.role === 'SUPER_ADMIN' && (
                        <Button
                          size="small"
                          type="text"
                          status="success"
                          icon={<IconUndo />}
                          onClick={async () => {
                            await restoreWarehouseMutation.mutateAsync(record.id);
                          }}
                        >
                          Tiklash
                        </Button>
                      )
                    )}
                  </TableActions>
                ),
              },
            ]}
          />
        </>
      )}

      {/* CREATE WAREHOUSE MODAL */}
      <CreateWarehouseModal
        visible={isCreateWarehouseModalVisible}
        onClose={() => setIsCreateWarehouseModalVisible(false)}
      />

      {/* EDIT WAREHOUSE MODAL */}
      <EditWarehouseModal
        visible={!!editingWarehouse}
        warehouse={editingWarehouse}
        onClose={() => setEditingWarehouse(null)}
      />

      {/* INGEST STOCK MODAL (OS-1 Kirim Akti) */}
      <IngestStockModal
        visible={isIngestModalVisible}
        onClose={() => setIsIngestModalVisible(false)}
        onSuccessDoc={(doc) => {
          setOfficialKirimDoc(doc);
          setIsDocModalVisible(true);
        }}
      />

      {/* SUPPLIERS MODAL */}
      <SuppliersModal
        visible={isSuppliersModalVisible}
        onClose={() => setIsSuppliersModalVisible(false)}
      />

      {/* EXCEL IMPORT MODAL */}
      <ExcelImportModal
        visible={isExcelImportModalVisible}
        onClose={() => setIsExcelImportModalVisible(false)}
      />

      {/* INTER-WAREHOUSE TRANSFER MODAL */}
      <InterWarehouseTransferModal
        visible={isTransferModalVisible}
        onClose={() => setIsTransferModalVisible(false)}
      />

      {/* OFFICIAL OS-1 RECEIPT DOCUMENT MODAL WITH WORM DIGITAL STAMP */}
      {officialKirimDoc && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType="KIRIM"
          entityId={officialKirimDoc.stampId || officialKirimDoc.id || officialKirimDoc.docNumber}
          docNumber={officialKirimDoc.docNumber}
          date={officialKirimDoc.date}
          sourceLocation={officialKirimDoc.sourceLocation}
          targetLocation={officialKirimDoc.targetLocation}
          senderName={officialKirimDoc.senderName}
          receiverName={officialKirimDoc.receiverName}
          reason={officialKirimDoc.reason}
          items={officialKirimDoc.items}
        />
      )}
      {/* INLINE TALABNOMA MODAL — Sahifadan chiqmasdan talabnoma shakllantirish */}
      <NewRequestModal
        visible={isRequestModalVisible}
        onClose={() => setIsRequestModalVisible(false)}
        onSubmit={handleWarehouseRequestSubmit}
        initialDraftItems={requestDraftItems}
        initialPurpose={requestInitialPurpose}
      />
    </div>
  );
};

export default WarehousePage;
