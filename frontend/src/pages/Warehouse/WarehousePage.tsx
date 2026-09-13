import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Tag,
  Modal,
  Form,
  InputNumber,
  Message,
  Progress,
  Badge,
  Grid,
  Alert,
  Empty,
  Tooltip,
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
  IconCheckCircle,
  IconPrinter,
  IconSafe,
  IconBranch,
  IconRight,
  IconTool,
  IconSync,
} from '@arco-design/web-react/icon';
import { useWarehouseQuery, useMovementsQuery, useWarehousesQuery } from '../../hooks/useWarehouseQuery';
import { useSuppliersQuery } from '../../hooks/useSuppliersQuery';
import type { StockItem } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { IngestStockModal } from '../../components/Warehouse/IngestStockModal';
import { SuppliersModal } from '../../components/Warehouse/SuppliersModal';
import { ExcelImportModal } from '../../components/Warehouse/ExcelImportModal';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { InterWarehouseTransferModal } from '../../components/Warehouse/InterWarehouseTransferModal';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';

const FormItem = Form.Item;
const { Row, Col } = Grid;

export const WarehousePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { stocks, isLoading, isFetching, isError, refetch, replenishStock } = useWarehouseQuery();
  const { movements, isLoading: isMovementsLoading, isFetching: isMovementsFetching } = useMovementsQuery();
  const { warehouses } = useWarehousesQuery();
  const { suppliers } = useSuppliersQuery();

  const [activeMainTab, setActiveMainTab] = useState<'STOCKS' | 'MOVEMENTS'>('STOCKS');
  const [searchText, setSearchText] = useState('');
  const [stockFilterTab, setStockFilterTab] = useState('ALL');
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [isReplenishModalVisible, setIsReplenishModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Modals state
  const [isIngestModalVisible, setIsIngestModalVisible] = useState(false);
  const [isSuppliersModalVisible, setIsSuppliersModalVisible] = useState(false);
  const [isExcelImportModalVisible, setIsExcelImportModalVisible] = useState(false);
  const [officialKirimDoc, setOfficialKirimDoc] = useState<any | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);

  // Handle URL Query Params from Universal Header or Dashboard quick action
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'incoming') {
      setIsIngestModalVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const itemId = searchParams.get('itemId');
    if (itemId && stocks.length > 0) {
      const match = stocks.find((s) => s.id === itemId || (s as any).itemId === itemId);
      if (match) {
        handleOpenReplenish(match);
      }
    }
  }, [searchParams, stocks]);

  // Visual thumbnail helper for consumable categories
  const getConsumableVisual = (categoryName?: string, itemName?: string) => {
    const text = `${categoryName || ''} ${itemName || ''}`.toLowerCase();
    if (
      text.includes('qog‘oz') ||
      text.includes('qogoz') ||
      text.includes('daftar') ||
      text.includes('fayl') ||
      text.includes('bloknot')
    ) {
      return { icon: <IconFile />, color: '#165DFF', bg: '#E8F3FF' };
    }
    if (
      text.includes('toner') ||
      text.includes('kartridj') ||
      text.includes('siyoh') ||
      text.includes('printer')
    ) {
      return { icon: <IconPrinter />, color: '#722ED1', bg: '#F5E8FF' };
    }
    if (
      text.includes('ruchka') ||
      text.includes('qalam') ||
      text.includes('kantselyariya') ||
      text.includes('skotch') ||
      text.includes('stepler')
    ) {
      return { icon: <IconTool />, color: '#FF7D00', bg: '#FFF7E8' };
    }
    if (
      text.includes('tozalash') ||
      text.includes('sovun') ||
      text.includes('antiseptik') ||
      text.includes('xo‘jalik') ||
      text.includes('xojalik')
    ) {
      return { icon: <IconSafe />, color: '#00B42A', bg: '#E8FFEA' };
    }
    return { icon: <IconArchive />, color: '#4E5969', bg: '#F2F3F5' };
  };

  const filteredStocks = stocks.filter((s) => {
    const matchesSearch =
      s.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.categoryName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.warehouseName.toLowerCase().includes(searchText.toLowerCase());

    const matchesTab =
      stockFilterTab === 'ALL' ||
      (stockFilterTab === 'LOW' && s.status === 'LOW') ||
      (stockFilterTab === 'NORMAL' && s.status === 'NORMAL');

    return matchesSearch && matchesTab;
  });

  const handleOpenReplenish = (stock: StockItem) => {
    setSelectedStock(stock);
    form.setFieldsValue({ amount: 10 });
    setIsReplenishModalVisible(true);
  };

  const handleReplenishSubmit = () => {
    form.validate().then(async (values) => {
      if (!selectedStock) return;
      await replenishStock({ stockId: selectedStock.id, amount: Number(values.amount) });
      setIsReplenishModalVisible(false);
    });
  };

  const handleExportExcel = () => {
    const formatted = stocks.map((s) => ({
      'Mahsulot Nomi': s.itemName,
      'Kategoriya': s.categoryName,
      'Omborxona': s.warehouseName,
      'O‘lchov Birligi': s.unit,
      'Mavjud Qoldiq': s.quantity,
      'Minimal Limit': s.minStockLimit,
      'Holati': s.status === 'LOW' ? 'Zaxira kam!' : 'Yetarli',
    }));
    exportToExcel(formatted, 'Ombor_Sarf_Tovarlari_Qoldigi', 'Qoldiqlar');
    Message.success('Ombor qoldiqlari Excelga muvaffaqiyatli yuklandi!');
  };

  // KPI Calculations
  const totalStockUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
  const lowStockItems = stocks.filter((s) => s.status === 'LOW');
  const normalStockCount = stocks.length - lowStockItems.length;
  const warehouseCount = warehouses.length > 0 ? warehouses.length : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ERROR STATE */}
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
          { key: 'MOVEMENTS', title: 'Ombor Harakatlari va Ko‘chirishlar (Audit Log)', count: movements.length },
        ]}
      />

      {/* TAB 1: STOCKS REGISTRY */}
      {activeMainTab === 'STOCKS' && (
        <>
          {/* Top Search & Action Bar */}
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space size="medium" wrap>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Sarf mahsulotini qidirish (Qog‘oz, Toner, Ruchka...)"
                  style={{ width: 300, borderRadius: 0 }}
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
                    Kam Qolganlar ({lowStockItems.length})
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
              </Space>

              <Space size="small" wrap>
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => setIsIngestModalVisible(true)}
                  style={{ borderRadius: 0, fontWeight: 600 }}
                >
                  Ta’minotchidan Kirim (OS-1)
                </Button>
                <Button
                  type="outline"
                  icon={<IconSwap />}
                  onClick={() => setIsTransferModalVisible(true)}
                  style={{ borderRadius: 0, color: '#FF7D00', borderColor: '#FF7D00' }}
                >
                  Omborlararo Ko‘chirish
                </Button>
                <Button
                  type="outline"
                  icon={<IconUserGroup />}
                  onClick={() => setIsSuppliersModalVisible(true)}
                  style={{ borderRadius: 0 }}
                >
                  Ta’minotchilar ({suppliers.length})
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
                  icon={<IconDownload />}
                  onClick={handleExportExcel}
                  style={{ borderRadius: 0 }}
                >
                  Eksport
                </Button>
              </Space>
            </div>
          </Card>

          {/* Stock Table with Visual Thumbnails & Progress Meter */}
          <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              loading={isLoading || isFetching}
              data={filteredStocks}
              scroll={{ x: 1100 }}
              noDataElement={
                searchText ? (
                  <Empty description="Qidiruv so‘rovi bo‘yicha tovar topilmadi" />
                ) : (
                  <Empty description="Omborda sarf tovarlari mavjud emas" />
                )
              }
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
                  title: 'Mahsulot Nomi va Toifasi',
                  dataIndex: 'itemName',
                  minWidth: 260,
                  render: (name: string, record: StockItem) => {
                    const visual = getConsumableVisual(record.categoryName, name);
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
                  title: 'Omborxona',
                  dataIndex: 'warehouseName',
                  width: 170,
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
                  width: 130,
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
                  width: 130,
                  fixed: 'right' as const,
                  render: (_, record: StockItem) => (
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconPlus />}
                      onClick={() => handleOpenReplenish(record)}
                      style={{ borderRadius: 0, fontWeight: 600 }}
                    >
                      To‘ldirish
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}

      {/* TAB 2: WAREHOUSE MOVEMENTS AUDIT LOG */}
      {activeMainTab === 'MOVEMENTS' && (
        <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
          <Table
            rowKey="id"
            loading={isMovementsLoading}
            data={movements}
            scroll={{ x: 1050 }}
            noDataElement={<Empty description="Ombor harakatlari jurnali bo‘sh" />}
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
                width: 120,
                render: (d: string) => <span style={{ color: 'var(--color-text-3)', fontSize: 12 }}>{d ? d.split('T')[0] : '—'}</span>,
              },
            ]}
          />
        </Card>
      )}

      {/* REPLENISH MODAL */}
      <Modal
        title={`Omborga Kirim Qilish: ${selectedStock?.itemName}`}
        visible={isReplenishModalVisible}
        onOk={handleReplenishSubmit}
        onCancel={() => setIsReplenishModalVisible(false)}
        okText="Qo‘shish"
        cancelText="Bekor qilish"
        style={{ borderRadius: 0 }}
      >
        <Form form={form} layout="vertical">
          <FormItem label="Hozirgi mavjud qoldiq">
            <Input value={`${selectedStock?.quantity} ${selectedStock?.unit}`} disabled style={{ borderRadius: 0 }} />
          </FormItem>
          <FormItem
            label={`Kirim qilinadigan miqdor (${selectedStock?.unit})`}
            field="amount"
            rules={[{ required: true, message: 'Miqdorni kiriting!' }]}
          >
            <InputNumber min={1} max={10000} style={{ width: '100%', borderRadius: 0 }} />
          </FormItem>
        </Form>
      </Modal>

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

      {/* OFFICIAL OS-1 RECEIPT DOCUMENT MODAL */}
      {officialKirimDoc && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType="KIRIM"
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
    </div>
  );
};
