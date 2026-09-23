import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Message,
  Grid,
  Alert,
  Tooltip,
  DatePicker,
} from '@arco-design/web-react';
import { useSocket } from '../../hooks/useSocket';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
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
  IconEye,
  IconLock,
} from '@arco-design/web-react/icon';
import {
  useQuotasQuery,
  useSetQuotaMutation,
  useUpdateQuotaMutation,
} from '../../hooks/useQuotasQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useWarehouseQuery } from '../../hooks/useWarehouseQuery';
import { DepartmentQuota } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const FormItem = Form.Item;

export const QuotasPage: React.FC = () => {
  const { user } = useAuthStore();

  // Faqat Moliya-iqtisod prorektori kvotalarni boshqarishi (yangi belgilash, tahrirlash) mumkin.
  // Superadminga ham tahrirlash qat’iyan disable bo‘ladi.
  const canManageQuotas = user?.role === 'VICE_RECTOR_FINANCE';

  const isDepartmentStaff = user?.role === 'EMPLOYEE' || user?.role === 'MOL';

  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (isDepartmentStaff && user?.departmentId) {
      return user.departmentId;
    }
    return 'ALL';
  });

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

  // If department staff has departmentId, lock department selection
  useEffect(() => {
    if (isDepartmentStaff && user?.departmentId) {
      setSelectedDept(user.departmentId);
    }
  }, [isDepartmentStaff, user?.departmentId]);

  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const { data: quotas = [], isLoading, isError, refetch } = useQuotasQuery({
    departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
    period: currentPeriod || undefined,
  });

  const { departments } = useOrganizationQuery();
  const { stocks = [] } = useWarehouseQuery();

  // Real-Time Socket.io Sync for Quotas & Stock Balance
  useEffect(() => {
    if (!socket) return;

    const handleStockUpdated = () => {
      // Invalidate both quotas and warehouse stocks immediately
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    };

    socket.on('stock:updated', handleStockUpdated);
    socket.on('stock:low_alert', handleStockUpdated);

    return () => {
      socket.off('stock:updated', handleStockUpdated);
      socket.off('stock:low_alert', handleStockUpdated);
    };
  }, [socket, queryClient]);

  const setQuotaMutation = useSetQuotaMutation();
  const updateQuotaMutation = useUpdateQuotaMutation();

  // Deduplicated unique consumable items from warehouse stocks
  const consumableItems = useMemo(() => {
    const map = new Map<string, { itemId: string; itemName: string; unit: string; totalQty: number }>();
    for (const s of stocks) {
      if (!s.itemId) continue;
      if (!map.has(s.itemId)) {
        map.set(s.itemId, {
          itemId: s.itemId,
          itemName: s.itemName,
          unit: s.unit || 'dona',
          totalQty: Number(s.quantity) || 0,
        });
      } else {
        const existing = map.get(s.itemId)!;
        existing.totalQty += Number(s.quantity) || 0;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [stocks]);

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

  // Filtered list based on status tab, search text, and department lockdown
  const filteredQuotas = useMemo(() => {
    return quotas.filter((q) => {
      // Department lockdown for department staff
      if (isDepartmentStaff && user?.departmentId && q.departmentId !== user.departmentId) {
        return false;
      }

      // Status tab filter (including dedicated "Rektorat ruxsati talab qilinadiganlar")
      if (statusFilter === 'RECTOR_APPROVAL' && q.usedQuantity <= q.monthlyLimit) return false;
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
    }).sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [quotas, statusFilter, search, isDepartmentStaff, user?.departmentId]);

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
      Message.success('Kvota muvaffaqiyatli belgilandi!');
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
    exportToExcel(exportData, 'Kafedra_va_Bolimlar_Oylik_Kvotasi');
  };

  const columns = [
    {
      title: 'Kafedra / Bo‘lim',
      dataIndex: 'department.name',
      width: 175,
      render: (_: any, record: DepartmentQuota) => (
        <div style={{ paddingLeft: 8 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--color-text-1)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {record.department.name}
          </div>
          {record.department.code && (
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
              Kod: <b style={{ color: 'var(--color-text-2)' }}>{record.department.code}</b>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Sarflanuvchi Mahsulot',
      dataIndex: 'item.name',
      minWidth: 175,
      render: (_: any, record: DepartmentQuota) => (
        <CategoryThumbnail
          icon={<IconStorage />}
          name={record.item.name}
          tag={record.period}
          color="#165DFF"
          bg="#E8F3FF"
        />
      ),
    },
    {
      title: 'Davr',
      dataIndex: 'period',
      width: 85,
      render: (period: string) => (
        <Tag size="small" style={{ borderRadius: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {period}
        </Tag>
      ),
    },
    {
      title: 'Oylik Limit',
      dataIndex: 'monthlyLimit',
      width: 100,
      render: (val: number, record: DepartmentQuota) => (
        <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
          {val} {record.item.unit}
        </span>
      ),
    },
    {
      title: 'Joriy Sarf',
      dataIndex: 'usedQuantity',
      width: 95,
      render: (val: number, record: DepartmentQuota) => (
        <span
          style={{
            color: val > record.monthlyLimit ? '#F53F3F' : 'var(--color-text-1)',
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          {val} {record.item.unit}
        </span>
      ),
    },
    {
      title: 'Qoldiq Kvota',
      width: 100,
      render: (_: any, record: DepartmentQuota) => {
        const remaining = record.monthlyLimit - record.usedQuantity;
        return (
          <span
            style={{
              color: remaining <= 0 ? '#F53F3F' : '#00B42A',
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            {remaining > 0 ? remaining : 0} {record.item.unit}
          </span>
        );
      },
    },
    {
      title: 'Sarf Shkalasi va Foizi',
      width: 135,
      render: (_: any, record: DepartmentQuota) => {
        const percent = Math.min(
          100,
          Math.round((record.usedQuantity / (record.monthlyLimit || 1)) * 100)
        );
        const isOver = record.usedQuantity > record.monthlyLimit;
        const isWarning = !isOver && percent >= 80;

        return (
          <StockLevelGauge
            percent={percent}
            label={
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: isOver ? '#F53F3F' : isWarning ? '#FF7D00' : 'var(--color-text-1)',
                  whiteSpace: 'nowrap',
                }}
              >
                {record.usedQuantity} {record.item.unit}
              </span>
            }
            subLabel={
              <span style={{ color: 'var(--color-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {percent}%
              </span>
            }
            color={isOver ? '#F53F3F' : isWarning ? '#FF7D00' : '#00B42A'}
            status={isOver ? 'error' : isWarning ? 'warning' : 'success'}
            width={105}
            strokeWidth={6}
          />
        );
      },
    },
    {
      title: 'Holati',
      width: 155,
      render: (_: any, record: DepartmentQuota) => {
        if (record.usedQuantity > record.monthlyLimit) {
          return (
            <Space direction="vertical" size={3}>
              <Tag color="red" icon={<IconExclamationCircle />} style={{ borderRadius: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                LIMIT OSHGAN
              </Tag>
              <Tag color="magenta" style={{ borderRadius: 0, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Rektorat ruxsati shart
              </Tag>
            </Space>
          );
        }
        if (record.usedQuantity >= record.monthlyLimit * 0.8) {
          return (
            <Tag color="orange" icon={<IconClockCircle />} style={{ borderRadius: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>
              CHEGARADA
            </Tag>
          );
        }
        return (
          <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>
            ME’YORDA
          </Tag>
        );
      },
    },
    {
      title: 'Amallar',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: DepartmentQuota) => (
        <TableActions rightPadding={0} gap={6}>
          {canManageQuotas ? (
            <Button
              size="small"
              type="outline"
              icon={<IconEdit />}
              style={{ borderRadius: 0, padding: '0 8px', whiteSpace: 'nowrap' }}
              onClick={(e) => {
                e?.stopPropagation?.();
                openEditModal(record);
              }}
            >
              Tahrirlash
            </Button>
          ) : (
            <Tooltip content="Kvotani tahrirlash faqat Moliya-iqtisod prorektori vakolatida">
              <Button
                size="small"
                type="outline"
                disabled
                icon={<IconEdit />}
                style={{ borderRadius: 0, padding: '0 8px', whiteSpace: 'nowrap' }}
              >
                Tahrirlash
              </Button>
            </Tooltip>
          )}
        </TableActions>
      ),
    },
  ];

  // If department staff has no department assigned, show Permission Denied view
  if (isDepartmentStaff && !user?.departmentId) {
    return (
      <ForbiddenView
        title="Kafedra yoki Bo‘lim Biriktirilmagan"
        subTitle="Sizning akkauntingizga rasmiy kafedra yoki bo‘lim biriktirilmagan. Kvotalarni ko‘rish uchun administratorga murojaat qiling."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Real-time Status Indicator (Rule 4.2 & Faza 4) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: -6 }}>
        <Space size="small">
          <Tag color={isConnected ? 'green' : 'orange'} icon={<IconRefresh spin={!isConnected} />}>
            {isConnected ? 'Real-Time Quota & Stock Sync (Faol)' : 'Sinxronizatsiya kutilmoqda'}
          </Tag>
          <Tag color="cyan">
            Jonli Qoldiqlar (0ms)
          </Tag>
        </Space>
      </div>

      {/* Tabs Filter */}
      <PageTabs
        activeTab={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { key: 'ALL', title: 'Barcha Kvotalar', count: totalQuotas },
          { key: 'NORMAL', title: 'Me’yorda', count: normalQuotas },
          { key: 'WARNING', title: 'Chegarada (80%+)', count: warningQuotas },
          { key: 'EXCEEDED', title: 'Limit Oshgan', count: exceededQuotas },
          { key: 'RECTOR_APPROVAL', title: 'Rektorat Ruxsati Talab Qilinadiganlar', count: exceededQuotas },
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
              placeholder="Kafedra / bo‘lim yoki mahsulot nomi..."
              style={{ width: 260, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />

            {isDepartmentStaff ? (
              <Space size="small">
                <Tag
                  color="arcoblue"
                  icon={<IconLock />}
                  style={{ borderRadius: 0, padding: '4px 10px', fontSize: 13, height: 32, display: 'inline-flex', alignItems: 'center' }}
                >
                  {user?.departmentName || (user as any)?.department?.name || 'Kafedra yoki bo‘limingiz'}
                </Tag>
                <Tag
                  color="gray"
                  style={{ borderRadius: 0, padding: '4px 8px', fontSize: 12, height: 32, display: 'inline-flex', alignItems: 'center' }}
                >
                  Faqat o‘qish (Read-Only)
                </Tag>
              </Space>
            ) : (
              <Select
                style={{ width: 220, borderRadius: 0 }}
                value={selectedDept}
                onChange={setSelectedDept}
              >
                <Select.Option value="ALL">Barcha Kafedra va Bo‘limlar</Select.Option>
                {departments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name}
                  </Select.Option>
                ))}
              </Select>
            )}

            <DatePicker.MonthPicker
              format="YYYY-MM"
              style={{ width: 160, borderRadius: 0 }}
              value={currentPeriod}
              onChange={(val) => {
                if (val) setCurrentPeriod(val);
              }}
              placeholder="Davrni tanlang"
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

            {canManageQuotas ? (
              <Button
                type="primary"
                icon={<IconPlus />}
                style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                onClick={() => setCreateModalVisible(true)}
              >
                Yangi Kvota Belgilash
              </Button>
            ) : (
              <Tooltip content="Kvota belgilash faqat Moliya-iqtisod prorektori vakolatida">
                <Button
                  type="primary"
                  disabled
                  icon={<IconPlus />}
                  style={{ borderRadius: 0 }}
                >
                  Yangi Kvota Belgilash
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>
      </Card>

      {/* Exceeded Quotas Alert Banner (University Rule 5.4) */}
      {exceededQuotas > 0 && (
        <Alert
          type="warning"
          title={`${exceededQuotas} ta kafedra va bo‘limda oylik sarf limiti oshib ketgan!`}
          content="Universitet Nizomi 5.4-bandiga muvofiq, oylik limitdan ortiqcha berilgan talabnomalar uchun Moliya-iqtisodiyot bo‘yicha prorektor yoki Rektoratning maxsus ruxsati (rezolyutsiyasi) talab qilinadi."
          action={
            statusFilter !== 'RECTOR_APPROVAL' ? (
              <Button
                size="small"
                type="primary"
                status="warning"
                style={{ borderRadius: 0 }}
                onClick={() => setStatusFilter('RECTOR_APPROVAL')}
              >
                Rektorat ruxsati talab qilinuvchilarni ko‘rish
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Error State */}
      {isError && (
        <Alert
          type="error"
          title="Kvotalarni yuklashda xatolik yuz berdi"
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

      {/* Universal StandardTable Component */}
      <StandardTable<DepartmentQuota>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        data={filteredQuotas}
        scrollX={1118}
        onRowClick={(record) => openEditModal(record)}
        emptyText={
          search || selectedDept !== 'ALL'
            ? 'Tanlangan parametrlar bo‘yicha kvotalar topilmadi'
            : 'Ushbu davr uchun kvotalar belgilanmagan'
        }
      />

      {/* Create Modal */}
      <Modal
        title="Yangi Kvota Belgilash (Kafedra va Bo‘limlar)"
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
            label="Kafedra / Bo‘lim"
            field="departmentId"
            rules={[{ required: true, message: 'Kafedra yoki bo‘limni tanlang' }]}
          >
            <Select placeholder="Kafedra yoki bo‘limni tanlang" style={{ borderRadius: 0 }}>
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
            <Select placeholder="Mahsulotni tanlang" style={{ borderRadius: 0 }} showSearch>
              {consumableItems.map((c) => (
                <Select.Option key={c.itemId} value={c.itemId}>
                  {c.itemName} ({c.unit}) — Omborda mavjud: {c.totalQty} {c.unit}
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
                <DatePicker.MonthPicker
                  format="YYYY-MM"
                  style={{ width: '100%', borderRadius: 0 }}
                  placeholder="Davrni tanlang"
                />
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

      {/* Edit / View Modal */}
      <Modal
        title={
          canManageQuotas
            ? `Kvota Limitini Tahrirlash: ${selectedQuota?.department.name || ''}`
            : `Kvota Tafsilotlari: ${selectedQuota?.department.name || ''}`
        }
        visible={editModalVisible}
        onOk={canManageQuotas ? handleUpdateQuota : () => setEditModalVisible(false)}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedQuota(null);
          editForm.resetFields();
        }}
        confirmLoading={updateQuotaMutation.isPending}
        style={{ width: 480, borderRadius: 0 }}
        okText={canManageQuotas ? 'Saqlash' : 'Yopish'}
        okButtonProps={{ style: { borderRadius: 0 } }}
        cancelButtonProps={canManageQuotas ? { style: { borderRadius: 0 } } : { style: { display: 'none' } }}
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
            <br />
            <Text type="secondary">
              Davr: <b>{selectedQuota?.period}</b>
            </Text>
            {selectedQuota && selectedQuota.usedQuantity > selectedQuota.monthlyLimit && (
              <div style={{ marginTop: 8 }}>
                <Tag color="red" icon={<IconExclamationCircle />}>
                  Limit {selectedQuota.usedQuantity - selectedQuota.monthlyLimit} {selectedQuota.item.unit} ga oshgan — Rektorat ruxsati zarur
                </Tag>
              </div>
            )}
          </div>

          <FormItem
            label="Oylik Limit Miqdori"
            field="monthlyLimit"
            rules={[{ required: true, message: 'Yangi limitni kiriting' }]}
          >
            <InputNumber
              min={1}
              disabled={!canManageQuotas}
              style={{ width: '100%', borderRadius: 0 }}
            />
          </FormItem>

          <FormItem label="Izoh" field="notes">
            <Input.TextArea
              rows={2}
              disabled={!canManageQuotas}
              style={{ borderRadius: 0 }}
            />
          </FormItem>
        </Form>
      </Modal>
    </div>
  );
};


