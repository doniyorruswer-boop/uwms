import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
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
  Tooltip,
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
  IconLock,
} from '@arco-design/web-react/icon';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { StandardTable } from '../../components/Common/StandardTable';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { formatMoney } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import {
  useDepreciationRunsQuery,
  useDepreciationRunDetailsQuery,
  useDepreciationPreviewQuery,
  useRunDepreciationMutation,
  useAssetDepreciationHistoryQuery,
  useDepreciationStatementQuery,
  DepreciationRunItem,
} from '../../hooks/useDepreciationQuery';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

export const DepreciationPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const canExecute =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'CHIEF_ACCOUNTANT' ||
    user?.role === 'VICE_RECTOR_FINANCE';
  const canView = canExecute || user?.role === 'AUDITOR';

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
  const { data: previewData, isLoading: previewLoading } = useDepreciationPreviewQuery(
    { period: runPeriod },
    (previewRequested || isRunModalVisible) && canView,
  );
  const { data: assetHistory, isLoading: assetHistoryLoading } = useAssetDepreciationHistoryQuery(selectedAssetId);
  const { data: statementData, isLoading: statementLoading } = useDepreciationStatementQuery(
    statementPeriod,
    activeTab === 'statement' && canView,
  );

  // Mutation
  const runMutation = useRunDepreciationMutation();

  // Permission Denied UX State (Rule 6.3 & Rule 3)
  if (!user || !canView) {
    return (
      <ForbiddenView
        title="403 — Kirish Cheklangan"
        subTitle="Amortizatsiya hisobi va qoldiq qiymat moduliga kirish faqat Bosh hisobchi, Moliya prorektori va Tizim administratori uchun ruxsat etilgan."
        requiredRoles={['CHIEF_ACCOUNTANT', 'VICE_RECTOR_FINANCE', 'SUPER_ADMIN', 'ADMIN']}
      />
    );
  }

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
    if (!canExecute) return;
    setRunPeriod(defaultPeriod);
    setRunNotes('');
    setPreviewRequested(true);
    setIsRunModalVisible(true);
  };

  // Handle execute run with DTO binding
  const handleExecuteRun = async () => {
    if (!canExecute) return;
    try {
      const res = await runMutation.mutateAsync({
        period: runPeriod,
        notes: runNotes || `${runPeriod} davri uchun OTM oylik amortizatsiya hisobi`,
      });
      setIsRunModalVisible(false);
      if (res?.run?.id) {
        setActiveTab('runs');
        setSelectedRunId(res.run.id);
      }
    } catch {
      // Handled by onError in mutation
    }
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
            {r.categoryName} • {r.fundingSource || 'BYUDJET'}
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
      width: 160,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 600 }}>{formatMoney(val)}</span>
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
      width: 150,
      align: 'right' as const,
      render: (_: any, r: any) => {
        const rate = (r.depreciationRate || 20) / 100 / 12;
        const monthly = Math.round(Number(r.purchasePrice || 0) * rate);
        return <span style={{ color: '#F53F3F', fontWeight: 600 }}>+{formatMoney(monthly)}</span>;
      },
    },
    {
      title: 'Jamg‘arilgan Eskirish',
      dataIndex: 'accumulatedDepreciation',
      width: 160,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: '#F53F3F', fontWeight: 600 }}>{formatMoney(val)}</span>
      ),
    },
    {
      title: 'Joriy Qoldiq (Book Value)',
      dataIndex: 'currentBookValue',
      width: 180,
      align: 'right' as const,
      render: (val: number, r: any) => {
        const price = Number(r.purchasePrice || 0);
        const bookVal = val !== undefined && val !== null ? Number(val) : price;
        const isZero = bookVal <= 0;
        return (
          <div>
            <div style={{ color: isZero ? '#86909C' : '#00B42A', fontWeight: 700 }}>
              {formatMoney(bookVal)}
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAssetId(r.id);
          }}
          style={{ borderRadius: 0 }}
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
          -{formatMoney(val)}
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
          {formatMoney(val)}
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRunId(r.id);
          }}
          style={{ borderRadius: 0 }}
        >
          Tafsilot
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Read-only Alert for Non-Executors (e.g. AUDITOR) */}
      {!canExecute && (
        <Alert
          type="info"
          title="Ko‘rish Rejimi (Read-only)"
          content="Siz amortizatsiya reestri va hisobotlarini ko‘rish huquqiga egasiz. Oylik eskirish hisoblashni amalga oshirish faqat Bosh hisobchi, Moliya ishlari bo‘yicha prorektor va Tizim administratori uchun ruxsat etilgan."
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Space>
          <Button
            type="outline"
            icon={<IconPrinter />}
            onClick={() => {
              setActiveTab('statement');
            }}
            style={{ borderRadius: 0 }}
          >
            Rasmiy Qaydnoma
          </Button>

          {canExecute ? (
            <Button
              type="primary"
              icon={<IconPlayArrow />}
              style={{ backgroundColor: '#165DFF', borderRadius: 0 }}
              onClick={handleOpenRunModal}
            >
              Oylik Amortizatsiyani Hisoblash
            </Button>
          ) : (
            <Tooltip content="Amortizatsiyani hisoblash faqat Bosh hisobchi, Moliya prorektori va Admin uchun ruxsat etilgan">
              <Button disabled icon={<IconLock />} style={{ borderRadius: 0 }}>
                Amortizatsiyani Hisoblash (Cheklangan)
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Hero Stat Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Jami Boshlang‘ich Qiymat"
            value={`${(stats.totalCost / 1_000_000).toFixed(1)} mln`}
            subtext={formatMoney(stats.totalCost)}
            icon={<IconFile />}
            color="blue"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Jamg‘arilgan Eskirish"
            value={`${(stats.totalDepreciation / 1_000_000).toFixed(1)} mln`}
            subtext={formatMoney(stats.totalDepreciation)}
            icon={<IconHistory />}
            color="red"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Joriy Qoldiq Balans Qiymati"
            value={`${(stats.totalBookValue / 1_000_000).toFixed(1)} mln`}
            subtext={formatMoney(stats.totalBookValue)}
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
      <Tabs activeTab={activeTab} onChange={setActiveTab} type="line">
        {/* Tab 1: Registry */}
        <TabPane key="registry" title="Asosiy Vositalar Amortizatsiya Reestri">
          <Card className="uwms-card" style={{ borderRadius: 0, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
            <Row gutter={16} align="center">
              <Col xs={24} sm={12} md={8}>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Inventar raqami yoki nomi bo‘yicha qidiruv..."
                  value={search}
                  onChange={setSearch}
                  allowClear
                  style={{ borderRadius: 0 }}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  style={{ width: '100%', borderRadius: 0 }}
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
            emptyText={search ? 'Qidiruv bo‘yicha asosiy vosita topilmadi' : 'Asosiy vositalar ro‘yxati bo‘sh'}
            onRowClick={(r) => setSelectedAssetId(r.id)}
          />
        </TabPane>

        {/* Tab 2: Runs History */}
        <TabPane key="runs" title="O‘tkazilgan Partiyalar Tarixi (Runs)">
          <StandardTable<DepreciationRunItem>
            columns={runsColumns}
            data={runsData?.data || []}
            loading={runsLoading}
            rowKey="id"
            scrollX={1200}
            emptyText="O‘tkazilgan amortizatsiya partiyalari mavjud emas"
            onRowClick={(r) => setSelectedRunId(r.id)}
          />
        </TabPane>

        {/* Tab 3: Official Statement */}
        <TabPane key="statement" title="Davlat OTM Rasmiy Amortizatsiya Qaydnomasi">
          <Card className="uwms-card" style={{ borderRadius: 0, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
            <Row justify="space-between" align="center">
              <Col span={12}>
                <Space>
                  <Text bold>Hisobot Davrini Tanlang:</Text>
                  <DatePicker.MonthPicker
                    value={statementPeriod}
                    onChange={(dateString) => setStatementPeriod(dateString)}
                    style={{ width: 160, borderRadius: 0 }}
                  />
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Button icon={<IconPrinter />} type="primary" onClick={() => window.print()} style={{ borderRadius: 0 }}>
                  Chop Etish (Print)
                </Button>
              </Col>
            </Row>
          </Card>

          {statementLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spin dot size={20} tip="Qaydnoma tayyorlanmoqda..." />
            </div>
          ) : statementData ? (
            <Card className="uwms-card" style={{ borderRadius: 0, padding: 16 }} id="printable-statement">
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
                      {formatMoney(statementData.totals.initialCost)}
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={{ textAlign: 'center', background: '#FFECE8', borderRadius: 0 }}>
                    <div style={{ fontSize: 12, color: '#F53F3F' }}>Oylik Eskirish</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#F53F3F' }}>
                      {formatMoney(statementData.totals.monthlyDepreciation)}
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card style={{ textAlign: 'center', background: '#E8FFEA', borderRadius: 0 }}>
                    <div style={{ fontSize: 12, color: '#00B42A' }}>Yakuniy Qoldiq Qiymat</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#00B42A' }}>
                      {formatMoney(statementData.totals.closingBookValue)}
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
                        {formatMoney(cat.initialCost)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {formatMoney(cat.openingBookValue)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#F53F3F', fontWeight: 600 }}>
                        {formatMoney(cat.depreciationAmount)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#00B42A', fontWeight: 700 }}>
                        {formatMoney(cat.closingBookValue)}
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
            <Card className="uwms-card" style={{ borderRadius: 0, textAlign: 'center', padding: 40 }}>
              <IconExclamationCircle style={{ fontSize: 36, color: '#F7BA1E', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Ushbu davr uchun qaydnoma mavjud emas</div>
              <div style={{ color: '#86909C', marginTop: 6 }}>
                "{statementPeriod}" oyi uchun hali amortizatsiya hisoblanmagan. Yuqoridagi "Oylik Amortizatsiyani Hisoblash" tugmasi orqali hisoblashingiz mumkin.
              </div>
            </Card>
          )}
        </TabPane>
      </Tabs>

      {/* Modal 1: Oylik Amortizatsiyani Hisoblash (Dry-Run Preview + Run with DTO) */}
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
        style={{ width: 900, borderRadius: 0 }}
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
                    style={{ width: 180, borderRadius: 0 }}
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
            <Spin dot size={20} tip="Amortizatsiya hisob-kitoblari prognoz qilinmoqda..." />
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
                    -{formatMoney(previewData.totalProjectedDepreciation)}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#E8FFEA', textAlign: 'center', borderRadius: 0 }}>
                  <div style={{ fontSize: 12, color: '#00B42A' }}>Yangi Qoldiq Qiymat</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#00B42A' }}>
                    {formatMoney(previewData.totalProjectedBookValue)}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Preview Items Table bound to DTO */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text bold style={{ fontSize: 13 }}>
                  Hisoblanuvchi Vositalar Ro‘yxati (DTO Prognozi):
                </Text>
                <Tag size="small" color="arcoblue">{previewData.items?.length || 0} ta aktiv</Tag>
              </div>
              <Table
                size="small"
                rowKey="assetId"
                data={previewData.items || []}
                scroll={{ x: 750, y: 220 }}
                pagination={{ pageSize: 5, sizeCanChange: false }}
                columns={[
                  {
                    title: 'Inventar №',
                    dataIndex: 'inventoryNumber',
                    width: 120,
                    render: (inv) => <b style={{ color: '#165DFF' }}>{inv}</b>,
                  },
                  {
                    title: 'Vosita Nomi',
                    dataIndex: 'itemName',
                    render: (name, r) => (
                      <div>
                        <div>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{r.categoryName}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Manba',
                    dataIndex: 'fundingSource',
                    width: 110,
                    render: (fs) => (
                      <Tag size="small" color={fs === 'KONTRAKT_RIVOJLANTIRISH' ? 'green' : fs === 'GRANT' ? 'purple' : 'arcoblue'}>
                        {fs === 'KONTRAKT_RIVOJLANTIRISH' ? 'Kontrakt' : fs === 'GRANT' ? 'Grant' : 'Byudjet'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Boshiga Qoldiq',
                    dataIndex: 'openingBookValue',
                    width: 130,
                    align: 'right' as const,
                    render: (v) => formatMoney(v),
                  },
                  {
                    title: 'Oylik Eskirish',
                    dataIndex: 'monthlyDepreciation',
                    width: 130,
                    align: 'right' as const,
                    render: (v) => <span style={{ color: '#F53F3F', fontWeight: 600 }}>-{formatMoney(v)}</span>,
                  },
                  {
                    title: 'Yangi Qoldiq',
                    dataIndex: 'closingBookValue',
                    width: 130,
                    align: 'right' as const,
                    render: (v) => <span style={{ color: '#00B42A', fontWeight: 700 }}>{formatMoney(v)}</span>,
                  },
                ]}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text bold style={{ display: 'block', marginBottom: 6 }}>
                Hisobot Asosi / Izoh:
              </Text>
              <Input
                placeholder="Masalan: 2026-yil sentabr oyi reja bo‘yicha OTM oylik amortizatsiyasi"
                value={runNotes}
                onChange={setRunNotes}
                style={{ borderRadius: 0 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button onClick={() => setIsRunModalVisible(false)} style={{ borderRadius: 0 }}>Bekor Qilish</Button>
              <Popconfirm
                title="Amortizatsiyani Tasdiqlash"
                content={`Rostdan ham ${previewData.period} davri uchun ${previewData.newlyEligibleCount} ta aktivga jami ${formatMoney(previewData.totalProjectedDepreciation)} amortizatsiya hisoblanib, bazada qoldiq qiymat yangilansinmi?`}
                okText="Ha, Tasdiqlash va Saqlash"
                cancelText="Yo‘q"
                onOk={handleExecuteRun}
              >
                <Button
                  type="primary"
                  loading={runMutation.isPending}
                  disabled={!canExecute || previewData.newlyEligibleCount === 0}
                  style={{ backgroundColor: '#165DFF', borderRadius: 0 }}
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
            <Spin dot size={20} tip="Aktiv tarixi yuklanmoqda..." />
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
                { label: 'Boshlang‘ich Narx', value: formatMoney(assetHistory.asset.purchasePrice) },
                { label: 'Yillik Me’yor', value: `${assetHistory.asset.depreciationRate}% (yillik)` },
                {
                  label: 'Jamg‘arilgan Eskirish',
                  value: (
                    <span style={{ color: '#F53F3F', fontWeight: 600 }}>
                      {formatMoney(assetHistory.asset.accumulatedDepreciation)}
                    </span>
                  ),
                },
                {
                  label: 'Joriy Qoldiq (Book Value)',
                  value: (
                    <span style={{ color: '#00B42A', fontWeight: 700 }}>
                      {formatMoney(assetHistory.asset.currentBookValue)}
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
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatMoney(h.openingBookValue)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#F53F3F', fontWeight: 600 }}>
                        -{formatMoney(h.depreciationAmount)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#00B42A', fontWeight: 700 }}>
                        {formatMoney(h.closingBookValue)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatMoney(h.accumulatedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal 3: Run Details Modal with DTO records */}
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
        style={{ width: 920, borderRadius: 0 }}
      >
        {runDetailsLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin dot size={20} tip="Partiya tafsilotlari yuklanmoqda..." />
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
                      -{formatMoney(runDetails.totalDepreciationAmount)}
                    </span>
                  ),
                },
                {
                  label: 'Yakuniy Qoldiq Balans',
                  value: (
                    <span style={{ color: '#00B42A', fontWeight: 700 }}>
                      {formatMoney(runDetails.totalBookValue)}
                    </span>
                  ),
                },
                { label: 'Ijrochi', value: `${runDetails.executedByName} (${runDetails.executedByRole || 'Mas’ul'})` },
              ]}
            />

            <Title heading={6} style={{ marginBottom: 8 }}>
              Partiyaga Kiritilgan Asosiy Vositalar Ro‘yxati (DTO Jurnali):
            </Title>
            <Table
              columns={[
                {
                  title: 'Inventar №',
                  dataIndex: 'inventoryNumber',
                  width: 140,
                  render: (v) => <b style={{ color: '#165DFF' }}>{v}</b>,
                },
                { title: 'Vosita Nomi', dataIndex: 'itemName' },
                { title: 'Kategoriya', dataIndex: 'categoryName', width: 160 },
                {
                  title: 'Boshlang‘ich Narx',
                  dataIndex: 'initialCost',
                  align: 'right' as const,
                  render: (v: number) => formatMoney(v),
                },
                {
                  title: 'Oylik Eskirish',
                  dataIndex: 'depreciationAmount',
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: '#F53F3F', fontWeight: 600 }}>-{formatMoney(v)}</span>
                  ),
                },
                {
                  title: 'Yangi Qoldiq',
                  dataIndex: 'closingBookValue',
                  align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ color: '#00B42A', fontWeight: 700 }}>{formatMoney(v)}</span>
                  ),
                },
              ]}
              data={runDetails.records || []}
              rowKey="id"
              scroll={{ x: 800 }}
              pagination={{ pageSize: 8 }}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DepreciationPage;
