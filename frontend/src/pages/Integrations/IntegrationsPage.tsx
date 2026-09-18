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
  Radio,
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
} from '@arco-design/web-react/icon';
import {
  useHemisStatusQuery,
  useHemisSyncMutation,
  useHemisTestConnectionMutation,
} from '../../hooks/useIntegrationsQuery';
import { apiClient } from '../../api/client';
import { PageTabs } from '../../components/Common/PageTabs';
import { API_ENDPOINTS } from '../../constants/api.constants';
import type { HemisTestConnectionResult } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

export const IntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('hemis');
  const [exportPeriod, setExportPeriod] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );
  const [exportType, setExportType] = useState<string>('summary');
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  // Sozlamalar va Sinxronlash modallari
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState<boolean>(false);

  // Sozlamalar form qiymatlari
  const [apiUrlInput, setApiUrlInput] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [syncMode, setSyncMode] = useState<'LIVE' | 'DEMO_STUB'>('DEMO_STUB');

  // Ping holati
  const [pingResult, setPingResult] = useState<HemisTestConnectionResult | null>(null);

  const {
    data: hemisStatus,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useHemisStatusQuery();

  const hemisSyncMutation = useHemisSyncMutation();
  const hemisTestConnectionMutation = useHemisTestConnectionMutation();

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

  const handleExecuteSync = async () => {
    try {
      const res = await hemisSyncMutation.mutateAsync({
        mode: syncMode,
        hemisApiUrl: apiUrlInput || undefined,
        apiKey: apiKeyInput || undefined,
      });

      if (res.isDemoStub) {
        Message.warning(
          `[DEMO / STUB] Sinov ma’lumotlari muvaffaqiyatli yangilandi: ${res.syncedDepartments} ta kafedra, ${res.syncedRooms} ta xona!`,
        );
      } else {
        Message.success(
          `Jonli HEMIS sinxronizatsiyasi yakunlandi: ${res.syncedDepartments} ta kafedra, ${res.syncedRooms} ta xona!`,
        );
      }

      setIsSyncConfirmOpen(false);
      refetchStatus();
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
    try {
      const res = await apiClient.get(API_ENDPOINTS.INTEGRATIONS.UZASBO_EXPORT, {
        params: {
          period: exportPeriod,
          type: exportType,
          format: exportFormat,
        },
      });

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
      case 'DEMO_STUB':
        return (
          <Tag color="orange" icon={<IconExclamationCircle />} style={{ borderRadius: 0 }}>
            DEMO / STUB REJIMI
          </Tag>
        );
      case 'CONNECTION_FAILED':
        return (
          <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0 }}>
            ULANISHDA XATOLIK
          </Tag>
        );
      case 'AUTHENTICATION_FAILED':
        return (
          <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0 }}>
            RUXSAT XATOSI (AUTH FAILED)
          </Tag>
        );
      case 'NOT_CONFIGURED':
      default:
        return (
          <Tag color="gray" icon={<IconInfoCircle />} style={{ borderRadius: 0 }}>
            SOZLANMAGAN (NOT CONFIGURED)
          </Tag>
        );
    }
  };

  const renderStatusAlert = () => {
    const status = hemisStatus?.status;
    if (status === 'CONNECTED') {
      return (
        <Alert
          type="success"
          title="HEMIS REST API Bilan Real Aloqa O‘rnatilgan"
          content={
            hemisStatus?.message ||
            'OTM axborot tizimining REST API interfeysi orqali fakultetlar, kafedralar va auditoriyalar real vaqtda bazaga sinxronlashtiriladi.'
          }
          style={{ borderRadius: 0 }}
        />
      );
    }
    if (status === 'DEMO_STUB') {
      return (
        <Alert
          type="warning"
          title="DIQQAT: Tizim DEMO / STUB Rejimida Ishlamoqda"
          content="Haqiqiy HEMIS API serveriga ulanish mavjud emas. Sinov va ko‘rgazma maqsadida OTMning standart namunaviy kafedralari va xonalari ro‘yxati ishlatilmoqda. Tizim audit jurnalida barcha amallar STUB sifatida qayd etiladi."
          style={{ borderRadius: 0 }}
        />
      );
    }
    if (status === 'CONNECTION_FAILED' || status === 'AUTHENTICATION_FAILED') {
      return (
        <Alert
          type="error"
          title="HEMIS API Serveriga Ulanishda Xatolik Yuz Berdi"
          content={
            hemisStatus?.errorMessage ||
            hemisStatus?.message ||
            'Tashqi HEMIS serveridan javob olinmadi. Iltimos, server manzili va API kalitini tekshiring.'
          }
          style={{ borderRadius: 0 }}
        />
      );
    }

    // Default: NOT_CONFIGURED
    return (
      <Alert
        type="info"
        title="HEMIS API Integratsiyasi Sozlanmagan"
        content="OTM axborot tizimiga ulanish uchun API URL va API Kalit kiritilmagan. Real tizimga ulanish uchun 'Sozlamalar' tugmasini bosing yoki sinov maqsadida 'DEMO / STUB' rejimini tanlang."
        style={{ borderRadius: 0 }}
      />
    );
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
          <Tag color="green" style={{ borderRadius: 0 }}>
            Haqiqiy Jonli API (Live)
          </Tag>
        ) : hemisStatus?.mode === 'DEMO_STUB' ? (
          <Tag color="orange" style={{ borderRadius: 0 }}>
            Demo / Stub Sinov Rejimi
          </Tag>
        ) : (
          <Tag color="gray" style={{ borderRadius: 0 }}>
            Sozlanmagan (Nofaol)
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
            color={hemisStatus.lastSyncType === 'HEMIS_STUB_SYNC' ? 'orange' : 'green'}
            size="small"
            style={{ borderRadius: 0 }}
          >
            {hemisStatus.lastSyncType === 'HEMIS_STUB_SYNC' ? 'Demo/Stub' : 'Jonli Sinxronizatsiya'}
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
              <Spin style={{ display: 'block', margin: '40px auto' }} />
            ) : (
              <Descriptions
                column={2}
                border
                data={hemisItems}
                style={{ borderRadius: 0 }}
              />
            )}

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
                    Kafedra va Auditoriyalarni Sinxronlash
                  </Title>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                    HEMIS REST API orqali universitetning yangi ochilgan kafedralari va auditoriyalarini yangilash.
                  </Paragraph>
                </div>
                <Space>
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
                    onClick={() => {
                      setSyncMode(hemisStatus?.status === 'CONNECTED' ? 'LIVE' : 'DEMO_STUB');
                      setIsSyncConfirmOpen(true);
                    }}
                  >
                    Sinxronlashni Boshlash
                  </Button>
                </Space>
              </div>
            </Card>
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
                  <Select.Option value="json">JSON (1C Shlyuzi Formati)</Select.Option>
                  <Select.Option value="xml">XML (UzASBO Davlat Standarti)</Select.Option>
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
                    <Button size="small" icon={<IconCopy />} onClick={handleCopyResult}>
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

      {/* MODAL 2: SINXRONLASHNI TASDIQLASH VA REJIM TANLASH */}
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
          <Paragraph style={{ margin: 0 }}>
            Universitet fakultetlari, kafedralari va auditoriyalarini yangilash uchun sinxronizatsiya rejimini tanlang:
          </Paragraph>

          <Radio.Group
            direction="vertical"
            value={syncMode}
            onChange={(val) => setSyncMode(val)}
          >
            <Radio value="DEMO_STUB" style={{ alignItems: 'flex-start' }}>
              <div>
                <Text bold>Demo / Stub Sinov Rejimi (Tavsiya etiladi - Sinov uchun)</Text>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                  Tashqi tarmoqqa ulanmasdan, standart OTM namunaviy kafedra va xonalarini bazaga yuklaydi. Tizim audit logida STUB deb qayd etiladi.
                </div>
              </div>
            </Radio>
            <Radio value="LIVE" style={{ alignItems: 'flex-start', marginTop: 12 }}>
              <div>
                <Text bold>Haqiqiy HEMIS REST API (Live Ulanish)</Text>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                  Sozlangan API URL va Token orqali davlat HEMIS serveridan real vaqtda yangi ma’lumotlarni qabul qiladi. Server ulanmasa, xatolik beradi.
                </div>
              </div>
            </Radio>
          </Radio.Group>

          {syncMode === 'LIVE' && !apiUrlInput && !hemisStatus?.apiUrl && (
            <Alert
              type="warning"
              title="API URL kiritilmagan"
              content="Live rejimida sinxronlash uchun avval 'HEMIS Sozlamalari' bo‘limidan API URL va kalitni kiriting!"
              style={{ borderRadius: 0 }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationsPage;
