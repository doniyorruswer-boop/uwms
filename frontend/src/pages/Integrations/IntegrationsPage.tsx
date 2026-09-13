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
} from '@arco-design/web-react';
import {
  IconSync,
  IconDownload,
  IconCheckCircle,
  IconCloud,
  IconFile,
  IconCopy,
  IconBranch,
  IconStorage,
  IconDesktop,
  IconCalendar,
} from '@arco-design/web-react/icon';
import {
  useHemisStatusQuery,
  useHemisSyncMutation,
} from '../../hooks/useIntegrationsQuery';
import { apiClient } from '../../api/client';
import { PageTabs } from '../../components/Common/PageTabs';
import { API_ENDPOINTS } from '../../constants/api.constants';

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

  const { data: hemisStatus, isLoading: isStatusLoading, refetch: refetchStatus } = useHemisStatusQuery();
  const hemisSyncMutation = useHemisSyncMutation();

  const handleTriggerHemisSync = () => {
    Modal.confirm({
      title: 'HEMIS Sinxronizatsiyasini Boshlash',
      content:
        'OTM HEMIS axborot tizimidan barcha fakultetlar, kafedralar va auditoriyalar ro‘yxati qayta olinadi va UWMS bazasiga sinxronlashtiriladi. Davom etasizmi?',
      okText: 'Sinxronlash',
      cancelText: 'Bekor qilish',
      style: { borderRadius: 0 },
      onOk: async () => {
        try {
          const res = await hemisSyncMutation.mutateAsync({});
          Message.success(
            `HEMIS sinxronizatsiyasi muvaffaqiyatli yakunlandi: ${res.syncedDepartments} ta kafedra, ${res.syncedRooms} ta xona yangilandi!`,
          );
          refetchStatus();
        } catch (err: any) {
          Message.error(err?.response?.data?.message || 'Sinxronizatsiyada xatolik yuz berdi!');
        }
      },
    });
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
        exportFormat === 'json'
          ? JSON.stringify(res.data, null, 2)
          : String(res.data);

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

  const hemisItems = [
    {
      label: 'HEMIS API Shlyuzi',
      value: <Tag color="blue" style={{ borderRadius: 0 }}>https://hemis.edu.uz/api/v2</Tag>,
    },
    {
      label: 'Aloqa Holati',
      value: (
        <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>
          {hemisStatus?.status || 'CONNECTED'}
        </Tag>
      ),
    },
    {
      label: 'Protokol Versiyasi',
      value: hemisStatus?.hemisVersion || 'HEMIS REST API v2.4',
    },
    {
      label: 'Oxirgi Sinxronlash Vaqti',
      value: hemisStatus?.lastSyncAt
        ? new Date(hemisStatus.lastSyncAt).toLocaleString('uz-UZ')
        : 'Hali sinxronlanmagan',
    },
    {
      label: 'Rejali Sinxronizatsiya (Cron)',
      value: 'Har kecha soat 02:00 da (Avtomatik)',
    },
    {
      label: 'Sinxronlangan Bo‘limlar',
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
            <Alert
              type="success"
              title="HEMIS API Shlyuzi Faol va Integratsiyalashgan"
              content="OTM axborot tizimining REST API interfeysi orqali fakultetlar, kafedralar, o‘quv laboratoriyalari va xonalar real vaqtda bazaga sinxronlashtiriladi."
              style={{ borderRadius: 0 }}
            />

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
                    Qo‘lda Sinxronlashni Ishga Tushirish
                  </Title>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                    Universitetning yangi ochilgan kafedralari va auditoriyalari ro‘yxatini HEMIS API orqali darhol qabul qilish.
                  </Paragraph>
                </div>
                <Button
                  type="primary"
                  icon={<IconSync />}
                  loading={hemisSyncMutation.isPending}
                  style={{ borderRadius: 0 }}
                  onClick={handleTriggerHemisSync}
                >
                  HEMIS Tizimidan Hozir Sinxronlash
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: 1C / UzASBO EXPORT */}
        {activeTab === 'uzasbo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Alert
              type="info"
              title="Davlat G‘aznachiligi va UzASBO Buxgalteriya Standarti"
              content="Universitet asosiy vositalarining amortizatsiyasi, hisobdan chiqarilgan (OS-4) ashyolar va sarflanuvchi materiallar ombor chiqimlari (OS-2) O‘zbekiston Respublikasi Davlat buxgalteriya hisobi (010, 013, 060 sub-hisob raqamlari) bo‘yicha eksport qilinadi."
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
                  <Select.Option value="assets">Asosiy Vositalar Reestri (010)</Select.Option>
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
                  <Select.Option value="json">JSON (1C API Shlyuzi)</Select.Option>
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
    </div>
  );
};

export default IntegrationsPage;
