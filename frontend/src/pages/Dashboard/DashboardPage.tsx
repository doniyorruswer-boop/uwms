import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Grid,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Spin,
  Empty,
  Badge,
  Tooltip,
  Skeleton,
  Progress,
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
  IconApps,
  IconSafe,
  IconStorage,
  IconCheckCircle,
  IconTool,
  IconUserGroup,
  IconRight,
  IconSync,
  IconClockCircle,
  IconCalendar,
  IconWifi,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useDashboardAnalyticsQuery } from '../../hooks/useDashboardAnalyticsQuery';
import { useQuotasQuery } from '../../hooks/useQuotasQuery';
import { useSocket } from '../../hooks/useSocket';
import { exportToExcel } from '../../utils/exportExcel';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';
import { formatMoney, formatMln, formatPercent } from '../../utils/formatters';
import { StatusTag } from '../../components/Common/StatusTag';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { analytics, isLoading, isError, refetch } = useDashboardAnalyticsQuery();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real-Time Live Sync: Talabnomalar va operativ ko'rsatkichlar yangilanganda dashboardni sinxronlash
  const queryClient = useQueryClient();
  const { socket, isConnected: isSocketConnected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleWorkflowSync = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    };

    const syncEvents = [
      'REQUEST_CREATED',
      'REQUEST_UPDATED',
      'request:created',
      'request:status_changed',
      'stock:updated',
      'STOCK_UPDATED',
      'stock:low_alert',
      'writeoff:created',
      'writeoff:finalized',
      'transfer:accepted',
    ];

    syncEvents.forEach((evt) => socket.on(evt, handleWorkflowSync));

    return () => {
      syncEvents.forEach((evt) => socket.off(evt, handleWorkflowSync));
    };
  }, [socket, queryClient]);

  // Current period for quotas (YYYY-MM)
  const currentPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const { data: quotas = [], isLoading: isQuotasLoading, refetch: refetchQuotas } = useQuotasQuery({
    period: currentPeriod,
  });

  const exceededQuotas = useMemo(
    () => quotas.filter((q) => q.usedQuantity > q.monthlyLimit),
    [quotas]
  );

  const sortedQuotas = useMemo(() => {
    return [...quotas].sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [quotas]);

  const warningQuotas = useMemo(
    () =>
      quotas.filter(
        (q) => q.usedQuantity > q.monthlyLimit * 0.8 && q.usedQuantity <= q.monthlyLimit
      ),
    [quotas]
  );

  const summary = analytics?.summary;
  const needsAttention = analytics?.needsAttention;
  const fundingSources = analytics?.fundingSources || [];
  const categories = analytics?.categories || [];
  const departments = analytics?.departments || [];
  const recentMovements = analytics?.recentMovements || [];
  const recentRequests = analytics?.recentRequests || [];
  const lowStocks = analytics?.lowStockItems || [];

  // Foydalanuvchi roli va vakolatlari
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isRector = user?.role === 'RECTOR';
  const isProrector = user?.role === 'VICE_RECTOR_FINANCE';
  const isChiefAccountant = user?.role === 'CHIEF_ACCOUNTANT';
  const isAuditor = user?.role === 'AUDITOR';
  const isWarehouse = user?.role === 'HEAD_WAREHOUSE';
  const isCommendant = user?.role === 'COMMENDANT';
  const isDepartmentStaff = user?.role === 'MOL' || user?.role === 'EMPLOYEE';

  const isLeadership = isSuperAdmin || isRector || isProrector || isChiefAccountant || isAuditor;

  // Agar kafedra xodimi yoki MOL bo‘lsa, kvotalarni o‘z kafedrasi bo‘yicha filtrlaymiz
  const displayedQuotas = useMemo(() => {
    if (isDepartmentStaff && user?.departmentId) {
      return sortedQuotas.filter((q: any) => q.departmentId === user.departmentId);
    }
    return sortedQuotas;
  }, [sortedQuotas, isDepartmentStaff, user?.departmentId]);


  const handleExportExecutiveExcel = () => {
    if (!analytics) return;

    const summaryReport = [
      { 'Ko‘rsatkich': 'Jami Asosiy Vositalar Soni', 'Qiymat': `${summary?.totalAssets || 0} dona` },
      { 'Ko‘rsatkich': 'Dastlabki Balans Qiymati', 'Qiymat': formatMoney(summary?.totalInitialCost) },
      { 'Ko‘rsatkich': 'Jami Hisoblangan Amortizatsiya', 'Qiymat': formatMoney(summary?.totalDepreciated) },
      { 'Ko‘rsatkich': 'Joriy Qoldiq Balans Qiymati (Book Value)', 'Qiymat': formatMoney(summary?.totalNetBookValue) },
      { 'Ko‘rsatkich': 'Eskirish Foizi', 'Qiymat': `${summary?.depreciationPercentage || 0}%` },
      { 'Ko‘rsatkich': 'Ombordagi Sarf Tovarlar Zaxirasi', 'Qiymat': `${summary?.totalStockUnits || 0} birlik` },
      { 'Ko‘rsatkich': 'Zaxirasi Kam Qolgan Mahsulotlar', 'Qiymat': `${summary?.lowStockCount || 0} ta` },
      { 'Ko‘rsatkich': 'Jarayondagi Talabnomalar', 'Qiymat': `${summary?.pendingRequestsCount || 0} ta` },
      { 'Ko‘rsatkich': 'Kutilayotgan Ko‘chirish Dalolatnomalari', 'Qiymat': `${summary?.pendingTransfersCount || 0} ta` },
      { 'Ko‘rsatkich': 'Ta’mirdagi Texnikalar Soni', 'Qiymat': `${summary?.activeRepairsCount ?? summary?.statusCounts?.IN_REPAIR ?? 0} ta` },
      { 'Ko‘rsatkich': 'Hamkor Ta’minotchilar Soni', 'Qiymat': `${summary?.suppliersCount || 0} ta` },
      { 'Ko‘rsatkich': 'Kafedralar Kvotasidan Oshgan Holatlar', 'Qiymat': `${exceededQuotas.length} ta` },
    ];

    exportToExcel(summaryReport, 'Universitet_Boshqaruv_Tahliliy_Balansi', 'Tahliliy Hisobot');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* EXECUTIVE HEADER TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, margin: 0, color: 'var(--color-text-1)' }}>
            Xush kelibsiz, {user?.fullName}!
          </h1>
          <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 600 }}>
            {user?.role === 'VICE_RECTOR_FINANCE'
              ? 'Moliya-iqtisodiyot bo‘yicha prorektor'
              : user?.role === 'RECTOR'
              ? 'Universitet Rektori'
              : user?.role === 'CHIEF_ACCOUNTANT'
              ? 'Bosh hisobchi'
              : user?.role === 'HEAD_WAREHOUSE'
              ? 'Bosh ombor mudiri'
              : user?.role === 'COMMENDANT'
              ? 'Bino komendanti'
              : user?.role === 'MOL'
              ? 'Moddiy javobgar shaxs (MOL)'
              : user?.role === 'EMPLOYEE'
              ? 'Xodim / O‘qituvchi'
              : 'Bosh Administrator'}
          </Tag>
          {isSocketConnected && (
            <Tag color="green" icon={<IconWifi />} style={{ borderRadius: 0, fontWeight: 600 }}>
              Live Sync (Faol)
            </Tag>
          )}
        </div>

        <Space size="small" wrap style={{ width: isMobile ? '100%' : 'auto' }}>
          <Button
            type="primary"
            icon={<IconScan />}
            onClick={() => navigate('/audit')}
            style={{ borderRadius: isMobile ? 6 : 0, flex: isMobile ? 1 : 'none', minHeight: 38 }}
          >
            QR Skaner
          </Button>
          <Button
            type="outline"
            icon={<IconPlus />}
            onClick={() => navigate('/requests?action=create')}
            style={{ borderRadius: isMobile ? 6 : 0, flex: isMobile ? 1 : 'none', minHeight: 38 }}
          >
            Yangi Zayavka
          </Button>
          {(isLeadership || isWarehouse) && !isMobile && (
            <Button
              icon={<IconDownload />}
              onClick={handleExportExecutiveExcel}
              style={{ borderRadius: 0 }}
            >
              Tahliliy Hisobot (Excel)
            </Button>
          )}
          <Button
            icon={<IconSync />}
            loading={isLoading || isQuotasLoading}
            onClick={() => {
              refetch();
              refetchQuotas();
            }}
            style={{ borderRadius: isMobile ? 6 : 0, minHeight: 38 }}
          />
        </Space>
      </div>

      {/* MOBILE ACTION HIGHLIGHT BANNER */}
      {isMobile && (summary?.pendingRequestsCount || 0) > 0 && (
        <Card
          style={{
            borderRadius: 8,
            backgroundColor: '#FFF7E8',
            border: '1px solid #FFC069',
            boxShadow: '0 2px 8px rgba(250,140,22,0.1)',
          }}
          bodyStyle={{ padding: '12px 14px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: '#FFE7BA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D46B08',
                  flexShrink: 0,
                }}
              >
                <IconFile style={{ fontSize: 20 }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#D46B08' }}>
                  {summary?.pendingRequestsCount} ta jarayondagi ariza
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                  Ijro va tasdiqlash jarayonida
                </div>
              </div>
            </div>
            <Button
              type="primary"
              size="small"
              style={{ borderRadius: 6, backgroundColor: '#FA8C16' }}
              onClick={() => navigate('/inbox')}
            >
              Ko‘rish
            </Button>
          </div>
        </Card>
      )}

      {/* ERROR STATE: ROBUST ERROR HANDLING */}
      {isError && !analytics && (
        <Card style={{ borderRadius: 0, border: '1px solid #F53F3F' }}>
          <Alert
            type="error"
            title="Tahliliy ko‘rsatkichlarni yuklashda xatolik yuz berdi"
            content="Server bilan aloqada uzilish yuz berdi yoki ichki xatolik mavjud. Iltimos, qaytadan urinib ko‘ring."
            action={
              <Button
                size="small"
                type="primary"
                status="danger"
                icon={<IconSync />}
                onClick={() => {
                  refetch();
                  refetchQuotas();
                }}
              >
                Qayta yuklash
              </Button>
            }
          />
        </Card>
      )}

      {isError && analytics && (
        <Alert
          type="warning"
          banner
          title="Diqqat: Yangi ma’lumotlarni sinxronlashda xatolik yuz berdi. Keshdagi tahliliy ko‘rsatkichlar namoyish etilmoqda."
          action={
            <Button size="mini" type="outline" onClick={() => { refetch(); refetchQuotas(); }}>
              Qayta yangilash
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
            subtext={(summary?.pendingTransfersCount || 0) > 0 ? `${summary?.pendingTransfersCount} ta topshirish jarayonda` : '100% QR hisobga olingan'}
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

        {/* Card 3: Pending / In-progress Requests */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatHeroCard
            title="Jarayondagi Talabnomalar"
            value={isLoading ? '—' : `${summary?.pendingRequestsCount || 0}`}
            subtext={
              (summary?.myActionRequestsCount || 0) > 0
                ? `${summary?.myActionRequestsCount} ta vizangiz kutilmoqda`
                : (summary?.pendingRequestsCount || 0) > 0
                ? `${summary?.pendingRequestsCount} ta ijro jarayonida`
                : 'Barcha arizalar yakunlangan'
            }
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
            value={isLoading ? '—' : `${summary?.activeRepairsCount ?? summary?.statusCounts?.IN_REPAIR ?? 0}`}
            subtext={
              (summary?.activeRepairsCount || 0) > 0
                ? `${summary?.activeRepairsCount} ta servis jarayonida`
                : 'Servis va ustaxona'
            }
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

      {/* ROW 2: RECENT MOVEMENTS & REQUESTS AUDIT LOG TABLES */}
      <Row gutter={[16, 16]} style={{ display: 'flex', alignItems: 'stretch' }}>
        <Col xs={24} lg={14} style={{ display: 'flex' }}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, width: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconStorage style={{ color: '#165DFF', fontSize: 18 }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  So‘nggi Ombor Harakatlari (Audit Log)
                </span>
              </div>
            }
            extra={
              <Button
                type="outline"
                size="mini"
                onClick={() => navigate('/movements')}
                style={{ borderRadius: 0 }}
              >
                Barchasini ko‘rish <IconRight />
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
                  width: 140,
                  render: (val: string) => (
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', whiteSpace: 'nowrap' }}>
                      {val}
                    </span>
                  ),
                },
                {
                  title: 'Turi',
                  dataIndex: 'movementType',
                  width: 95,
                  render: (val: string) => {
                    if (val === 'INCOMING') return <Tag color="blue" size="small" style={{ borderRadius: 0, fontSize: 12 }}>Kirim</Tag>;
                    if (val === 'OUTGOING') return <Tag color="arcoblue" size="small" style={{ borderRadius: 0, fontSize: 12 }}>Chiqim</Tag>;
                    if (val === 'TRANSFER') return <Tag color="cyan" size="small" style={{ borderRadius: 0, fontSize: 12 }}>Siljish</Tag>;
                    if (val === 'WRITE_OFF') return <Tag color="red" size="small" style={{ borderRadius: 0, fontSize: 12 }}>Spisanie</Tag>;
                    if (val === 'RETURN') return <Tag color="orange" size="small" style={{ borderRadius: 0, fontSize: 12 }}>Qaytarish</Tag>;
                    return <Tag size="small" style={{ borderRadius: 0, fontSize: 12 }}>{val}</Tag>;
                  },
                },
                {
                  title: 'Mahsulotlar',
                  dataIndex: 'itemSummary',
                  render: (text: string) => (
                    <span style={{ fontSize: 13, color: 'var(--color-text-1)' }}>
                      {text}
                    </span>
                  ),
                },
                {
                  title: 'Qayerga / Kimga',
                  dataIndex: 'targetLocation',
                  width: 160,
                  render: (text: string) => (
                    <span style={{ fontSize: 13, color: 'var(--color-text-1)' }}>
                      {text}
                    </span>
                  ),
                },
                {
                  title: 'Sana',
                  dataIndex: 'createdAt',
                  width: 105,
                  render: (d: string) => (
                    <span style={{ color: 'var(--color-text-3)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {d}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10} style={{ display: 'flex' }}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, width: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconFile style={{ color: '#FA8C16', fontSize: 18 }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  Faol Talabnomalar (Zayavkalar)
                </span>
              </div>
            }
            extra={
              <Button
                type="outline"
                size="mini"
                onClick={() => navigate('/requests')}
                style={{ borderRadius: 0 }}
              >
                Barchasini ko‘rish <IconRight />
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
                  width: 135,
                  render: (num: string) => (
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#165DFF', whiteSpace: 'nowrap' }}>
                      {num}
                    </span>
                  ),
                },
                {
                  title: 'Talabgor',
                  dataIndex: 'requesterName',
                  width: 160,
                  render: (name: string) => (
                    <span style={{ fontSize: 13, color: 'var(--color-text-1)', fontWeight: 500 }}>
                      {name}
                    </span>
                  ),
                },
                {
                  title: 'Holati',
                  dataIndex: 'status',
                  render: (status: string) => (
                    <StatusTag status={status} domain="request" />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* ROW 3: AKTIVLAR TOIFALARI VA FAKULTETLAR BO‘YICHA MULK BALANSI */}
      <Row gutter={[16, 16]} style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Left: Category Breakdown (Aktivlar Toifalari Balansi) */}
        <Col xs={24} lg={10} style={{ display: 'flex' }}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, width: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconApps style={{ color: '#722ED1', fontSize: 18 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Aktivlar Toifalari Balansi
                  </span>
                  <Tag color="purple" size="small" style={{ borderRadius: 0, fontWeight: 600 }}>
                    {categories.length} ta toifa
                  </Tag>
                </div>
                <Button
                  size="mini"
                  type="outline"
                  onClick={() => navigate('/assets')}
                  style={{ borderRadius: 0 }}
                >
                  Barcha toifalar <IconRight />
                </Button>
              </div>
            }
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin dot size={20} tip="Toifalar bo‘yicha balans yuklanmoqda..." />
              </div>
            ) : categories.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="Toifalar bo‘yicha ashyolar topilmadi" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: 8 }}>
                {categories.map((cat, index) => {
                  const catPalette = ['#165DFF', '#722ED1', '#00B42A', '#FF7D00', '#F53F3F', '#0FC6C2'];
                  const color = catPalette[index % catPalette.length];
                  return (
                    <div
                      key={cat.name}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--color-fill-2)',
                        borderLeft: `3px solid ${color}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 6,
                        flex: 1,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onClick={() => navigate(`/assets?search=${encodeURIComponent(cat.name)}`)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: color,
                              display: 'inline-block',
                            }}
                          />
                          <b style={{ fontSize: 13, color: 'var(--color-text-1)' }}>
                            {cat.name}
                          </b>
                        </div>
                        <Tag size="small" style={{ borderRadius: 0, fontWeight: 600, color, backgroundColor: 'var(--color-bg-2)' }}>
                          {cat.count} ta vosita
                        </Tag>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--color-text-3)' }}>
                          Balans qiymati:
                        </span>
                        <b style={{ color: 'var(--color-text-1)' }}>
                          {formatMoney(cat.initialCost)}
                        </b>
                      </div>

                      <Progress
                        percent={cat.percentage}
                        size="small"
                        color={color}
                        style={{ width: '100%' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Department & Faculty Asset Registry Table */}
        <Col xs={24} lg={14} style={{ display: 'flex' }}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0, width: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconBranch style={{ color: '#165DFF', fontSize: 18 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Fakultet va Kafedralar Bo‘yicha Mulk Balansi
                  </span>
                  <Tag color="blue" size="small" style={{ borderRadius: 0, fontWeight: 600 }}>
                    {departments.length} ta tuzilma
                  </Tag>
                </div>
                <Space size="small">
                  <Button
                    size="mini"
                    type="outline"
                    onClick={() => navigate('/organization')}
                    style={{ borderRadius: 0 }}
                  >
                    Tuzilma xaritasi <IconRight />
                  </Button>
                </Space>
              </div>
            }
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin dot size={20} tip="Fakultet va kafedralar balansi yuklanmoqda..." />
              </div>
            ) : departments.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <Empty description="Tuzilmalar bo‘yicha ashyolar ma’lumoti topilmadi" />
              </div>
            ) : (
              <Table
                rowKey={(record) => record.id || record.name}
                pagination={{ pageSize: 6, sizeCanChange: false }}
                size="small"
                data={departments}
                columns={[
                  {
                    title: 'Kafedra / Bo‘lim',
                    dataIndex: 'name',
                    render: (name: string, record: any) => (
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-1)', fontSize: 13 }}>
                          {name}
                        </div>
                        {record.facultyName && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                            {record.facultyName}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: 'Vositalar Soni',
                    dataIndex: 'count',
                    width: 120,
                    sorter: (a, b) => a.count - b.count,
                    render: (cnt: number) => (
                      <Badge count={cnt} maxCount={9999} />
                    ),
                  },
                  {
                    title: 'Balans Qiymati',
                    dataIndex: 'initialCost',
                    width: 165,
                    sorter: (a, b) => a.initialCost - b.initialCost,
                    render: (val: number, record: any) => (
                      <div style={{ fontWeight: 600, color: '#00B42A', fontSize: 13 }}>
                        {formatMoney(val || record.initialCost)}
                      </div>
                    ),
                  },
                  {
                    title: 'Mulk Ulushi',
                    dataIndex: 'percentage',
                    width: 130,
                    sorter: (a, b) => a.percentage - b.percentage,
                    render: (pct: number) => (
                      <div style={{ width: '100%' }}>
                        <Progress
                          percent={pct}
                          size="small"
                          color="#165DFF"
                          style={{ width: '100%' }}
                        />
                      </div>
                    ),
                  },
                  {
                    title: 'Amal',
                    width: 75,
                    render: (_: any, record: any) => (
                      <Button
                        size="mini"
                        type="text"
                        onClick={() => {
                          const term = record.id === 'warehouse' ? 'ombor' : record.name;
                          navigate(`/assets?search=${encodeURIComponent(term)}`);
                        }}
                      >
                        Aktivlar
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ROW 3: MULK AMORTIZATSIYASI & FUNDING SOURCES BALANCE (Faqat Rahbariyat va Bosh Hisobchi) */}
      {isLeadership && (
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
                <Spin dot size={20} tip="Moliyaviy tahlil hisoblanmoqda..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Visual Depreciation Meter */}
                <StockLevelGauge
                  percent={summary?.depreciationPercentage || 0}
                  label={<span style={{ color: 'var(--color-text-2)', fontSize: 13 }}>Eskirish (Amortizatsiya) darajasi:</span>}
                  subLabel={<b style={{ color: '#F53F3F', fontSize: 14 }}>{summary?.depreciationPercentage || 0}%</b>}
                  color="#F53F3F"
                  strokeWidth={8}
                  width="100%"
                />

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
                      {formatMoney(summary?.totalInitialCost)}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-fill-2)', borderLeft: '3px solid #F53F3F' }}>
                    <div style={{ fontSize: 11, color: '#F53F3F' }}>Jami Amortizatsiya</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F53F3F', marginTop: 4 }}>
                      - {formatMoney(summary?.totalDepreciated)}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-fill-2)', borderLeft: '3px solid #00B42A' }}>
                    <div style={{ fontSize: 11, color: '#00B42A' }}>Joriy Qoldiq Qiymat</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#00B42A', marginTop: 4 }}>
                      {formatMoney(summary?.totalNetBookValue)}
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
            extra={
              <Button
                size="mini"
                type="outline"
                onClick={() => navigate('/reports/funding')}
                style={{ borderRadius: 0 }}
              >
                Batafsil hisobot <IconRight />
              </Button>
            }
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin dot size={20} tip="Manbalar yuklanmoqda..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {fundingSources.map((fs) => (
                  <div key={fs.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-1)' }}>
                    <StockLevelGauge
                      percent={fs.percentage}
                      label={
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {fs.name}{' '}
                          <span style={{ fontWeight: 400, color: 'var(--color-text-3)', fontSize: 12 }}>
                            ({fs.count} ta vosita)
                          </span>
                        </span>
                      }
                      subLabel={
                        <span style={{ fontWeight: 700, color: '#165DFF', fontSize: 13 }}>
                          {formatMoney(fs.initialCost)}{' '}
                          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>({fs.percentage}%)</span>
                        </span>
                      }
                      color={
                        fs.key === 'BYUDJET'
                          ? '#165DFF'
                          : fs.key === 'KONTRAKT_RIVOJLANTIRISH'
                          ? '#00B42A'
                          : '#FF7D00'
                      }
                      strokeWidth={8}
                      width="100%"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
      )}

      {/* ROW 3.5: KAFEDRALAR OYLIK KVOTA MONITORINGI (DEPARTMENT QUOTA LIMIT WATCHER) */}
      <Card
        className="uwms-card"
        style={{ borderRadius: 0 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCalendar style={{ color: '#165DFF', fontSize: 18 }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {isDepartmentStaff && user?.departmentName
                  ? `${user.departmentName} Oylik Sarf Kvotalari Nazorati (${currentPeriod} davri)`
                  : `Kafedralar va Bo‘limlar Oylik Sarf Kvotalari Nazorati (${currentPeriod} davri)`}
              </span>
              {exceededQuotas.length > 0 ? (
                <Tag color="red" size="small" style={{ borderRadius: 0, fontWeight: 600 }}>
                  {exceededQuotas.length} ta tuzilmada oylik limitdan oshish qayd etildi!
                </Tag>
              ) : (
                <Tag color="green" size="small" style={{ borderRadius: 0 }}>
                  Barcha tuzilmalar me’yoriy limit doirasida
                </Tag>
              )}
            </div>
            <Button size="mini" type="outline" onClick={() => navigate('/quotas')} style={{ borderRadius: 0 }}>
              {isProrector ? 'Kvotalarni boshqarish' : 'Kvotalar reestri'} <IconRight />
            </Button>
          </div>
        }
      >
        {isQuotasLoading ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Spin dot size={20} tip="Kafedralar va bo‘limlar oylik kvotalari monitoringi yuklanmoqda..." />
          </div>
        ) : quotas.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Empty description="Joriy oy uchun kafedralar va bo‘limlar sarf kvotasi belgilanmagan" />
          </div>
        ) : (
          <Table
            rowKey="id"
            pagination={{ pageSize: 6, sizeCanChange: false }}
            size="small"
            data={displayedQuotas}
            columns={[
              {
                title: 'Kafedra / Bo‘lim',
                dataIndex: 'department',
                render: (dept: any) => (
                  <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {dept?.name || 'Kafedra'}
                  </span>
                ),
              },
              {
                title: 'Sarf Materiali',
                dataIndex: 'item',
                render: (item: any) => (
                  <span style={{ color: 'var(--color-text-2)' }}>
                    {item?.name || 'Mahsulot'}
                  </span>
                ),
              },
              {
                title: 'Oylik Limit',
                dataIndex: 'monthlyLimit',
                width: 120,
                render: (lim: number, record: any) => (
                  <span>
                    {lim} {record?.item?.unit || 'dona'}
                  </span>
                ),
              },
              {
                title: 'Sarflangan Miqdor',
                dataIndex: 'usedQuantity',
                width: 140,
                render: (used: number, record: any) => {
                  const isExceeded = used > record.monthlyLimit;
                  return (
                    <b style={{ color: isExceeded ? '#F53F3F' : 'var(--color-text-1)' }}>
                      {used} {record?.item?.unit || 'dona'}
                    </b>
                  );
                },
              },
              {
                title: 'Limit Iste’moli',
                width: 180,
                render: (_: any, record: any) => {
                  const percent = record.monthlyLimit > 0 ? Math.round((record.usedQuantity / record.monthlyLimit) * 100) : 0;
                  const isExceeded = percent > 100;
                  return (
                    <div style={{ width: '100%' }}>
                      <StockLevelGauge
                        percent={percent}
                        label={<span style={{ fontSize: 11 }}>{percent}%</span>}
                        color={isExceeded ? '#F53F3F' : percent > 80 ? '#FF7D00' : '#00B42A'}
                        strokeWidth={6}
                        width="100%"
                      />
                    </div>
                  );
                },
              },
              {
                title: 'Holati',
                width: 170,
                render: (_: any, record: any) => {
                  if (record.usedQuantity > record.monthlyLimit) {
                    return (
                      <Tag color="red" style={{ borderRadius: 0, fontWeight: 600 }}>
                        Limitdan oshgan (+{record.usedQuantity - record.monthlyLimit})
                      </Tag>
                    );
                  }
                  if (record.usedQuantity > record.monthlyLimit * 0.8) {
                    return (
                      <Tag color="orange" style={{ borderRadius: 0 }}>
                        Kritik chegara (80%+)
                      </Tag>
                    );
                  }
                  return (
                    <Tag color="green" style={{ borderRadius: 0 }}>
                      Me’yorda
                    </Tag>
                  );
                },
              },
              {
                title: 'Amal',
                width: 110,
                render: (_: any, record: any) => (
                  <Button
                    size="mini"
                    type={record.usedQuantity > record.monthlyLimit ? 'primary' : 'outline'}
                    status={record.usedQuantity > record.monthlyLimit ? 'danger' : 'default'}
                    style={{ borderRadius: 0 }}
                    onClick={() => navigate('/quotas')}
                  >
                    {isProrector
                      ? (record.usedQuantity > record.monthlyLimit ? 'Ruxsat Berish' : 'Tahrirlash')
                      : 'Ko‘rish'}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
};
