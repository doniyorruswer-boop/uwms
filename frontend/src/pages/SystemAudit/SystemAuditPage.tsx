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
  IconCheckCircle,
  IconExclamationCircle,
  IconDownload,
  IconUser,
  IconLock,
  IconPrinter,
  IconSync,
} from '@arco-design/web-react/icon';
import { useSystemAuditQuery } from '../../hooks/useSystemAuditQuery';
import { SystemAuditLogItem } from '../../types';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { useAuthStore } from '../../store/authStore';
import { exportToExcel } from '../../utils/exportExcel';

const { Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;
const TabPane = Tabs.TabPane;

interface ActionMeta {
  label: string;
  color: 'green' | 'blue' | 'red' | 'arcoblue' | 'orange' | 'gray';
  icon?: React.ReactNode;
}

const ACTION_MAP: Record<string, ActionMeta> = {
  // Security & Digital Integrity
  WORM_STAMP_GENERATE: { label: 'WORM Elektron Muhr', color: 'green', icon: <IconLock /> },
  BIOMETRIC_SIGN: { label: 'Biometrik Imzo', color: 'green', icon: <IconCheckCircle /> },
  BIOMETRIC_SIGNED: { label: 'Biometrik Imzo', color: 'green', icon: <IconCheckCircle /> },
  DOCUMENT_REVOKED: { label: 'Muhr Bekor Qilindi', color: 'red', icon: <IconExclamationCircle /> },

  // Hardware & Labeling
  REPRINT_LABEL: { label: 'QR Stiker Qayta Chop', color: 'orange', icon: <IconPrinter /> },

  // Limits & Governance
  QUOTA_OVERRIDE: { label: 'Kvota Limitini Oshirish', color: 'red', icon: <IconExclamationCircle /> },
  QUOTA_UPDATE: { label: 'Kvota Yangilandi', color: 'blue' },

  // Core Workflow
  APPROVE: { label: 'Tasdiqlandi', color: 'green' },
  FULFILL: { label: 'Bajarildi', color: 'green' },
  REJECT: { label: 'Rad Etildi', color: 'red' },
  DELETE: { label: 'O‘chirildi', color: 'red' },
  CREATE: { label: 'Yaratildi (Kirim)', color: 'arcoblue' },
  UPDATE: { label: 'O‘zgartirildi', color: 'blue' },
  TRANSFER: { label: 'Ko‘chirildi (MOL)', color: 'blue' },
  RETURN: { label: 'Qaytarildi', color: 'orange' },
  REPAIR: { label: 'Ta’mirga Yuborildi', color: 'orange' },
  WRITE_OFF: { label: 'Spisanie (OS-4)', color: 'red' },

  // Auth & Integrations
  LOGIN: { label: 'Tizimga Kirish', color: 'arcoblue' },
  LOGOUT: { label: 'Tizimdan Chiqish', color: 'gray' },
  HEMIS_SYNC: { label: 'HEMIS Sinxronizatsiya', color: 'arcoblue', icon: <IconSync /> },
  EXPORT: { label: 'Ma’lumot Eksporti', color: 'gray', icon: <IconDownload /> },
  EXCEL_IMPORT: { label: 'Excel Kirim', color: 'arcoblue' },
};

export const SystemAuditPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const canView = user?.role === 'SUPER_ADMIN' || user?.role === 'AUDITOR';

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

  // Semantic Action Tag Renderer (Replaces static ad-hoc color switch)
  const renderActionTag = (action: string) => {
    const meta = ACTION_MAP[action];
    if (!meta) {
      return <Tag style={{ borderRadius: 0 }} color="gray">{action}</Tag>;
    }
    return (
      <Tag
        color={meta.color}
        icon={meta.icon}
        style={{ borderRadius: 0, fontWeight: 500 }}
      >
        {meta.label}
      </Tag>
    );
  };

  // Executive KPI summary stats
  const kpiStats = useMemo(() => {
    const wormStamps = logs.filter(
      (l) => l.action === 'WORM_STAMP_GENERATE' || l.action === 'DOCUMENT_REVOKED',
    ).length;
    const biometricOrReprint = logs.filter(
      (l) =>
        l.action === 'BIOMETRIC_SIGN' ||
        l.action === 'BIOMETRIC_SIGNED' ||
        l.action === 'REPRINT_LABEL',
    ).length;
    const criticals = logs.filter(
      (l) =>
        l.action === 'QUOTA_OVERRIDE' ||
        l.action === 'REJECT' ||
        l.action === 'DELETE' ||
        l.action === 'DOCUMENT_REVOKED',
    ).length;

    return {
      total,
      wormStamps,
      biometricOrReprint,
      criticals,
    };
  }, [logs, total]);

  // Permission Denied State (Rule 3 & Rule 6.3)
  if (!user || !canView) {
    return (
      <ForbiddenView
        title="403 — Kirish Cheklangan"
        subTitle="Tizim auditi va xavfsizlik jurnallarini ko‘rish faqat Tizim administratori (SUPER_ADMIN) va Auditor (AUDITOR) uchun ruxsat etilgan."
        requiredRoles={['SUPER_ADMIN', 'AUDITOR']}
      />
    );
  }

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
      'Amal Tavsifi': ACTION_MAP[l.action]?.label || l.action,
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
              color="var(--color-text-3)"
              bg="var(--color-fill-2)"
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
            bg="var(--color-fill-2)"
          />
        );
      },
    },
    {
      title: 'Amal',
      dataIndex: 'action',
      width: 170,
      render: (action: string) => renderActionTag(action),
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
      {/* Top 4 KPI Executive StatHeroCards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Jami Audit Qaydlari"
            value={kpiStats.total}
            subtext="Tizim xavfsizlik va tranzaksiya jurnali"
            icon={<IconSafe />}
            color="blue"
            onClick={() => {
              setActionTab('ALL');
              setEntityFilter('ALL');
              setPage(1);
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="WORM Muhrlar & Xavfsizlik"
            value={kpiStats.wormStamps}
            subtext="O‘zgarmas (WORM) elektron hujjatlar"
            icon={<IconLock />}
            color="teal"
            onClick={() => {
              setActionTab('WORM_STAMP_GENERATE');
              setPage(1);
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Biometrik & QR Amallar"
            value={kpiStats.biometricOrReprint}
            subtext="QR dublikatlar va biometrik imzolar"
            icon={<IconCheckCircle />}
            color="green"
            onClick={() => {
              setActionTab('BIOMETRIC_SIGN');
              setPage(1);
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Nazorat & Kvota Override"
            value={kpiStats.criticals}
            subtext="Limit oshirish, rad etish va bekor qilish"
            icon={<IconExclamationCircle />}
            color="red"
            onClick={() => {
              setActionTab('QUOTA_OVERRIDE');
              setPage(1);
            }}
          />
        </Col>
      </Row>

      {/* Tabs Filter with New Actions */}
      <PageTabs
        activeTab={actionTab}
        onChange={(tab) => {
          setActionTab(tab);
          setPage(1);
        }}
        tabs={[
          { key: 'ALL', title: 'Barcha Amallar' },
          { key: 'WORM_STAMP_GENERATE', title: 'WORM Muhrlash' },
          { key: 'BIOMETRIC_SIGN', title: 'Biometrik Imzo' },
          { key: 'REPRINT_LABEL', title: 'QR Qayta Chop' },
          { key: 'QUOTA_OVERRIDE', title: 'Kvota Override' },
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
              style={{ width: 250, borderRadius: 0 }}
              placeholder="Qidiruv (Xodim, ID, matn)..."
              prefix={<IconSearch />}
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              allowClear
            />

            {/* Action Type Dropdown Filter */}
            <Select
              style={{ width: 230, borderRadius: 0 }}
              value={actionTab}
              onChange={(val) => {
                setActionTab(val);
                setPage(1);
              }}
              placeholder="Amal turi bo‘yicha filter"
            >
              <Select.Option value="ALL">Barcha amallar</Select.Option>
              <Select.Option value="WORM_STAMP_GENERATE">WORM_STAMP_GENERATE (WORM Elektron Muhr)</Select.Option>
              <Select.Option value="BIOMETRIC_SIGN">BIOMETRIC_SIGN (Biometrik Imzo)</Select.Option>
              <Select.Option value="REPRINT_LABEL">REPRINT_LABEL (QR Stikerni Qayta Chop)</Select.Option>
              <Select.Option value="QUOTA_OVERRIDE">QUOTA_OVERRIDE (Kvota Limitini Oshirish)</Select.Option>
              <Select.Option value="DOCUMENT_REVOKED">DOCUMENT_REVOKED (Hujjat Bekor Qilindi)</Select.Option>
              <Select.Option value="CREATE">CREATE (Yangi Kirim / Yaratildi)</Select.Option>
              <Select.Option value="UPDATE">UPDATE (O‘zgartirildi)</Select.Option>
              <Select.Option value="APPROVE">APPROVE (Tasdiqlandi)</Select.Option>
              <Select.Option value="FULFILL">FULFILL (Talabnoma Bajarildi)</Select.Option>
              <Select.Option value="TRANSFER">TRANSFER (MOL Ko‘chirildi)</Select.Option>
              <Select.Option value="REJECT">REJECT (Rad Etildi)</Select.Option>
              <Select.Option value="WRITE_OFF">WRITE_OFF (Hisobdan Chiqarish OS-4)</Select.Option>
              <Select.Option value="RETURN">RETURN (Omborga Qaytarildi)</Select.Option>
              <Select.Option value="REPAIR">REPAIR (Ta’mirga Yuborildi)</Select.Option>
              <Select.Option value="QUOTA_UPDATE">QUOTA_UPDATE (Kvota O‘zgartirildi)</Select.Option>
              <Select.Option value="LOGIN">LOGIN (Tizimga Kirish)</Select.Option>
              <Select.Option value="HEMIS_SYNC">HEMIS_SYNC (HEMIS Integratsiya)</Select.Option>
              <Select.Option value="EXPORT">EXPORT (Reyestr Eksporti)</Select.Option>
            </Select>

            {/* Entity Filter */}
            <Select
              style={{ width: 200, borderRadius: 0 }}
              value={entityFilter}
              onChange={(val) => {
                setEntityFilter(val);
                setPage(1);
              }}
            >
              <Select.Option value="ALL">Barcha modullar</Select.Option>
              <Select.Option value="ASSET">ASSET (Asosiy vosita)</Select.Option>
              <Select.Option value="ItemInstance">ItemInstance (Ashyo nusxasi)</Select.Option>
              <Select.Option value="STOCK">STOCK (Ombor qoldig‘i)</Select.Option>
              <Select.Option value="REQUEST">REQUEST (Talabnoma)</Select.Option>
              <Select.Option value="DocumentStamp">DocumentStamp (WORM Muhr)</Select.Option>
              <Select.Option value="SigningSession">SigningSession (Biometrik Sessiya)</Select.Option>
              <Select.Option value="DepartmentQuota">DepartmentQuota (Kvota)</Select.Option>
              <Select.Option value="REPAIR">REPAIR (Ta’mirlash)</Select.Option>
              <Select.Option value="WRITE_OFF">WRITE_OFF (Spisanie)</Select.Option>
              <Select.Option value="USER">USER (Xodim)</Select.Option>
              <Select.Option value="DEPARTMENT">DEPARTMENT (Kafedra)</Select.Option>
            </Select>

            <RangePicker
              style={{ width: 240, borderRadius: 0 }}
              onChange={(dateStrings: any) => {
                setDateRange(dateStrings);
                setPage(1);
              }}
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
        scrollX={1150}
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
            {selectedLog && renderActionTag(selectedLog.action)}
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
                      value: renderActionTag(selectedLog.action),
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
