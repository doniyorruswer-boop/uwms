import React from 'react';
import {
  Card,
  Grid,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Progress,
  Spin,
  Empty,
  Badge,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconScan,
  IconPlus,
  IconDesktop,
  IconArchive,
  IconFile,
  IconPrinter,
  IconArrowRise,
  IconExclamationCircle,
  IconDownload,
  IconBranch,
  IconSafe,
  IconStorage,
  IconCheckCircle,
  IconTool,
  IconUserGroup,
  IconRight,
  IconSync,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useDashboardAnalyticsQuery } from '../../hooks/useDashboardAnalyticsQuery';
import { exportToExcel } from '../../utils/exportExcel';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { analytics, isLoading, isError, refetch } = useDashboardAnalyticsQuery();

  const summary = analytics?.summary;
  const needsAttention = analytics?.needsAttention;
  const fundingSources = analytics?.fundingSources || [];
  const categories = analytics?.categories || [];
  const departments = analytics?.departments || [];
  const recentMovements = analytics?.recentMovements || [];
  const recentRequests = analytics?.recentRequests || [];
  const lowStocks = analytics?.lowStockItems || [];

  const formatPrice = (val?: number | string | null) => {
    if (!val) return '0 so‘m';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `${num.toLocaleString('uz-UZ')} so‘m`;
  };

  const formatMln = (val?: number | string | null) => {
    if (!val) return '0.0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return (num / 1000000).toFixed(1);
  };

  const handleExportExecutiveExcel = () => {
    if (!analytics) return;

    const summaryReport = [
      { 'Ko‘rsatkich': 'Jami Asosiy Vositalar Soni', 'Qiymat': `${summary?.totalAssets || 0} dona` },
      { 'Ko‘rsatkich': 'Dastlabki Balans Qiymati', 'Qiymat': formatPrice(summary?.totalInitialCost) },
      { 'Ko‘rsatkich': 'Jami Hisoblangan Amortizatsiya', 'Qiymat': formatPrice(summary?.totalDepreciated) },
      { 'Ko‘rsatkich': 'Joriy Qoldiq Balans Qiymati (Book Value)', 'Qiymat': formatPrice(summary?.totalNetBookValue) },
      { 'Ko‘rsatkich': 'Eskirish Foizi', 'Qiymat': `${summary?.depreciationPercentage || 0}%` },
      { 'Ko‘rsatkich': 'Ombordagi Sarf Tovarlar Zaxirasi', 'Qiymat': `${summary?.totalStockUnits || 0} birlik` },
      { 'Ko‘rsatkich': 'Zaxirasi Kam Qolgan Mahsulotlar', 'Qiymat': `${summary?.lowStockCount || 0} ta` },
      { 'Ko‘rsatkich': 'Kutilayotgan Talabnomalar', 'Qiymat': `${summary?.pendingRequestsCount || 0} ta` },
      { 'Ko‘rsatkich': 'Kutilayotgan Ko‘chirish Dalolatnomalari', 'Qiymat': `${summary?.pendingTransfersCount || 0} ta` },
      { 'Ko‘rsatkich': 'Ta’mirdagi Texnikalar Soni', 'Qiymat': `${summary?.statusCounts?.IN_REPAIR || 0} ta` },
      { 'Ko‘rsatkich': 'Hamkor Ta’minotchilar Soni', 'Qiymat': `${summary?.suppliersCount || 0} ta` },
    ];

    exportToExcel(summaryReport, 'Universitet_Boshqaruv_Tahliliy_Balansi', 'Tahliliy Hisobot');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* EXECUTIVE HEADER TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '4px 0' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-text-1)' }}>
          Xush kelibsiz, {user?.fullName}!
        </h1>

        <Space size="medium" wrap>
          <Button
            type="outline"
            icon={<IconScan />}
            onClick={() => navigate('/audit')}
            style={{ borderRadius: 0 }}
          >
            QR Auditni Boshlash
          </Button>
          <Button
            type="primary"
            icon={<IconPlus />}
            onClick={() => navigate('/assets?action=create')}
            style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
          >
            Yangi Vosita Kiritish
          </Button>
          <Button
            icon={<IconDownload />}
            onClick={handleExportExecutiveExcel}
            style={{ borderRadius: 0 }}
          >
            Tahliliy Hisobot (Excel)
          </Button>
          <Button
            icon={<IconSync />}
            onClick={() => refetch()}
            style={{ borderRadius: 0 }}
          />
        </Space>
      </div>

      {/* ERROR STATE */}
      {isError && (
        <Alert
          type="error"
          title="Tahliliy ko‘rsatkichlarni yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
        />
      )}

      {/* 6 SNIPE-IT STYLE HERO METRIC CARDS */}
      <Row gutter={[16, 16]}>
        {/* Card 1: Assets */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Asosiy Vositalar"
            value={isLoading ? '—' : `${summary?.totalAssets || 0}`}
            subtext="100% QR hisobga olingan"
            icon={<IconDesktop />}
            bgColor="#165DFF"
            footerBgColor="#0E42D2"
            linkText="Barcha vositalar"
            onClick={() => navigate('/assets')}
          />
        </Col>

        {/* Card 2: Book Value */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Qoldiq Qiymat (Book Value)"
            value={isLoading ? '—' : `${formatMln(summary?.totalNetBookValue)} mln`}
            subtext={`Dastlabki: ${formatMln(summary?.totalInitialCost)} mln`}
            icon={<IconSafe />}
            bgColor="#00B42A"
            footerBgColor="#009A22"
            linkText="Moliyaviy reestr"
            onClick={() => navigate('/assets')}
          />
        </Col>

        {/* Card 3: Pending Requests */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Kutilayotgan Zayavkalar"
            value={isLoading ? '—' : `${summary?.pendingRequestsCount || 0}`}
            subtext={(summary?.pendingRequestsCount || 0) > 0 ? 'Tasdiqlash kutilmoqda' : 'Hammasi bajarilgan'}
            icon={<IconFile />}
            bgColor="#FF7D00"
            footerBgColor="#D25F00"
            linkText="Zayavkalarni ko‘rish"
            onClick={() => navigate('/requests')}
          />
        </Col>

        {/* Card 4: Consumables */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Ombor Sarf Zaxirasi"
            value={isLoading ? '—' : `${summary?.totalStockUnits || 0}`}
            subtext={(summary?.lowStockCount || 0) > 0 ? `${summary?.lowStockCount} turdagi tovar kam` : 'Zaxiralar yetarli'}
            icon={<IconArchive />}
            bgColor="#722ED1"
            footerBgColor="#531DAB"
            linkText="Ombor hisoboti"
            onClick={() => navigate('/warehouse')}
          />
        </Col>

        {/* Card 5: In Repairs */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Ta’mirdagi Texnikalar"
            value={isLoading ? '—' : `${summary?.statusCounts?.IN_REPAIR || 0}`}
            subtext="Servis va ustaxona"
            icon={<IconTool />}
            bgColor="#F53F3F"
            footerBgColor="#CB272D"
            linkText="Ta’mirlash jurnali"
            onClick={() => navigate('/repairs')}
          />
        </Col>

        {/* Card 6: MOL & Staff */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Moddiy Javobgarlar (MOL)"
            value={isLoading ? '—' : `${summary?.molsCount || 0}`}
            subtext="Ashyo biriktirilgan xodimlar"
            icon={<IconUserGroup />}
            bgColor="#009A87"
            footerBgColor="#007A6C"
            linkText="MOL pasportlari"
            onClick={() => navigate('/users')}
          />
        </Col>
      </Row>

      {/* ROW 2: "NEEDS ATTENTION" OPERATIONAL WIDGET & DEPRECIATION BALANCE */}
      <Row gutter={[16, 16]}>
        {/* Snipe-IT "Needs Attention" Operational Action List */}
        <Col xs={24} lg={12}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, height: '100%' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconExclamationCircle style={{ color: '#FF7D00', fontSize: 18 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Diqqat Talab Qiluvchi Operativ Vazifalar (Needs Attention)
                  </span>
                </div>
                {(needsAttention?.totalAttentionItems || 0) > 0 ? (
                  <Tag color="red" size="small" style={{ borderRadius: 0 }}>
                    {needsAttention?.totalAttentionItems} ta vazifa
                  </Tag>
                ) : (
                  <Tag color="green" size="small" style={{ borderRadius: 0 }}>
                    Hammasi barqaror
                  </Tag>
                )}
              </div>
            }
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Spin tip="Operativ vazifalar tahlil qilinmoqda..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. Low Stock Alert */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: (needsAttention?.lowStockCount || 0) > 0 ? 'var(--color-danger-light-1, #FFECE8)' : 'var(--color-fill-2)',
                    borderLeft: `4px solid ${(needsAttention?.lowStockCount || 0) > 0 ? '#F53F3F' : '#00B42A'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge count={needsAttention?.lowStockCount || 0} maxCount={99} dotStyle={{ borderRadius: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Zaxirasi kritik kam mahsulotlar
                    </div>
                  </div>
                  {(needsAttention?.lowStockCount || 0) > 0 ? (
                    <Button
                      size="mini"
                      type="primary"
                      status="danger"
                      style={{ borderRadius: 0 }}
                      onClick={() => navigate('/warehouse?action=incoming')}
                    >
                      + Kirim qilish
                    </Button>
                  ) : (
                    <Tag color="green" size="small" style={{ borderRadius: 0 }}>Yetarli</Tag>
                  )}
                </div>

                {/* 2. Pending Requests */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: (needsAttention?.pendingRequestsCount || 0) > 0 ? 'var(--color-warning-light-1, #FFF7E8)' : 'var(--color-fill-2)',
                    borderLeft: `4px solid ${(needsAttention?.pendingRequestsCount || 0) > 0 ? '#FF7D00' : '#00B42A'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge count={needsAttention?.pendingRequestsCount || 0} maxCount={99} dotStyle={{ borderRadius: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Tasdiq kutilayotgan talabnomalar
                    </div>
                  </div>
                  {(needsAttention?.pendingRequestsCount || 0) > 0 ? (
                    <Button
                      size="mini"
                      type="primary"
                      status="warning"
                      style={{ borderRadius: 0 }}
                      onClick={() => navigate('/requests')}
                    >
                      Tasdiqlash
                    </Button>
                  ) : (
                    <Tag color="green" size="small" style={{ borderRadius: 0 }}>Ko‘rilgan</Tag>
                  )}
                </div>

                {/* 3. Pending Transfers */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: (needsAttention?.pendingTransfersCount || 0) > 0 ? 'var(--color-primary-light-1, #E8F3FF)' : 'var(--color-fill-2)',
                    borderLeft: `4px solid ${(needsAttention?.pendingTransfersCount || 0) > 0 ? '#165DFF' : '#00B42A'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge count={needsAttention?.pendingTransfersCount || 0} maxCount={99} dotStyle={{ borderRadius: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Topshirish-qabul qilish dalolatnomalari (OS-1)
                    </div>
                  </div>
                  {(needsAttention?.pendingTransfersCount || 0) > 0 ? (
                    <Button
                      size="mini"
                      type="primary"
                      style={{ borderRadius: 0 }}
                      onClick={() => navigate('/assets')}
                    >
                      Qabul qilish
                    </Button>
                  ) : (
                    <Tag color="green" size="small" style={{ borderRadius: 0 }}>Toza</Tag>
                  )}
                </div>

                {/* 4. In Repair Hardware */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: (summary?.statusCounts?.IN_REPAIR || 0) > 0 ? 'var(--color-fill-2)' : 'var(--color-fill-2)',
                    borderLeft: `4px solid ${(summary?.statusCounts?.IN_REPAIR || 0) > 0 ? '#F53F3F' : '#00B42A'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge count={summary?.statusCounts?.IN_REPAIR || 0} maxCount={99} dotStyle={{ borderRadius: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Ta’mirdagi nosoz uskunalar
                    </div>
                  </div>
                  {(summary?.statusCounts?.IN_REPAIR || 0) > 0 && (
                    <Button
                      size="mini"
                      type="outline"
                      status="danger"
                      style={{ borderRadius: 0 }}
                      onClick={() => navigate('/repairs')}
                    >
                      Ko‘rish
                    </Button>
                  )}
                </div>

                {/* 5. Pending Write-Offs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-fill-2)',
                    borderLeft: `4px solid ${(needsAttention?.pendingWriteOffsCount || 0) > 0 ? '#722ED1' : '#00B42A'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge count={needsAttention?.pendingWriteOffsCount || 0} maxCount={99} dotStyle={{ borderRadius: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Spisanie komissiya xulosalari (OS-4)
                    </div>
                  </div>
                  {(needsAttention?.pendingWriteOffsCount || 0) > 0 && (
                    <Button
                      size="mini"
                      type="outline"
                      style={{ borderRadius: 0 }}
                      onClick={() => navigate('/write-offs')}
                    >
                      Ovoz berish
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* Quick Replenish Table for Low Stock items */}
        <Col xs={24} lg={12}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, height: '100%' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconStorage style={{ color: '#F53F3F' }} />
                  <span style={{ fontWeight: 600 }}>Kritik Qoldiqdagi Sarf Tovarlar (Quick Replenish)</span>
                  {lowStocks.length > 0 && (
                    <Badge count={lowStocks.length} maxCount={99} dotStyle={{ borderRadius: 0 }} />
                  )}
                </div>
                {lowStocks.length > 0 && (
                  <Button
                    type="primary"
                    status="danger"
                    size="mini"
                    style={{ borderRadius: 0 }}
                    onClick={() => navigate('/warehouse?action=incoming')}
                  >
                    + Yangi Kirim Orderi
                  </Button>
                )}
              </div>
            }
          >
            {lowStocks.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Empty description="Barcha sarf mahsulotlari qoldig‘i yetarli darajada" />
              </div>
            ) : (
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                data={lowStocks}
                columns={[
                  {
                    title: 'Mahsulot nomi',
                    dataIndex: 'name',
                    render: (name: string) => (
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>{name}</span>
                    ),
                  },
                  {
                    title: 'Zaxira Holati',
                    width: 140,
                    render: (_: any, item: any) => (
                      <StockLevelGauge
                        quantity={item.quantity}
                        minLimit={item.minLimit}
                        unit={item.unit}
                        status="LOW"
                        type="circle"
                        showMinLimit={false}
                      />
                    ),
                  },
                  {
                    title: 'Kamomad',
                    width: 110,
                    render: (_: any, item: any) => {
                      const deficit = item.deficit ?? Math.max(0, item.minLimit - item.quantity);
                      return (
                        <Tag color="red" size="small" style={{ borderRadius: 0, fontWeight: 600 }}>
                          -{deficit} {item.unit}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Amal',
                    width: 90,
                    render: (_: any, item: any) => (
                      <Button
                        size="mini"
                        type="primary"
                        status="danger"
                        style={{ borderRadius: 0 }}
                        onClick={() => navigate(`/warehouse?action=incoming&itemId=${item.itemId || item.id}`)}
                      >
                        + Kirim
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ROW 3: MULK AMORTIZATSIYASI & FUNDING SOURCES BALANCE */}
      <Row gutter={[16, 16]}>
        {/* Mulk Amortizatsiyasi va Eskirish Tahlili (Book Value Engine) */}
        <Col xs={24} lg={12}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, height: '100%' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconSafe style={{ color: '#165DFF' }} />
                <span style={{ fontWeight: 600 }}>Mulk Amortizatsiyasi va Qoldiq Balans Qiymati</span>
              </div>
            }
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin tip="Moliyaviy tahlil hisoblanmoqda..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Visual Depreciation Meter */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--color-text-2)' }}>Eskirish (Amortizatsiya) darajasi:</span>
                    <b style={{ color: '#F53F3F', fontSize: 14 }}>{summary?.depreciationPercentage || 0}%</b>
                  </div>
                  <Progress
                    percent={summary?.depreciationPercentage || 0}
                    strokeWidth={10}
                    showText={false}
                    color="#F53F3F"
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
                    <span>Dastlabki balans: 100%</span>
                    <span>Qoldiq foydali qiymat: {100 - (summary?.depreciationPercentage || 0)}%</span>
                  </div>
                </div>

                {/* 3 Value Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                  }}
                >
                  <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-fill-2)', borderLeft: '3px solid #165DFF' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Dastlabki Balans Qiymati</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)', marginTop: 4 }}>
                      {formatPrice(summary?.totalInitialCost)}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-fill-2)', borderLeft: '3px solid #F53F3F' }}>
                    <div style={{ fontSize: 11, color: '#F53F3F' }}>Jami Amortizatsiya</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F53F3F', marginTop: 4 }}>
                      - {formatPrice(summary?.totalDepreciated)}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-fill-2)', borderLeft: '3px solid #00B42A' }}>
                    <div style={{ fontSize: 11, color: '#00B42A' }}>Joriy Qoldiq Qiymat</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#00B42A', marginTop: 4 }}>
                      {formatPrice(summary?.totalNetBookValue)}
                    </div>
                  </div>
                </div>

                {/* Status Breakdown Chips */}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>
                    Inventar holati bo‘yicha taqsimot:
                  </div>
                  <Space size="small" wrap>
                    <Tag color="green" style={{ borderRadius: 0 }}>Yangi: {summary?.statusCounts?.NEW || 0} ta</Tag>
                    <Tag color="blue" style={{ borderRadius: 0 }}>Foydalanishda: {summary?.statusCounts?.IN_USE || 0} ta</Tag>
                    <Tag color="orange" style={{ borderRadius: 0 }}>Ta’mirda: {summary?.statusCounts?.IN_REPAIR || 0} ta</Tag>
                    <Tag color="red" style={{ borderRadius: 0 }}>Hisobdan chiqarilgan: {summary?.statusCounts?.WRITTEN_OFF || 0} ta</Tag>
                  </Space>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* Moliyalashtirish Manbalari Balansi */}
        <Col xs={24} lg={12}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, height: '100%' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconBranch style={{ color: '#00B42A' }} />
                <span style={{ fontWeight: 600 }}>Moliyalashtirish Manbalari Balansi</span>
              </div>
            }
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin tip="Manbalar yuklanmoqda..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {fundingSources.map((fs) => (
                  <div key={fs.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {fs.name}{' '}
                        <span style={{ fontWeight: 400, color: 'var(--color-text-3)', fontSize: 12 }}>
                          ({fs.count} ta vosita)
                        </span>
                      </span>
                      <span style={{ fontWeight: 700, color: '#165DFF', fontSize: 13 }}>
                        {formatPrice(fs.initialCost)}{' '}
                        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>({fs.percentage}%)</span>
                      </span>
                    </div>
                    <Progress
                      percent={fs.percentage}
                      strokeWidth={10}
                      showText={false}
                      color={
                        fs.key === 'BYUDJET'
                          ? '#165DFF'
                          : fs.key === 'KONTRAKT_RIVOJLANTIRISH'
                          ? '#00B42A'
                          : '#FF7D00'
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ROW 4: RECENT MOVEMENTS & REQUESTS AUDIT LOG TABLES */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0 }}
            bodyStyle={{ padding: 0 }}
            title={<Title heading={6} style={{ margin: 0 }}>So‘nggi Ombor Harakatlari (Audit Log)</Title>}
            extra={
              <Button type="text" size="small" onClick={() => navigate('/movements')}>
                Barchasini ko‘rish
              </Button>
            }
          >
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              data={recentMovements}
              noDataElement={<Empty description="Harakatlar jurnali bo‘sh" />}
              columns={[
                {
                  title: 'Harakat №',
                  dataIndex: 'movementNumber',
                  render: (val: string) => <b style={{ color: '#165DFF' }}>{val}</b>,
                },
                {
                  title: 'Turi',
                  dataIndex: 'movementType',
                  render: (val: string) => {
                    if (val === 'INCOMING') return <Tag color="blue" style={{ borderRadius: 0 }}>Kirim</Tag>;
                    if (val === 'TRANSFER') return <Tag color="cyan" style={{ borderRadius: 0 }}>Siljish</Tag>;
                    if (val === 'WRITE_OFF') return <Tag color="red" style={{ borderRadius: 0 }}>Spisanie</Tag>;
                    if (val === 'RETURN') return <Tag color="orange" style={{ borderRadius: 0 }}>Qaytarish</Tag>;
                    return <Tag style={{ borderRadius: 0 }}>{val}</Tag>;
                  },
                },
                {
                  title: 'Mahsulotlar',
                  dataIndex: 'itemSummary',
                },
                {
                  title: 'Qayerga / Kimga',
                  dataIndex: 'targetLocation',
                },
                {
                  title: 'Sana',
                  dataIndex: 'createdAt',
                  render: (d: string) => <span style={{ color: 'var(--color-text-3)', fontSize: 12 }}>{d}</span>,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0 }}
            bodyStyle={{ padding: 0 }}
            title={<Title heading={6} style={{ margin: 0 }}>Faol Talabnomalar (Zayavkalar)</Title>}
            extra={
              <Button type="text" size="small" onClick={() => navigate('/requests')}>
                Zayavkalar
              </Button>
            }
          >
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              data={recentRequests}
              noDataElement={<Empty description="Faol zayavkalar yo‘q" />}
              columns={[
                {
                  title: 'Zayavka №',
                  dataIndex: 'requestNumber',
                  render: (num: string) => <span style={{ fontWeight: 600, color: '#165DFF' }}>{num}</span>,
                },
                {
                  title: 'Talabgor',
                  dataIndex: 'requesterName',
                  render: (name: string) => <span style={{ fontSize: 13 }}>{name}</span>,
                },
                {
                  title: 'Holati',
                  dataIndex: 'status',
                  render: (status: string) => {
                    if (status === 'PENDING') return <Tag color="orange" style={{ borderRadius: 0 }}>Kutilmoqda</Tag>;
                    if (status === 'APPROVED_BY_HEAD') return <Tag color="green" style={{ borderRadius: 0 }}>Tasdiqlandi</Tag>;
                    if (status === 'FULFILLED') return <Tag color="arcoblue" style={{ borderRadius: 0 }}>Bajarildi</Tag>;
                    return <Tag style={{ borderRadius: 0 }}>{status}</Tag>;
                  },
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
