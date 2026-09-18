import React, { useState, useMemo } from 'react';
import {
  Card,
  Grid,
  Button,
  Input,
  Select,
  Modal,
  Tag,
  Badge,
  Progress,
  Typography,
  Space,
  Alert,
  Descriptions,
  Popconfirm,
  Tabs,
  DatePicker,
  Spin,
} from '@arco-design/web-react';
import {
  IconPlayArrow,
  IconHistory,
  IconPrinter,
  IconSearch,
  IconCalendar,
  IconCheckCircle,
  IconExclamationCircle,
  IconEye,
  IconFile,
} from '@arco-design/web-react/icon';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { StandardTable } from '../../components/Common/StandardTable';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import {
  useDepreciationRunsQuery,
  useDepreciationRunDetailsQuery,
  useDepreciationPreviewQuery,
  useRunDepreciationMutation,
  useAssetDepreciationHistoryQuery,
  useDepreciationStatementQuery,
} from '../../hooks/useDepreciationQuery';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

export const DepreciationPage: React.FC = () => {
  // Current period in YYYY-MM
  const defaultPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // State
  const [activeTab, setActiveTab] = useState<string>('registry');
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statementPeriod, setStatementPeriod] = useState<string>(defaultPeriod);

  // Run modal state
  const [isRunModalVisible, setIsRunModalVisible] = useState<boolean>(false);
  const [runPeriod, setRunPeriod] = useState<string>(defaultPeriod);
  const [runNotes, setRunNotes] = useState<string>('');
  const [previewRequested, setPreviewRequested] = useState<boolean>(false);

  // Queries
  const { assets, isLoading: assetsLoading } = useAssetsQuery();
  const { data: runsData, isLoading: runsLoading } = useDepreciationRunsQuery({ limit: 50 });
  const { data: runDetails, isLoading: runDetailsLoading } = useDepreciationRunDetailsQuery(selectedRunId);
  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useDepreciationPreviewQuery(
    { period: runPeriod },
    previewRequested || isRunModalVisible,
  );
  const { data: assetHistory, isLoading: assetHistoryLoading } = useAssetDepreciationHistoryQuery(selectedAssetId);
  const { data: statementData, isLoading: statementLoading } = useDepreciationStatementQuery(statementPeriod, activeTab === 'statement');

  // Mutation
  const runMutation = useRunDepreciationMutation();

  // Statistics calculation across all assets
  const stats = useMemo(() => {
    if (!assets || !Array.isArray(assets)) {
      return { totalCost: 0, totalDepreciation: 0, totalBookValue: 0, fullyDepreciatedCount: 0, totalCount: 0 };
    }
    let totalCost = 0;
    let totalDepreciation = 0;
    let totalBookValue = 0;
    let fullyDepreciatedCount = 0;

    assets.forEach((a: any) => {
      const price = Number(a.purchasePrice || 0);
      const bookVal = a.currentBookValue !== undefined && a.currentBookValue !== null ? Number(a.currentBookValue) : price;
      const dep = a.accumulatedDepreciation !== undefined && a.accumulatedDepreciation !== null ? Number(a.accumulatedDepreciation) : 0;

      totalCost += price;
      totalDepreciation += dep;
      totalBookValue += bookVal;
      if (bookVal <= 0 && price > 0) {
        fullyDepreciatedCount++;
      }
    });

    return {
      totalCost,
      totalDepreciation,
      totalBookValue,
      fullyDepreciatedCount,
      totalCount: assets.length,
    };
  }, [assets]);

  // Categories list for filter
  const categories = useMemo(() => {
    if (!assets || !Array.isArray(assets)) return [];
    const set = new Set<string>();
    assets.forEach((a: any) => {
      if (a.categoryName) set.add(a.categoryName);
    });
    return Array.from(set);
  }, [assets]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    if (!assets || !Array.isArray(assets)) return [];
    return assets.filter((a: any) => {
      const matchesSearch =
        !search ||
        a.inventoryNumber?.toLowerCase().includes(search.toLowerCase()) ||
        a.itemName?.toLowerCase().includes(search.toLowerCase()) ||
        a.roomName?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'ALL' || a.categoryName === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [assets, search, categoryFilter]);

  // Handle open run modal
  const handleOpenRunModal = () => {
    setRunPeriod(defaultPeriod);
    setRunNotes('');
    setPreviewRequested(true);
    setIsRunModalVisible(true);
  };

  // Handle execute run
  const handleExecuteRun = async () => {
    await runMutation.mutateAsync({
      period: runPeriod,
      notes: runNotes || `${runPeriod} davri uchun OTM oylik amortizatsiya hisobi`,
    });
    setIsRunModalVisible(false);
  };

  // Asset Registry Columns
  const assetColumns = [
    {
      title: 'Inventar №',
      dataIndex: 'inventoryNumber',
      width: 140,
      render: (val: string) => <Tag color="arcoblue" style={{ fontWeight: 600 }}>{val}</Tag>,
    },
    {
      title: 'Asosiy Vosita Nomi',
      dataIndex: 'itemName',
      render: (val: string, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{val}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
            {r.categoryName} • {r.fundingSource}
          </div>
        </div>
      ),
    },
    {
      title: 'Joylashuvi & Mas’ul',
      render: (_: any, r: any) => (
        <div style={{ fontSize: 13 }}>
          <div>{r.roomName || 'Markaziy ombor'}</div>
          <div style={{ color: 'var(--color-text-3)', fontSize: 12 }}>{r.responsibleUserName}</div>
        </div>
      ),
    },
    {
      title: 'Boshlang‘ich Narx',
      dataIndex: 'purchasePrice',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 600 }}>{Number(val || 0).toLocaleString('uz-UZ')} so‘m</span>
      ),
    },
    {
      title: 'Yillik Stavka',
      dataIndex: 'depreciationRate',
      width: 110,
      align: 'center' as const,
      render: (val: number) => <Badge color="blue" text={`${val || 20}%`} />,
    },
    {
      title: 'Oylik Eskirish',
      width: 140,
      align: 'right' as const,
      render: (_: any, r: any) => {
        const rate = (r.depreciationRate || 20) / 100 / 12;
        const monthly = Math.round(Number(r.purchasePrice || 0) * rate);
        return <span style={{ color: '#F53F3F', fontWeight: 600 }}>+{monthly.toLocaleString('uz-UZ')} so‘m</span>;
      },
    },
    {
      title: 'Jamg‘arilgan Eskirish',
      dataIndex: 'accumulatedDepreciation',
      width: 160,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: '#F53F3F', fontWeight: 600 }}>{Number(val || 0).toLocaleString('uz-UZ')} so‘m</span>
      ),
    },
    {
      title: 'Joriy Qoldiq (Book Value)',
      dataIndex: 'currentBookValue',
      width: 170,
      align: 'right' as const,
      render: (val: number, r: any) => {
        const price = Number(r.purchasePrice || 0);
        const bookVal = val !== undefined && val !== null ? Number(val) : price;
        const isZero = bookVal <= 0;
        return (
          <div>
            <div style={{ color: isZero ? '#86909C' : '#00B42A', fontWeight: 700 }}>
              {bookVal.toLocaleString('uz-UZ')} so‘m
            </div>
            {price > 0 && (
              <Progress
                percent={Math.max(0, Math.min(100, Math.round((bookVal / price) * 100)))}
                size="mini"
                status={isZero ? 'error' : 'normal'}
                style={{ width: 80, marginTop: 4 }}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'Oxirgi Hisob',
      dataIndex: 'lastDepreciatedAt',
      width: 120,
      render: (val: string) =>
        val ? (
          <span style={{ fontSize: 12 }}>{val.substring(0, 10)}</span>
        ) : (
          <span style={{ color: '#86909C', fontSize: 12 }}>Hisoblanmagan</span>
        ),
    },
    {
      title: 'Amallar',
      width: 100,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <Button
          type="text"
          size="small"
          icon={<IconHistory />}
          onClick={() => setSelectedAssetId(r.id)}
        >
          Daftar
        </Button>
      ),
    },
  ];

  // Runs Table Columns
  const runsColumns = [
    {
      title: 'Partiya №',
      dataIndex: 'batchNumber',
      width: 170,
      render: (val: string) => <Tag color="blue" style={{ fontWeight: 600 }}>{val}</Tag>,
    },
    {
      title: 'Hisob Davri',
      dataIndex: 'period',
      width: 130,
      render: (val: string) => (
        <Space>
          <IconCalendar />
          <span style={{ fontWeight: 600 }}>{val}</span>
        </Space>
      ),
    },
    {
      title: 'Aktivlar Soni',
      dataIndex: 'totalAssetsCount',
      width: 130,
      align: 'center' as const,
      render: (val: number) => <Badge count={val} maxCount={9999} style={{ backgroundColor: '#165DFF' }} />,
    },
    {
      title: 'Oylik Eskirish Summasi',
      dataIndex: 'totalDepreciationAmount',
      width: 180,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: '#F53F3F', fontWeight: 700 }}>
          -{Number(val || 0).toLocaleString('uz-UZ')} so‘m
        </span>
      ),
    },
    {
      title: 'Jami Qoldiq Balansi',
      dataIndex: 'totalBookValue',
      width: 190,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: '#00B42A', fontWeight: 700 }}>
          {Number(val || 0).toLocaleString('uz-UZ')} so‘m
        </span>
      ),
    },
    {
      title: 'Ijrochi Xodim',
      dataIndex: 'executedByName',
      width: 170,
      render: (val: string, r: any) => (
        <div>
          <div>{val}</div>
          <div style={{ fontSize: 11, color: '#86909C' }}>{r.executedByRole}</div>
        </div>
      ),
    },
    {
      title: 'Sana & Vaqt',
      dataIndex: 'createdAt',
      width: 160,
      render: (val: string) => (val ? val.replace('T', ' ').substring(0, 16) : '—'),
    },
    {
      title: 'Amallar',
      width: 110,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <Button
          type="text"
          size="small"
          icon={<IconEye />}
          onClick={() => setSelectedRunId(r.id)}
        >
          Tafsilot
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header Toolbar */}
      <Card style={{ marginBottom: 16, borderRadius: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title heading={5} style={{ margin: 0 }}>
              Amortizatsiya va Qoldiq Qiymat Dvigateli (Depreciation Engine)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              O‘zbekiston OTM davlat standarti bo‘yicha oylik teng me’yorli eskirish va balans qiymati nazorati
            </Text>
          </div>
          <Space>
            <Button
              type="outline"
              icon={<IconPrinter />}
              onClick={() => {
                setActiveTab('statement');
              }}
            >
              Rasmiy Qaydnoma
            </Button>
            <Button
              type="primary"
              icon={<IconPlayArrow />}
              style={{ backgroundColor: '#165DFF' }}
              onClick={handleOpenRunModal}
            >
              Oylik Amortizatsiyani Hisoblash
            </Button>
          </Space>
        </div>
      </Card>

      {/* Hero Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Jami Boshlang‘ich Qiymat"
            value={`${(stats.totalCost / 1_000_000).toFixed(1)} mln`}
            subtext={`${stats.totalCost.toLocaleString('uz-UZ')} so‘m`}
            icon={<IconFile />}
            color="blue"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Jamg‘arilgan Eskirish"
            value={`${(stats.totalDepreciation / 1_000_000).toFixed(1)} mln`}
            subtext={`${stats.totalDepreciation.toLocaleString('uz-UZ')} so‘m`}
            icon={<IconHistory />}
            color="red"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Joriy Qoldiq Balans Qiymati"
            value={`${(stats.totalBookValue / 1_000_000).toFixed(1)} mln`}
            subtext={`${stats.totalBookValue.toLocaleString('uz-UZ')} so‘m`}
            icon={<IconCheckCircle />}
            color="green"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="To‘liq Eskirgan Vositalar"
            value={stats.fullyDepreciatedCount}
            subtext={`Jami ${stats.totalCount} ta aktivdan`}
            icon={<IconExclamationCircle />}
            color="purple"
          />
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs activeTab={activeTab} onChange={setActiveTab} type="card">
        {/* Tab 1: Registry */}
        <TabPane key="registry" title="Asosiy Vositalar Amortizatsiya Reestri">
          <Card style={{ borderRadius: 0, marginBottom: 12 }}>
            <Row gutter={16} align="center">
              <Col xs={24} sm={12} md={8}>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Inventar raqami yoki nomi bo‘yicha qidiruv..."
                  value={search}
                  onChange={setSearch}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="ALL">Barcha Kategoriyalar</Select.Option>
                  {categories.map((c) => (
                    <Select.Option key={c} value={c}>
                      {c}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={24} md={10} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Jami: <b>{filteredAssets.length}</b> ta asosiy vosita topildi
                </Text>
              </Col>
            </Row>
          </Card>

          <StandardTable
            columns={assetColumns}
            data={filteredAssets}
            loading={assetsLoading}
            rowKey="id"
            scrollX={1450}
          />
        </TabPane>

        {/* Tab 2: Runs History */}
        <TabPane key="runs" title="O‘tkazilgan Partiyalar Tarixi (Runs)">
          <StandardTable
            columns={runsColumns}
            data={runsData?.data || []}
            loading={runsLoading}
            rowKey="id"
            scrollX={1200}
          />
        </TabPane>

        {/* Tab 3: Official Statement */}
        <TabPane key="statement" title="Davlat OTM Rasmiy Amortizatsiya Qaydnomasi">
          <Card style={{ borderRadius: 0, marginBottom: 12 }}>
            <Row justify="space-between" align="center">
              <Col span={12}>
                <Space>
                  <Text bold>Hisobot Davrini Tanlang:</Text>
                  <DatePicker.MonthPicker
                    value={statementPeriod}
                    onChange={(dateString) => setStatementPeriod(dateString)}
                    style={{ width: 160 }}
                  />
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Button icon={<IconPrinter />} type="primary" onClick={() => window.print()}>
                  Chop Etish (Print)
                </Button>
              </Col>
            </Row>
          </Card>

          {statementLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spin tip="Qaydnoma tayyorlanmoqda..." />
            </div>
          ) : statementData ? (
            <Card style={{ borderRadius: 0, padding: 16 }} id="printable-statement">
              <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #1D2129', paddingBottom: 16 }}>
                <Title heading={4} style={{ margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                  {statementData.documentName}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {statementData.standardRef} • Davr: <b>{statementData.period}</b>
                </Text>
              </div>

              {/* Totals Banner */}
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card style={{ textAlign: 'center', background: '#F2F3F5', borderRadius: 0 }}>
                    <div style={{ fontSize: 12, color: '#4E5969' }}>Jami Aktivlar</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{statementData.totals.totalAssets} ta</div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={{ textAlign: 'center', background: '#F2F3F5', borderRadius: 0 }}>
                    <div style={{ fontSize: 12, color: '#4E5969' }}>Boshlang‘ich Narx</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {statementData.totals.initialCost.toLocaleString('uz-UZ')} so‘m
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={{ textAlign: 'center', background: '#FFECE8', borderRadius: 0 }}>
                    <div style={{ fontSize: 12, color: '#F53F3F' }}>Oylik Eskirish</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#F53F3F' }}>
                      {statementData.totals.monthlyDepreciation.toLocaleString('uz-UZ')} so‘m
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={{ textAlign: 'center', background: '#E8FFEA', borderRadius: 0 }}>
                    <div style={{ fontSize: 12, color: '#00B42A' }}>Yakuniy Qoldiq Qiymat</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#00B42A' }}>
                      {statementData.totals.closingBookValue.toLocaleString('uz-UZ')} so‘m
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Category Breakdown Table */}
              <Title heading={6} style={{ marginTop: 16, marginBottom: 12 }}>
                1. Asosiy Vositalar Toifalari (Kategoriyalari) Kesimida Eskirish
              </Title>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F2F3F5', borderBottom: '1px solid #C9CDD4' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Kategoriya Nomi</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Soni</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Yillik Stavka</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Boshlang‘ich Narx</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Davr Boshiga Qoldiq</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Oylik Eskirish</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Davr Oxiriga Qoldiq</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.categorySummary.map((cat) => (
                    <tr key={cat.categoryName} style={{ borderBottom: '1px solid #E5E6EB' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{cat.categoryName}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{cat.count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{cat.annualRate}%</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {cat.initialCost.toLocaleString('uz-UZ')} so‘m
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {cat.openingBookValue.toLocaleString('uz-UZ')} so‘m
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#F53F3F', fontWeight: 600 }}>
                        {cat.depreciationAmount.toLocaleString('uz-UZ')} so‘m
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#00B42A', fontWeight: 700 }}>
                        {cat.closingBookValue.toLocaleString('uz-UZ')} so‘m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', padding: '0 24px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Bosh Buxgalter: ____________________</div>
                  <div style={{ fontSize: 12, color: '#86909C', marginTop: 4 }}>Imzo va sana</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Bosh Omborchi: ____________________</div>
                  <div style={{ fontSize: 12, color: '#86909C', marginTop: 4 }}>Imzo va sana</div>
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ borderRadius: 0, textAlign: 'center', padding: 40 }}>
              <IconExclamationCircle style={{ fontSize: 36, color: '#F7BA1E', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Ushbu davr uchun qaydnoma mavjud emas</div>
              <div style={{ color: '#86909C', marginTop: 6 }}>
                "{statementPeriod}" oyi uchun hali amortizatsiya hisoblanmagan. Yuqoridagi "Oylik Amortizatsiyani Hisoblash" tugmasi orqali hisoblashingiz mumkin.
              </div>
            </Card>
          )}
        </TabPane>
      </Tabs>

      {/* Modal 1: Oylik Amortizatsiyani Hisoblash (Dry-Run Preview + Run) */}
      <Modal
        title={
          <Space>
            <IconPlayArrow style={{ color: '#165DFF' }} />
            <span>Oylik Amortizatsiyani Hisoblash (Depreciation Run)</span>
          </Space>
        }
        visible={isRunModalVisible}
        onCancel={() => setIsRunModalVisible(false)}
        footer={null}
        style={{ width: 850, borderRadius: 0 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Descriptions
            column={2}
            border
            data={[
              {
                label: 'Hisob Davri',
                value: (
                  <DatePicker.MonthPicker
                    value={runPeriod}
                    onChange={(dateString) => {
                      setRunPeriod(dateString);
                      setPreviewRequested(true);
                    }}
                    style={{ width: 180 }}
                  />
                ),
              },
              {
                label: 'Hisoblash Metodi',
                value: <Tag color="green">Teng Me’yorli (Chiziqli OTM standarti)</Tag>,
              },
            ]}
          />
        </div>

        {previewLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin tip="Amortizatsiya hisob-kitoblari prognoz qilinmoqda..." />
          </div>
        ) : previewData ? (
          <div>
            {previewData.alreadyDepreciatedCount > 0 && (
              <Alert
                type="warning"
                style={{ marginBottom: 16, borderRadius: 0 }}
                content={`Ushbu davr (${previewData.period}) uchun ${previewData.alreadyDepreciatedCount} ta aktiv allaqachon hisoblangan. Ular takroriy eskirishdan himoya qilinadi va o‘tkazib yuboriladi.`}
              />
            )}

            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card style={{ background: '#F2F3F5', textAlign: 'center', borderRadius: 0 }}>
                  <div style={{ fontSize: 12, color: '#4E5969' }}>Jami Asosiy Vositalar</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{previewData.totalAssetsCount} ta</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#E8F3FF', textAlign: 'center', borderRadius: 0 }}>
                  <div style={{ fontSize: 12, color: '#165DFF' }}>Yangi Hisoblanuvchi</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#165DFF' }}>
                    {previewData.newlyEligibleCount} ta
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#FFECE8', textAlign: 'center', borderRadius: 0 }}>
                  <div style={{ fontSize: 12, color: '#F53F3F' }}>Oylik Eskirish Summasi</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#F53F3F' }}>
                    -{previewData.totalProjectedDepreciation.toLocaleString('uz-UZ')} so‘m
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#E8FFEA', textAlign: 'center', borderRadius: 0 }}>
                  <div style={{ fontSize: 12, color: '#00B42A' }}>Yangi Qoldiq Qiymat</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#00B42A' }}>
                    {previewData.totalProjectedBookValue.toLocaleString('uz-UZ')} so‘m
                  </div>
                </Card>
              </Col>
            </Row>

            <div style={{ marginBottom: 16 }}>
              <Text bold style={{ display: 'block', marginBottom: 6 }}>
                Hisobot Asosi / Izoh:
              </Text>
              <Input
                placeholder="Masalan: 2026-yil sentabr oyi reja bo‘yicha OTM oylik amortizatsiyasi"
                value={runNotes}
                onChange={setRunNotes}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button onClick={() => setIsRunModalVisible(false)}>Bekor Qilish</Button>
              <Popconfirm
                title="Amortizatsiyani Tasdiqlash"
                content={`Rostdan ham ${previewData.period} davri uchun ${previewData.newlyEligibleCount} ta aktivga jami ${previewData.totalProjectedDepreciation.toLocaleString('uz-UZ')} so‘m amortizatsiya hisoblanib, bazada qoldiq qiymat yangilansinmi?`}
                okText="Ha, Tasdiqlash va Saqlash"
                cancelText="Yo‘q"
                onOk={handleExecuteRun}
              >
                <Button
                  type="primary"
                  loading={runMutation.isPending}
                  disabled={previewData.newlyEligibleCount === 0}
                  style={{ backgroundColor: '#165DFF' }}
                >
                  Tasdiqlash va Bazaga Saqlash
                </Button>
              </Popconfirm>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal 2: Asset Depreciation Ledger */}
      <Modal
        title={
          <Space>
            <IconHistory style={{ color: '#165DFF' }} />
            <span>Asosiy Vosita Amortizatsiya Daftari (Ledger Timeline)</span>
          </Space>
        }
        visible={Boolean(selectedAssetId)}
        onCancel={() => setSelectedAssetId(null)}
        footer={null}
        style={{ width: 800, borderRadius: 0 }}
      >
        {assetHistoryLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin tip="Aktiv tarixi yuklanmoqda..." />
          </div>
        ) : assetHistory ? (
          <div>
            <Descriptions
              column={2}
              border
              style={{ marginBottom: 16 }}
              data={[
                { label: 'Inventar №', value: <Tag color="arcoblue">{assetHistory.asset.inventoryNumber}</Tag> },
                { label: 'Vosita Nomi', value: assetHistory.asset.itemName },
                { label: 'Boshlang‘ich Narx', value: `${assetHistory.asset.purchasePrice.toLocaleString('uz-UZ')} so‘m` },
                { label: 'Yillik Me’yor', value: `${assetHistory.asset.depreciationRate}% (yillik)` },
                {
                  label: 'Jamg‘arilgan Eskirish',
                  value: (
                    <span style={{ color: '#F53F3F', fontWeight: 600 }}>
                      {assetHistory.asset.accumulatedDepreciation.toLocaleString('uz-UZ')} so‘m
                    </span>
                  ),
                },
                {
                  label: 'Joriy Qoldiq (Book Value)',
                  value: (
                    <span style={{ color: '#00B42A', fontWeight: 700 }}>
                      {assetHistory.asset.currentBookValue.toLocaleString('uz-UZ')} so‘m
                    </span>
                  ),
                },
              ]}
            />

            <Title heading={6} style={{ marginBottom: 8 }}>
              Oylar Kesimidagi Amortizatsiya Tarixi:
            </Title>
            {assetHistory.history.length === 0 ? (
              <Alert
                type="info"
                content="Ushbu vosita bo‘yicha hali oylik amortizatsiya yozuvlari mavjud emas. Oylik hisoblash ishga tushirilganda bu yerda partiyalar bo‘yicha to‘liq tarix ko‘rsatiladi."
                style={{ borderRadius: 0 }}
              />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F2F3F5', borderBottom: '1px solid #C9CDD4' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Davr</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Partiya №</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Boshiga Qoldiq</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Oylik Eskirish</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Oxiriga Qoldiq</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Jamg‘arilgan</th>
                  </tr>
                </thead>
                <tbody>
                  {assetHistory.history.map((h) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #E5E6EB' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{h.period}</td>
                      <td style={{ padding: '8px' }}>
                        <Tag size="small">{h.batchNumber}</Tag>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{h.openingBookValue.toLocaleString('uz-UZ')} so‘m</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#F53F3F', fontWeight: 600 }}>
                        -{h.depreciationAmount.toLocaleString('uz-UZ')} so‘m
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#00B42A', fontWeight: 700 }}>
                        {h.closingBookValue.toLocaleString('uz-UZ')} so‘m
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{h.accumulatedTotal.toLocaleString('uz-UZ')} so‘m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal 3: Run Details Modal */}
      <Modal
        title={
          <Space>
            <IconFile style={{ color: '#165DFF' }} />
            <span>Partiya Tafsilotlari: {runDetails?.batchNumber}</span>
          </Space>
        }
        visible={Boolean(selectedRunId)}
        onCancel={() => setSelectedRunId(null)}
        footer={null}
        style={{ width: 900, borderRadius: 0 }}
      >
        {runDetailsLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin tip="Partiya tafsilotlari yuklanmoqda..." />
          </div>
        ) : runDetails ? (
          <div>
            <Descriptions
              column={3}
              border
              style={{ marginBottom: 16 }}
              data={[
                { label: 'Partiya №', value: <Tag color="blue">{runDetails.batchNumber}</Tag> },
                { label: 'Hisob Davri', value: runDetails.period },
                { label: 'Aktivlar Soni', value: `${runDetails.totalAssetsCount} ta` },
                {
                  label: 'Jami Oylik Eskirish',
                  value: (
                    <span style={{ color: '#F53F3F', fontWeight: 700 }}>
                      -{runDetails.totalDepreciationAmount.toLocaleString('uz-UZ')} so‘m
                    </span>
                  ),
                },
                {
                  label: 'Yakuniy Qoldiq Balans',
                  value: (
                    <span style={{ color: '#00B42A', fontWeight: 700 }}>
                      {runDetails.totalBookValue.toLocaleString('uz-UZ')} so‘m
                    </span>
                  ),
                },
                { label: 'Ijrochi', value: runDetails.executedByName },
              ]}
            />

            <Title heading={6} style={{ marginBottom: 8 }}>
              Partiyaga Kiritilgan Asosiy Vositalar Ro‘yxati:
            </Title>
            <StandardTable
              columns={[
                { title: 'Inventar №', dataIndex: 'inventoryNumber', width: 140 },
                { title: 'Vosita Nomi', dataIndex: 'itemName' },
                { title: 'Kategoriya', dataIndex: 'categoryName', width: 160 },
                {
                  title: 'Boshlang‘ich Narx',
                  dataIndex: 'initialCost',
                  align: 'right' as const,
                  render: (v: number) => `${v.toLocaleString('uz-UZ')} so‘m`,
                },
                {
                  title: 'Oylik Eskirish',
                  dataIndex: 'depreciationAmount',
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: '#F53F3F', fontWeight: 600 }}>-{v.toLocaleString('uz-UZ')} so‘m</span>
                  ),
                },
                {
                  title: 'Yangi Qoldiq',
                  dataIndex: 'closingBookValue',
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: '#00B42A', fontWeight: 700 }}>{v.toLocaleString('uz-UZ')} so‘m</span>
                  ),
                },
              ]}
              data={runDetails.records || []}
              rowKey="id"
              scrollX={800}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
