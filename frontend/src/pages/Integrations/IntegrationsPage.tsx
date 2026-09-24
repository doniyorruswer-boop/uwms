import React, { useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Grid,
  Tag,
  Message,
  Modal,
  Input,
  Select,
  Alert,
  Spin,
  Descriptions,
  Divider,
} from '@arco-design/web-react';
import {
  IconSync,
  IconDownload,
  IconCheckCircle,
  IconExclamationCircle,
  IconCloseCircle,
  IconInfoCircle,
  IconSettings,
  IconCopy,
  IconPlayArrow,
  IconUser,
  IconStorage,
  IconLock,
  IconHistory,
  IconDown,
  IconUp,
} from '@arco-design/web-react/icon';
import {
  useHemisStatusQuery,
  useHemisSyncMutation,
  useHemisTestConnectionMutation,
  useHemisSyncLogsQuery,
  HemisSyncLogItem,
} from '../../hooks/useIntegrationsQuery';
import { apiClient } from '../../api/client';
import { PageTabs } from '../../components/Common/PageTabs';
import { StandardTable } from '../../components/Common/StandardTable';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { useAuthStore } from '../../store/authStore';
import { API_ENDPOINTS } from '../../constants/api.constants';
import type { HemisTestConnectionResult } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

export const IntegrationsPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<string>('hemis');
  const [exportPeriod, setExportPeriod] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );
  const [exportType, setExportType] = useState<string>('summary');
  const [exportFormat, setExportFormat] = useState<string>('xlsx');
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [xlsxDownloadData, setXlsxDownloadData] = useState<{ base64: string; fileName: string } | null>(null);

  // Modals & Expandable Panel
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState<boolean>(false);
  const [isLogsExpanded, setIsLogsExpanded] = useState<boolean>(false);

  // Form inputs for config/ping
  const [apiUrlInput, setApiUrlInput] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');

  // Ping result
  const [pingResult, setPingResult] = useState<HemisTestConnectionResult | null>(null);

  const {
    data: hemisStatus,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useHemisStatusQuery();

  const {
    data: syncLogs = [],
    isLoading: isLogsLoading,
    refetch: refetchLogs,
  } = useHemisSyncLogsQuery(25);

  const hemisSyncMutation = useHemisSyncMutation();
  const hemisTestConnectionMutation = useHemisTestConnectionMutation();

  // Permission Denied State (Rule 3 & Rule 6.3)
  if (!user || !isSuperAdmin) {
    return (
      <ForbiddenView
        title="403 — Kirish Cheklangan"
        subTitle="Tashqi tizimlar (HEMIS REST API, UzASBO/1C) integratsiyasini sozlash va sinxronizatsiya qilish faqat Bosh Administrator (SUPER_ADMIN) vakolatiga kiradi."
        requiredRoles={['SUPER_ADMIN']}
      />
    );
  }

  const handleOpenConfigModal = () => {
    setApiUrlInput(hemisStatus?.apiUrl || '');
    setApiKeyInput('');
    setPingResult(null);
    setIsConfigModalOpen(true);
  };

  const handleTestPing = async () => {
    if (!apiUrlInput) {
      Message.warning('Iltimos, tekshirish uchun HEMIS API URL manzilini kiriting!');
      return;
    }

    try {
      const result = await hemisTestConnectionMutation.mutateAsync({
        hemisApiUrl: apiUrlInput,
        apiKey: apiKeyInput || undefined,
      });
      setPingResult(result);
      if (result.success) {
        Message.success(`Ulanish muvaffaqiyatli: ${result.pingMs} ms`);
      } else {
        Message.error(result.message || 'Ulanishda xatolik yuz berdi!');
      }
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Serverga so‘rov yuborishda xatolik!');
    }
  };

  // Execute sync directly adhering to real server mode
  const handleExecuteSync = async () => {
    try {
      const isLive = hemisStatus?.mode === 'LIVE';
      const res = await hemisSyncMutation.mutateAsync({
        mode: isLive ? 'LIVE' : 'DEMO',
        forceDemo: isLive ? undefined : true,
        hemisApiUrl: apiUrlInput || undefined,
        apiKey: apiKeyInput || undefined,
      });

      if (res.isDemoStub) {
        Message.warning(
          `[DEMO] Namunaviy ma’lumotlar yangilandi: ${res.syncedDepartments} ta kafedra, ${res.syncedRooms} ta xona!`,
        );
      } else {
        Message.success(
          `Jonli HEMIS sinxronizatsiyasi yakunlandi: ${res.syncedDepartments} ta kafedra, ${res.syncedRooms} ta xona, ${res.syncedUsers || 0} ta xodim!`,
        );
      }

      setIsSyncConfirmOpen(false);
      refetchStatus();
      refetchLogs();
    } catch (err: any) {
      Message.error(
        err?.response?.data?.message ||
          'Sinxronizatsiyada xatolik yuz berdi. Tashqi HEMIS serveri bilan aloqani tekshiring!',
      );
    }
  };

  const handleExportUzAsbo = async () => {
    setExportLoading(true);
    setExportResult(null);
    setXlsxDownloadData(null);
    try {
      const res = await apiClient.get(API_ENDPOINTS.INTEGRATIONS.UZASBO_EXPORT, {
        params: {
          period: exportPeriod,
          type: exportType,
          format: exportFormat,
        },
      });

      if (exportFormat === 'xlsx') {
        const fileInfo = res.data;
        if (fileInfo?.base64) {
          setXlsxDownloadData({ base64: fileInfo.base64, fileName: fileInfo.fileName });
          // Auto download via blob
          const byteCharacters = atob(fileInfo.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {
            type: fileInfo.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileInfo.fileName || `uzasbo_export_${exportPeriod}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          setExportResult(`[Excel Fayl: ${fileInfo.fileName} muvaffaqiyatli shakllantirildi va avtomatik yuklab olindi]`);
          Message.success('UzASBO 3-varaqli Excel hisoboti muvaffaqiyatli yuklab olindi!');
          return;
        }
      }

      const formatted =
        exportFormat === 'json' ? JSON.stringify(res.data, null, 2) : String(res.data);

      setExportResult(formatted);
      Message.success('UzASBO / 1C hisoboti muvaffaqiyatli shakllantirildi!');
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Eksport jarayonida xatolik yuz berdi!');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadFile = () => {
    if (!exportResult) return;
    if (exportFormat === 'xlsx' && xlsxDownloadData) {
      const byteCharacters = atob(xlsxDownloadData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = xlsxDownloadData.fileName || `uzasbo_export_${exportPeriod}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      Message.success('Excel fayli yuklab olindi!');
      return;
    }
    const blob = new Blob([exportResult], {
      type: exportFormat === 'json' ? 'application/json' : 'application/xml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uzasbo_export_${exportPeriod}_${exportType}.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
    Message.success('Fayl yuklab olindi!');
  };

  const handleCopyResult = () => {
    if (!exportResult) return;
    navigator.clipboard.writeText(exportResult);
    Message.success('Kopiya qilindi!');
  };

  const renderStatusTag = (status?: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>
            ULANGAN (CONNECTED)
          </Tag>
        );
      case 'CONFIGURED_BUT_STUB':
        return (
          <Tag color="arcoblue" icon={<IconExclamationCircle />} style={{ borderRadius: 0 }}>
            SOZLANGAN (STUB REJIMI)
          </Tag>
        );
      case 'DEMO':
      case 'DEMO_STUB':
        return (
          <Tag color="gold" icon={<IconExclamationCircle />} style={{ borderRadius: 0 }}>
            {hemisStatus?.isWaitingForCredentials ? 'DEMO (Kalitlar kutilmoqda)' : 'DEMO REJIMI'}
          </Tag>
        );
      case 'CONNECTION_FAILED':
      case 'ERROR':
      case 'AUTHENTICATION_FAILED':
        return (
          <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0 }}>
            ULANISHDA XATOLIK
          </Tag>
        );
      case 'NOT_CONFIGURED':
      default:
        return (
          <Tag color="gray" icon={<IconInfoCircle />} style={{ borderRadius: 0 }}>
            SOZLANMAGAN
          </Tag>
        );
    }
  };

  const renderStatusAlert = () => {
    const status = hemisStatus?.status;
    if (status === 'ERROR' || status === 'CONNECTION_FAILED' || status === 'AUTHENTICATION_FAILED' || hemisStatus?.lastError) {
      return (
        <Alert
          type="error"
          title="HEMIS Serveri Bilan Aloqada Xatolik"
          content={
            hemisStatus?.lastError ||
            hemisStatus?.errorMessage ||
            hemisStatus?.message ||
            'Tashqi HEMIS serveridan javob olinmadi. Iltimos, ulanish sozlamalarini tekshiring.'
          }
          style={{ borderRadius: 0 }}
        />
      );
    }

    if (hemisStatus?.isWaitingForCredentials) {
      return (
        <Alert
          type="info"
          title="HEMIS Jonli API Kalitlari Kutilmoqda (Xavfsiz Sinov Rejimi)"
          content={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>{hemisStatus?.message || 'HEMIS API kalitlari hali kiritilmagan. Tizim xavfsiz sinov (DEMO) rejimida to‘liq ishlamoqda.'}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                {hemisStatus?.instructions || 'Vazirlik yoki OTM ma’murlari tomonidan HEMIS_API_URL va HEMIS_API_KEY taqdim etilgach, «HEMIS Sozlamalari & Ping» tugmasi orqali ulanishni tekshirib, jonli rejimga o‘tishingiz mumkin.'}
              </div>
            </div>
          }
          action={
            <Button
              size="small"
              type="primary"
              icon={<IconSettings />}
              style={{ borderRadius: 0 }}
              onClick={handleOpenConfigModal}
            >
              Kalitlarni Kiritish va Tekshirish
            </Button>
          }
          style={{ borderRadius: 0 }}
        />
      );
    }

    return null;
  };

  const hemisItems = [
    {
      label: 'HEMIS API Shlyuzi',
      value: hemisStatus?.apiUrl ? (
        <Tag color="blue" style={{ borderRadius: 0 }}>
          {hemisStatus.apiUrl}
        </Tag>
      ) : (
        <Text type="secondary">Sozlanmagan (URL kiritilmagan)</Text>
      ),
    },
    {
      label: 'Aloqa Holati',
      value: renderStatusTag(hemisStatus?.status),
    },
    {
      label: 'Ishlash Rejimi',
      value:
        hemisStatus?.mode === 'LIVE' ? (
          <Tag color="green" style={{ borderRadius: 0, fontWeight: 600 }}>
            Haqiqiy Jonli API (Live)
          </Tag>
        ) : hemisStatus?.mode === 'DEMO' || hemisStatus?.mode === 'DEMO_STUB' ? (
          <Tag color="gold" style={{ borderRadius: 0, fontWeight: 600 }}>
            Demo Sinov Rejimi
          </Tag>
        ) : (
          <Tag color="gray" style={{ borderRadius: 0 }}>
            Sozlanmagan
          </Tag>
        ),
    },
    {
      label: 'Protokol Versiyasi',
      value: hemisStatus?.hemisVersion || 'HEMIS REST API v2.4',
    },
    {
      label: 'Oxirgi Sinxronlash',
      value: hemisStatus?.lastSyncAt ? (
        <Space>
          <span>{new Date(hemisStatus.lastSyncAt).toLocaleString('uz-UZ')}</span>
          <Tag
            color={
              hemisStatus.lastSyncType === 'HEMIS_SYNC_DEMO' ||
              hemisStatus.lastSyncType === 'HEMIS_STUB_SYNC'
                ? 'gold'
                : 'green'
            }
            size="small"
            style={{ borderRadius: 0 }}
          >
            {hemisStatus.lastSyncType === 'HEMIS_SYNC_DEMO' ||
            hemisStatus.lastSyncType === 'HEMIS_STUB_SYNC'
              ? 'Demo Seed'
              : 'Jonli Sinxron'}
          </Tag>
        </Space>
      ) : (
        <Text type="secondary">Hali sinxronlanmagan</Text>
      ),
    },
    {
      label: 'Sinxronlangan Kafedralar',
      value: `${hemisStatus?.stats?.syncedDepartments || 0} ta kafedra va bo‘lim`,
    },
    {
      label: 'Sinxronlangan Auditoriyalar',
      value: `${hemisStatus?.stats?.syncedRooms || 0} ta xona / laboratoriya`,
    },
    {
      label: 'Sinxronlangan Xodimlar',
      value: `${hemisStatus?.stats?.syncedUsers || 0} ta mas’ul xodim / o‘qituvchi`,
    },
    ...(hemisStatus?.lastError
      ? [
          {
            label: 'Oxirgi Xatolik Tafsiloti',
            value: (
              <Text type="error" bold>
                {hemisStatus.lastError}
              </Text>
            ),
          },
        ]
      : []),
  ];

  // Columns for Live HEMIS Sync Logs Table
  const syncLogColumns = [
    {
      title: 'Vaqt',
      dataIndex: 'createdAt',
      width: 140,
      render: (val: string) => {
        if (!val) return '—';
        const d = new Date(val);
        const dateStr = d.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return (
          <div style={{ paddingLeft: 8, lineHeight: 1.35 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>
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
      title: 'Rejim / Amal',
      dataIndex: 'action',
      width: 150,
      render: (action: string, record: HemisSyncLogItem) => {
        if (action === 'HEMIS_LIVE_SYNC' || record.details?.mode === 'LIVE') {
          return (
            <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0, fontWeight: 600 }}>
              JONLI (LIVE)
            </Tag>
          );
        }
        if (action === 'HEMIS_SYNC_FAILED') {
          return (
            <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0, fontWeight: 600 }}>
              XATOLIK
            </Tag>
          );
        }
        return (
          <Tag color="gold" icon={<IconInfoCircle />} style={{ borderRadius: 0, fontWeight: 600 }}>
            DEMO SEED
          </Tag>
        );
      },
    },
    {
      title: 'Xodimlar',
      width: 120,
      render: (_: any, record: HemisSyncLogItem) => {
        const count = record.details?.syncedUsers;
        return (
          <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 500 }}>
            {count !== undefined ? `${count} ta xodim` : '—'}
          </Tag>
        );
      },
    },
    {
      title: 'Xonalar',
      width: 120,
      render: (_: any, record: HemisSyncLogItem) => {
        const count = record.details?.syncedRooms;
        return (
          <Tag color="purple" style={{ borderRadius: 0, fontWeight: 500 }}>
            {count !== undefined ? `${count} ta xona` : '—'}
          </Tag>
        );
      },
    },
    {
      title: 'Kafedralar',
      width: 130,
      render: (_: any, record: HemisSyncLogItem) => {
        const count = record.details?.syncedDepartments;
        return (
          <Tag color="teal" style={{ borderRadius: 0, fontWeight: 500 }}>
            {count !== undefined ? `${count} ta kafedra` : '—'}
          </Tag>
        );
      },
    },
    {
      title: 'Ijrochi (Mas’ul)',
      width: 160,
      render: (_: any, record: HemisSyncLogItem) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {record.user?.fullName || 'Tizim (Rejali Cron)'}
          </div>
          {record.user?.role && (
            <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
              @{record.user.username} • {record.user.role}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tafsilotlar & Holat',
      minWidth: 200,
      render: (_: any, record: HemisSyncLogItem) => {
        if (record.details?.error) {
          return (
            <Text type="error" style={{ fontSize: 12 }}>
              {record.details.error}
            </Text>
          );
        }
        if (record.details?.apiUrl) {
          return (
            <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
              <span>Endpoint: </span>
              <Text code style={{ fontSize: 11 }}>{record.details.apiUrl}</Text>
            </div>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>Muvaffaqiyatli sinxronlandi</Text>;
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <PageTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'hemis', title: 'HEMIS Axborot Tizimi Sinxronizatsiyasi' },
          { key: 'uzasbo', title: '1C / UzASBO Buxgalteriya Eksporti' },
        ]}
      />

      {/* Main Content Card */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 20 }}>
        {/* TAB 1: HEMIS SYNC */}
        {activeTab === 'hemis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {renderStatusAlert()}

            {isStatusLoading ? (
              <Spin dot size={20} style={{ display: 'block', margin: '40px auto' }} />
            ) : (
              <Descriptions
                column={2}
                border
                data={hemisItems}
                style={{ borderRadius: 0 }}
              />
            )}

            {/* Action Bar */}
            <Card
              style={{
                borderRadius: 0,
                backgroundColor: 'var(--color-fill-1)',
                border: '1px solid var(--color-border-2)',
              }}
              bodyStyle={{ padding: 16 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <Title heading={6} style={{ margin: 0 }}>
                    Kafedra, Auditoriya va Xodimlarni Sinxronlash
                  </Title>
                </div>
                <Space>
                  <Button
                    icon={<IconHistory />}
                    type={isLogsExpanded ? 'primary' : 'default'}
                    style={{ borderRadius: 0 }}
                    onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                  >
                    {isLogsExpanded ? 'Sinxronizatsiyalar Tarixini Yashirish' : `Sinxronizatsiyalar Tarixi (${syncLogs.length})`}{' '}
                    {isLogsExpanded ? <IconUp style={{ marginLeft: 4 }} /> : <IconDown style={{ marginLeft: 4 }} />}
                  </Button>
                  <Button
                    icon={<IconSettings />}
                    style={{ borderRadius: 0 }}
                    onClick={handleOpenConfigModal}
                  >
                    HEMIS Sozlamalari & Ping
                  </Button>
                  <Button
                    type="primary"
                    icon={<IconSync />}
                    loading={hemisSyncMutation.isPending}
                    style={{ borderRadius: 0 }}
                    onClick={() => setIsSyncConfirmOpen(true)}
                  >
                    {hemisStatus?.mode === 'LIVE' ? 'Jonli Sinxronlashni Boshlash' : 'Demo Sinxronlashni Boshlash'}
                  </Button>
                </Space>
              </div>
            </Card>

            {/* Recent Sync Clean Summary Bar (Clickable to expand table below) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--color-fill-2)',
                border: '1px dashed var(--color-border-3)',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => setIsLogsExpanded(!isLogsExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconHistory style={{ fontSize: 18, color: 'var(--color-primary-6)' }} />
                <div>
                  <Text style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                    Oxirgi sinxronizatsiya:
                  </Text>{' '}
                  {syncLogs.length > 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                      {new Date(syncLogs[0].createdAt).toLocaleString('uz-UZ')} —{' '}
                      {syncLogs[0].action === 'HEMIS_LIVE_SYNC' ? (
                        <Tag color="green" size="small" style={{ borderRadius: 0 }}>JONLI</Tag>
                      ) : syncLogs[0].action === 'HEMIS_SYNC_FAILED' ? (
                        <Tag color="red" size="small" style={{ borderRadius: 0 }}>XATOLIK</Tag>
                      ) : (
                        <Tag color="gold" size="small" style={{ borderRadius: 0 }}>DEMO SEED</Tag>
                      )}{' '}
                      ({syncLogs[0].details?.syncedDepartments || 0} ta kafedra, {syncLogs[0].details?.syncedRooms || 0} ta xona, {syncLogs[0].details?.syncedUsers || 0} ta xodim)
                    </span>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Hali sinxronizatsiya o‘tkazilmagan
                    </Text>
                  )}
                </div>
              </div>
              <Button
                type="text"
                size="small"
                style={{ borderRadius: 0, fontWeight: 500 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLogsExpanded(!isLogsExpanded);
                }}
              >
                {isLogsExpanded ? (
                  <Space size={4}>
                    <span>Jurnalni yashirish</span>
                    <IconUp />
                  </Space>
                ) : (
                  <Space size={4}>
                    <span>Barcha jurnallarni pastda ochish ({syncLogs.length})</span>
                    <IconDown />
                  </Space>
                )}
              </Button>
            </div>

            {/* Expandable HEMIS Sync Logs Table (Full Width directly underneath) */}
            {isLogsExpanded && (
              <div
                style={{
                  padding: 16,
                  backgroundColor: 'var(--color-bg-2)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Space>
                    <IconHistory style={{ fontSize: 18, color: 'var(--color-primary-6)' }} />
                    <Title heading={6} style={{ margin: 0 }}>
                      HEMIS Sinxronizatsiyalari Tarixi va Audit Jurnali
                    </Title>
                    <Tag color="blue" size="small" style={{ borderRadius: 0 }}>
                      Jami: {syncLogs.length} ta yozuv
                    </Tag>
                  </Space>

                  <Space>
                    <Button
                      size="small"
                      icon={<IconSync />}
                      style={{ borderRadius: 0 }}
                      loading={isLogsLoading}
                      onClick={() => refetchLogs()}
                    >
                      Jurnalni Yangilash
                    </Button>
                    <Button
                      size="small"
                      style={{ borderRadius: 0 }}
                      onClick={() => setIsLogsExpanded(false)}
                    >
                      Yashirish ▲
                    </Button>
                  </Space>
                </div>

                <StandardTable<HemisSyncLogItem>
                  rowKey="id"
                  columns={syncLogColumns}
                  data={syncLogs}
                  loading={isLogsLoading}
                  scrollX={1000}
                  emptyText="HEMIS sinxronizatsiya jurnali mavjud emas"
                  pagination={{ pageSize: 10 }}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 1C / UzASBO EXPORT */}
        {activeTab === 'uzasbo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Alert
              type="info"
              title="1C / UzASBO Oflayn Davlat Standarti Buxgalteriya Eksporti"
              content="Ushbu modul orqali universitetning asosiy vositalari reestri (010, 013 sub-hisoblar), ombor qoldiqlari (060 sub-hisob) va rasmiy chiqimlar (OS-2 shakli) O‘zbekiston Respublikasi Davlat buxgalteriya hisobi talablari bo‘yicha JSON va XML formatlarda eksport qilinadi. Shakllantirilgan fayl UzASBO yoki 1C:Korxona tizimiga to‘g‘ridan-to‘g‘ri import qilinadi."
              style={{ borderRadius: 0 }}
            />

            <Row gutter={16}>
              <Col xs={24} sm={12} md={6}>
                <div style={{ marginBottom: 6 }}>
                  <Text bold>Hisobot Davri (Oy/Yil):</Text>
                </div>
                <Input
                  style={{ borderRadius: 0 }}
                  value={exportPeriod}
                  onChange={setExportPeriod}
                  placeholder="YYYY-MM"
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ marginBottom: 6 }}>
                  <Text bold>Eksport Tarkibi:</Text>
                </div>
                <Select
                  style={{ borderRadius: 0, width: '100%' }}
                  value={exportType}
                  onChange={setExportType}
                >
                  <Select.Option value="summary">Umumiy Jamlama Hisobot</Select.Option>
                  <Select.Option value="movements">Ombor Chiqimlari Jurnali (OS-2)</Select.Option>
                  <Select.Option value="assets">Asosiy Vositalar Reestri (010 / 013)</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ marginBottom: 6 }}>
                  <Text bold>Fayl Formati:</Text>
                </div>
                <Select
                  style={{ borderRadius: 0, width: '100%' }}
                  value={exportFormat}
                  onChange={setExportFormat}
                >
                  <Select.Option value="xlsx">Excel (.xlsx 3-Varaqli Jadval)</Select.Option>
                  <Select.Option value="xml">XML (UzASBO Davlat Standarti)</Select.Option>
                  <Select.Option value="json">JSON (1C Shlyuzi Formati)</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ marginBottom: 6 }}>&nbsp;</div>
                <Button
                  type="primary"
                  icon={<IconDownload />}
                  style={{ borderRadius: 0, width: '100%' }}
                  loading={exportLoading}
                  onClick={handleExportUzAsbo}
                >
                  Hisobotni Shakllantirish
                </Button>
              </Col>
            </Row>

            {exportResult && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text bold style={{ fontSize: 14 }}>
                    Shakllantirilgan Eksport Natijasi ({exportFormat.toUpperCase()}):
                  </Text>
                  <Space>
                    <Button size="small" icon={<IconCopy />} onClick={handleCopyResult} style={{ borderRadius: 0 }}>
                      Nusxa Olish
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<IconDownload />}
                      style={{ borderRadius: 0 }}
                      onClick={handleDownloadFile}
                    >
                      Faylni Yuklab Olish (.{exportFormat})
                    </Button>
                  </Space>
                </div>
                <pre
                  style={{
                    backgroundColor: 'var(--color-fill-2)',
                    padding: 16,
                    borderRadius: 0,
                    maxHeight: 400,
                    overflowY: 'auto',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    border: '1px solid var(--color-border-2)',
                  }}
                >
                  {exportResult}
                </pre>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* MODAL 1: HEMIS SOZLAMALARI VA PING TEKSHIRUVI */}
      <Modal
        title="HEMIS API Sozlamalari va Aloqani Tekshirish (Ping)"
        visible={isConfigModalOpen}
        onCancel={() => setIsConfigModalOpen(false)}
        footer={null}
        style={{ borderRadius: 0, maxWidth: 560 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
            Universitetning rasmiy HEMIS axborot tizimi endpointi va maxfiy API kalitini kiritib, jonli serverga ulanish tezligini (ping) tekshirishingiz mumkin.
          </Paragraph>

          <div>
            <Text bold style={{ display: 'block', marginBottom: 6 }}>
              HEMIS API Endpoint URL:
            </Text>
            <Input
              style={{ borderRadius: 0 }}
              placeholder="https://hemis.edu.uz/api/v1 yoki http://localhost:9999/api"
              value={apiUrlInput}
              onChange={setApiUrlInput}
            />
          </div>

          <div>
            <Text bold style={{ display: 'block', marginBottom: 6 }}>
              HEMIS API Kalit (Bearer Token yoki api-key):
            </Text>
            <Input.Password
              style={{ borderRadius: 0 }}
              placeholder="Tashqi HEMIS tizimi tomonidan berilgan maxfiy token"
              value={apiKeyInput}
              onChange={setApiKeyInput}
            />
          </div>

          <Button
            type="outline"
            icon={<IconPlayArrow />}
            loading={hemisTestConnectionMutation.isPending}
            style={{ borderRadius: 0 }}
            onClick={handleTestPing}
          >
            Serverga Ulanishni Tekshirish (Ping)
          </Button>

          {pingResult && (
            <Alert
              type={pingResult.success ? 'success' : 'error'}
              title={
                pingResult.success
                  ? `Ulanish muvaffaqiyatli (${pingResult.pingMs} ms)`
                  : 'Ulanib bo‘lmadi'
              }
              content={pingResult.message}
              style={{ borderRadius: 0 }}
            />
          )}

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button style={{ borderRadius: 0 }} onClick={() => setIsConfigModalOpen(false)}>
              Yopish
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: SINXRONLASHNI TASDIQLASH (SERVER KONFIGURATSIYASIGA ASOSLANGAN) */}
      <Modal
        title="HEMIS Sinxronizatsiyasini Boshlash"
        visible={isSyncConfirmOpen}
        onCancel={() => setIsSyncConfirmOpen(false)}
        style={{ borderRadius: 0, maxWidth: 520 }}
        okText="Sinxronlashni Ishga Tushirish"
        cancelText="Bekor Qilish"
        confirmLoading={hemisSyncMutation.isPending}
        onOk={handleExecuteSync}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hemisStatus?.mode === 'LIVE' ? (
            <Alert
              type="success"
              style={{ borderRadius: 0 }}
              title="Jonli (LIVE) HEMIS REST API Sinxronizatsiyasi"
              content={`"${hemisStatus?.apiUrl || 'HEMIS REST API'}" manziliga so‘rov yuborilib, universitet fakultetlari, kafedralari va xodimlari real vaqtda bazaga sinxronlashtiriladi.`}
            />
          ) : (
            <Alert
              type="info"
              style={{ borderRadius: 0 }}
              title="Namunaviy Sinxronizatsiya (Demo Rejim)"
              content="Namunaviy ma’lumotlar asosida sinxronizatsiya amalga oshiriladi va bu harakat audit jurnalida qayd etiladi."
            />
          )}

          <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
            Sinxronizatsiyani ishga tushirishni tasdiqlaysizmi?
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationsPage;
