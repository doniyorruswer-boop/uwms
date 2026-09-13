import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Progress,
  Message,
  Grid,
  Alert,
  Empty,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconEdit,
  IconCheckCircle,
  IconExclamationCircle,
  IconClockCircle,
  IconSearch,
  IconDownload,
  IconRefresh,
  IconStorage,
  IconCommon,
  IconFilter,
} from '@arco-design/web-react/icon';
import {
  useQuotasQuery,
  useSetQuotaMutation,
  useUpdateQuotaMutation,
} from '../../hooks/useQuotasQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useWarehouseQuery } from '../../hooks/useWarehouseQuery';
import { DepartmentQuota } from '../../types';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

export const QuotasPage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedQuota, setSelectedQuota] = useState<DepartmentQuota | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: quotas = [], isLoading, isError, refetch } = useQuotasQuery({
    departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
    period: currentPeriod || undefined,
  });

  const { departments } = useOrganizationQuery();
  const { stocks = [] } = useWarehouseQuery();

  const setQuotaMutation = useSetQuotaMutation();
  const updateQuotaMutation = useUpdateQuotaMutation();

  // Dynamic KPI Stats calculated from PostgreSQL data
  const totalQuotas = quotas.length;
  const totalMonthlyAllocated = useMemo(
    () => quotas.reduce((sum, q) => sum + q.monthlyLimit, 0),
    [quotas]
  );
  const totalUsedQuantity = useMemo(
    () => quotas.reduce((sum, q) => sum + q.usedQuantity, 0),
    [quotas]
  );
  const exceededQuotas = useMemo(
    () => quotas.filter((q) => q.usedQuantity > q.monthlyLimit).length,
    [quotas]
  );
  const warningQuotas = useMemo(
    () =>
      quotas.filter(
        (q) => q.usedQuantity > q.monthlyLimit * 0.8 && q.usedQuantity <= q.monthlyLimit
      ).length,
    [quotas]
  );
  const normalQuotas = useMemo(
    () => quotas.filter((q) => q.usedQuantity <= q.monthlyLimit * 0.8).length,
    [quotas]
  );

  // Filtered list based on status tab and search text
  const filteredQuotas = useMemo(() => {
    return quotas.filter((q) => {
      // Status tab filter
      if (statusFilter === 'EXCEEDED' && q.usedQuantity <= q.monthlyLimit) return false;
      if (
        statusFilter === 'WARNING' &&
        !(q.usedQuantity > q.monthlyLimit * 0.8 && q.usedQuantity <= q.monthlyLimit)
      )
        return false;
      if (statusFilter === 'NORMAL' && q.usedQuantity > q.monthlyLimit * 0.8) return false;

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const deptMatch = q.department?.name?.toLowerCase().includes(query);
        const itemMatch = q.item?.name?.toLowerCase().includes(query);
        const noteMatch = q.notes?.toLowerCase().includes(query);
        if (!deptMatch && !itemMatch && !noteMatch) return false;
      }

      return true;
    });
  }, [quotas, statusFilter, search]);

  const handleCreateQuota = async () => {
    try {
      const values = await createForm.validate();
      await setQuotaMutation.mutateAsync({
        departmentId: values.departmentId,
        itemId: values.itemId,
        monthlyLimit: values.monthlyLimit,
        period: values.period || currentPeriod,
        notes: values.notes,
      });
      Message.success('Kafedra kvotasi muvaffaqiyatli belgilandi!');
      setCreateModalVisible(false);
      createForm.resetFields();
      refetch();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        Message.error(err.response.data.message);
      }
    }
  };

  const handleUpdateQuota = async () => {
    if (!selectedQuota) return;
    try {
      const values = await editForm.validate();
      await updateQuotaMutation.mutateAsync({
        id: selectedQuota.id,
        payload: {
          monthlyLimit: values.monthlyLimit,
          notes: values.notes,
        },
      });
      Message.success('Kvota limiti muvaffaqiyatli yangilandi!');
      setEditModalVisible(false);
      setSelectedQuota(null);
      editForm.resetFields();
      refetch();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        Message.error(err.response.data.message);
      }
    }
  };

  const openEditModal = (quota: DepartmentQuota) => {
    setSelectedQuota(quota);
    editForm.setFieldsValue({
      monthlyLimit: quota.monthlyLimit,
      notes: quota.notes || '',
    });
    setEditModalVisible(true);
  };

  const handleExportExcel = () => {
    const exportData = filteredQuotas.map((q) => ({
      'Kafedra / Bo‘lim': q.department.name,
      'Kafedra Kodi': q.department.code || '-',
      'Sarf Mahsuloti': q.item.name,
      'O‘lchov Birligi': q.item.unit,
      'Davr (Oy/Yil)': q.period,
      'Oylik Limit': q.monthlyLimit,
      'Haqiqiy Sarf': q.usedQuantity,
      'Qoldiq Kvota': Math.max(0, q.monthlyLimit - q.usedQuantity),
      'Sarf Foizi': `${Math.round((q.usedQuantity / (q.monthlyLimit || 1)) * 100)}%`,
      'Holati':
        q.usedQuantity > q.monthlyLimit
          ? 'LIMIT OSHGAN'
          : q.usedQuantity >= q.monthlyLimit * 0.8
          ? 'CHEGARADA'
          : 'ME’YORDA',
      'Izoh': q.notes || '-',
    }));
    exportToExcel(exportData, 'Kafedralar_Oylik_Kvotasi');
  };

  const columns = [
    {
      title: 'Kafedra / Bo‘linma',
      dataIndex: 'department.name',
      minWidth: 220,
      render: (_: any, record: DepartmentQuota) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>
            {record.department.name}
          </div>
          {record.department.code && (
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
              Kod: <b>{record.department.code}</b>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Sarflanuvchi Mahsulot',
      dataIndex: 'item.name',
      minWidth: 240,
      render: (_: any, record: DepartmentQuota) => (
        <CategoryThumbnail
          icon={<IconStorage />}
          name={record.item.name}
          subtitle={`O‘lchov birligi: ${record.item.unit}`}
          tag={record.period}
          color="#165DFF"
          bg="#E8F3FF"
        />
      ),
    },
    {
      title: 'Davr',
      dataIndex: 'period',
      width: 110,
      render: (period: string) => (
        <Tag size="small" style={{ borderRadius: 0, fontWeight: 500 }}>
          {period}
        </Tag>
      ),
    },
    {
      title: 'Oylik Limit',
      dataIndex: 'monthlyLimit',
      width: 125,
      render: (val: number, record: DepartmentQuota) => (
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {val} {record.item.unit}
        </span>
      ),
    },
    {
      title: 'Joriy Sarf',
      dataIndex: 'usedQuantity',
      width: 125,
      render: (val: number, record: DepartmentQuota) => (
        <span
          style={{
            color: val > record.monthlyLimit ? '#F53F3F' : 'var(--color-text-1)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {val} {record.item.unit}
        </span>
      ),
    },
    {
      title: 'Qoldiq Kvota',
      width: 125,
      render: (_: any, record: DepartmentQuota) => {
        const remaining = record.monthlyLimit - record.usedQuantity;
        return (
          <span
            style={{
              color: remaining <= 0 ? '#F53F3F' : '#00B42A',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {remaining > 0 ? remaining : 0} {record.item.unit}
          </span>
        );
      },
    },
    {
      title: 'Sarf Foizi',
      width: 170,
      render: (_: any, record: DepartmentQuota) => {
        const percent = Math.min(
          100,
          Math.round((record.usedQuantity / (record.monthlyLimit || 1)) * 100)
        );
        let statusColor = '#00B42A';
        if (record.usedQuantity > record.monthlyLimit) {
          statusColor = '#F53F3F';
        } else if (percent >= 80) {
          statusColor = '#FF7D00';
        }
        return (
          <div style={{ width: 140 }}>
            <Progress
              percent={percent}
              color={statusColor}
              size="small"
              style={{ width: '100%' }}
            />
          </div>
        );
      },
    },
    {
      title: 'Holati',
      width: 140,
      render: (_: any, record: DepartmentQuota) => {
        if (record.usedQuantity > record.monthlyLimit) {
          return (
            <Tag color="red" icon={<IconExclamationCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
              LIMIT OSHGAN
            </Tag>
          );
        }
        if (record.usedQuantity >= record.monthlyLimit * 0.8) {
          return (
            <Tag color="orange" icon={<IconClockCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
              CHEGARADA
            </Tag>
          );
        }
        return (
          <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
            ME’YORDA
          </Tag>
        );
      },
    },
    {
      title: 'Amallar',
      width: 130,
      fixed: 'right' as const,
      render: (_: any, record: DepartmentQuota) => (
        <Button
          size="small"
          type="outline"
          icon={<IconEdit />}
          style={{ borderRadius: 0 }}
          onClick={() => openEditModal(record)}
        >
          Tahrirlash
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs Filter */}
      <PageTabs
        activeTab={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { key: 'ALL', title: 'Barcha Kvotalar', count: totalQuotas },
          { key: 'NORMAL', title: 'Me’yorda', count: normalQuotas },
          { key: 'WARNING', title: 'Chegarada (80%+)', count: warningQuotas },
          { key: 'EXCEEDED', title: 'Limit Oshgan', count: exceededQuotas },
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
              placeholder="Kafedra yoki mahsulot nomi..."
              style={{ width: 260, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />

            <Select
              style={{ width: 220, borderRadius: 0 }}
              value={selectedDept}
              onChange={setSelectedDept}
            >
              <Select.Option value="ALL">Barcha Kafedralar</Select.Option>
              {departments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>

            <Input
              type="month"
              style={{ width: 150, borderRadius: 0 }}
              value={currentPeriod}
              onChange={setCurrentPeriod}
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

            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => setCreateModalVisible(true)}
            >
              Yangi Kvota Belgilash
            </Button>
          </Space>
        </div>
      </Card>

      {/* Error State */}
      {isError && (
        <Alert
          type="error"
          title="Kafedra kvotalarini yuklashda xatolik yuz berdi"
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
        />
      )}

      {/* Quotas Table */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          data={filteredQuotas}
          scroll={{ x: 1250 }}
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
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Empty
                description={
                  search || selectedDept !== 'ALL'
                    ? 'Tanlangan parametrlar bo‘yicha kvotalar topilmadi'
                    : 'Ushbu davr uchun kvotalar belgilanmagan'
                }
              />
            </div>
          }
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Yangi Kafedra Kvotasini Belgilash"
        visible={createModalVisible}
        onOk={handleCreateQuota}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        confirmLoading={setQuotaMutation.isPending}
        style={{ width: 540, borderRadius: 0 }}
        okButtonProps={{ style: { borderRadius: 0 } }}
        cancelButtonProps={{ style: { borderRadius: 0 } }}
      >
        <Form form={createForm} layout="vertical">
          <FormItem
            label="Kafedra / Bo‘linma"
            field="departmentId"
            rules={[{ required: true, message: 'Kafedrani tanlang' }]}
          >
            <Select placeholder="Kafedrani tanlang" style={{ borderRadius: 0 }}>
              {departments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name} {d.code ? `(${d.code})` : ''}
                </Select.Option>
              ))}
            </Select>
          </FormItem>

          <FormItem
            label="Sarflanuvchi Mahsulot (Ombor)"
            field="itemId"
            rules={[{ required: true, message: 'Mahsulotni tanlang' }]}
          >
            <Select placeholder="Mahsulotni tanlang" style={{ borderRadius: 0 }}>
              {stocks.map((s) => (
                <Select.Option key={s.itemId} value={s.itemId}>
                  {s.itemName} ({s.unit}) — Omborda: {s.quantity}
                </Select.Option>
              ))}
            </Select>
          </FormItem>

          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="Oylik Limit Miqdori"
                field="monthlyLimit"
                rules={[{ required: true, message: 'Limitni kiriting' }]}
              >
                <InputNumber
                  min={1}
                  placeholder="Masalan: 5"
                  style={{ width: '100%', borderRadius: 0 }}
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="Davr (Oy/Yil)" field="period" initialValue={currentPeriod}>
                <Input type="month" style={{ width: '100%', borderRadius: 0 }} />
              </FormItem>
            </Col>
          </Row>

          <FormItem label="Qo‘shimcha Izoh yoki Asos" field="notes">
            <Input.TextArea
              placeholder="Kvota belgilash asosi yoki rektorat buyrug‘i..."
              rows={2}
              style={{ borderRadius: 0 }}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Kvota Limitini Tahrirlash: ${selectedQuota?.department.name || ''}`}
        visible={editModalVisible}
        onOk={handleUpdateQuota}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedQuota(null);
          editForm.resetFields();
        }}
        confirmLoading={updateQuotaMutation.isPending}
        style={{ width: 480, borderRadius: 0 }}
        okButtonProps={{ style: { borderRadius: 0 } }}
        cancelButtonProps={{ style: { borderRadius: 0 } }}
      >
        <Form form={editForm} layout="vertical">
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              Mahsulot: <b>{selectedQuota?.item.name}</b> ({selectedQuota?.item.unit})
            </Text>
            <br />
            <Text type="secondary">
              Hozirgi sarf: <b>{selectedQuota?.usedQuantity}</b> {selectedQuota?.item.unit}
            </Text>
          </div>

          <FormItem
            label="Yangi Oylik Limit"
            field="monthlyLimit"
            rules={[{ required: true, message: 'Yangi limitni kiriting' }]}
          >
            <InputNumber min={1} style={{ width: '100%', borderRadius: 0 }} />
          </FormItem>

          <FormItem label="Izoh" field="notes">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  );
};
