import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
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
  IconUserGroup,
  IconTool,
  IconDesktop,
  IconStorage,
} from '@arco-design/web-react/icon';
import { QRCodeSVG } from 'qrcode.react';
import { useAssetsQuery, useTransfersQuery, TransferItem } from '../../hooks/useAssetsQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useAuthStore } from '../../store/authStore';
import type { ItemInstance, AssetStatus } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { useTranslation } from 'react-i18next';
import { ExcelImportModal } from '../../components/Warehouse/ExcelImportModal';
import { PageTabs } from '../../components/Common/PageTabs';
import { ReturnAssetModal } from '../../components/Assets/ReturnAssetModal';
import { MassMolTransferModal } from '../../components/Assets/MassMolTransferModal';
import { CreateRepairModal } from '../../components/Repairs/CreateRepairModal';
import { CreateWriteOffModal } from '../../components/WriteOff/CreateWriteOffModal';


const FormItem = Form.Item;
const TabPane = Tabs.TabPane;
const TimelineItem = Timeline.Item;
const { Text } = Typography;

export const AssetsPage: React.FC = () => {
  const {
    assets,
    isLoading,
    createAsset,
    transferAsset,
    batchTransfer,
    writeOffAsset,
  } = useAssetsQuery();
  const { transfers, isLoading: isTransfersLoading, respondTransfer } = useTransfersQuery();
  const { rooms } = useOrganizationQuery();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [searchParams] = useSearchParams();

  const [activeMainTab, setActiveMainTab] = useState<'ASSETS' | 'TRANSFERS'>('ASSETS');
  const [selectedTransferDoc, setSelectedTransferDoc] = useState<TransferItem | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);

  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [quickCategory, setQuickCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchText(q);
    }
    const action = searchParams.get('action');
    if (action === 'create') {
      setIsAddModalVisible(true);
    }
  }, [searchParams]);

  // Selected rows for batch actions
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);

  // Modals and Drawer state
  const [selectedAsset, setSelectedAsset] = useState<ItemInstance | null>(null);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isBatchPrintModalVisible, setIsBatchPrintModalVisible] = useState(false);
  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
  const [isBatchTransferModalVisible, setIsBatchTransferModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isExcelImportModalVisible, setIsExcelImportModalVisible] = useState(false);
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [isMassMolModalVisible, setIsMassMolModalVisible] = useState(false);
  const [isRepairModalVisible, setIsRepairModalVisible] = useState(false);
  const [isWriteOffModalVisible, setIsWriteOffModalVisible] = useState(false);
  const [actionAsset, setActionAsset] = useState<ItemInstance | null>(null);

  const [transferForm] = Form.useForm();

  const [batchTransferForm] = Form.useForm();
  const [addForm] = Form.useForm();

  // Filtered assets
  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
      a.inventoryNumber.toLowerCase().includes(searchText.toLowerCase()) ||
      (a.roomName && a.roomName.toLowerCase().includes(searchText.toLowerCase())) ||
      (a.serialNumber && a.serialNumber.toLowerCase().includes(searchText.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesCat =
      quickCategory === 'ALL' ||
      (quickCategory === 'IT' && a.categoryName?.includes('IT')) ||
      (quickCategory === 'MEBEL' && a.categoryName?.includes('Mebel')) ||
      (quickCategory === 'NEW' && a.status === 'NEW');

    return matchesSearch && matchesStatus && matchesCat;
  });

  const selectedAssetsList = assets.filter((a) => selectedRowKeys.includes(a.id));

  const handleOpenDetail = (asset: ItemInstance) => {
    setSelectedAsset(asset);
    setIsDetailDrawerVisible(true);
  };

  const handleOpenQr = (asset: ItemInstance, e?: any) => {
    e?.stopPropagation?.();
    setSelectedAsset(asset);
    setIsQrModalVisible(true);
  };

  const handleOpenTransfer = (asset: ItemInstance, e?: any) => {
    e?.stopPropagation?.();
    setSelectedAsset(asset);
    transferForm.setFieldsValue({
      toRoomId: asset.roomId,
      note: 'Rejali qayta taqsimlash',
    });
    setIsTransferModalVisible(true);
  };

  const handleTransferSubmit = async () => {
    try {
      const values = await transferForm.validate();
      if (!selectedAsset) return;
      await transferAsset({
        id: selectedAsset.id,
        toRoomId: values.toRoomId,
        note: values.note,
      });
      setIsTransferModalVisible(false);
      setActiveMainTab('TRANSFERS');
    } catch {
      // validation error handled by Arco
    }
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

  const handleBatchTransferSubmit = async () => {
    try {
      const values = await batchTransferForm.validate();
      await batchTransfer({
        assetIds: selectedRowKeys as string[],
        toRoomId: values.toRoomId,
        note: values.note,
      });
      setIsBatchTransferModalVisible(false);
      setSelectedRowKeys([]);
    } catch {
      // validation error handled by Arco
    }
  };

  const handleWriteOff = async (asset: ItemInstance, e?: any) => {
    e?.stopPropagation?.();
    await writeOffAsset({
      id: asset.id,
      reason: 'Komissiya xulosasiga ko‘ra texnik yaroqsiz deb topildi',
    });
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validate();
      await createAsset({
        itemName: values.itemName,
        model: values.model,
        categoryName: values.categoryName,
        inventoryNumber: values.inventoryNumber,
        serialNumber: values.serialNumber,
        purchasePrice: Number(values.purchasePrice) || 0,
        roomId: values.roomId,
      });
      setIsAddModalVisible(false);
      addForm.resetFields();
    } catch {
      // validation error handled by Arco
    }
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
      'Holati': a.status,
      'Balans Qiymati (so‘m)': a.purchasePrice || 0,
      'Xarid Sanasi': a.purchaseDate || '',
    }));
    exportToExcel(formatted, 'Asosiy_Vositalar_Reestri', 'Asosiy Vositalar');
    Message.success('Excel fayl muvaffaqiyatli yuklab olindi!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        <Card className="uwms-card" bodyStyle={{ padding: 0 }}>
          <Table
            rowKey="id"
            loading={isTransfersLoading}
            data={transfers}
            scroll={{ x: 1150 }}
            pagination={{
              pageSize: 10,
              sizeCanChange: true,
              sizeOptions: [10, 20, 50, 100],
              showTotal: (total, range) => {
                if (!total || total === 0) return '0/0';
                const to = range ? Math.min(range[1], total) : total;
                return `${to}/${total}`;
              },
            }}
            columns={[
              {
                title: 'Dalolatnoma №',
                dataIndex: 'id',
                width: 150,
                render: (id: string) => <b style={{ color: '#165DFF' }}>TRF-{id.substring(0, 8).toUpperCase()}</b>,
              },
              {
                title: 'Asosiy Vosita',
                minWidth: 240,
                render: (_, r: TransferItem) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.assetName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      Inv: <b>{r.inventoryNumber}</b> {r.assetModel ? `• ${r.assetModel}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                title: 'Qayerdan / Qayerga',
                minWidth: 220,
                render: (_, r: TransferItem) => (
                  <div>
                    <div style={{ fontSize: 12 }}>Chiqish: {r.fromRoomName}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#165DFF' }}>
                      Kirish: {r.toRoomName}
                    </div>
                  </div>
                ),
              },
              {
                title: 'Topshiruvchi / Mas’ul (MOL)',
                minWidth: 220,
                render: (_, r: TransferItem) => (
                  <div>
                    <div style={{ fontSize: 12 }}>Topshiruvchi: {r.senderName}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Qabul qiluvchi: {r.receiverName}</div>
                  </div>
                ),
              },
              {
                title: 'Holat',
                dataIndex: 'status',
                width: 140,
                render: (status: string) => {
                  if (status === 'PENDING') return <Badge status="warning" text="Kafedra qabuli kutilmoqda" />;
                  if (status === 'ACCEPTED') return <Badge status="success" text="Qabul qilindi va biriktirildi" />;
                  if (status === 'REJECTED') return <Badge status="error" text="Rad etildi" />;
                  return <Tag>{status}</Tag>;
                },
              },
              {
                title: 'Yuborilgan Sana',
                dataIndex: 'createdAt',
                width: 140,
              },
              {
                title: 'Amallar',
                width: 170,
                fixed: 'right' as const,
                render: (_, r: TransferItem) => {
                  const canAccept =
                    r.status === 'PENDING' &&
                    (user?.role === 'MOL' || user?.role === 'SUPER_ADMIN' || user?.id === r.receiverId);

                  return (
                    <Space size="small">
                      {canAccept && (
                        <Button
                          size="small"
                          type="primary"
                          status="success"
                          icon={<IconCheckCircle />}
                          onClick={(e) => handleAcceptTransfer(r, e)}
                        >
                          Qabul Qilish
                        </Button>
                      )}
                      {canAccept && (
                        <Button
                          size="small"
                          type="text"
                          status="danger"
                          icon={<IconClose />}
                          onClick={(e) => handleRejectTransfer(r, e)}
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
                        >
                          Rasmiy Akt (OS-1)
                        </Button>
                      )}
                    </Space>
                  );
                },
              },
            ]}
          />
        </Card>
      )}

      {/* ASSETS TAB CONTENT */}
      {activeMainTab === 'ASSETS' && (
        <>
          {/* Top Filter and Controls Bar */}
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space size="medium" wrap>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Inventar №, Nomi, Seriya № yoki Xona..."
                  style={{ width: 280 }}
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
                <Radio.Group
                  type="button"
                  value={quickCategory}
                  onChange={setQuickCategory}
                >
                  <Radio value="ALL">Barchasi</Radio>
                  <Radio value="IT">
                    <IconDesktop style={{ marginRight: 4 }} /> IT & Kompyuter
                  </Radio>
                  <Radio value="MEBEL">
                    <IconStorage style={{ marginRight: 4 }} /> Mebel
                  </Radio>
                  <Radio value="NEW">
                    <IconCheckCircle style={{ marginRight: 4 }} /> Zaxirada (Yangi)
                  </Radio>
                </Radio.Group>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 170 }}
                >
                  <Select.Option value="ALL">Barcha holatlar</Select.Option>
                  <Select.Option value="IN_USE">Foydalanishda</Select.Option>
                  <Select.Option value="NEW">Yangi (Omborda)</Select.Option>
                  <Select.Option value="IN_REPAIR">Ta’mirda</Select.Option>
                  <Select.Option value="WRITTEN_OFF">Hisobdan chiqarilgan</Select.Option>
                </Select>
              </Space>

              <Space size="small" wrap>
                <Button
                  type="outline"
                  icon={<IconUndo />}
                  onClick={() => {
                    setActionAsset(null);
                    setIsReturnModalVisible(true);
                  }}
                  style={{ borderRadius: 0, color: '#165DFF', borderColor: '#165DFF' }}
                >
                  Omborga Qaytarish
                </Button>
                <Button
                  type="outline"
                  icon={<IconUserGroup />}
                  onClick={() => setIsMassMolModalVisible(true)}
                  style={{ borderRadius: 0, color: '#00B42A', borderColor: '#00B42A' }}
                >
                  MOL Yalpi Almashinuvi
                </Button>
                <Button
                  type="outline"
                  icon={<IconUpload />}
                  onClick={() => setIsExcelImportModalVisible(true)}
                  style={{ borderRadius: 0 }}
                >
                  Excel Import
                </Button>
                <Button
                  type="outline"
                  icon={<IconDownload />}
                  onClick={() => handleExportExcel()}
                  style={{ borderRadius: 0 }}
                >
                  Eksport
                </Button>
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => {
                    addForm.setFieldsValue({
                      categoryName: 'Kompyuter va IT uskunalari',
                    });
                    setIsAddModalVisible(true);
                  }}
                  style={{ borderRadius: 0 }}
                >
                  Yangi Vosita
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
                    type="primary"
                    icon={<IconSwap />}
                    onClick={() => {
                      batchTransferForm.resetFields();
                      setIsBatchTransferModalVisible(true);
                    }}
                  >
                    Ommaviy Xonaga Ko‘chirish
                  </Button>
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
          <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              loading={isLoading}
              data={filteredAssets}
              scroll={{ x: 1540 }}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              pagination={{
                pageSize: 10,
                sizeCanChange: true,
                sizeOptions: [10, 20, 50, 100],
                showTotal: (total, range) => {
                  if (!total || total === 0) return '0/0';
                  const to = range ? Math.min(range[1], total) : total;
                  return `${to}/${total}`;
                },
              }}
              onRow={(record) => ({
                onClick: () => handleOpenDetail(record),
                style: { cursor: 'pointer' },
              })}
              columns={[
                {
                  title: 'Inventar №',
                  dataIndex: 'inventoryNumber',
                  width: 150,
                  render: (inv: string, record: ItemInstance) => (
                    <div>
                      <b style={{ color: '#165DFF' }}>{inv}</b>
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                        SN: {record.serialNumber || 'Noma’lum'}
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'Jihoz Nomi va Modeli',
                  dataIndex: 'itemName',
                  width: 240,
                  render: (name: string, record: ItemInstance) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{record.itemModel}</div>
                      <Tag size="small" style={{ marginTop: 4 }}>{record.categoryName}</Tag>
                    </div>
                  ),
                },
                {
                  title: 'Joylashuvi & Javobgar Shaxs',
                  dataIndex: 'roomName',
                  width: 220,
                  render: (room: string, record: ItemInstance) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{room || 'Markaziy ombor'}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                        Mas’ul: <b>{record.responsibleUserName || 'Belgilanmagan'}</b>
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'Balans Narxi',
                  dataIndex: 'purchasePrice',
                  width: 150,
                  sorter: (a: ItemInstance, b: ItemInstance) => (a.purchasePrice || 0) - (b.purchasePrice || 0),
                  render: (price: number) => (
                    <span style={{ fontWeight: 600 }}>
                      {price ? price.toLocaleString('uz-UZ') + ' so‘m' : '—'}
                    </span>
                  ),
                },
                {
                  title: 'Amortizatsiya & Qoldiq',
                  width: 180,
                  render: (_, record: any) => {
                    const bookVal = record.currentBookValue !== undefined ? record.currentBookValue : record.purchasePrice || 0;
                    const depAcc = record.accumulatedDepreciation || 0;
                    const rate = Math.round((record.depreciationRate || 0.15) * 100);
                    return (
                      <div>
                        <div style={{ fontWeight: 600, color: '#00B42A' }}>
                          {Number(bookVal).toLocaleString('uz-UZ')} so‘m
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          Eskirish: {Number(depAcc).toLocaleString('uz-UZ')} so‘m ({rate}%/yil)
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: 'Moliyalashtirish',
                  dataIndex: 'fundingSource',
                  width: 140,
                  render: (funding: string) => {
                    const color =
                      funding === 'BYUDJET'
                        ? 'cyan'
                        : funding === 'KONTRAKT_RIVOJLANTIRISH'
                          ? 'purple'
                          : 'green';
                    return (
                      <Tag color={color} size="small" style={{ borderRadius: 0 }}>
                        {funding || 'BYUDJET'}
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Holati',
                  dataIndex: 'status',
                  width: 140,
                  render: (status: AssetStatus) => {
                    if (status === 'IN_USE') return <Badge status="success" text="Foydalanishda" />;
                    if (status === 'NEW') return <Badge status="processing" text="Yangi (Omborda)" />;
                    if (status === 'IN_REPAIR') return <Badge status="warning" text="Ta’mirda" />;
                    if (status === 'WRITTEN_OFF') return <Badge status="error" text="Spisanie" />;
                    return <Tag>{status}</Tag>;
                  },
                },

                {
                  title: 'Amallar',
                  width: 320,
                  fixed: 'right' as const,
                  render: (_, record: ItemInstance) => (
                    <div onClick={(e) => e.stopPropagation()} style={{ paddingRight: 8, display: 'flex', alignItems: 'center' }}>
                      <Space size={6}>
                        <Button
                          size="small"
                          type="outline"
                          icon={<IconEye />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(record);
                          }}
                        >
                          Pasport
                        </Button>
                        <Button
                          size="small"
                          type="outline"
                          icon={<IconQrcode />}
                          onClick={(e) => handleOpenQr(record, e)}
                        >
                          QR
                        </Button>
                        {record.status !== 'WRITTEN_OFF' && (
                          <>
                            <Button
                              size="small"
                              type="secondary"
                              icon={<IconSwap />}
                              title="Xonaga ko‘chirish"
                              onClick={(e) => handleOpenTransfer(record, e)}
                            />
                            <Button
                              size="small"
                              type="secondary"
                              icon={<IconUndo />}
                              title="Omborga qaytarish"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionAsset(record);
                                setIsReturnModalVisible(true);
                              }}
                            />
                            <Button
                              size="small"
                              type="secondary"
                              icon={<IconTool />}
                              title="Ta’mirga yuborish"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionAsset(record);
                                setIsRepairModalVisible(true);
                              }}
                            />
                            <Button
                              size="small"
                              type="text"
                              status="danger"
                              icon={<IconDelete />}
                              title="Hisobdan chiqarish (OS-4)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionAsset(record);
                                setIsWriteOffModalVisible(true);
                              }}
                            />
                          </>
                        )}
                      </Space>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}

      {/* ARCO DRAWER: ASSET DETAIL PASSPORT */}
      <Drawer
        width={540}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedAsset?.inventoryNumber}</span>
            {selectedAsset && (
              <Tag color={selectedAsset.status === 'IN_USE' ? 'green' : 'arcoblue'}>
                {selectedAsset.status === 'IN_USE' ? 'Foydalanishda' : 'Omborda'}
              </Tag>
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
                      value: `${Math.round(((selectedAsset as any).depreciationRate || 0.15) * 100)}% (yillik)`,
                    },
                    {
                      label: 'Foydalanish Davri',
                      value: `${(selectedAsset as any).ageYears || 0} yil`,
                    },
                    {
                      label: 'Yig‘ilgan Eskirish (Amortizatsiya)',
                      value: (
                        <span style={{ color: '#F53F3F', fontWeight: 600 }}>
                          {Number((selectedAsset as any).accumulatedDepreciation || 0).toLocaleString('uz-UZ')} so‘m
                        </span>
                      ),
                    },
                    {
                      label: 'Joriy Qoldiq Qiymat (Book Value)',
                      value: (
                        <span style={{ color: '#00B42A', fontWeight: 700, fontSize: 15 }}>
                          {Number(
                            (selectedAsset as any).currentBookValue !== undefined
                              ? (selectedAsset as any).currentBookValue
                              : selectedAsset.purchasePrice || 0,
                          ).toLocaleString('uz-UZ')}{' '}
                          so‘m
                        </span>
                      ),
                    },
                    {
                      label: 'Moliyalashtirish Manbasi',
                      value: (selectedAsset as any).fundingSource || 'BYUDJET',
                    },
                  ]}
                />
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
              onClick={() => window.print()}
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
            <Button type="primary" icon={<IconPrinter />} onClick={() => window.print()}>
              Barchasini Chop Etish (A4 Stiker)
            </Button>
            <Button onClick={() => setIsBatchPrintModalVisible(false)}>Yopish</Button>
          </Space>
        }
      >
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

      {/* BATCH TRANSFER MODAL */}
      <Modal
        title={`Ommaviy Xonaga Ko‘chirish: ${selectedRowKeys.length} ta uskuna`}
        visible={isBatchTransferModalVisible}
        onOk={handleBatchTransferSubmit}
        onCancel={() => setIsBatchTransferModalVisible(false)}
        okText="Ommaviy Ko‘chirishni Tasdiqlash"
        cancelText="Bekor qilish"
      >
        <Form form={batchTransferForm} layout="vertical">
          <FormItem label="Ko‘chirilayotgan vositalar soni">
            <Input value={`${selectedRowKeys.length} dona tanlangan uskuna`} disabled />
          </FormItem>
          <FormItem
            label="Yangi Xona / Laboratoriya"
            field="toRoomId"
            rules={[{ required: true, message: 'Iltimos, manzil xonasini tanlang!' }]}
          >
            <Select placeholder="Qaysi xonaga ko‘chiriladi?">
              {rooms.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.number}-xona: {r.name} (Mas’ul: {r.responsibleUserName})
                </Select.Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="Asos / Izoh" field="note">
            <Input.TextArea placeholder="Masalan: Kafedraga yangi kompyuter sinfini jihozlash uchun" />
          </FormItem>
        </Form>
      </Modal>

      {/* SINGLE TRANSFER MODAL */}
      <Modal
        title={`Uskunani Ko‘chirish: ${selectedAsset?.inventoryNumber}`}
        visible={isTransferModalVisible}
        onOk={handleTransferSubmit}
        onCancel={() => setIsTransferModalVisible(false)}
        okText="Ko‘chirish"
        cancelText="Bekor qilish"
      >
        <Form form={transferForm} layout="vertical">
          <FormItem label="Hozirgi joylashuvi">
            <Input value={selectedAsset?.roomName || 'Omborxona'} disabled />
          </FormItem>
          <FormItem
            label="Yangi Xona"
            field="toRoomId"
            rules={[{ required: true, message: 'Iltimos, xonani tanlang!' }]}
          >
            <Select placeholder="Qaysi xonaga ko‘chiriladi?">
              {rooms.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.number}-xona: {r.name} (Mas’ul: {r.responsibleUserName})
                </Select.Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="Ko‘chirish asosi / Izoh" field="note">
            <Input.TextArea placeholder="Masalan: Farmoyish yoki talabnoma asosida" />
          </FormItem>
        </Form>
      </Modal>

      {/* ADD ASSET MODAL */}
      <Modal
        title="Yangi Asosiy Vosita Qabul Qilish (Kirim)"
        visible={isAddModalVisible}
        onOk={handleAddSubmit}
        onCancel={() => setIsAddModalVisible(false)}
        okText="Kirim Qilish"
        cancelText="Bekor qilish"
      >
        <Form form={addForm} layout="vertical">
          <FormItem
            label="Inventar Raqami"
            field="inventoryNumber"
            rules={[{ required: true, message: 'Inventar raqami shart!' }]}
          >
            <Input placeholder="Masalan: INV-2026-006" />
          </FormItem>
          <FormItem
            label="Jihoz Nomi"
            field="itemName"
            rules={[{ required: true, message: 'Jihoz nomini kiriting!' }]}
          >
            <Input placeholder="Masalan: Kompyuter to‘plami, Proyektor, Laboratoriya stoli" />
          </FormItem>
          <FormItem label="Model / Tavsif" field="model">
            <Input placeholder="Masalan: HP ProBook 450 G9 (16GB, 512GB)" />
          </FormItem>
          <FormItem label="Kategoriya" field="categoryName">
            <Select>
              <Select.Option value="Kompyuter va IT uskunalari">Kompyuter va IT uskunalari</Select.Option>
              <Select.Option value="Laboratoriya jihozlari">Laboratoriya jihozlari</Select.Option>
              <Select.Option value="Mebel va ofis jihozlari">Mebel va ofis jihozlari</Select.Option>
            </Select>
          </FormItem>
          <FormItem label="Seriya Raqami (SN)" field="serialNumber">
            <Input placeholder="Zavod seriya raqami" />
          </FormItem>
          <FormItem label="Xarid Narxi (so‘mda)" field="purchasePrice">
            <Input placeholder="Masalan: 8500000" type="number" />
          </FormItem>
          <FormItem label="Dastlabki Joylashuvi (Xona)" field="roomId">
            <Select placeholder="Xonani tanlang (ixtiyoriy, tanlanmasa omborga o‘tadi)">
              {rooms.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.number}-xona: {r.name}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        </Form>
      </Modal>

      {/* RASMIY AKT OS-1 MODAL */}
      {selectedTransferDoc && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType="KIRIM"
          docNumber={`OS1-${selectedTransferDoc.id.substring(0, 8).toUpperCase()}`}
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

      {/* RETURN TO WAREHOUSE MODAL */}
      <ReturnAssetModal
        visible={isReturnModalVisible}
        onClose={() => {
          setIsReturnModalVisible(false);
          setActionAsset(null);
        }}
        selectedAsset={actionAsset}
      />

      {/* MASS MOL HANDOFF MODAL */}
      <MassMolTransferModal
        visible={isMassMolModalVisible}
        onClose={() => setIsMassMolModalVisible(false)}
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
    </div>
  );
};


