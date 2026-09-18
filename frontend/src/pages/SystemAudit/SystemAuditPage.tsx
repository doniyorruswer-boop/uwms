import React, { useState, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Drawer,
  Descriptions,
  Tabs,
  Input,
  Select,
  DatePicker,
  Grid,
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
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;
const TabPane = Tabs.TabPane;

export const SystemAuditPage: React.FC = () => {
  const [search, setSearch] = useState<string>('');
  const [actionTab, setActionTab] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
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
    setDetailDrawerVisible(true);
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
      width: 125,
      render: (val: string) => {
        const d = new Date(val);
        const dateStr = d.toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const timeStr = d.toLocaleTimeString('uz-UZ', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return (
          <div style={{ paddingLeft: 8, lineHeight: 1.35 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
              {timeStr}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Foydalanuvchi / Mas’ul',
      dataIndex: 'user',
      width: 220,
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
      width: 125,
      render: (action: string) => getActionTag(action),
    },
    {
      title: 'Ob’yekt (Modul)',
      dataIndex: 'entity',
      width: 140,
      render: (entity: string, record: SystemAuditLogItem) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>{entity}</div>
          {record.entityId && (
            <div style={{ fontSize: 11, color: 'var(--color-text-4)', fontFamily: 'monospace', marginTop: 2, whiteSpace: 'nowrap' }}>
              ID: {record.entityId.substring(0, 8)}...
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tafsilotlar (Xulosa)',
      dataIndex: 'details',
      minWidth: 200,
      render: (details: string) => {
        if (!details) return <Text type="secondary">—</Text>;
        try {
          const parsed = JSON.parse(details);
          const entries = Object.entries(parsed).slice(0, 3);
          return (
            <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.4 }}>
              {entries.map(([k, v]) => `${k}: ${v}`).join(' | ')}
            </div>
          );
        } catch {
          return <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{details.substring(0, 60)}</span>;
        }
      },
    },
    {
      title: 'IP Manzil',
      dataIndex: 'ipAddress',
      width: 110,
      render: (ip: string) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
          {ip || '127.0.0.1'}
        </span>
      ),
    },
    {
      title: 'Amallar',
      width: 107,
      fixed: 'right' as const,
      render: (_: any, record: SystemAuditLogItem) => (
        <TableActions rightPadding={0} gap={6}>
          <Button
            size="small"
            type="outline"
            icon={<IconEye />}
            style={{ borderRadius: 0, padding: '0 8px', whiteSpace: 'nowrap' }}
            onClick={(e) => {
              e?.stopPropagation?.();
              openDetails(record);
            }}
          >
            Ko‘rish
          </Button>
        </TableActions>
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

      {/* Universal StandardTable Component */}
      <StandardTable<SystemAuditLogItem>
        rowKey="id"
        columns={columns}
        data={logs}
        loading={isLoading}
        scrollX={1050}
        onRowClick={(record) => openDetails(record)}
        emptyText={
          search || entityFilter !== 'ALL' || actionTab !== 'ALL'
            ? 'Tanlangan parametrlar bo‘yicha audit yozuvlari topilmadi'
            : 'Tizim audit jurnali bo‘sh'
        }
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, s) => {
            setPage(p);
            if (s) setPageSize(s);
          },
        }}
      />

      {/* Detail Drawer */}
      <Drawer
        width={560}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {selectedLog ? `Audit #${selectedLog.id.substring(0, 8).toUpperCase()}` : 'Audit Yozuvi'}
            </span>
            {selectedLog && getActionTag(selectedLog.action)}
          </div>
        }
        visible={detailDrawerVisible}
        onOk={() => setDetailDrawerVisible(false)}
        onCancel={() => setDetailDrawerVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              type="primary"
              onClick={() => setDetailDrawerVisible(false)}
              style={{ borderRadius: 0 }}
            >
              Yopish
            </Button>
          </div>
        }
      >
        {selectedLog && (
          <Tabs defaultActiveTab="info">
            <TabPane key="info" title="Asosiy Ma’lumotlar">
              <div style={{ padding: '8px 0' }}>
                <Descriptions
                  column={1}
                  border
                  data={[
                    {
                      label: 'Audit ID',
                      value: <span style={{ fontFamily: 'monospace' }}>{selectedLog.id}</span>,
                    },
                    {
                      label: 'Amal (Harakat)',
                      value: getActionTag(selectedLog.action),
                    },
                    {
                      label: 'Modul / Ob’yekt',
                      value: <b style={{ color: 'var(--color-text-1)' }}>{selectedLog.entity}</b>,
                    },
                    {
                      label: 'Ob’yekt ID',
                      value: selectedLog.entityId ? (
                        <span style={{ fontFamily: 'monospace' }}>{selectedLog.entityId}</span>
                      ) : (
                        '—'
                      ),
                    },
                    {
                      label: 'Mas’ul Foydalanuvchi',
                      value: selectedLog.user ? selectedLog.user.fullName : 'Tizim Servisi (Avtomatik)',
                    },
                    {
                      label: 'Username / Login',
                      value: selectedLog.user?.username ? `@${selectedLog.user.username}` : '—',
                    },
                    {
                      label: 'Foydalanuvchi Roli',
                      value: selectedLog.user?.role || '—',
                    },
                    {
                      label: 'Kafedra / Bo‘lim',
                      value: selectedLog.user?.department?.name || '—',
                    },
                    {
                      label: 'Sana va Vaqt',
                      value: new Date(selectedLog.createdAt).toLocaleString('uz-UZ'),
                    },
                    {
                      label: 'IP Manzil',
                      value: (
                        <span style={{ fontFamily: 'monospace' }}>
                          {selectedLog.ipAddress || '127.0.0.1'}
                        </span>
                      ),
                    },
                    {
                      label: 'Mijoz Qurilmasi',
                      value: selectedLog.userAgent || 'Web Brauzer / API',
                    },
                  ]}
                />
              </div>
            </TabPane>

            <TabPane key="details" title="Tafsilotlar & Parametrlar">
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  try {
                    const parsed = selectedLog.details ? JSON.parse(selectedLog.details) : null;
                    if (parsed && typeof parsed === 'object') {
                      const entries = Object.entries(parsed);
                      if (entries.length > 0) {
                        return (
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                marginBottom: 8,
                                color: 'var(--color-text-1)',
                              }}
                            >
                              Qayd Etilgan Parametrlar:
                            </div>
                            <Descriptions
                              column={1}
                              border
                              data={entries.map(([k, v]) => ({
                                label: k,
                                value: typeof v === 'object' ? JSON.stringify(v) : String(v),
                              }))}
                            />
                          </div>
                        );
                      }
                    }
                  } catch {
                    // not JSON
                  }
                  return null;
                })()}

                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      marginBottom: 8,
                      color: 'var(--color-text-1)',
                    }}
                  >
                    To‘liq JSON Ma’lumotlar:
                  </div>
                  <pre
                    style={{
                      background: 'var(--color-fill-2)',
                      padding: 12,
                      borderRadius: 0,
                      fontSize: 12,
                      maxHeight: 280,
                      overflowY: 'auto',
                      border: '1px solid var(--color-border-2)',
                      fontFamily: 'monospace',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {selectedLog.details
                      ? (() => {
                          try {
                            return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                          } catch {
                            return selectedLog.details;
                          }
                        })()
                      : 'Tafsilotlar mavjud emas'}
                  </pre>
                </div>
              </div>
            </TabPane>
          </Tabs>
        )}
      </Drawer>
    </div>
  );
};
