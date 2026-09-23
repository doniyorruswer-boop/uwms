import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  Message,
  Popconfirm,
  Badge,
  Drawer,
  Tabs,
  Descriptions,
  Timeline,
  Radio,
  Typography,
  Tooltip,
  Empty,
  Alert,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconQrcode,
  IconSwap,
  IconDelete,
  IconSearch,
  IconPrinter,
  IconDownload,
  IconEye,
  IconCheckCircle,
  IconHistory,
  IconInfoCircle,
  IconClose,
  IconUpload,
  IconUndo,
  IconTool,
  IconDesktop,
  IconStorage,
  IconExclamationCircle,
  IconUser,
  IconApps,
} from '@arco-design/web-react/icon';
import { QRCodeSVG } from 'qrcode.react';
import {
  useAssetsQuery,
  useTransfersQuery,
  useCategoriesQuery,
  TransferItem,
} from '../../hooks/useAssetsQuery';
import { useAssetDepreciationHistoryQuery } from '../../hooks/useDepreciationQuery';
import { useAuthStore } from '../../store/authStore';
import type { ItemInstance, AssetStatus, HandoverItemActionType } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { useTranslation } from 'react-i18next';
import { ExcelImportModal } from '../../components/Warehouse/ExcelImportModal';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { StatusTag } from '../../components/Common/StatusTag';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { CreateRepairModal } from '../../components/Repairs/CreateRepairModal';
import { CreateWriteOffModal } from '../../components/WriteOff/CreateWriteOffModal';
import { AssetHandoverWizardModal } from '../../components/Assets/AssetHandoverWizardModal';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';

const ALLOWED_ASSET_ROLES = [
  'SUPER_ADMIN',
  'HEAD_WAREHOUSE',
  'MOL',
  'AUDITOR',
  'CHIEF_ACCOUNTANT',
  'COMMENDANT',
  'RECTOR',
  'VICE_RECTOR_FINANCE',
];

const FormItem = Form.Item;
const TabPane = Tabs.TabPane;
const TimelineItem = Timeline.Item;
const { Text } = Typography;

