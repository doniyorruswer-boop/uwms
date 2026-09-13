import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Input,
  Select,
  DatePicker,
  Grid,
  Empty,
  Alert,
} from '@arco-design/web-react';
import {
  IconSearch,
  IconEye,
  IconRefresh,
  IconSafe,
  IconFilter,
  IconCheckCircle,
  IconExclamationCircle,
  IconDownload,
  IconUser,
} from '@arco-design/web-react/icon';
import { useSystemAuditQuery } from '../../hooks/useSystemAuditQuery';
import { SystemAuditLogItem } from '../../types';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

export const SystemAuditPage: React.FC = () => {
  const [search, setSearch] = useState<string>('');
  const [actionTab, setActionTab] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<SystemAuditLogItem | null>(null);

  const { data, isLoading, isError, refetch } = useSystemAuditQuery({
    search: search || undefined,
    action: actionTab !== 'ALL' ? actionTab : undefined,
    entity: entityFilter !== 'ALL' ? entityFilter : undefined,
    startDate: dateRange[0] || undefined,
    endDate: dateRange[1] || undefined,
    page,
    limit: pageSize,
  });

  const logs = data?.items || [];
  const total = data?.total || 0;

  // Stats calculation
  const successfulActions = useMemo(
    () => logs.filter((l) => l.action !== 'REJECT' && l.action !== 'DELETE').length,
    [logs]
  );
  const updateActions = useMemo(
    () => logs.filter((l) => l.action === 'UPDATE' || l.action === 'TRANSFER').length,
    [logs]
  );
  const criticalActions = useMemo(
    () => logs.filter((l) => l.action === 'REJECT' || l.action === 'DELETE').length,
    [logs]
  );

  const getActionTag = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return <Tag color="arcoblue" style={{ borderRadius: 0 }}>LOGIN</Tag>;
      case 'CREATE':
        return <Tag color="cyan" style={{ borderRadius: 0 }}>YARATILDI</Tag>;
      case 'UPDATE':
        return <Tag color="blue" style={{ borderRadius: 0 }}>O‘ZGARTIRILDI</Tag>;
      case 'APPROVE':
        return <Tag color="green" style={{ borderRadius: 0 }}>TASDIQLANDI</Tag>;
      case 'FULFILL':
        return <Tag color="green" style={{ borderRadius: 0 }}>BAJARILDI</Tag>;
      case 'REJECT':
        return <Tag color="red" style={{ borderRadius: 0 }}>RAD ETILDI</Tag>;
      case 'TRANSFER':
        return <Tag color="purple" style={{ borderRadius: 0 }}>KO‘CHIRILDI</Tag>;
      case 'RETURN':
        return <Tag color="orangered" style={{ borderRadius: 0 }}>QAYTARILDI</Tag>;
      case 'REPAIR':
        return <Tag color="orange" style={{ borderRadius: 0 }}>TA’MIRLASH</Tag>;
      case 'WRITE_OFF':
        return <Tag color="magenta" style={{ borderRadius: 0 }}>SPISANIE</Tag>;
      case 'QUOTA_UPDATE':
        return <Tag color="gold" style={{ borderRadius: 0 }}>KVOTA</Tag>;
      case 'HEMIS_SYNC':
        return <Tag color="arcoblue" style={{ borderRadius: 0 }}>HEMIS SYNC</Tag>;
      case 'EXPORT':
        return <Tag color="lime" style={{ borderRadius: 0 }}>EKSPORT</Tag>;
      default:
        return <Tag style={{ borderRadius: 0 }}>{action}</Tag>;
    }
  };

  const openDetails = (log: SystemAuditLogItem) => {
    setSelectedLog(log);
    setDetailModalVisible(true);
  };

  const handleExportExcel = () => {
    const exportData = logs.map((l) => ({
      'Vaqt': new Date(l.createdAt).toLocaleString('uz-UZ'),
      'Xodim': l.user?.fullName || 'Tizim (Avtomatik)',
      'Username': l.user?.username || '-',
      'Roli': l.user?.role || '-',
      'Bo‘lim': l.user?.department?.name || '-',
      'Amal': l.action,
      'Ob’yekt (Modul)': l.entity,
      'Ob’yekt ID': l.entityId || '-',
      'Tafsilotlar': l.details || '-',
      'IP Manzil': l.ipAddress || '127.0.0.1',
    }));
    exportToExcel(exportData, 'Tizim_Xavfsizlik_Audit_Jurnali');
  };

  const columns = [
    {
      title: 'Vaqt',
      dataIndex: 'createdAt',
      width: 175,
      render: (val: string) => (
        <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--color-text-2)' }}>
          {new Date(val).toLocaleString('uz-UZ', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      title: 'Foydalanuvchi / Mas’ul',
      dataIndex: 'user',
      minWidth: 240,
      render: (_: any, record: SystemAuditLogItem) => {
        if (!record.user) {
          return (
            <CategoryThumbnail
              icon={<IconSafe />}
              name="Tizim Servisi"
              subtitle="Avtomatik jarayon"
              color="#86909C"
              bg="#F2F3F5"
            />
          );
        }
        return (
          <CategoryThumbnail
            icon={<IconUser />}
            name={record.user.fullName}
            subtitle={`@${record.user.username} • ${record.user.role}`}
            tag={record.user.department?.name || undefined}
            color="#165DFF"
            bg="#E8F3FF"
          />
        );
      },
    },
    {
      title: 'Amal',
      dataIndex: 'action',
      width: 135,
      render: (action: string) => getActionTag(action),
    },
    {
      title: 'Ob’yekt (Modul)',
      dataIndex: 'entity',
      width: 160,
      render: (entity: string, record: SystemAuditLogItem) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{entity}</div>
          {record.entityId && (
            <div style={{ fontSize: 11, color: 'var(--color-text-4)', fontFamily: 'monospace', marginTop: 2 }}>
              ID: {record.entityId.substring(0, 10)}...
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tafsilotlar (Xulosa)',
      dataIndex: 'details',
      minWidth: 240,
      render: (details: string) => {
        if (!details) return <Text type="secondary">—</Text>;
        try {
          const parsed = JSON.parse(details);
          const entries = Object.entries(parsed).slice(0, 3);
          return (
            <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
              {entries.map(([k, v]) => `${k}: ${v}`).join(' | ')}
            </div>
          );
        } catch {
          return <span style={{ fontSize: 12 }}>{details.substring(0, 60)}</span>;
        }
      },
    },
    {
      title: 'IP Manzil',
      dataIndex: 'ipAddress',
      width: 130,
      render: (ip: string) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-3)' }}>
          {ip || '127.0.0.1'}
        </span>
      ),
    },
    {
      title: 'Amallar',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: SystemAuditLogItem) => (
        <Button
          size="small"
          type="text"
          icon={<IconEye />}
          style={{ borderRadius: 0 }}
          onClick={() => openDetails(record)}
        >
          Ko‘rish
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs Filter */}
      <PageTabs
        activeTab={actionTab}
        onChange={setActionTab}
        tabs={[
          { key: 'ALL', title: 'Barcha Amallar' },
          { key: 'CREATE', title: 'Yaratildi (Kirim)' },
          { key: 'UPDATE', title: 'O‘zgartirildi' },
          { key: 'APPROVE', title: 'Tasdiqlandi' },
          { key: 'TRANSFER', title: 'Ko‘chirildi' },
          { key: 'REJECT', title: 'Rad Etildi' },
          { key: 'WRITE_OFF', title: 'Spisanie' },
        ]}
      />

      {/* Filter Toolbar */}
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
              style={{ width: 260, borderRadius: 0 }}
              placeholder="Qidiruv (Xodim, ID, matn)..."
              prefix={<IconSearch />}
              value={search}
              onChange={setSearch}
              allowClear
            />

            <Select
              style={{ width: 180, borderRadius: 0 }}
              value={entityFilter}
              onChange={setEntityFilter}
            >
              <Select.Option value="ALL">Barcha modullar</Select.Option>
              <Select.Option value="ASSET">ASSET (Vosita)</Select.Option>
              <Select.Option value="STOCK">STOCK (Ombor)</Select.Option>
              <Select.Option value="REQUEST">REQUEST (Talabnoma)</Select.Option>
              <Select.Option value="REPAIR">REPAIR (Ta’mir)</Select.Option>
              <Select.Option value="WRITE_OFF">WRITE_OFF (Spisanie)</Select.Option>
              <Select.Option value="USER">USER (Xodim)</Select.Option>
              <Select.Option value="DEPARTMENT">DEPARTMENT (Kafedra)</Select.Option>
            </Select>

            <RangePicker
              style={{ width: 240, borderRadius: 0 }}
              onChange={(dateStrings: any) => setDateRange(dateStrings)}
            />
          </Space>

          <Space size="medium" wrap>
            <Button
              type="outline"
              icon={<IconRefresh />}
              style={{ borderRadius: 0 }}
              onClick={() => refetch()}
              loading={isLoading}
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
          </Space>
        </div>
      </Card>

      {/* Error state */}
      {isError && (
        <Alert
          type="error"
          title="Audit jurnalini yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()} style={{ borderRadius: 0 }}>
              Qayta Urinish
            </Button>
          }
        />
      )}

      {/* Table */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          data={logs}
          loading={isLoading}
          scroll={{ x: 1150 }}
          style={{ borderRadius: 0 }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, s) => {
              setPage(p);
              if (s) setPageSize(s);
            },
            showTotal: (t, range) => {
              if (!t || t === 0) return '0/0';
              const to = range ? Math.min(range[1], t) : t;
              return `${to}/${t}`;
            },
            sizeCanChange: true,
            sizeOptions: [10, 20, 50, 100],
          }}
          noDataElement={
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Empty description="Audit yozuvlari topilmadi" />
            </div>
          }
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Audit Yozuvi Tafsilotlari"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Button onClick={() => setDetailModalVisible(false)} style={{ borderRadius: 0 }}>
            Yopish
          </Button>
        }
        style={{ width: 620, borderRadius: 0 }}
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-2)', paddingBottom: 8 }}>
              <Text bold>Amal:</Text>
              {getActionTag(selectedLog.action)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text bold>Vaqt:</Text>
              <Text>{new Date(selectedLog.createdAt).toLocaleString('uz-UZ')}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text bold>Foydalanuvchi:</Text>
              <Text>{selectedLog.user ? `${selectedLog.user.fullName} (@${selectedLog.user.username})` : 'Tizim'}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text bold>Ob’yekt / Modul:</Text>
              <Text>{selectedLog.entity} (ID: {selectedLog.entityId || '—'})</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text bold>IP Manzil:</Text>
              <Text code style={{ borderRadius: 0 }}>{selectedLog.ipAddress || '127.0.0.1'}</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text bold style={{ display: 'block', marginBottom: 4 }}>To‘liq JSON Ma’lumotlar:</Text>
              <pre
                style={{
                  background: 'var(--color-fill-2)',
                  padding: 12,
                  borderRadius: 0,
                  fontSize: 12,
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid var(--color-border-2)',
                }}
              >
                {selectedLog.details || 'Tafsilotlar mavjud emas'}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
