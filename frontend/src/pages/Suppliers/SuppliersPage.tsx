import React, { useState } from 'react';
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
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconDownload,
  IconEdit,
  IconDelete,
  IconEye,
  IconSafe,
  IconFile,
  IconUserGroup,
  IconCheckCircle,
} from '@arco-design/web-react/icon';
import { useSuppliersQuery, SupplierItem } from '../../hooks/useSuppliersQuery';
import { useAuthStore } from '../../store/authStore';
import { exportToExcel } from '../../utils/exportExcel';
import { SupplierModal } from './SupplierModal';
import { SupplierDetailDrawer } from './SupplierDetailDrawer';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

export const SuppliersPage: React.FC = () => {
  const { user } = useAuthStore();
  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const {
    suppliers,
    isLoading,
    isFetching,
    isError,
    refetch,
    stats,
    isLoadingStats,
    nextCodes,
    createSupplier,
    isCreatingSupplier,
    updateSupplier,
    isUpdatingSupplier,
    deleteSupplier,
    createInvoice,
    isCreatingInvoice,
  } = useSuppliersQuery(search);

  const [filterTab, setFilterTab] = useState<'ALL' | 'CONTRACTED' | 'DELIVERIES'>('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);

  const contractedCount = suppliers.filter((s) => Boolean(s.contractNumber && s.contractNumber.trim() !== '')).length;
  const deliveryCount = suppliers.filter((s) => (s._count?.invoices || 0) > 0 || (s._count?.itemInstances || 0) > 0).length;

  const filteredSuppliers = suppliers.filter((s) => {
    if (filterTab === 'CONTRACTED') {
      return Boolean(s.contractNumber && s.contractNumber.trim() !== '');
    }
    if (filterTab === 'DELIVERIES') {
      return (s._count?.invoices || 0) > 0 || (s._count?.itemInstances || 0) > 0;
    }
    return true;
  });

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceTargetSupplier, setInvoiceTargetSupplier] = useState<SupplierItem | null>(null);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (record: SupplierItem, e?: any) => {
    e?.stopPropagation?.();
    setEditingSupplier(record);
    setModalVisible(true);
  };

  const handleOpenDetail = (record: SupplierItem, e?: any) => {
    e?.stopPropagation?.();
    setSelectedSupplierId(record.id);
    setDetailDrawerVisible(true);
  };

  const handleOpenCreateInvoice = (supplier: SupplierItem) => {
    setInvoiceTargetSupplier(supplier);
    setInvoiceModalVisible(true);
  };

  const handleSubmitModal = async (values: any) => {
    if (editingSupplier) {
      await updateSupplier({ id: editingSupplier.id, dto: values });
    } else {
      await createSupplier(values);
    }
  };

  const handleDelete = async (id: string, e?: any) => {
    e?.stopPropagation?.();
    await deleteSupplier(id);
  };

  const handleExportExcel = () => {
    const data = suppliers.map((s) => ({
      'Korxona Nomi': s.name,
      'STIR (INN)': s.inn || '—',
      'Shartnoma Raqami': s.contractNumber || '—',
      'Shartnoma Sanasi': s.contractDate ? s.contractDate.split('T')[0] : '—',
      'Mas’ul Vakil': s.contactPerson || '—',
      'Telefon': s.phone || '—',
      'Elektron Pochta': s.email || '—',
      'Keltirilgan Ashyolar': s._count?.itemInstances || 0,
      'Hisob-fakturalar Soni': s._count?.invoices || 0,
      'Izoh': s.notes || '',
    }));

    exportToExcel(data, 'Taminotchilar_va_Shartnomalar_Reestri', 'Kontragentlar');
  };

  const formatPrice = (val?: number | string | null) => {
    if (!val) return '0 so‘m';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `${num.toLocaleString('uz-UZ')} so‘m`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter and Search Bar */}
      <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space size="medium" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="Korxona nomi, STIR (INN), shartnoma raqami yoki vakil..."
              style={{ width: 340, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />
            <Space size="small">
              <Button
                type={filterTab === 'ALL' ? 'primary' : 'secondary'}
                style={{ borderRadius: 0 }}
                onClick={() => setFilterTab('ALL')}
              >
                Barchasi ({suppliers.length})
              </Button>
              <Button
                type={filterTab === 'CONTRACTED' ? 'primary' : 'secondary'}
                style={{ borderRadius: 0 }}
                onClick={() => setFilterTab('CONTRACTED')}
              >
                Faol Shartnomali ({suppliers.filter((s) => s.contractNumber).length})
              </Button>
              <Button
                type={filterTab === 'DELIVERIES' ? 'primary' : 'secondary'}
                style={{ borderRadius: 0 }}
                onClick={() => setFilterTab('DELIVERIES')}
              >
                Hisob-fakturali
              </Button>
            </Space>
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconDownload />}
              onClick={handleExportExcel}
              style={{ borderRadius: 0 }}
            >
              Excelga Yuklash
            </Button>
            {isManager && (
              <Button
                type="primary"
                icon={<IconPlus />}
                onClick={handleOpenCreate}
                style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              >
                Yangi Shartnoma / Kontragent
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* Error state */}
      {isError && (
        <Alert
          type="error"
          title="Ma’lumotlarni yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzilgan yoki ruxsat etilmagan. Qaytadan urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta yuklash
            </Button>
          }
        />
      )}

      {/* Main Suppliers Table */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isLoading || isFetching}
          data={filteredSuppliers}
          scroll={{ x: 1100 }}
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
          noDataElement={
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Empty description={search ? 'Qidiruv bo‘yicha ta’minotchi topilmadi' : 'Hali ta’minotchilar kiritilmagan'} />
            </div>
          }
          columns={[
            {
              title: 'Korxona Nomi & Mas’ul',
              dataIndex: 'name',
              minWidth: 260,
              render: (name: string, record: SupplierItem) => (
                <CategoryThumbnail
                  icon={<IconUserGroup />}
                  name={name}
                  subtitle={record.contactPerson ? `Vakil: ${record.contactPerson}` : record.address || undefined}
                  tag={record.contractNumber ? `Shartnoma: № ${record.contractNumber}` : 'Shartnomasiz'}
                  color="#165DFF"
                  bg="#E8F3FF"
                />
              ),
            },
            {
              title: 'STIR (INN)',
              dataIndex: 'inn',
              width: 140,
              render: (inn?: string) =>
                inn ? (
                  <Tag color="arcoblue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {inn}
                  </Tag>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: 'Shartnoma № & Sana',
              width: 170,
              render: (_, record: SupplierItem) => (
                <div>
                  <div style={{ fontWeight: 500, color: '#165DFF' }}>
                    {record.contractNumber || 'Shartnomasiz'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                    {record.contractDate ? record.contractDate.split('T')[0] : 'Sana yo‘q'}
                  </div>
                </div>
              ),
            },
            {
              title: 'Bog‘lanish',
              width: 180,
              render: (_, record: SupplierItem) => (
                <div>
                  <div style={{ fontSize: 12 }}>{record.phone || '—'}</div>
                  {record.email && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{record.email}</div>
                  )}
                </div>
              ),
            },
            {
              title: 'Kirimlar',
              width: 160,
              render: (_, record: SupplierItem) => (
                <div>
                  <div style={{ fontSize: 12 }}>
                    Fakturalar: <b>{record._count?.invoices || 0} ta</b>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                    Ashyolar: <b>{record._count?.itemInstances || 0} ta</b>
                  </div>
                </div>
              ),
            },
            {
              title: 'Amallar',
              width: 170,
              fixed: 'right' as const,
              render: (_, record: SupplierItem) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <Space size="small">
                    <Button
                      size="small"
                      type="secondary"
                      icon={<IconEye />}
                      onClick={(e) => handleOpenDetail(record, e)}
                      style={{ borderRadius: 0 }}
                    >
                      Pasport
                    </Button>
                    {isManager && (
                      <Button
                        size="small"
                        type="outline"
                        icon={<IconEdit />}
                        onClick={(e) => handleOpenEdit(record, e)}
                        style={{ borderRadius: 0 }}
                      />
                    )}
                    {isSuperAdmin && (
                      <Popconfirm
                        title="Ta’minotchini o‘chirishni tasdiqlaysizmi?"
                        onOk={(e) => handleDelete(record.id, e)}
                        okText="Ha, o‘chirish"
                        cancelText="Bekor qilish"
                      >
                        <Button
                          size="small"
                          type="text"
                          status="danger"
                          icon={<IconDelete />}
                          style={{ borderRadius: 0 }}
                        />
                      </Popconfirm>
                    )}
                  </Space>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Add / Edit Supplier Modal */}
      <SupplierModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmitModal}
        loading={isCreatingSupplier || isUpdatingSupplier}
        initialValues={editingSupplier}
        nextCodes={nextCodes}
      />

      {/* Supplier Passport Drawer */}
      <SupplierDetailDrawer
        visible={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        supplierId={selectedSupplierId}
        onOpenCreateInvoice={handleOpenCreateInvoice}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        visible={invoiceModalVisible}
        onClose={() => setInvoiceModalVisible(false)}
        onSubmit={async (values) => {
          if (invoiceTargetSupplier) {
            await createInvoice({
              supplierId: invoiceTargetSupplier.id,
              dto: values,
            });
          }
        }}
        loading={isCreatingInvoice}
        supplier={invoiceTargetSupplier}
        nextCodes={nextCodes}
      />
    </div>
  );
};