export const AssetsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [activeMainTab, setActiveMainTab] = useState<'ASSETS' | 'TRANSFERS'>('ASSETS');
  const [selectedTransferDoc, setSelectedTransferDoc] = useState<TransferItem | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);



  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [quickCategory, setQuickCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fundingSourceFilter, setFundingSourceFilter] = useState<string>('ALL');
  const [showMyAssetsOnly, setShowMyAssetsOnly] = useState<boolean>(user?.role === 'MOL');
  const [wizardAssets, setWizardAssets] = useState<ItemInstance[]>([]);
  const [wizardInitialActionType, setWizardInitialActionType] = useState<HandoverItemActionType>('TRANSFER_TO_MOL');

  useEffect(() => {
    if (user?.role === 'MOL') {
      setShowMyAssetsOnly(true);
    }
  }, [user?.role]);

  const {
    assets,
    isLoading,
    isError,
    error,
    writeOffAsset,
    refetch: refetchAssets,
  } = useAssetsQuery({
    search: searchText || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    fundingSource: fundingSourceFilter === 'ALL' ? undefined : fundingSourceFilter,
    responsibleUserId: showMyAssetsOnly ? user?.id : undefined,
  });

  const { transfers, isLoading: isTransfersLoading, respondTransfer } = useTransfersQuery();
  const { categories: backendCategories, isLoading: isCategoriesLoading } = useCategoriesQuery();

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchText(q);
    }
  }, [searchParams]);

  // Selected rows for batch actions
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);

  // Modals and Drawer state
  const [selectedAsset, setSelectedAsset] = useState<ItemInstance | null>(null);
  const { data: assetDepHistory } = useAssetDepreciationHistoryQuery(selectedAsset?.id || null);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isBatchPrintModalVisible, setIsBatchPrintModalVisible] = useState(false);
  const [isExcelImportModalVisible, setIsExcelImportModalVisible] = useState(false);
  const [isRepairModalVisible, setIsRepairModalVisible] = useState(false);
  const [isWriteOffModalVisible, setIsWriteOffModalVisible] = useState(false);
  const [isAssetHandoverWizardVisible, setIsAssetHandoverWizardVisible] = useState(false);
  const [actionAsset, setActionAsset] = useState<ItemInstance | null>(null);

  const [reprintReason, setReprintReason] = useState('Eski stiker shikastlangan yoki xiralashgan');
  const [isPrintingQr, setIsPrintingQr] = useState(false);
  const [batchReprintReason, setBatchReprintReason] = useState('Ommaviy inventar stikerlari chop etildi');
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  const handlePrintSingleQr = async () => {
    if (!selectedAsset) return;
    try {
      setIsPrintingQr(true);
      const res = await apiClient.post(API_ENDPOINTS.ASSETS.REPRINT_QR(selectedAsset.id), {
        reason: reprintReason.trim() || 'QR-stiker qayta chop etildi',
      });
      if (res.data?.asset) {
        setSelectedAsset((prev) => (prev ? { ...prev, ...res.data.asset } : null));
      }
      refetchAssets();
      window.print();
      Message.success('QR-stikerni qayta chop etish auditi jurnalga qayd etildi');
    } catch (err: any) {
      Message.error(err.response?.data?.message || 'Qayta chop etishni qayd etishda xatolik yuz berdi');
    } finally {
      setIsPrintingQr(false);
    }
  };

  const handlePrintBatchQr = async () => {
    try {
      setIsBatchPrinting(true);
      await Promise.all(
        selectedAssetsList.map((asset) =>
          apiClient.post(API_ENDPOINTS.ASSETS.REPRINT_QR(asset.id), {
            reason: batchReprintReason.trim() || 'Ommaviy QR-stikerlar chop etildi',
          }).catch(() => {})
        )
      );
      refetchAssets();
      window.print();
      Message.success('Ommaviy chop etish audit jurnaliga muvaffaqiyatli yozildi');
    } catch (err: any) {
      Message.error('Audit jurnalini yozishda xatolik');
    } finally {
      setIsBatchPrinting(false);
    }
  };

  // Filtered assets
  const filteredAssets = assets.filter((a) => {
    const s = searchText.trim().toLowerCase();
    const matchesSearch =
      !s ||
      a.itemName.toLowerCase().includes(s) ||
      a.inventoryNumber.toLowerCase().includes(s) ||
      (a.categoryName && a.categoryName.toLowerCase().includes(s)) ||
      (a.roomName && a.roomName.toLowerCase().includes(s)) ||
      (a.serialNumber && a.serialNumber.toLowerCase().includes(s)) ||
      (a.departmentName && a.departmentName.toLowerCase().includes(s)) ||
      (a.facultyName && a.facultyName.toLowerCase().includes(s)) ||
      (a.responsibleUserName && a.responsibleUserName.toLowerCase().includes(s)) ||
      (s.includes('ombor') && (!a.roomId || a.roomName?.toLowerCase().includes('ombor')));

    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesFunding = fundingSourceFilter === 'ALL' || a.fundingSource === fundingSourceFilter;
    const matchesCat =
      quickCategory === 'ALL' ||
      a.categoryName === quickCategory ||
      (quickCategory === 'IT' && a.categoryName?.includes('IT')) ||
      (quickCategory === 'MEBEL' && a.categoryName?.includes('Mebel')) ||
      (quickCategory === 'NEW' && a.status === 'NEW');

    const matchesMyAssets = !showMyAssetsOnly || a.responsibleUserId === user?.id;

    return matchesSearch && matchesStatus && matchesFunding && matchesCat && matchesMyAssets;
  });

  const selectedAssetsList = assets.filter((a) => selectedRowKeys.includes(a.id));

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const handleOpenMyHandoverWizard = () => {
    // Foydalanuvchining o'z nomidagi (bo'ynidagi) faol aktivlari
    const myAssets = assets.filter(
      (a) => a.responsibleUserId === user?.id && a.status !== 'WRITTEN_OFF'
    );

    if (myAssets.length === 0) {
      Message.info('Sizning nomingizda topshirish mumkin bo‘lgan faol asosiy vositalar mavjud emas.');
      return;
    }

    setWizardInitialActionType('TRANSFER_TO_MOL');
    setWizardAssets(myAssets);
    setIsAssetHandoverWizardVisible(true);
  };

  const handleOpenDetail = (asset: ItemInstance) => {
    setSelectedAsset(asset);
    setIsDetailDrawerVisible(true);
  };

  const handleOpenQr = (asset: ItemInstance, e?: any) => {
    e?.stopPropagation?.();
    setSelectedAsset(asset);
    setIsQrModalVisible(true);
  };

  const handleAcceptTransfer = async (transfer: TransferItem, e?: any) => {
    e?.stopPropagation?.();
    try {
      await respondTransfer({ id: transfer.id, status: 'ACCEPTED' });
      setSelectedTransferDoc(transfer);
      setIsDocModalVisible(true);
    } catch {
      // Handled by query mutation
    }
  };

  const handleRejectTransfer = async (transfer: TransferItem, e?: any) => {
    e?.stopPropagation?.();
    try {
      await respondTransfer({ id: transfer.id, status: 'REJECTED' });
    } catch {
      // Handled by query mutation
    }
  };

  const handleOpenTransferDoc = (transfer: TransferItem, e?: any) => {
    e?.stopPropagation?.();
    setSelectedTransferDoc(transfer);
    setIsDocModalVisible(true);
  };



  const handleWriteOff = async (asset: ItemInstance, e?: any) => {
    e?.stopPropagation?.();
    await writeOffAsset({
      id: asset.id,
      reason: 'Komissiya xulosasiga ko‘ra texnik yaroqsiz deb topildi',
    });
  };

  const handleExportExcel = (dataToExport = filteredAssets) => {
    const formatted = dataToExport.map((a) => ({
      'Inventar Raqam': a.inventoryNumber,
      'Seriya Raqam': a.serialNumber || '',
      'Jihoz Nomi': a.itemName,
      'Model': a.itemModel || '',
      'Kategoriya': a.categoryName || '',
      'Joylashuvi': a.roomName || 'Omborxona',
      'Mas’ul Shaxs': a.responsibleUserName || '',
      'Moliyalashtirish Manbasi': a.fundingSource || 'BYUDJET',
      'Holati': a.status,
      'Balans Qiymati (so‘m)': a.purchasePrice || 0,
      'Xarid Sanasi': a.purchaseDate || '',
    }));
    exportToExcel(formatted, 'Asosiy_Vositalar_Reestri', 'Asosiy Vositalar');
    Message.success('Excel fayl muvaffaqiyatli yuklab olindi!');
  };

  // Official Category-based visual representation for assets (matching Warehouse/Requests/Users standard)
  const getAssetCategoryVisual = (categoryName?: string) => {
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('kompyuter') || cat.includes('noutbuk') || cat.includes('server') || cat.includes('monoblok')) {
      return { icon: <IconDesktop />, color: '#165DFF', bg: '#E8F3FF' };
    }
    if (cat.includes('printer') || cat.includes('skaner') || cat.includes('nusxa') || cat.includes('kartridj')) {
      return { icon: <IconPrinter />, color: '#722ED1', bg: '#F5E8FF' };
    }
    if (cat.includes('mebel') || cat.includes('stol') || cat.includes('stul') || cat.includes('shkaf')) {
      return { icon: <IconStorage />, color: '#FF7D00', bg: '#FFF7E8' };
    }
    if (cat.includes('konditsioner') || cat.includes('sovutgich') || cat.includes('texnika') || cat.includes('jihoz') || cat.includes('asbob')) {
      return { icon: <IconTool />, color: '#00B42A', bg: '#E8FFEA' };
    }
    return { icon: <IconApps />, color: '#165DFF', bg: '#E8F3FF' };
  };

  // Permission checks
  const isAllowedToView = !user?.role || ALLOWED_ASSET_ROLES.includes(user.role);
  if (!isAllowedToView || (error && (error as any)?.response?.status === 403)) {
    return <ForbiddenView requiredRoles={ALLOWED_ASSET_ROLES} />;
  }

  const canManageAssets =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'HEAD_WAREHOUSE' ||
    user?.role === 'MOL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ERROR UX STATE (Rule 6.3) */}
      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ borderRadius: 0 }}
          title="Asosiy vositalarni yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzildi yoki ma’lumotlarni olishda muammo yuzaga keldi. Iltimos, qayta urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetchAssets()} style={{ borderRadius: 0 }}>
              Qayta yuklash
            </Button>
          }
        />
      )}

      {/* Main Tab Switcher */}
      <PageTabs
        activeTab={activeMainTab}
        onChange={(t: any) => setActiveMainTab(t)}
        tabs={[
          { key: 'ASSETS', title: 'Asosiy Vositalar Reestri', count: assets.length },
          {
            key: 'TRANSFERS',
            title: 'Topshirish va Qabul Aktlari (OS-1)',
            count: transfers.filter((t) => t.status === 'PENDING').length || undefined,
          },
        ]}
      />

      {/* TRANSFERS TAB CONTENT */}
      {activeMainTab === 'TRANSFERS' && (
        <StandardTable
          rowKey="id"
          loading={isTransfersLoading}
          data={transfers}
          scrollX={1180}
          emptyText="Topshirish va qabul aktlari (OS-1) mavjud emas"
          columns={[
            {
              title: 'Dalolatnoma №',
              dataIndex: 'documentNumber',
              width: 170,
              render: (docNum: string, r: TransferItem) => {
                const displayNum = docNum || `TRF-${r.id.substring(0, 8).toUpperCase()}`;
                return (
                  <div style={{ paddingLeft: 8 }}>
                    <span style={{ color: '#165DFF', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {displayNum}
                    </span>
                  </div>
                );
              },
            },
            {
              title: 'Asosiy Vosita',
              dataIndex: 'assetName',
              minWidth: 180,
              render: (name: string) => (
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)', wordBreak: 'break-word' }}>
                  {name}
                </div>
              ),
            },
            {
              title: 'Qayerdan / Qayerga',
              width: 190,
              render: (_, r: TransferItem) => (
                <div style={{ lineHeight: 1.35 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Chiqish: <span style={{ color: 'var(--color-text-1)' }}>{r.fromRoomName}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#165DFF', marginTop: 2 }}>
                    Kirish: {r.toRoomName}
                  </div>
                </div>
              ),
            },
            {
              title: 'Topshiruvchi / Mas’ul (MOL)',
              width: 190,
              render: (_, r: TransferItem) => (
                <div style={{ lineHeight: 1.35 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Topshiruvchi: <span style={{ color: 'var(--color-text-1)' }}>{r.senderName}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                    Qabul qiluvchi: {r.receiverName}
                  </div>
                </div>
              ),
            },
            {
              title: 'Holati',
              dataIndex: 'status',
              width: 150,
              render: (status: string) => <StatusTag domain="general" status={status} mode="badge" />,
            },
            {
              title: 'Yuborilgan Sana',
              dataIndex: 'createdAt',
              width: 130,
              render: (createdAt: string) => (
                <span style={{ fontSize: 13, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                  {createdAt ? createdAt.replace('T', ' ').substring(0, 16) : '—'}
                </span>
              ),
            },
            {
              title: 'Amallar',
              width: 290,
              fixed: 'right' as const,
              render: (_, r: TransferItem) => {
                const canAccept =
                  r.status === 'PENDING' &&
                  (user?.role === 'MOL' || user?.role === 'SUPER_ADMIN' || user?.id === r.receiverId);

                return (
                  <TableActions rightPadding={24} gap={8}>
                    {canAccept && (
                      <Button
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconCheckCircle />}
                        onClick={(e) => handleAcceptTransfer(r, e)}
                        style={{ borderRadius: 0, fontWeight: 600 }}
                      >
                        Qabul Qilish
                      </Button>
                    )}
                    {canAccept && (
                      <Button
                        size="small"
                        type="secondary"
                        status="danger"
                        icon={<IconClose />}
                        onClick={(e) => handleRejectTransfer(r, e)}
                        style={{ borderRadius: 0 }}
                      >
                        Rad etish
                      </Button>
                    )}
                    {r.status === 'ACCEPTED' && (
                      <Button
                        size="small"
                        type="outline"
                        icon={<IconPrinter />}
                        onClick={(e) => handleOpenTransferDoc(r, e)}
                        style={{ borderRadius: 0 }}
                      >
                        Rasmiy Akt (OS-1)
                      </Button>
                    )}
                    {r.status === 'REJECTED' && (
                      <span style={{ color: 'var(--color-text-3)', fontSize: 12 }}>—</span>
                    )}
                  </TableActions>
                );
              },
            },
          ]}
        />
      )}

      {/* ASSETS TAB CONTENT */}
      {activeMainTab === 'ASSETS' && (
        <>
          {/* Top Filter and Controls Bar */}
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space size="medium" wrap>
                <Radio.Group
                  type="button"
                  value={showMyAssetsOnly ? 'MINE' : 'ALL'}
                  onChange={(val) => setShowMyAssetsOnly(val === 'MINE')}
                >
                  <Radio value="MINE">
                    <IconUser style={{ marginRight: 4 }} /> Mening aktivlarim
                  </Radio>
                  <Radio value="ALL">Barchasi</Radio>
                </Radio.Group>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Inventar №, Nomi, Seriya № yoki Xona..."
                  style={{ width: 260 }}
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
                <Select
                  placeholder="Barcha turlar"
                  value={quickCategory}
                  onChange={setQuickCategory}
                  style={{ width: 220 }}
                  loading={isCategoriesLoading}
                >
                  <Select.Option value="ALL">Barcha turlar (Barchasi)</Select.Option>
                  {backendCategories.map((cat) => (
                    <Select.Option key={cat.id} value={cat.name}>
                      {cat.name}
                    </Select.Option>
                  ))}
                </Select>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 160 }}
                >
                  <Select.Option value="ALL">Barcha holatlar</Select.Option>
                  <Select.Option value="IN_USE">Foydalanishda</Select.Option>
                  <Select.Option value="NEW">Yangi (Omborda)</Select.Option>
                  <Select.Option value="IN_REPAIR">Ta’mirda</Select.Option>
                  <Select.Option value="WRITTEN_OFF">Hisobdan chiqarilgan</Select.Option>
                </Select>
                <Select
                  value={fundingSourceFilter}
                  onChange={setFundingSourceFilter}
                  style={{ width: 170 }}
                >
                  <Select.Option value="ALL">Barcha manbalar</Select.Option>
                  <Select.Option value="BYUDJET">Byudjet mablag‘i</Select.Option>
                  <Select.Option value="KONTRAKT_RIVOJLANTIRISH">Kontrakt / Fond</Select.Option>
                  <Select.Option value="GRANT">Grant mablag‘i</Select.Option>
                </Select>
              </Space>

              <Space size="small" wrap>
                {canManageAssets && (
                  <>
                    <Button
                      type="primary"
                      status="success"
                      icon={<IconSwap />}
                      onClick={handleOpenMyHandoverWizard}
                      style={{ borderRadius: 0, fontWeight: 600 }}
                    >
                      Aktivlarni topshirish
                    </Button>
                    <Button
                      type="outline"
                      icon={<IconUpload />}
                      onClick={() => setIsExcelImportModalVisible(true)}
                      style={{ borderRadius: 0 }}
                    >
                      Excel Import
                    </Button>
                  </>
                )}
                <Button
                  type="outline"
                  icon={<IconDownload />}
                  onClick={() => handleExportExcel()}
                  style={{ borderRadius: 0 }}
                >
                  Eksport
                </Button>
              </Space>
            </div>
          </Card>


          {/* Floating Batch Actions Toolbar */}
          {selectedRowKeys.length > 0 && (
            <Card
              style={{
                background: '#E8F3FF',
                border: '1px solid #94BFFF',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(22, 93, 255, 0.15)',
              }}
              bodyStyle={{ padding: '12px 20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <Space size="medium">
                  <Badge count={selectedRowKeys.length} />
                  <b style={{ color: '#165DFF' }}>ta uskuna belgilandi</b>
                </Space>
                <Space size="small">
                  <Button
                    type="outline"
                    icon={<IconPrinter />}
                    onClick={() => setIsBatchPrintModalVisible(true)}
                  >
                    Ommaviy QR Stikerlar ({selectedRowKeys.length})
                  </Button>
                  <Button
                    type="secondary"
                    icon={<IconDownload />}
                    onClick={() => handleExportExcel(selectedAssetsList)}
                  >
                    Tanlanganlarni Excelga
                  </Button>
                  <Button
                    type="text"
                    icon={<IconClose />}
                    onClick={() => setSelectedRowKeys([])}
                  >
                    Bekor qilish
                  </Button>
                </Space>
              </div>
            </Card>
          )}

          {/* Main Assets Table with row selection & clickable rows */}
          <StandardTable
            rowKey="id"
            loading={isLoading}
            data={filteredAssets}
            scrollX={1360}
            emptyText="Qidiruv bo‘yicha asosiy vosita topilmadi"
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              checkboxProps: (record) => {
                const isWrittenOff = record.status === 'WRITTEN_OFF';
                // SuperAdmin barcha aktivlarni tanlay oladi (QR stiker, Excel eksport, xonaga ko'chirish uchun).
                // Oddiy xodim esa faqat o'ziga biriktirilgan aktivlarni tanlaydi.
                const isNotMine = !isSuperAdmin && record.responsibleUserId !== user?.id;
                return {
                  disabled: isWrittenOff || isNotMine,
                };
              },
            }}
            onRowClick={(record) => handleOpenDetail(record)}
            columns={[
              {
                title: 'Inventar №',
                dataIndex: 'inventoryNumber',
                width: 130,
                render: (inv: string) => (
                  <span style={{ color: '#165DFF', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {inv}
                  </span>
                ),
              },
              {
                title: 'Jihoz Nomi',
                dataIndex: 'itemName',
                minWidth: 260,
                render: (name: string, record: ItemInstance) => {
                  const visual = getAssetCategoryVisual(record.categoryName);
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
                title: 'Joylashuvi & Javobgar Shaxs',
                dataIndex: 'roomName',
                width: 220,
                render: (room: string, record: ItemInstance) => (
                  <div style={{ lineHeight: 1.35 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>
                      {room || 'Markaziy ombor'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                      Mas’ul: <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>{record.responsibleUserName || 'Belgilanmagan'}</span>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Balans & Qoldiq Qiymat',
                width: 165,
                sorter: (a: ItemInstance, b: ItemInstance) => (a.purchasePrice || 0) - (b.purchasePrice || 0),
                render: (_, record: ItemInstance) => {
                  const bookVal = record.currentBookValue !== undefined ? record.currentBookValue : record.purchasePrice || 0;
                  return (
                    <div style={{ lineHeight: 1.35 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>
                        {record.purchasePrice ? record.purchasePrice.toLocaleString('uz-UZ') + ' so‘m' : '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#00B42A', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2 }}>
                        Qoldiq: {Number(bookVal).toLocaleString('uz-UZ')} so‘m
                      </div>
                    </div>
                  );
                },
              },
              {
                title: 'Moliyalashtirish',
                dataIndex: 'fundingSource',
                width: 125,
                render: (funding: string) => {
                  let color = 'arcoblue';
                  let label = 'Byudjet';
                  if (funding === 'KONTRAKT_RIVOJLANTIRISH') {
                    color = 'green';
                    label = 'Kontrakt';
                  } else if (funding === 'GRANT') {
                    color = 'orange';
                    label = 'Grant';
                  }
                  return (
                    <Tag color={color} size="small" style={{ borderRadius: 0, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>
                      {label}
                    </Tag>
                  );
                },
              },
              {
                title: 'Holati',
                dataIndex: 'status',
                width: 130,
                render: (status: AssetStatus) => (
                  <StatusTag domain="asset" status={status} mode="badge" />
                ),
              },
              {
                title: 'Amallar',
                width: 310,
                fixed: 'right' as const,
                render: (_, record: ItemInstance) => (
                  <TableActions
                    onDelete={
                      canManageAssets && record.status !== 'WRITTEN_OFF'
                        ? () => {
                            setActionAsset(record);
                            setIsWriteOffModalVisible(true);
                          }
                        : undefined
                    }
                    deleteTooltip="Hisobdan chiqarish (OS-4)"
                    deleteConfirmTitle="Ushbu vositani hisobdan chiqarish (OS-4) komissiyasiga yuborilsinmi?"
                    deleteOkText="Ha, yuborilsin"
                    rightPadding={16}
                    gap={6}
                  >
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconEye />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(record);
                      }}
                      style={{ borderRadius: 0 }}
                    >
                      Pasport
                    </Button>
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconQrcode />}
                      onClick={(e) => handleOpenQr(record, e)}
                      style={{ borderRadius: 0 }}
                    >
                      QR
                    </Button>
                    {canManageAssets && record.status !== 'WRITTEN_OFF' && (
                      <>
                        <Tooltip
                          content={
                            record.responsibleUserId === user?.id
                              ? 'Javobgarlikni topshirish (OS-1)'
                              : 'Faqat o‘zingizga biriktirilgan vositani topshira olasiz'
                          }
                        >
                          <Button
                            size="small"
                            type="secondary"
                            icon={
                              <IconSwap
                                style={{
                                  color: record.responsibleUserId === user?.id ? '#00B42A' : '#C9CDD4',
                                }}
                              />
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (record.responsibleUserId !== user?.id) {
                                Message.error('Ushbu aktiv sizga biriktirilmagan! Faqat o‘zingizga tegishli vositalarni topshira olasiz.');
                                return;
                              }
                              setWizardInitialActionType('TRANSFER_TO_MOL');
                              setWizardAssets([record]);
                              setIsAssetHandoverWizardVisible(true);
                            }}
                            disabled={record.responsibleUserId !== user?.id}
                            style={{ borderRadius: 0, fontWeight: 500 }}
                          >
                            Topshirish
                          </Button>
                        </Tooltip>
                        <Tooltip
                          content={
                            record.responsibleUserId === user?.id
                              ? 'Omborga qaytarish (OS-1)'
                              : 'Faqat o‘zingizga biriktirilgan vositani omborga qaytara olasiz'
                          }
                        >
                          <Button
                            size="small"
                            type="secondary"
                            icon={
                              <IconUndo
                                style={{
                                  color: record.responsibleUserId === user?.id ? '#165DFF' : '#C9CDD4',
                                }}
                              />
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (record.responsibleUserId !== user?.id) {
                                Message.error('Ushbu aktiv sizga biriktirilmagan! Faqat o‘zingizga tegishli vositani omborga qaytara olasiz.');
                                return;
                              }
                              setWizardInitialActionType('RETURN_TO_WAREHOUSE');
                              setWizardAssets([record]);
                              setIsAssetHandoverWizardVisible(true);
                            }}
                            disabled={record.responsibleUserId !== user?.id}
                            style={{ borderRadius: 0 }}
                          />
                        </Tooltip>
                        <Tooltip content="Ta’mirga yuborish">
                          <Button
                            size="small"
                            type="secondary"
                            icon={<IconTool />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionAsset(record);
                              setIsRepairModalVisible(true);
                            }}
                            style={{ borderRadius: 0 }}
                          />
                        </Tooltip>
                      </>
                    )}
                  </TableActions>
                ),
              },
            ]}
          />
        </>
      )}

      {/* ARCO DRAWER: ASSET DETAIL PASSPORT */}
      <Drawer
        width={540}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedAsset?.inventoryNumber}</span>
            {selectedAsset && (
              <StatusTag domain="asset" status={selectedAsset.status} />
            )}
          </div>
        }
        visible={isDetailDrawerVisible}
        onOk={() => setIsDetailDrawerVisible(false)}
        onCancel={() => setIsDetailDrawerVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button
              type="outline"
              icon={<IconPrinter />}
              onClick={() => {
                if (selectedAsset) handleOpenQr(selectedAsset);
              }}
            >
              Stikerni Chop Etish
            </Button>
            <Button type="primary" onClick={() => setIsDetailDrawerVisible(false)}>
              Yopish
            </Button>
          </div>
        }
      >
        {selectedAsset && (
          <Tabs defaultActiveTab="info">
            <TabPane key="info" title="Asosiy Pasport">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    { label: 'Jihoz Nomi', value: selectedAsset.itemName },
                    { label: 'Model / Modifikatsiya', value: selectedAsset.itemModel || 'Standart' },
                    { label: 'Kategoriya', value: selectedAsset.categoryName || 'IT jihozlari' },
                    { label: 'Seriya Raqami (SN)', value: selectedAsset.serialNumber || 'Mavjud emas' },
                    { label: 'Hozirgi Xonasi', value: selectedAsset.roomName || 'Markaziy Ombor' },
                    { label: 'Moddiy Javobgar Shaxs', value: selectedAsset.responsibleUserName || 'Bosh omborchi' },
                    { label: 'Xarid Sanasi', value: selectedAsset.purchaseDate || '2025-09-15' },
                    {
                      label: 'Balans Qiymati',
                      value: `${selectedAsset.purchasePrice?.toLocaleString('uz-UZ')} so‘m`,
                    },
                    { label: 'QR Identifikator', value: selectedAsset.qrCode },
                  ]}
                />
              </div>
            </TabPane>

            <TabPane key="depreciation" title="Amortizatsiya (Qoldiq Qiymat)">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    {
                      label: 'Boshlang‘ich Balans Narxi',
                      value: `${(selectedAsset.purchasePrice || 0).toLocaleString('uz-UZ')} so‘m`,
                    },
                    {
                      label: 'OTM Yillik Eskirish Normasi',
                      value: `${Math.round(((selectedAsset as any).depreciationRate || 20) * 100) / 100}% (yillik)`,
                    },
                    {
                      label: 'Yig‘ilgan Eskirish (Amortizatsiya)',
                      value: (
                        <span style={{ color: '#F53F3F', fontWeight: 600 }}>
                          {Number(
                            assetDepHistory?.asset?.accumulatedDepreciation ??
                              (selectedAsset as any).accumulatedDepreciation ??
                              0,
                          ).toLocaleString('uz-UZ')}{' '}
                          so‘m
                        </span>
                      ),
                    },
                    {
                      label: 'Joriy Qoldiq Qiymat (Book Value)',
                      value: (
                        <span style={{ color: '#00B42A', fontWeight: 700, fontSize: 15 }}>
                          {Number(
                            assetDepHistory?.asset?.currentBookValue ??
                              (selectedAsset as any).currentBookValue ??
                              selectedAsset.purchasePrice ??
                              0,
                          ).toLocaleString('uz-UZ')}{' '}
                          so‘m
                        </span>
                      ),
                    },
                    {
                      label: 'Oxirgi Hisoblangan Sana',
                      value:
                        assetDepHistory?.asset?.lastDepreciatedAt?.substring(0, 10) ||
                        (selectedAsset as any).lastDepreciatedAt?.substring(0, 10) ||
                        'Hali hisoblanmagan',
                    },
                    {
                      label: 'Moliyalashtirish Manbasi',
                      value: (selectedAsset as any).fundingSource || 'BYUDJET',
                    },
                  ]}
                />

                {assetDepHistory?.history && assetDepHistory.history.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                      Oylar Bo‘yicha Amortizatsiya Jurnali:
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F2F3F5', borderBottom: '1px solid #C9CDD4' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Davr</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Partiya</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Oylik Eskirish</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qoldiq Qiymat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetDepHistory.history.map((h) => (
                          <tr key={h.id} style={{ borderBottom: '1px solid #E5E6EB' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{h.period}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <Tag size="small">{h.batchNumber}</Tag>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#F53F3F', fontWeight: 600 }}>
                              -{h.depreciationAmount.toLocaleString('uz-UZ')} so‘m
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#00B42A', fontWeight: 600 }}>
                              {h.closingBookValue.toLocaleString('uz-UZ')} so‘m
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabPane>

            <TabPane key="timeline" title="Harakatlar Tarixi (Audit)">
              <div style={{ padding: '16px 8px' }}>
                <Timeline>
                  {selectedAsset.history && selectedAsset.history.length > 0 ? (
                    selectedAsset.history.map((h, idx) => (
                      <TimelineItem key={idx} dotColor="#165DFF">
                        <div style={{ fontWeight: 600 }}>{h.action}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          {h.date} • Mas’ul: {h.user}
                        </div>
                      </TimelineItem>
                    ))
                  ) : (
                    <>
                      <TimelineItem dotColor="#00B42A">
                        <div style={{ fontWeight: 600 }}>Joriy xonaga biriktirilgan</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          {selectedAsset.roomName} • Mas’ul: {selectedAsset.responsibleUserName}
                        </div>
                      </TimelineItem>
                      <TimelineItem dotColor="#165DFF">
                        <div style={{ fontWeight: 600 }}>Markaziy omborga qabul qilingan</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          {selectedAsset.purchaseDate || '2025-09-15'} • Shartnoma asosida
                        </div>
                      </TimelineItem>
                    </>
                  )}
                </Timeline>
              </div>
            </TabPane>

            <TabPane key="qr" title="QR Pasport">
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <QRCodeSVG value={selectedAsset.qrCode} size={160} level="H" />
                <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                  {selectedAsset.inventoryNumber}
                </div>
                <div style={{ color: 'var(--color-text-3)', fontSize: 12 }}>
                  Telefon kamerasi yoki skaner orqali avtomatik aniqlanadi
                </div>
              </div>
            </TabPane>
          </Tabs>
        )}
      </Drawer>

      {/* SINGLE QR PRINT MODAL */}
      <Modal
        title="Uskunaning Unikal QR-Kodi va Inventar Stikeri"
        visible={isQrModalVisible}
        onCancel={() => setIsQrModalVisible(false)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<IconPrinter />}
              loading={isPrintingQr}
              disabled={!reprintReason.trim()}
              onClick={handlePrintSingleQr}
            >
              Chop Etish
            </Button>
            <Button onClick={() => setIsQrModalVisible(false)}>Yopish</Button>
          </Space>
        }
      >
        {selectedAsset && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div
              className="print-area"
              style={{
                display: 'inline-block',
                border: '2px dashed #165DFF',
                borderRadius: '12px',
                padding: '20px',
                background: '#fafafa',
                color: '#1d2129',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#165DFF', letterSpacing: '0.5px' }}>
                UNIVERSITET MODDIY AKTIVI
              </div>
              <div style={{ margin: '14px 0' }}>
                <QRCodeSVG value={selectedAsset.qrCode} size={150} level="H" />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#000' }}>
                {selectedAsset.inventoryNumber}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginTop: 4 }}>
                {selectedAsset.itemName}
              </div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: 2 }}>
                Xona: {selectedAsset.roomName || 'Omborxona'} | SN: {selectedAsset.serialNumber || 'Noma’lum'}
              </div>
            </div>

            {selectedAsset.reprintCount && selectedAsset.reprintCount > 0 ? (
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#fff7e8',
                  border: '1px solid #ff7d00',
                  padding: '8px 12px',
                  borderRadius: 4,
                  color: '#d46b08',
                  fontSize: 12,
                  textAlign: 'left',
                }}
              >
                <IconExclamationCircle style={{ fontSize: 16, flexShrink: 0 }} />
                <div>
                  <div>Ushbu stiker avval <b>{selectedAsset.reprintCount} marta</b> qayta chop etilgan.</div>
                  {selectedAsset.lastReprintReason && (
                    <div style={{ fontSize: 11, color: '#86909c', marginTop: 2 }}>
                      Oxirgi sabab: {selectedAsset.lastReprintReason}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 16, textAlign: 'left', background: '#f7f8fa', padding: 12, borderRadius: 4, border: '1px solid #e5e6eb' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#4e5969' }}>
                QR-stikerni chop etish sababi (Audit jurnali uchun majburiy):
              </div>
              <Input
                value={reprintReason}
                onChange={(val) => setReprintReason(val)}
                placeholder="Masalan: Eski stiker shikastlangan yoki xiralashgan"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* BATCH PRINT MODAL (SHEET OF MULTIPLE STICKERS) */}
      <Modal
        style={{ width: 720 }}
        title={`Ommaviy QR Stikerlar Varaqasi (${selectedAssetsList.length} dona)`}
        visible={isBatchPrintModalVisible}
        onCancel={() => setIsBatchPrintModalVisible(false)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<IconPrinter />}
              loading={isBatchPrinting}
              disabled={!batchReprintReason.trim()}
              onClick={handlePrintBatchQr}
            >
              Barchasini Chop Etish (A4 Stiker)
            </Button>
            <Button onClick={() => setIsBatchPrintModalVisible(false)}>Yopish</Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16, background: '#f7f8fa', padding: 12, borderRadius: 4, border: '1px solid #e5e6eb' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#4e5969' }}>
            Ommaviy chop etish sababi (Audit jurnali uchun majburiy):
          </div>
          <Input
            value={batchReprintReason}
            onChange={(val) => setBatchReprintReason(val)}
            placeholder="Masalan: Ommaviy yangilash yoki yangi qabul qilingan uskunalar"
          />
        </div>
        <div style={{ maxHeight: 450, overflowY: 'auto', padding: 8 }}>
          <div
            className="print-area"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {selectedAssetsList.map((asset) => (
              <div
                key={asset.id}
                style={{
                  border: '1px solid #c9cdd4',
                  borderRadius: 8,
                  padding: 12,
                  textAlign: 'center',
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: '#165DFF' }}>UNIVERSITET AKTIVI</div>
                <div style={{ margin: '8px 0' }}>
                  <QRCodeSVG value={asset.qrCode} size={90} level="M" />
                </div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{asset.inventoryNumber}</div>
                <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {asset.itemName}
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>{asset.roomName || 'Ombor'}</div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* RASMIY AKT OS-1 MODAL */}
      {selectedTransferDoc && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType="KIRIM"
          entityId={selectedTransferDoc.id}
          docNumber={selectedTransferDoc.documentNumber || `OS1-${selectedTransferDoc.id.substring(0, 8).toUpperCase()}`}
          date={selectedTransferDoc.acceptedAt || selectedTransferDoc.createdAt}
          sourceLocation={selectedTransferDoc.fromRoomName}
          targetLocation={selectedTransferDoc.toRoomName}
          senderName={selectedTransferDoc.senderName}
          receiverName={selectedTransferDoc.receiverName}
          items={[
            {
              inventoryNumber: selectedTransferDoc.inventoryNumber,
              name: selectedTransferDoc.assetName,
              model: selectedTransferDoc.assetModel,
              quantity: 1,
              unit: 'DONA',
            },
          ]}
          reason={selectedTransferDoc.note || 'Kafedra moddiy javobgarligiga qabul qilish'}
        />
      )}


      {/* EXCEL IMPORT MODAL */}
      <ExcelImportModal
        visible={isExcelImportModalVisible}
        onClose={() => setIsExcelImportModalVisible(false)}
      />


      {/* REPAIR REQUEST MODAL */}
      <CreateRepairModal
        visible={isRepairModalVisible}
        onClose={() => {
          setIsRepairModalVisible(false);
          setActionAsset(null);
        }}
        selectedAsset={actionAsset}
      />

      {/* WRITE-OFF (OS-4) MODAL */}
      <CreateWriteOffModal
        visible={isWriteOffModalVisible}
        onClose={() => {
          setIsWriteOffModalVisible(false);
          setActionAsset(null);
        }}
        selectedAsset={actionAsset}
      />

      {/* ASSET HANDOVER WIZARD MODAL (MOL WORKSPACE) */}
      <AssetHandoverWizardModal
        visible={isAssetHandoverWizardVisible}
        onClose={() => {
          setIsAssetHandoverWizardVisible(false);
          setWizardAssets([]);
        }}
        selectedAssets={wizardAssets}
        initialActionType={wizardInitialActionType}
        onSuccess={() => {
          setSelectedRowKeys([]);
          setWizardAssets([]);
          refetchAssets();
        }}
      />
    </div>
  );
};


