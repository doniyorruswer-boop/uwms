import React, { useState, useMemo } from 'react';
import {
  Card,
  Button,
  Tag,
  Badge,
  Space,
  Input,
  Select,
  Grid,
  Modal,
  Form,
  InputNumber,
  Radio,
  Typography,
  Alert,
  Empty,
} from '@arco-design/web-react';
import {
  IconTool,
  IconPlus,
  IconSearch,
  IconCheckCircle,
  IconCloseCircle,
  IconClockCircle,
  IconSafe,
  IconDownload,
  IconRefresh,
  IconSync,
  IconEye,
  IconFile,
} from '@arco-design/web-react/icon';
import { useRepairsQuery, type RepairItem } from '../../hooks/useRepairsQuery';
import { CreateRepairModal } from '../../components/Repairs/CreateRepairModal';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { exportToExcel } from '../../utils/exportExcel';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const FormItem = Form.Item;
const { TextArea } = Input;

export const RepairsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Update status modal state
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairItem | null>(null);
  const [updateForm] = Form.useForm();

  const { repairs, isLoading, isError, refetch, updateRepairStatus, isUpdating } = useRepairsQuery();

  const filteredRepairs = useMemo(() => {
    return repairs.filter((r) => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      if (!matchesStatus) return false;

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.repairNumber.toLowerCase().includes(q) ||
        r.asset.inventoryNumber.toLowerCase().includes(q) ||
        r.asset.item.name.toLowerCase().includes(q) ||
        r.issueDescription.toLowerCase().includes(q) ||
        (r.serviceProvider && r.serviceProvider.toLowerCase().includes(q))
      );
    });
  }, [repairs, statusFilter, search]);

  const handleOpenUpdate = (repair: RepairItem) => {
    setSelectedRepair(repair);
    updateForm.setFieldsValue({
      status: repair.status === 'COMPLETED' || repair.status === 'UNREPAIRABLE' ? repair.status : 'COMPLETED',
      serviceProvider: repair.serviceProvider || 'Universitet ichki ustaxonasi',
      cost: repair.cost !== undefined && repair.cost !== null ? Number(repair.cost) : 0,
      actNumber: repair.actNumber || `AKT-REP-${new Date().getFullYear()}-${repair.repairNumber.split('-').pop()}`,
      notes: repair.notes || '',
    });
    setUpdateModalVisible(true);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedRepair) return;
    try {
      const values = await updateForm.validate();
      await updateRepairStatus({
        id: selectedRepair.id,
        status: values.status,
        serviceProvider: values.serviceProvider ? String(values.serviceProvider).trim() : undefined,
        cost: values.cost !== undefined && values.cost !== null && values.cost !== '' ? Number(values.cost) : 0,
        actNumber: values.actNumber ? String(values.actNumber).trim() : undefined,
        notes: values.notes ? String(values.notes).trim() : undefined,
      });
      setUpdateModalVisible(false);
      setSelectedRepair(null);
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    {
      title: 'Vosita & Talabnoma №',
      dataIndex: 'asset',
      width: 230,
      render: (asset: any, record: RepairItem) => (
        <div style={{ paddingLeft: 8 }}>
          <CategoryThumbnail
            icon={<IconTool />}
            name={asset?.item?.name || 'Asosiy vosita'}
            subtitle={
              asset?.room
                ? `${asset.room.number}-xona`
                : asset?.inventoryNumber
                ? `Inv: ${asset.inventoryNumber}`
                : undefined
            }
            tag={record.repairNumber}
            color="#165DFF"
            bg="#E8F3FF"
          />
        </div>
      ),
    },
    {
      title: 'Nosozlik & Servis Markazi',
      dataIndex: 'issueDescription',
      minWidth: 280,
      render: (val: string, record: RepairItem) => (
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-text-1)', lineHeight: 1.45, wordBreak: 'break-word' }}>
            {val}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--color-text-3)', flexWrap: 'wrap' }}>
            <span>Ustaxona: <span style={{ color: 'var(--color-text-2)' }}>{record.serviceProvider || 'OTM ustaxonasi'}</span></span>
            {record.cost ? (
              <span style={{ color: '#165DFF', fontWeight: 600 }}>• {Number(record.cost).toLocaleString()} so‘m</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: 'Yuboruvchi & Sana',
      width: 150,
      render: (_: any, record: RepairItem) => (
        <div style={{ lineHeight: 1.35 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>
            {record.requestedBy?.fullName || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2, whiteSpace: 'nowrap' }}>
            {record.createdAt?.substring(0, 10)}
          </div>
        </div>
      ),
    },
    {
      title: 'Bosqich',
      dataIndex: 'status',
      width: 165,
      render: (status: string) => {
        let badge;
        if (status === 'IN_REPAIR') badge = <Badge status="processing" text="Ta’mir jarayonida" />;
        else if (status === 'PENDING') badge = <Badge status="warning" text="Kutilmoqda" />;
        else if (status === 'COMPLETED') badge = <Badge status="success" text="Yakunlangan" />;
        else if (status === 'UNREPAIRABLE') badge = <Badge status="error" text="Yaroqsiz (Spisanie)" />;
        else badge = <Tag style={{ borderRadius: 0 }}>{status}</Tag>;
        return <div style={{ whiteSpace: 'nowrap' }}>{badge}</div>;
      },
    },
    {
      title: 'Amallar',
      dataIndex: 'actions',
      width: 224,
      fixed: 'right' as const,
      render: (_: any, record: RepairItem) => (
        <TableActions rightPadding={0} gap={6}>
          <Button
            size="small"
            type="outline"
            icon={<IconEye />}
            onClick={(e) => {
              e?.stopPropagation?.();
              handleOpenUpdate(record);
            }}
            style={{ borderRadius: 0, padding: '0 7px', whiteSpace: 'nowrap', width: 88 }}
          >
            Batafsil
          </Button>
          {record.status === 'IN_REPAIR' || record.status === 'PENDING' ? (
            <Button
              size="small"
              type="primary"
              status="success"
              icon={<IconSync />}
              onClick={(e) => {
                e?.stopPropagation?.();
                handleOpenUpdate(record);
              }}
              style={{ borderRadius: 0, padding: '0 7px', whiteSpace: 'nowrap', width: 104 }}
            >
              Yangilash
            </Button>
          ) : (
            <Button
              size="small"
              type="outline"
              icon={<IconFile />}
              onClick={(e) => {
                e?.stopPropagation?.();
                handleOpenUpdate(record);
              }}
              style={{ borderRadius: 0, padding: '0 7px', whiteSpace: 'nowrap', width: 104 }}
            >
              Akt (OS-3)
            </Button>
          )}
        </TableActions>
      ),
    },
  ];

  const inRepairCount = repairs.filter((r) => r.status === 'IN_REPAIR').length;
  const pendingCount = repairs.filter((r) => r.status === 'PENDING').length;
  const completedCount = repairs.filter((r) => r.status === 'COMPLETED').length;
  const unrepairableCount = repairs.filter((r) => r.status === 'UNREPAIRABLE').length;
  const totalRepairCost = repairs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

  const handleExportExcel = () => {
    const data = filteredRepairs.map((r) => ({
      'Talabnoma №': r.repairNumber,
      'Asosiy Vosita': r.asset?.item?.name || '—',
      'Inventar №': r.asset?.inventoryNumber || '—',
      'Model': r.asset?.item?.model || '—',
      'Nosozlik / Sabab': r.issueDescription,
      'Ustaxona / Servis': r.serviceProvider || 'OTM ustaxonasi',
      'Xarajat (so‘m)': r.cost || 0,
      'Holati':
        r.status === 'IN_REPAIR'
          ? 'Ta’mirda'
          : r.status === 'COMPLETED'
          ? 'Yakunlangan'
          : r.status === 'UNREPAIRABLE'
          ? 'Yaroqsiz (Spisaniega)'
          : 'Kutilmoqda',
      'Yuboruvchi': r.requestedBy?.fullName || '—',
      'Sana': r.createdAt?.substring(0, 10),
    }));
    exportToExcel(data, 'Tamirlash_va_Texnik_Servis_Jurnali', 'Ta’mirlash');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs Filter */}
      <PageTabs
        activeTab={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { key: 'ALL', title: 'Barcha Holatlar', count: repairs.length },
          { key: 'IN_REPAIR', title: 'Ta’mirda (Faol)', count: inRepairCount },
          { key: 'PENDING', title: 'Kutilmoqda', count: pendingCount },
          { key: 'COMPLETED', title: 'Yakunlangan', count: completedCount },
          { key: 'UNREPAIRABLE', title: 'Yaroqsiz (Spisaniega)', count: unrepairableCount },
        ]}
      />

      {/* Actions Toolbar */}
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
              placeholder="Uskuna nomi, inv №, nosozlik sababi..."
              style={{ width: 320, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconRefresh />}
              onClick={() => refetch()}
              style={{ borderRadius: 0 }}
            >
              Yangilash
            </Button>
            <Button
              icon={<IconDownload />}
              onClick={handleExportExcel}
              style={{ borderRadius: 0 }}
            >
              Excelga Yuklash
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => setCreateModalVisible(true)}
            >
              Yangi Ta’mir Talabnomasi
            </Button>
          </Space>
        </div>
      </Card>

      {/* Error state */}
      {isError && (
        <Alert
          type="error"
          title="Ta’mirlash ma’lumotlarini yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {/* Universal Standard Table */}
      <StandardTable<RepairItem>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        data={filteredRepairs}
        scrollX={1050}
        onRowClick={(record) => handleOpenUpdate(record)}
        emptyText={search ? 'Qidiruv bo‘yicha ariza topilmadi' : 'Hozircha ta’mirlash arizalari mavjud emas'}
      />

      {/* Create Modal */}
      <CreateRepairModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />

      {/* Update Repair Status Modal */}
      <Modal
        title={
          <Space>
            <IconTool style={{ color: '#00B42A' }} />
            <span>Ta’mirlash Natijasini Qayd Etish</span>
          </Space>
        }
        visible={updateModalVisible}
        onCancel={() => setUpdateModalVisible(false)}
        style={{ width: 560, borderRadius: 0 }}
        footer={
          <Space>
            <Button onClick={() => setUpdateModalVisible(false)} style={{ borderRadius: 0 }}>
              Bekor Qilish
            </Button>
            <Button
              type="primary"
              loading={isUpdating}
              onClick={handleUpdateSubmit}
              style={{ borderRadius: 0, backgroundColor: '#00B42A' }}
            >
              Natijani Saqlash
            </Button>
          </Space>
        }
      >
        {selectedRepair && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--color-fill-2)',
              marginBottom: 16,
              border: '1px solid var(--color-border-2)',
            }}
          >
            <div style={{ fontWeight: 600 }}>{selectedRepair.asset.item.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
              Ariza №: <b>{selectedRepair.repairNumber}</b> | Inv: <b>{selectedRepair.asset.inventoryNumber}</b>
            </div>
          </div>
        )}

        <Form form={updateForm} layout="vertical">
          <FormItem
            label="Ta’mirlash Natijasi (Holati)"
            field="status"
            rules={[{ required: true, message: 'Natijani tanlang!' }]}
          >
            <Radio.Group type="button" style={{ width: '100%' }}>
              <Radio value="COMPLETED">
                <IconCheckCircle style={{ color: '#00B42A', marginRight: 6 }} />
                Muvaffaqiyatli Ta’mirlandi (Foydalanishga)
              </Radio>
              <Radio value="UNREPAIRABLE">
                <IconCloseCircle style={{ color: '#F53F3F', marginRight: 6 }} />
                Yaroqsiz Deb Topildi (Spisaniega)
              </Radio>
            </Radio.Group>
          </FormItem>

          <FormItem label="Servis Markazi / Ustaxona" field="serviceProvider">
            <Input style={{ borderRadius: 0 }} />
          </FormItem>

          <FormItem label="Yakuniy Ta’mirlash Xarajati (so‘m)" field="cost">
            <InputNumber min={0} style={{ width: '100%', borderRadius: 0 }} />
          </FormItem>

          <FormItem label="Rasmiy Ta’mirlash Dalolatnomasi №" field="actNumber">
            <Input placeholder="AKT-REP-2026-0001" style={{ borderRadius: 0 }} />
          </FormItem>

          <FormItem label="Xulosa yoki Mas’ul Izohi" field="notes">
            <TextArea rows={3} placeholder="Bajarilgan ishlar ro‘yxati, almashtirilgan detallar..." style={{ borderRadius: 0 }} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  );
};
export default RepairsPage;
