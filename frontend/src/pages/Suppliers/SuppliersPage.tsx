import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Space,
  Grid,
  Tag,
  Typography,
  Popconfirm,
  Alert,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconDownload,
  IconEdit,
  IconDelete,
  IconEye,
  IconUserGroup,
  IconUndo,
  IconStorage,
  IconCheckCircle,
  IconFile,
  IconLock,
} from '@arco-design/web-react/icon';
import { useSuppliersQuery, SupplierItem } from '../../hooks/useSuppliersQuery';
import { useAuthStore } from '../../store/authStore';
import { exportToExcel } from '../../utils/exportExcel';
import { SupplierModal } from './SupplierModal';
import { SupplierDetailDrawer } from './SupplierDetailDrawer';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { StandardTable } from '../../components/Common/StandardTable';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { TableActions } from '../../components/Common/TableActions';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { formatMoney } from '../../utils/formatters';

const { Text } = Typography;
const { Row, Col } = Grid;

export const SuppliersPage: React.FC = () => {
  const { user } = useAuthStore();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canView = canManage || user?.role === 'CHIEF_ACCOUNTANT' || user?.role === 'AUDITOR';

  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
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
    restoreSupplier,
    isRestoringSupplier,
    createInvoice,
    isCreatingInvoice,
  } = useSuppliersQuery(search, showDeleted);

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

  // Permission Denied UX State (Rule 6.3 & Rule 3)
  if (!user || !canView) {
    return (
      <ForbiddenView
        title="403 — Kirish Cheklangan"
        subTitle="Ta’minotchilar va shartnomalar reestrini ko‘rish uchun sizda yetarli ruxsat mavjud emas."
        requiredRoles={['HEAD_WAREHOUSE', 'SUPER_ADMIN', 'CHIEF_ACCOUNTANT', 'AUDITOR']}
      />
    );
  }

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

  const tableColumns = [
    {
      title: 'Korxona Nomi',
      dataIndex: 'name',
      minWidth: 260,
      render: (name: string, record: SupplierItem) => (
        <div style={{ paddingLeft: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CategoryThumbnail
            icon={<IconUserGroup />}
            name={name}
            tag={record.contractNumber ? `Shartnoma: № ${record.contractNumber}` : 'Shartnomasiz'}
            color="#165DFF"
            bg="#E8F3FF"
          />
          {record.deletedAt && (
            <Tag color="red" size="small">O‘chirilgan</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'STIR (INN)',
      dataIndex: 'inn',
      width: 130,
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
      width: 170,
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
      title: 'Kirimlar & Moliyalashtirish',
      width: 230,
      render: (_, record: SupplierItem) => {
        const instances = record.itemInstances || [];
        const byudjetCount = instances.filter((i) => i.fundingSource === 'BYUDJET' || !i.fundingSource).length;
        const kontraktCount = instances.filter(
          (i) => i.fundingSource === 'KONTRAKT_RIVOJLANTIRISH' || i.fundingSource === 'KONTRAKT',
        ).length;
        const grantCount = instances.filter((i) => i.fundingSource === 'GRANT').length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12 }}>
              Fakturalar: <b>{record._count?.invoices || 0} ta</b> • Ashyolar: <b>{record._count?.itemInstances || 0} ta</b>
            </div>
            {instances.length > 0 ? (
              <Space size="mini" wrap>
                {byudjetCount > 0 && <Tag size="small" color="blue">Byudjet: {byudjetCount}</Tag>}
                {kontraktCount > 0 && <Tag size="small" color="green">Kontrakt: {kontraktCount}</Tag>}
                {grantCount > 0 && <Tag size="small" color="purple">Grant: {grantCount}</Tag>}
              </Space>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Manba ma’lumoti yo‘q</span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Amallar',
      width: 200,
      fixed: 'right' as const,
      render: (_, record: SupplierItem) => {
        if (record.deletedAt) {
          return isSuperAdmin ? (
            <Popconfirm
              title="Ushbu ta’minotchini qayta tiklashni tasdiqlaysizmi?"
              okText="Ha, tiklash"
              cancelText="Bekor qilish"
              onOk={(e) => {
                e?.stopPropagation?.();
                restoreSupplier(record.id);
              }}
            >
              <Button
                size="small"
                type="primary"
                status="success"
                icon={<IconUndo />}
                loading={isRestoringSupplier}
                onClick={(e) => e.stopPropagation()}
                style={{ borderRadius: 0 }}
              >
                Qayta tiklash
              </Button>
            </Popconfirm>
          ) : (
            <Tag color="red">O‘chirilgan</Tag>
          );
        }

        return (
          <TableActions
            onDelete={isSuperAdmin ? (e) => handleDelete(record.id, e) : undefined}
            deleteConfirmTitle="Ta’minotchini o‘chirishni tasdiqlaysizmi?"
            deleteOkText="Ha, o‘chirish"
            deleteCancelText="Bekor qilish"
            deleteTooltip="O‘chirish"
            rightPadding={16}
          >
            <Button
              size="small"
              type="outline"
              icon={<IconEye />}
              onClick={(e) => handleOpenDetail(record, e)}
              style={{ borderRadius: 0 }}
            >
              Pasport
            </Button>
            {canManage ? (
              <Tooltip content="Tahrirlash">
                <Button
                  size="small"
                  type="outline"
                  icon={<IconEdit />}
                  onClick={(e) => handleOpenEdit(record, e)}
                  style={{ borderRadius: 0 }}
                />
              </Tooltip>
            ) : (
              <Tooltip content="Tahrirlash faqat Bosh omborchi va Administratorga ruxsat etilgan">
                <Button
                  size="small"
                  type="outline"
                  disabled
                  icon={<IconLock />}
                  style={{ borderRadius: 0 }}
                />
              </Tooltip>
            )}
          </TableActions>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Read-only Alert for Non-Managers */}
      {!canManage && (
        <Alert
          type="info"
          title="Ko‘rish Rejimi (Read-only)"
          content="Siz ta’minotchilar va shartnomalar reestrini ko‘rish huquqiga egasiz. Kontragent qo‘shish, tahrirlash va faktura biriktirish faqat Bosh omborchi va Tizim administratori uchun ruxsat etilgan."
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Top KPI Stat Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <StatHeroCard
            title="Jami Ta’minotchilar"
            value={stats?.totalSuppliers ?? suppliers.length}
            icon={<IconUserGroup />}
            color="blue"
            subtext="Reestrdagi kontragentlar soni"
          />
        </Col>
        <Col span={6}>
          <StatHeroCard
            title="Faol Shartnomalar"
            value={stats?.activeContractsCount ?? contractedCount}
            icon={<IconCheckCircle />}
            color="green"
            subtext="Amaldagi qonuniy shartnomalar"
          />
        </Col>
        <Col span={6}>
          <StatHeroCard
            title="Hisob-Fakturalar"
            value={stats?.totalInvoices ?? 0}
            icon={<IconFile />}
            color="purple"
            subtext="Keltirilgan partiya fakturalari"
          />
        </Col>
        <Col span={6}>
          <StatHeroCard
            title="Yetkazib Berish Qiymati"
            value={formatMoney(stats?.totalInvoiceAmount ?? 0)}
            icon={<IconStorage />}
            color="orange"
            subtext="Jami fakturalar summasi"
          />
        </Col>
      </Row>

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
                Faol Shartnomali ({contractedCount})
              </Button>
              <Button
                type={filterTab === 'DELIVERIES' ? 'primary' : 'secondary'}
                style={{ borderRadius: 0 }}
                onClick={() => setFilterTab('DELIVERIES')}
              >
                Hisob-fakturali ({deliveryCount})
              </Button>
              {isSuperAdmin && (
                <Button
                  type={showDeleted ? 'primary' : 'outline'}
                  status={showDeleted ? 'warning' : 'default'}
                  icon={<IconDelete />}
                  style={{ borderRadius: 0 }}
                  onClick={() => setShowDeleted(!showDeleted)}
                >
                  {showDeleted ? 'Faol kontragentlar' : 'O‘chirilganlar'}
                </Button>
              )}
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
            {canManage ? (
              <Button
                type="primary"
                icon={<IconPlus />}
                onClick={handleOpenCreate}
                style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              >
                Yangi Shartnoma / Kontragent
              </Button>
            ) : (
              <Tooltip content="Yangi ta’minotchi qo‘shish faqat Bosh omborchi va Administrator uchun ruxsat etilgan">
                <Button disabled icon={<IconLock />} style={{ borderRadius: 0 }}>
                  Yangi Shartnoma (Cheklangan)
                </Button>
              </Tooltip>
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
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Main Suppliers Table using StandardTable */}
      <StandardTable<SupplierItem>
        rowKey="id"
        loading={isLoading || isFetching}
        data={filteredSuppliers}
        scrollX={1200}
        emptyText={search ? 'Qidiruv bo‘yicha ta’minotchi topilmadi' : 'Hali ta’minotchilar kiritilmagan'}
        onRowClick={(record) => handleOpenDetail(record)}
        columns={tableColumns}
      />

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

export default SuppliersPage;
