import React, { useState } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
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
} from '@arco-design/web-react/icon';
import { useRepairsQuery, type RepairItem } from '../../hooks/useRepairsQuery';
import { CreateRepairModal } from '../../components/Repairs/CreateRepairModal';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { TableActions } from '../../components/Common/TableActions';
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

  const { repairs, isLoading, isError, refetch, updateRepairStatus, isUpdating } = useRepairsQuery({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  const filteredRepairs = repairs.filter((r) => {
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

  const handleOpenUpdate = (repair: RepairItem) => {
    setSelectedRepair(repair);
    updateForm.setFieldsValue({
      status: 'COMPLETED',
      serviceProvider: repair.serviceProvider || 'Universitet ichki ustaxonasi',
      cost: repair.cost || 0,
      actNumber: `AKT-REP-${new Date().getFullYear()}-${repair.repairNumber.split('-').pop()}`,
      notes: '',
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
        serviceProvider: values.serviceProvider,
        cost: values.cost,
        actNumber: values.actNumber,
        notes: values.notes,
      });
      setUpdateModalVisible(false);
      setSelectedRepair(null);
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    {
      title: 'Talabnoma №',
      dataIndex: 'repairNumber',
      width: 145,
      render: (val: string) => (
        <div style={{ paddingLeft: 8 }}>
          <b style={{ color: '#165DFF', whiteSpace: 'nowrap' }}>{val}</b>
        </div>
      ),
    },
    {
      title: 'Asosiy Vosita',
      dataIndex: 'asset',
      width: 220,
      render: (asset: any) => (
        <CategoryThumbnail
          icon={<IconTool />}
          name={asset?.item?.name || 'Asosiy vosita'}
          tag={asset?.room ? `${asset.room.number}-xona` : undefined}
          color="#165DFF"
          bg="#E8F3FF"
        />
      ),
    },
    {
      title: 'Nosozlik / Sabab',
      dataIndex: 'issueDescription',
      minWidth: 200,
      render: (val: string) => (
        <span style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.4 }}>{val}</span>
      ),
    },
    {
      title: 'Ustaxona / Servis',
      dataIndex: 'serviceProvider',
      width: 200,
      render: (val: string) => <span style={{ color: 'var(--color-text-2)' }}>{val || 'OTM ustaxonasi'}</span>,
    },
    {
      title: 'Xarajat (so‘m)',
      dataIndex: 'cost',
      width: 120,
      render: (val: any) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {val ? `${Number(val).toLocaleString()} so‘m` : '—'}
        </span>
      ),
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      width: 125,
      render: (status: string) => {
        if (status === 'IN_REPAIR') {
          return (
            <Tag color="orange" icon={<IconTool />} style={{ borderRadius: 0 }}>
              Ta’mirda
            </Tag>
          );
        }
        if (status === 'COMPLETED') {
          return (
            <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>
              Yakunlangan
            </Tag>
          );
        }
        if (status === 'UNREPAIRABLE') {
          return (
            <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0 }}>
              Yaroqsiz (Spisanie)
            </Tag>
          );
        }
        return (
          <Tag color="blue" icon={<IconClockCircle />} style={{ borderRadius: 0 }}>
            Kutilmoqda
          </Tag>
        );
      },
    },
    {
      title: 'Yuboruvchi',
      dataIndex: 'requestedBy',
      width: 130,
      render: (u: any) => (
        <span style={{ whiteSpace: 'nowrap', color: 'var(--color-text-2)' }}>
          {u ? u.fullName : '—'}
        </span>
      ),
    },
    {
      title: 'Sana',
      dataIndex: 'createdAt',
      width: 105,
      render: (val: string) => (
        <span style={{ whiteSpace: 'nowrap', color: 'var(--color-text-3)', fontSize: 12 }}>
          {val?.substring(0, 10)}
        </span>
      ),
    },
    {
      title: 'Amallar',
      dataIndex: 'actions',
      width: 185,
      fixed: 'right' as const,
      render: (_: any, record: RepairItem) => (
        <TableActions rightPadding={16}>
          {record.status === 'IN_REPAIR' || record.status === 'PENDING' ? (
            <Button
              type="outline"
              status="success"
              size="small"
              icon={<IconSync />}
              style={{ borderRadius: 0, fontWeight: 500, padding: '0 8px' }}
              onClick={() => handleOpenUpdate(record)}
            >
              Holatni Yangilash
            </Button>
          ) : (
            <Button
              type="outline"
              size="small"
              icon={<IconCheckCircle />}
              style={{ borderRadius: 0, color: 'var(--color-text-2)', padding: '0 8px' }}
              onClick={() => handleOpenUpdate(record)}
            >
              Tafsilot (Yopilgan)
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
    const data = repairs.map((r) => ({
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

      {/* Table */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          data={filteredRepairs}
          scroll={{ x: 1080 }}
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
          style={{ borderRadius: 0 }}
          noDataElement={
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Empty description={search ? 'Qidiruv bo‘yicha ariza topilmadi' : 'Hozircha ta’mirlash arizalari mavjud emas'} />
            </div>
          }
        />
      </Card>

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
