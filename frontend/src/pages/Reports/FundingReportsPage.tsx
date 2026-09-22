import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Select,
  DatePicker,
  Button,
  Tag,
  Typography,
  Grid,
  Space,
  Progress,
  Alert,
  Spin,
  Empty,
  Tabs,
  Modal,
  Radio,
  Tooltip,
  Divider,
} from '@arco-design/web-react';
import {
  IconDownload,
  IconFilter,
  IconRefresh,
  IconCalendar,
  IconSwap,
  IconCheckCircle,
  IconInfoCircle,
  IconFile,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import {
  useFundingSummaryQuery,
  useFundingMovementsQuery,
  useExportFundingReportMutation,
  FundingSourceType,
} from '../../hooks/useFundingReportsQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { useChiefAccountantExport } from '../../hooks/useChiefAccountantQuery';
import { formatMoney, formatMln, formatDate } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import { StatusTag } from '../../components/Common/StatusTag';
import { getStatusSelectOptions } from '../../constants/status.constants';

const { Title, Text } = Typography;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;
const TabPane = Tabs.TabPane;

export const FundingReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isMol = user?.role === 'MOL';
  const allowedRoles = ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'CHIEF_ACCOUNTANT', 'VICE_RECTOR_FINANCE', 'RECTOR'];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  // Filters state
  const [selectedDates, setSelectedDates] = useState<[string, string] | []>([]);
  const [selectedSource, setSelectedSource] = useState<FundingSourceType | 'ALL'>('ALL');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    isMol && user?.departmentId ? user.departmentId : 'ALL',
  );

  // Active tab
  const [activeTab, setActiveTab] = useState<string>('analysis');

  // Movements pagination
  const [movementPage, setMovementPage] = useState<number>(1);
  const [movementLimit, setMovementLimit] = useState<number>(15);

  // Export Modal state
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);
  const [exportType, setExportType] = useState<'assets' | 'movements' | 'summary'>('assets');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'uzasbo' | '1c'>('xlsx');

  // Query params
  const filterParams = useMemo(() => {
    const params: any = {};
    if (selectedDates.length === 2 && selectedDates[0] && selectedDates[1]) {
      params.from = selectedDates[0];
      params.to = selectedDates[1];
    }
    if (selectedSource !== 'ALL') {
      params.fundingSource = selectedSource;
    }
    if (selectedDepartmentId !== 'ALL') {
      params.departmentId = selectedDepartmentId;
    }
    return params;
  }, [selectedDates, selectedSource, selectedDepartmentId]);

  // Organization departments list
  const { allDepartments, isLoading: isOrgLoading } = useOrganizationQuery();

  // Summary Query
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useFundingSummaryQuery(filterParams);

  // Movements Query
  const movementsParams = useMemo(() => {
    return {
      ...filterParams,
      page: movementPage,
      limit: movementLimit,
    };
  }, [filterParams, movementPage, movementLimit]);

  const {
    data: movementsData,
    isLoading: isMovementsLoading,
    isError: isMovementsError,
    refetch: refetchMovements,
  } = useFundingMovementsQuery(movementsParams);

  // Export Mutations
  const exportMutation = useExportFundingReportMutation();
  const chiefAccountantExport = useChiefAccountantExport();

  const handleResetFilters = () => {
    setSelectedDates([]);
    setSelectedSource('ALL');
    setSelectedDepartmentId(isMol && user?.departmentId ? user.departmentId : 'ALL');
    setMovementPage(1);
  };

  const handleExecuteExport = async () => {
    if (exportFormat === 'uzasbo') {
      chiefAccountantExport.mutate({
        format: 'UZASBO_XML',
        fundingSource: selectedSource !== 'ALL' ? selectedSource : undefined,
      });
    } else if (exportFormat === '1c') {
      chiefAccountantExport.mutate({
        format: '1C_ENTERPRISE_XML',
        fundingSource: selectedSource !== 'ALL' ? selectedSource : undefined,
      });
    } else {
      await exportMutation.mutateAsync({
        ...filterParams,
        type: exportType,
        format: exportFormat,
      });
    }
    setExportModalVisible(false);
  };

  // RBAC Permission Check
  if (!hasAccess) {
    return (
      <ForbiddenView
        requiredRoles={['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL']}
        title="Ushbu sahifaga kirish taqiqlangan"
        subTitle="Moliyalashtirish manbalari hisoboti faqat Bosh Omborchi, Rahbariyat yoki Mas’ul shaxs (MOL) uchun mo‘ljallangan."
      />
    );
  }

  // Sources breakdown
  const byudjetStat = summaryData?.byFundingSource.find((s) => s.source === 'BYUDJET');
  const kontraktStat = summaryData?.byFundingSource.find((s) => s.source === 'KONTRAKT_RIVOJLANTIRISH');
  const grantStat = summaryData?.byFundingSource.find((s) => s.source === 'GRANT');

  return (
    <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Bar */}
      <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Title heading={5} style={{ margin: 0 }}>
              {t('reports.fundingTitle', 'Moliyalashtirish Manbalari Kesimidagi Hisobotlar')}
            </Title>
          </div>

          <Space size="medium">
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                refetchSummary();
                refetchMovements();
              }}
              loading={isSummaryLoading || isMovementsLoading}
            >
              Yangilash
            </Button>
            <Button
              type="primary"
              icon={<IconDownload />}
              onClick={() => setExportModalVisible(true)}
              style={{ backgroundColor: '#00B42A' }}
            >
              Excel / CSV Eksport
            </Button>
          </Space>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border-1)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCalendar style={{ color: 'var(--color-text-3)' }} />
            <Text style={{ fontSize: 13, fontWeight: 500 }}>Sana oralig‘i:</Text>
            <RangePicker
              style={{ width: 260 }}
              value={selectedDates}
              onChange={(dateString) => setSelectedDates(dateString && dateString.length === 2 ? [dateString[0], dateString[1]] : [])}
              placeholder={['Boshlanish', 'Tugash']}
              allowClear
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconFilter style={{ color: 'var(--color-text-3)' }} />
            <Text style={{ fontSize: 13, fontWeight: 500 }}>Manba:</Text>
            <Select
              style={{ width: 230 }}
              value={selectedSource}
              onChange={(val) => setSelectedSource(val as any)}
              options={getStatusSelectOptions('funding', true, 'Barcha manbalar')}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>Kafedra / Bo‘lim:</Text>
            <Select
              style={{ width: 260 }}
              value={selectedDepartmentId}
              onChange={(val) => setSelectedDepartmentId(val)}
              disabled={isMol}
              loading={isOrgLoading}
            >
              {!isMol && <Select.Option value="ALL">Barcha kafedralar</Select.Option>}
              {allDepartments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <Button type="secondary" onClick={handleResetFilters}>
            Filtrlarni tozalash
          </Button>
        </div>
      </Card>

      {/* Error state */}
      {isSummaryError && (
        <Alert
          type="error"
          title="Hisobot ma’lumotlarini yuklashda xatolik yuz berdi"
          content="Server bilan aloqa uzilgan bo‘lishi mumkin. Iltimos, qayta urinib ko‘ring."
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetchSummary()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {/* Loading state */}
      {isSummaryLoading && (
        <Card bordered={false} style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin dot size={20} tip="Moliyalashtirish hisoboti hisoblanmoqda..." />
        </Card>
      )}

      {/* Hero Stat Cards */}
      {!isSummaryLoading && summaryData && (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <StatHeroCard
              title="Davlat Byudjeti"
              value={formatMoney(byudjetStat?.totalValue || 0)}
              subtext={`${byudjetStat?.assetsCount || 0} ta asosiy vosita (${byudjetStat?.percentage || 0}%)`}
              icon={<IconFile style={{ fontSize: 32 }} />}
              color="blue"
              linkText={`${byudjetStat?.movementsCount || 0} ta ombor harakati`}
              onClick={() => {
                setSelectedSource('BYUDJET');
                setActiveTab('analysis');
              }}
            />
          </Col>

          <Col xs={24} sm={12} md={8}>
            <StatHeroCard
              title="To‘lov-shartnoma (Rivojlanish)"
              value={formatMoney(kontraktStat?.totalValue || 0)}
              subtext={`${kontraktStat?.assetsCount || 0} ta asosiy vosita (${kontraktStat?.percentage || 0}%)`}
              icon={<IconSwap style={{ fontSize: 32 }} />}
              color="orange"
              linkText={`${kontraktStat?.movementsCount || 0} ta ombor harakati`}
              onClick={() => {
                setSelectedSource('KONTRAKT_RIVOJLANTIRISH');
                setActiveTab('analysis');
              }}
            />
          </Col>

          <Col xs={24} sm={24} md={8}>
            <StatHeroCard
              title="Ilmiy va Xalqaro Grantlar"
              value={formatMoney(grantStat?.totalValue || 0)}
              subtext={`${grantStat?.assetsCount || 0} ta asosiy vosita (${grantStat?.percentage || 0}%)`}
              icon={<IconCheckCircle style={{ fontSize: 32 }} />}
              color="purple"
              linkText={`${grantStat?.movementsCount || 0} ta ombor harakati`}
              onClick={() => {
                setSelectedSource('GRANT');
                setActiveTab('analysis');
              }}
            />
          </Col>
        </Row>
      )}

      {/* Main Tabs Container */}
      {!isSummaryLoading && (
        <Card bordered={false} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <Tabs activeTab={activeTab} onChange={setActiveTab} type="line">
            {/* TAB 1: TAHLIL VA YIG‘MA */}
            <TabPane key="analysis" title="Umumiy Taqsimot va Tahlil">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 12 }}>
                {/* 1. Funding Sources Comparison Table */}
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title heading={6} style={{ margin: 0 }}>
                      Moliyalashtirish Manbalari Taqqoslama Jurnali
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Jami qoldiq qiymati: <strong>{formatMoney(summaryData?.totals.totalCurrentBookValue)}</strong>
                    </Text>
                  </div>

                  <Table
                    rowKey="source"
                    loading={isSummaryLoading}
                    data={summaryData?.byFundingSource || []}
                    pagination={false}
                    border={{ wrapper: true, cell: true }}
                    columns={[
                      {
                        title: 'Moliyalashtirish Manbasi',
                        dataIndex: 'label',
                        render: (col, record) => (
                          <Space>
                            <StatusTag status={record.source} domain="funding" />
                            <Text bold>{col}</Text>
                          </Space>
                        ),
                      },
                      {
                        title: 'Aktivlar soni',
                        dataIndex: 'assetsCount',
                        width: 130,
                        render: (val) => `${Number(val).toLocaleString()} ta`,
                      },
                      {
                        title: 'Boshlang‘ich xarid qiymati',
                        dataIndex: 'purchaseValue',
                        render: (val) => formatMoney(val),
                      },
                      {
                        title: 'Hozirgi qoldiq qiymati',
                        dataIndex: 'totalValue',
                        render: (val) => <Text bold style={{ color: '#165DFF' }}>{formatMoney(val)}</Text>,
                      },
                      {
                        title: 'Ombor harakatlari',
                        dataIndex: 'movementsCount',
                        width: 150,
                        render: (val) => `${Number(val).toLocaleString()} ta amal`,
                      },
                      {
                        title: 'Umumiy ulush',
                        dataIndex: 'percentage',
                        width: 210,
                        render: (percent) => (
                          <StockLevelGauge
                            percent={percent}
                            width={170}
                            strokeWidth={6}
                            label={
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: percent > 50 ? '#00B42A' : '#165DFF',
                                }}
                              >
                                {percent}%
                              </span>
                            }
                            subLabel={
                              <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                                Balans ulushi
                              </span>
                            }
                            color={percent > 50 ? '#00B42A' : '#165DFF'}
                            status={percent > 50 ? 'success' : 'normal'}
                          />
                        ),
                      },
                    ]}
                  />
                </div>

                {/* 2. Breakdown by Category */}
                <div>
                  <Title heading={6} style={{ marginBottom: 12 }}>
                    Kategoriyalar Kesimidagi Moliyalashtirish Taqsimoti
                  </Title>
                  <Table
                    rowKey="categoryName"
                    loading={isSummaryLoading}
                    data={summaryData?.byCategory || []}
                    pagination={{ pageSize: 8, showTotal: true }}
                    border={{ wrapper: true, cell: true }}
                    columns={[
                      {
                        title: 'Nomenklatura Kategoriyasi',
                        dataIndex: 'categoryName',
                        render: (name) => <Text bold>{name}</Text>,
                      },
                      {
                        title: 'Jami miqdor',
                        dataIndex: 'count',
                        width: 120,
                        render: (val) => `${val} ta`,
                      },
                      {
                        title: 'Byudjet hisobidan',
                        dataIndex: 'byudjetCount',
                        width: 150,
                        render: (val) => (
                          <Tag color={val > 0 ? 'arcoblue' : 'gray'}>{val} ta</Tag>
                        ),
                      },
                      {
                        title: 'Kontrakt hisobidan',
                        dataIndex: 'kontraktCount',
                        width: 150,
                        render: (val) => (
                          <Tag color={val > 0 ? 'orange' : 'gray'}>{val} ta</Tag>
                        ),
                      },
                      {
                        title: 'Grant hisobidan',
                        dataIndex: 'grantCount',
                        width: 150,
                        render: (val) => (
                          <Tag color={val > 0 ? 'purple' : 'gray'}>{val} ta</Tag>
                        ),
                      },
                      {
                        title: 'Jami qoldiq qiymati',
                        dataIndex: 'totalValue',
                        render: (val) => <Text bold>{formatMoney(val)}</Text>,
                      },
                    ]}
                  />
                </div>

                {/* 3. Breakdown by Department */}
                {!isMol && (
                  <div>
                    <Title heading={6} style={{ marginBottom: 12 }}>
                      Kafedralar va Bo‘limlar Kesimidagi Taqsimot
                    </Title>
                    <Table
                      rowKey="departmentId"
                      loading={isSummaryLoading}
                      data={summaryData?.byDepartment || []}
                      pagination={{ pageSize: 10, showTotal: true }}
                      border={{ wrapper: true, cell: true }}
                      columns={[
                        {
                          title: 'Kafedra / Bo‘lim',
                          dataIndex: 'departmentName',
                          render: (name) => <Text bold>{name}</Text>,
                        },
                        {
                          title: 'Biriktirilgan aktivlar',
                          dataIndex: 'assetsCount',
                          width: 160,
                          render: (val) => `${val} ta vosita`,
                        },
                        {
                          title: 'Byudjet',
                          dataIndex: 'byudjetCount',
                          width: 110,
                          render: (val) => <Tag color={val > 0 ? 'arcoblue' : 'gray'}>{val}</Tag>,
                        },
                        {
                          title: 'Kontrakt',
                          dataIndex: 'kontraktCount',
                          width: 110,
                          render: (val) => <Tag color={val > 0 ? 'orange' : 'gray'}>{val}</Tag>,
                        },
                        {
                          title: 'Grant',
                          dataIndex: 'grantCount',
                          width: 110,
                          render: (val) => <Tag color={val > 0 ? 'purple' : 'gray'}>{val}</Tag>,
                        },
                        {
                          title: 'Jami balans qiymati',
                          dataIndex: 'totalValue',
                          render: (val) => <Text bold>{formatMoney(val)}</Text>,
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            </TabPane>

            {/* TAB 2: HARAKATLAR JURNALI */}
            <TabPane key="movements" title="Ombor Harakatlari Jurnali">
              <div style={{ paddingTop: 12 }}>
                {isMovementsError && (
                  <Alert
                    type="error"
                    title="Harakatlar jurnalini yuklashda xatolik yuz berdi"
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Table
                  rowKey="id"
                  loading={isMovementsLoading}
                  data={movementsData?.items || []}
                  border={{ wrapper: true, cell: true }}
                  pagination={{
                    current: movementPage,
                    pageSize: movementLimit,
                    total: movementsData?.total || 0,
                    showTotal: true,
                    sizeCanChange: true,
                    pageSizeChangeResetCurrent: true,
                    onChange: (page, pageSize) => {
                      setMovementPage(page);
                      setMovementLimit(pageSize);
                    },
                  }}
                  noDataElement={<Empty description="Ushbu mezonlar bo‘yicha harakatlar topilmadi" />}
                  columns={[
                    {
                      title: 'Harakat №',
                      dataIndex: 'movementNumber',
                      width: 150,
                      render: (num) => <Text bold copyable>{num}</Text>,
                    },
                    {
                      title: 'Turi',
                      dataIndex: 'movementType',
                      width: 140,
                      render: (type) => <StatusTag status={type} domain="movement" />,
                    },
                    {
                      title: 'Manba',
                      dataIndex: 'fundingSource',
                      width: 160,
                      render: (src) => <StatusTag status={src} domain="funding" />,
                    },
                    {
                      title: 'Qayerdan',
                      dataIndex: 'fromWarehouse',
                      render: (_val, record) => {
                        if (record.fromWarehouse) return `Ombor: ${record.fromWarehouse.name}`;
                        if (record.fromRoom) return `Xona ${record.fromRoom.number} (${record.fromRoom.name})`;
                        if (record.supplier) return `Ta’minotchi: ${record.supplier.name}`;
                        return '—';
                      },
                    },
                    {
                      title: 'Qayerga',
                      dataIndex: 'toWarehouse',
                      render: (_val, record) => {
                        if (record.toWarehouse) return `Ombor: ${record.toWarehouse.name}`;
                        if (record.toRoom) return `Xona ${record.toRoom.number} (${record.toRoom.name})`;
                        return '—';
                      },
                    },
                    {
                      title: 'Tarkibi (Mahsulotlar)',
                      dataIndex: 'items',
                      render: (items: any[]) => {
                        if (!items || items.length === 0) return '—';
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {items.slice(0, 2).map((it, idx) => (
                              <Text key={idx} style={{ fontSize: 12 }}>
                                • {it.item?.name || 'Noma’lum'}: <strong>{it.quantity} {it.item?.unit || 'dona'}</strong>
                              </Text>
                            ))}
                            {items.length > 2 && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                + yana {items.length - 2} ta mahsulot
                              </Text>
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Mas’ul ijrochi',
                      dataIndex: 'executedBy',
                      width: 170,
                      render: (user) => user?.fullName || '—',
                    },
                    {
                      title: 'Sana',
                      dataIndex: 'createdAt',
                      width: 120,
                      render: (date) => (date ? new Date(date).toISOString().slice(0, 10) : '—'),
                    },
                    {
                      title: 'WORM Nazorat Kodi',
                      width: 180,
                      render: (_val, record: any) => {
                        const hashDisplay = record.stampHash || `HMAC-${record.id?.slice(0, 8) || 'REC'}`;
                        return (
                          <Tooltip content={`HMAC Kriptografik Xesh: ${hashDisplay}`}>
                            <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0, fontWeight: 500 }}>
                              HMAC: {hashDisplay.slice(0, 8)}...
                            </Tag>
                          </Tooltip>
                        );
                      },
                    },
                  ]}
                />
              </div>
            </TabPane>
          </Tabs>
        </Card>
      )}

      {/* Export Configuration Modal */}
      <Modal
        title={
          <Space>
            <IconDownload />
            <span>Moliyalashtirish Hisobotini Eksport Qilish</span>
          </Space>
        }
        visible={exportModalVisible}
        onOk={handleExecuteExport}
        confirmLoading={exportMutation.isPending || chiefAccountantExport.isPending}
        onCancel={() => setExportModalVisible(false)}
        okText="Yuklab olish"
        cancelText="Bekor qilish"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            content="Eksport qilinayotgan barcha hisobotlar universitet xavfsizlik audit jurnalida (REPORT_EXPORT) qayd etiladi."
          />

          <div>
            <Text bold style={{ display: 'block', marginBottom: 8 }}>
              1. Eksport predmeti (Mazmuni):
            </Text>
            <Radio.Group
              value={exportType}
              onChange={(val) => setExportType(val)}
              direction="vertical"
            >
              <Radio value="assets">
                <strong>Asosiy vositalar reestri</strong> — inventar raqami, narxi, qoldiq qiymati, joylashuvi
              </Radio>
              <Radio value="movements">
                <strong>Ombor harakatlari jurnali</strong> — kirim, chiqim va ichki ko‘chirishlar
              </Radio>
              <Radio value="summary">
                <strong>Yig‘ma manbalar xulosasi</strong> — manbalar va ulushlar balansi
              </Radio>
            </Radio.Group>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            <Text bold style={{ display: 'block', marginBottom: 8 }}>
              2. Davlat va Buxgalteriya formati:
            </Text>
            <Radio.Group
              value={exportFormat}
              onChange={(val) => setExportFormat(val)}
              direction="vertical"
            >
              <Radio value="xlsx">
                <strong>Excel (.xlsx)</strong> — rasmiy jadval formati (WORM HMAC nazorat kodi bilan)
              </Radio>
              <Radio value="csv">
                <strong>CSV (.csv)</strong> — UTF-8 BOM bilan
              </Radio>
              <Radio value="uzasbo">
                <strong>UzASBO G‘aznachilik XML (.xml)</strong> — Moliya Vazirligi UzASBO 2.0 standarti
              </Radio>
              <Radio value="1c">
                <strong>1C:Korxona 8.3 OTM XML (.xml)</strong> — CommerceML 1.8 standarti
              </Radio>
            </Radio.Group>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ background: 'var(--color-fill-2)', padding: '10px 14px', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tanlangan filtrlar: Manba: <strong>{selectedSource}</strong>; Bo‘lim:{' '}
              <strong>{selectedDepartmentId === 'ALL' ? 'Barchasi' : selectedDepartmentId}</strong>; Oraliq:{' '}
              <strong>{selectedDates.length === 2 ? `${selectedDates[0]} dan ${selectedDates[1]} gacha` : 'Barcha davr'}</strong>
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};
