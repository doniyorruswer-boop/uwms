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
  Alert,
  Tabs,
  Modal,
  Tooltip,
  Input,
  Descriptions,
} from '@arco-design/web-react';
import {
  IconDownload,
  IconRefresh,
  IconCheckCircle,
  IconFile,
  IconEye,
  IconUser,
  IconSearch,
  IconSafe,
  IconHistory,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import {
  useChiefAccountantReceipts,
  useChiefAccountantHandoverBalance,
  useChiefAccountantMolDetails,
  useChiefAccountantExport,
  FundingSourceType,
  StateExportFormat,
  ChiefAccountantReceiptItem,
  ChiefAccountantMolBalanceItem,
} from '../../hooks/useChiefAccountantQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { StatHeroCard } from '../../components/Common/StatHeroCard';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { formatMoney, formatMln, formatDate } from '../../utils/formatters';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;
const TabPane = Tabs.TabPane;

export const ChiefAccountantLedgerPage: React.FC = () => {
  const { user } = useAuthStore();
  const allowedRoles = [
    'CHIEF_ACCOUNTANT',
    'SUPER_ADMIN',
    'VICE_RECTOR_FINANCE',
    'RECTOR',
    'HEAD_WAREHOUSE',
  ];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>('receipts');

  // Filters for Iz 1 (Receipts / OS-1)
  const [receiptsPeriod, setReceiptsPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [receiptsSource, setReceiptsSource] = useState<FundingSourceType | 'ALL'>('ALL');
  const [receiptsSubAccount, setReceiptsSubAccount] = useState<string>('ALL');
  const [receiptsSearch, setReceiptsSearch] = useState<string>('');
  const [receiptsPage, setReceiptsPage] = useState<number>(1);
  const [receiptsLimit, setReceiptsLimit] = useState<number>(15);

  // Filters for Iz 2 (Handover Balance / OS-2)
  const [handoverSearch, setHandoverSearch] = useState<string>('');
  const [handoverDeptId, setHandoverDeptId] = useState<string>('ALL');
  const [handoverPage, setHandoverPage] = useState<number>(1);
  const [handoverLimit, setHandoverLimit] = useState<number>(15);

  // Filters for Iz 3 (Export Center)
  const [exportPeriod, setExportPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [exportSource, setExportSource] = useState<FundingSourceType | 'ALL'>('ALL');

  // Drill-down Modal State for MOL
  const [selectedMolId, setSelectedMolId] = useState<string | null>(null);
  const [molModalVisible, setMolModalVisible] = useState<boolean>(false);

  // Official OS-1 / OS-2 Document Modal State
  const [docModalVisible, setDocModalVisible] = useState<boolean>(false);
  const [activeDocData, setActiveDocData] = useState<{
    docType: 'KIRIM' | 'TRANSFER';
    docNumber: string;
    date: string;
    senderName: string;
    receiverName: string;
    sourceLocation: string;
    targetLocation: string;
    items: Array<{
      inventoryNumber: string;
      name: string;
      quantity: number;
      unit: string;
      price?: number;
    }>;
  } | null>(null);

  // Queries
  const { allDepartments } = useOrganizationQuery();

  const receiptsParams = useMemo(() => {
    return {
      period: receiptsPeriod || undefined,
      fundingSource: receiptsSource !== 'ALL' ? receiptsSource : undefined,
      subAccountCode: receiptsSubAccount !== 'ALL' ? receiptsSubAccount : undefined,
      search: receiptsSearch.trim() || undefined,
      page: receiptsPage,
      limit: receiptsLimit,
    };
  }, [receiptsPeriod, receiptsSource, receiptsSubAccount, receiptsSearch, receiptsPage, receiptsLimit]);

  const {
    data: receiptsData,
    isLoading: isReceiptsLoading,
    isError: isReceiptsError,
    refetch: refetchReceipts,
  } = useChiefAccountantReceipts(receiptsParams);

  const handoverParams = useMemo(() => {
    return {
      search: handoverSearch.trim() || undefined,
      departmentId: handoverDeptId !== 'ALL' ? handoverDeptId : undefined,
      page: handoverPage,
      limit: handoverLimit,
    };
  }, [handoverSearch, handoverDeptId, handoverPage, handoverLimit]);

  const {
    data: handoverData,
    isLoading: isHandoverLoading,
    isError: isHandoverError,
    refetch: refetchHandover,
  } = useChiefAccountantHandoverBalance(handoverParams);

  // Drill-down query for selected MOL
  const {
    data: molDetailsData,
    isLoading: isMolDetailsLoading,
  } = useChiefAccountantMolDetails(selectedMolId || undefined);

  // Export mutation
  const exportMutation = useChiefAccountantExport();

  // Handle Export Trigger
  const handleExport = (format: StateExportFormat) => {
    exportMutation.mutate({
      format,
      period: exportPeriod || undefined,
      fundingSource: exportSource !== 'ALL' ? exportSource : undefined,
    });
  };

  // Open MOL Drill-down
  const handleOpenMolDetails = (molId: string) => {
    setSelectedMolId(molId);
    setMolModalVisible(true);
  };

  // Open OS-1 Document Preview
  const handleViewOs1Doc = (record: ChiefAccountantReceiptItem) => {
    setActiveDocData({
      docType: 'KIRIM',
      docNumber: record.os1DocNumber,
      date: record.receiptDate,
      senderName: record.supplierName,
      receiverName: record.signedByName || 'Bosh Omborchi',
      sourceLocation: "Ta'minotchi Ombori",
      targetLocation: 'Universitet Markaziy Ombori',
      items: record.items.map((i, idx) => ({
        inventoryNumber: `${record.subAccountCode}-${idx + 1}`,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        price: record.allocatedAmount / (record.itemsCount || 1),
      })),
    });
    setDocModalVisible(true);
  };

  // Open OS-2 Document Preview
  const handleViewOs2Doc = (record: ChiefAccountantMolBalanceItem) => {
    if (!record.lastOs2DocNumber) return;
    setActiveDocData({
      docType: 'TRANSFER',
      docNumber: record.lastOs2DocNumber,
      date: record.lastOs2Date || new Date().toISOString(),
      senderName: 'Universitet Bino Komendanti',
      receiverName: record.molFullName,
      sourceLocation: 'Komendant Binosi',
      targetLocation: `${record.departmentName} Xonalari`,
      items: [
        {
          inventoryNumber: `MOL-${record.molId.slice(0, 5)}`,
          name: `${record.departmentName} biriktirilgan ashyolari`,
          quantity: record.fixedAssetsCount + record.consumablesCount,
          unit: 'DONA',
          price: record.fixedAssetsTotalValue,
        },
      ],
    });
    setDocModalVisible(true);
  };

  if (!hasAccess) {
    return <ForbiddenView />;
  }

  // OS-1 Receipts Table Columns
  const receiptsColumns = [
    {
      title: 'Kirim Sanasi',
      dataIndex: 'receiptDate',
      width: 120,
      render: (val: string) => val ? val.slice(0, 10) : '—',
    },
    {
      title: 'Talabnoma & OS-1',
      dataIndex: 'os1DocNumber',
      width: 160,
      render: (val: string, record: ChiefAccountantReceiptItem) => (
        <Space direction="vertical" size={2}>
          <Text bold>{val}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.requestNumber}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Kafedra & Maqsad',
      dataIndex: 'purpose',
      render: (val: string, record: ChiefAccountantReceiptItem) => (
        <Space direction="vertical" size={2}>
          <Text bold>{record.departmentName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{val}</Text>
        </Space>
      ),
    },
    {
      title: 'Manba & Sub-hisob',
      width: 170,
      render: (_: any, record: ChiefAccountantReceiptItem) => (
        <Space direction="vertical" size={4}>
          <Tag
            color={
              record.fundingSource === 'BYUDJET'
                ? 'blue'
                : record.fundingSource === 'KONTRAKT_RIVOJLANTIRISH'
                ? 'green'
                : 'purple'
            }
          >
            {record.fundingSource}
          </Tag>
          <Tag color="cyan">Sub-hisob: {record.subAccountCode}</Tag>
        </Space>
      ),
    },
    {
      title: 'Summa',
      dataIndex: 'allocatedAmount',
      width: 150,
      render: (val: number) => <Text bold style={{ color: '#0fc6c2' }}>{formatMoney(val)}</Text>,
    },
    {
      title: 'Buyumlar',
      width: 180,
      render: (_: any, record: ChiefAccountantReceiptItem) => (
        <Space direction="vertical" size={2}>
          {record.items.slice(0, 2).map((it, idx) => (
            <Text key={idx} style={{ fontSize: 12 }}>
              • {it.name} ({it.quantity} {it.unit})
            </Text>
          ))}
          {record.items.length > 2 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              +{record.items.length - 2} boshqa buyum
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'QR & WORM Muhr',
      width: 185,
      render: (_: any, record: ChiefAccountantReceiptItem) => {
        const hashDisplay = record.stampHash || `HMAC-OS1-${record.id.slice(0, 8)}`;
        return (
          <Tooltip
            content={
              <div>
                <div><b>Hujjat:</b> {record.os1DocNumber}</div>
                <div><b>Holati:</b> {record.hasStamp ? 'WORM Raqamli Muhrlangan' : 'Kirim Reestriga Olingan'}</div>
                <div><b>Imzolovchi:</b> {record.signedByName || 'Bosh Omborchi'}</div>
                <div><b>HMAC Nazorat Kodi:</b> {hashDisplay}</div>
              </div>
            }
          >
            <Tag
              color={record.hasStamp ? 'green' : 'arcoblue'}
              icon={record.hasStamp ? <IconCheckCircle /> : <IconSafe />}
              style={{ borderRadius: 0, fontWeight: 500 }}
            >
              {record.hasStamp ? 'WORM' : 'HMAC'}: {hashDisplay.slice(0, 8)}...
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Amallar',
      width: 100,
      render: (_: any, record: ChiefAccountantReceiptItem) => (
        <Button
          size="mini"
          type="outline"
          icon={<IconEye />}
          onClick={() => handleViewOs1Doc(record)}
        >
          OS-1
        </Button>
      ),
    },
  ];

  // OS-2 Handover Balance Table Columns
  const handoverColumns = [
    {
      title: 'Moddiy Javobgar Shaxs (MOL)',
      dataIndex: 'molFullName',
      width: 220,
      render: (val: string) => (
        <Text bold>{val}</Text>
      ),
    },
    {
      title: 'Kafedra / Bo‘lim',
      dataIndex: 'departmentName',
      width: 220,
      render: (val: string, record: ChiefAccountantMolBalanceItem) => (
        <Space direction="vertical" size={2}>
          <Text>{val}</Text>
          <Tag size="small" color="arcoblue">
            {record.roomsCount} ta xona biriktirilgan
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Asosiy Vositalar',
      dataIndex: 'fixedAssetsCount',
      width: 130,
      render: (val: number) => <Tag color="blue">{val} ta aktiv</Tag>,
    },
    {
      title: 'Balans Qiymati',
      dataIndex: 'fixedAssetsTotalValue',
      width: 160,
      render: (val: number) => <Text bold style={{ color: '#165dff' }}>{formatMoney(val)}</Text>,
    },
    {
      title: 'Sarflanuvchi Materiallar',
      dataIndex: 'consumablesCount',
      width: 150,
      render: (val: number) => <Tag color="cyan">{val} dona</Tag>,
    },
    {
      title: 'Oxirgi OS-2 Qabuli',
      dataIndex: 'lastOs2DocNumber',
      width: 170,
      render: (val: string | null, record: ChiefAccountantMolBalanceItem) => {
        if (!val) return <Text type="secondary">Mavjud emas</Text>;
        return (
          <Space direction="vertical" size={2}>
            <Text bold>{val}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.lastOs2Date ? record.lastOs2Date.slice(0, 10) : ''}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Amallar',
      width: 160,
      render: (_: any, record: ChiefAccountantMolBalanceItem) => (
        <Space size={4}>
          <Button
            size="mini"
            type="primary"
            icon={<IconEye />}
            onClick={() => handleOpenMolDetails(record.molId)}
          >
            Aktivlar
          </Button>
          {record.lastOs2DocNumber && (
            <Button
              size="mini"
              type="outline"
              onClick={() => handleViewOs2Doc(record)}
            >
              OS-2
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Hero Card Statistics
  const totalReceiptsAmount = receiptsData?.summary.totalReceiptsAmount || 0;
  const totalAssignedValue = handoverData?.summary.totalAssignedValue || 0;
  const byudjetAmount = receiptsData?.summary.byFundingSource?.['BYUDJET']?.amount || 0;
  const totalFixedAssets = handoverData?.summary.totalFixedAssetsCount || 0;
  const totalMols = handoverData?.summary.totalMolsCount || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Top Action Toolbar (Oq fonsiz, toza tugmalar) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Space>
          <Button
            type="outline"
            icon={<IconRefresh />}
            onClick={() => {
              refetchReceipts();
              refetchHandover();
            }}
          >
            Yangilash
          </Button>
          <Button
            type="primary"
            icon={<IconDownload />}
            style={{ backgroundColor: '#165DFF' }}
            onClick={() => setActiveTab('exports')}
          >
            Davlat Eksport Markazi
          </Button>
        </Space>
      </div>

      {/* Hero Stat Cards — Top of Page */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Jami Kirim Summasi"
            value={`${formatMln(totalReceiptsAmount)} mln`}
            subtext={formatMoney(totalReceiptsAmount)}
            icon={<IconFile />}
            color="blue"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="MOLlar Zimmasidagi Balans"
            value={`${formatMln(totalAssignedValue)} mln`}
            subtext={formatMoney(totalAssignedValue)}
            icon={<IconHistory />}
            color="red"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Byudjet Mablag‘i"
            value={`${formatMln(byudjetAmount)} mln`}
            subtext={formatMoney(byudjetAmount)}
            icon={<IconCheckCircle />}
            color="green"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatHeroCard
            title="Biriktirilgan Asosiy Vositalar"
            value={`${totalFixedAssets} ta`}
            subtext={`Jami ${totalMols} nafar javobgarda`}
            icon={<IconExclamationCircle />}
            color="purple"
          />
        </Col>
      </Row>

      {/* Main Tabs (Standard type="line" matching other UWMS pages) */}
      <Tabs activeTab={activeTab} onChange={setActiveTab} type="line">
        {/* ========================================================================= */}
        {/* TAB 1: 1. KIRIM IZI (OS-1 REESTRI) */}
        {/* ========================================================================= */}
        <TabPane key="receipts" title="1. Kirim Izi: OS-1 Reestri">
          {/* Filters Card */}
          <Card style={{ borderRadius: 0, marginBottom: 12 }}>
            <Row gutter={[16, 16]} align="center">
              <Col xs={24} sm={12} md={6}>
                <DatePicker.MonthPicker
                  style={{ width: '100%' }}
                  value={receiptsPeriod}
                  onChange={(dateStr) => setReceiptsPeriod(dateStr)}
                  placeholder="Hisobot Davri (Oy)"
                />
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Select
                  style={{ width: '100%' }}
                  value={receiptsSource}
                  onChange={(val) => setReceiptsSource(val)}
                  placeholder="Manba"
                >
                  <Select.Option value="ALL">Barcha Manbalar</Select.Option>
                  <Select.Option value="BYUDJET">Davlat Byudjeti</Select.Option>
                  <Select.Option value="KONTRAKT_RIVOJLANTIRISH">Kontrakt Jamg‘armasi</Select.Option>
                  <Select.Option value="GRANT">Ilmiy Grantlar</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Select
                  style={{ width: '100%' }}
                  value={receiptsSubAccount}
                  onChange={(val) => setReceiptsSubAccount(val)}
                  placeholder="Sub-hisob"
                >
                  <Select.Option value="ALL">Barcha Sub-hisoblar</Select.Option>
                  <Select.Option value="013">013 — Mashina va Uskunalar (Kompyuter, Texnika)</Select.Option>
                  <Select.Option value="015">015 — Transport Vositalari</Select.Option>
                  <Select.Option value="016">016 — Boshqa Asosiy Vositalar (Mebel, Jihozlar)</Select.Option>
                  <Select.Option value="071">071 — O‘rnatiladigan Uskunalar va Zaxiralar</Select.Option>
                  <Select.Option value="010">010 — Bino va Inshootlar</Select.Option>
                  <Select.Option value="060">060 — Materiallar va Sarf Tovarlari</Select.Option>
                  <Select.Option value="212">212 — Boshqa Xo‘jalik Inventarlari</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Input.Search
                  placeholder="Talabnoma / Kafedra qidiruvi"
                  value={receiptsSearch}
                  onChange={(val) => setReceiptsSearch(val)}
                  searchButton
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={2}>
                <Button
                  icon={<IconRefresh />}
                  onClick={() => refetchReceipts()}
                  style={{ width: '100%' }}
                >
                  Yangilash
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Sub-Accounts Standard Ribbon (013, 015, 016, 071) */}
          <Card
            style={{ borderRadius: 0, marginBottom: 12 }}
            bodyStyle={{ padding: '10px 16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text bold style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                Davlat Moliya Standarti Sub-hisoblari:
              </Text>
              <Space wrap size="small">
                <Tag
                  color={receiptsSubAccount === '013' ? 'arcoblue' : 'gray'}
                  style={{ cursor: 'pointer', borderRadius: 0, fontWeight: receiptsSubAccount === '013' ? 600 : 400 }}
                  onClick={() => setReceiptsSubAccount(receiptsSubAccount === '013' ? 'ALL' : '013')}
                >
                  <b>013</b> (Mashina/Texnika): {formatMoney(receiptsData?.summary?.bySubAccount?.['013']?.amount || 0)} ({receiptsData?.summary?.bySubAccount?.['013']?.count || 0} ta)
                </Tag>
                <Tag
                  color={receiptsSubAccount === '015' ? 'blue' : 'gray'}
                  style={{ cursor: 'pointer', borderRadius: 0, fontWeight: receiptsSubAccount === '015' ? 600 : 400 }}
                  onClick={() => setReceiptsSubAccount(receiptsSubAccount === '015' ? 'ALL' : '015')}
                >
                  <b>015</b> (Transport): {formatMoney(receiptsData?.summary?.bySubAccount?.['015']?.amount || 0)} ({receiptsData?.summary?.bySubAccount?.['015']?.count || 0} ta)
                </Tag>
                <Tag
                  color={receiptsSubAccount === '016' ? 'purple' : 'gray'}
                  style={{ cursor: 'pointer', borderRadius: 0, fontWeight: receiptsSubAccount === '016' ? 600 : 400 }}
                  onClick={() => setReceiptsSubAccount(receiptsSubAccount === '016' ? 'ALL' : '016')}
                >
                  <b>016</b> (Mebel/Jihoz): {formatMoney(receiptsData?.summary?.bySubAccount?.['016']?.amount || 0)} ({receiptsData?.summary?.bySubAccount?.['016']?.count || 0} ta)
                </Tag>
                <Tag
                  color={receiptsSubAccount === '071' ? 'cyan' : 'gray'}
                  style={{ cursor: 'pointer', borderRadius: 0, fontWeight: receiptsSubAccount === '071' ? 600 : 400 }}
                  onClick={() => setReceiptsSubAccount(receiptsSubAccount === '071' ? 'ALL' : '071')}
                >
                  <b>071</b> (Uskuna/Material): {formatMoney(receiptsData?.summary?.bySubAccount?.['071']?.amount || 0)} ({receiptsData?.summary?.bySubAccount?.['071']?.count || 0} ta)
                </Tag>
                {receiptsSubAccount !== 'ALL' && (
                  <Button size="mini" type="text" onClick={() => setReceiptsSubAccount('ALL')}>
                    Barchasi
                  </Button>
                )}
              </Space>
            </div>
          </Card>

          {/* Direct Table without wrapping card background */}
          {isReceiptsError ? (
            <Alert
              type="error"
              title="Xatolik"
              content="Kirim ma'lumotlarini yuklashda xatolik yuz berdi"
              style={{ marginBottom: 12 }}
            />
          ) : (
            <Table
              rowKey="id"
              loading={isReceiptsLoading}
              columns={receiptsColumns}
              data={receiptsData?.data || []}
              scroll={{ x: 1200 }}
              style={{ borderRadius: 0, width: '100%' }}
              pagination={{
                current: receiptsPage,
                pageSize: receiptsLimit,
                total: receiptsData?.total || 0,
                sizeCanChange: true,
                sizeOptions: [10, 15, 20, 50, 100],
                showTotal: (total: number, range?: [number, number]) => {
                  if (!total) return '0/0';
                  const to = range ? Math.min(range[1], total) : total;
                  return `${to}/${total}`;
                },
                onChange: (page, pageSize) => {
                  setReceiptsPage(page);
                  setReceiptsLimit(pageSize);
                },
              }}
            />
          )}
        </TabPane>

        {/* ========================================================================= */}
        {/* TAB 2: 2. CHIQIM & MOL BALANSI (OS-2 REESTRI) */}
        {/* ========================================================================= */}
        <TabPane key="handover" title="2. Chiqim & MOL Balansi: OS-2 Reestri">
          {/* Filters Card */}
          <Card style={{ borderRadius: 0, marginBottom: 12 }}>
            <Row gutter={[16, 16]} align="center">
              <Col xs={24} sm={12} md={10}>
                <Input.Search
                  placeholder="MOL ismi, familiyasi yoki username bo‘yicha qidiruv"
                  value={handoverSearch}
                  onChange={(val) => setHandoverSearch(val)}
                  searchButton
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={10}>
                <Select
                  style={{ width: '100%' }}
                  value={handoverDeptId}
                  onChange={(val) => setHandoverDeptId(val)}
                  placeholder="Kafedra bo‘yicha saralash"
                >
                  <Select.Option value="ALL">Barcha Kafedralar</Select.Option>
                  {allDepartments?.map((dept) => (
                    <Select.Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={4}>
                <Button
                  icon={<IconRefresh />}
                  onClick={() => refetchHandover()}
                  style={{ width: '100%' }}
                >
                  Yangilash
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Direct Table without wrapping card background */}
          {isHandoverError ? (
            <Alert
              type="error"
              title="Xatolik"
              content="MOL balansi ma'lumotlarini yuklashda xatolik yuz berdi"
              style={{ marginBottom: 12 }}
            />
          ) : (
            <Table
              rowKey="molId"
              loading={isHandoverLoading}
              columns={handoverColumns}
              data={handoverData?.data || []}
              scroll={{ x: 1200 }}
              style={{ borderRadius: 0, width: '100%' }}
              pagination={{
                current: handoverPage,
                pageSize: handoverLimit,
                total: handoverData?.total || 0,
                sizeCanChange: true,
                sizeOptions: [10, 15, 20, 50, 100],
                showTotal: (total: number, range?: [number, number]) => {
                  if (!total) return '0/0';
                  const to = range ? Math.min(range[1], total) : total;
                  return `${to}/${total}`;
                },
                onChange: (page, pageSize) => {
                  setHandoverPage(page);
                  setHandoverLimit(pageSize);
                },
              }}
            />
          )}
        </TabPane>

        {/* ========================================================================= */}
        {/* TAB 3: 3. BITTA TUGMALI DAVLAT EKSPORT MARKAZI */}
        {/* ========================================================================= */}
        <TabPane key="exports" title="3. Bitta Tugmali Davlat Eksport Markazi">
          {/* Export Filter Settings */}
          <Card
            title="Eksport Parametrlari (Davlat Standartlari va Buxgalteriya Formatlari)"
            style={{ borderRadius: 0, marginBottom: 16 }}
          >
            <Row gutter={[16, 16]} align="center">
              <Col xs={24} sm={12} md={8}>
                <DatePicker.MonthPicker
                  style={{ width: '100%' }}
                  value={exportPeriod}
                  onChange={(dateStr) => setExportPeriod(dateStr)}
                  placeholder="Hisobot Davri (Oy/Yil)"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Select
                  style={{ width: '100%' }}
                  value={exportSource}
                  onChange={(val) => setExportSource(val)}
                  placeholder="Moliyalashtirish Manbasi"
                >
                  <Select.Option value="ALL">Barcha Manbalar (Yalpi)</Select.Option>
                  <Select.Option value="BYUDJET">Davlat Byudjeti</Select.Option>
                  <Select.Option value="KONTRAKT_RIVOJLANTIRISH">Kontrakt Jamg‘armasi</Select.Option>
                  <Select.Option value="GRANT">Ilmiy Grantlar</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Tag color="arcoblue" style={{ padding: '6px 12px', fontSize: 13 }}>
                  Davr: {exportPeriod || 'Joriy oy'} | Manba: {exportSource}
                </Tag>
              </Col>
            </Row>
          </Card>

          {/* 4 State Export Cards (Moliya Vazirligi, Statistika, UzASBO, 1C) */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {/* Card 1: 3-Sheet Excel */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}
                title={
                  <Space>
                    <IconFile style={{ color: '#00b42a', fontSize: 18 }} />
                    <Text bold>3-Varaqli Excel (.xlsx)</Text>
                  </Space>
                }
              >
                <Paragraph type="secondary" style={{ minHeight: 90 }}>
                  Universitetning barcha kirim (OS-1), chiqim (OS-2) va moddiy javobgarlar aylanma balansini WORM HMAC xeshi bilan jamlagan to‘liq reestr.
                </Paragraph>
                <Button
                  type="primary"
                  long
                  icon={<IconDownload />}
                  loading={exportMutation.isPending}
                  onClick={() => handleExport('EXCEL_3SHEET')}
                >
                  Excel Yuklab Olish (.xlsx)
                </Button>
              </Card>
            </Col>

            {/* Card 2: UzASBO XML */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}
                title={
                  <Space>
                    <IconSafe style={{ color: '#ff7d00', fontSize: 18 }} />
                    <Text bold>UzASBO G‘aznachilik XML</Text>
                  </Space>
                }
              >
                <Paragraph type="secondary" style={{ minHeight: 90 }}>
                  Iqtisodiyot va Moliya Vazirligining <b>UzASBO 2.0</b> g‘aznachilik dasturiga to‘g‘ridan-to‘g‘ri import qilinadigan davlat standartidagi XML paketi.
                </Paragraph>
                <Button
                  type="outline"
                  status="warning"
                  long
                  icon={<IconDownload />}
                  loading={exportMutation.isPending}
                  onClick={() => handleExport('UZASBO_XML')}
                >
                  UzASBO XML (.xml)
                </Button>
              </Card>
            </Col>

            {/* Card 3: 1C:Enterprise XML */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}
                title={
                  <Space>
                    <IconFile style={{ color: '#165dff', fontSize: 18 }} />
                    <Text bold>1C:Korxona 8.3 OTM XML</Text>
                  </Space>
                }
              >
                <Paragraph type="secondary" style={{ minHeight: 90 }}>
                  1C:Korxona 8.3 OTM buxgalteriya tizimi uchun <b>CommerceML 1.8</b> standartidagi Asosiy vositalar va TMB harakati XML ma’lumoti.
                </Paragraph>
                <Button
                  type="outline"
                  status="success"
                  long
                  icon={<IconDownload />}
                  loading={exportMutation.isPending}
                  onClick={() => handleExport('1C_ENTERPRISE_XML')}
                >
                  1C OTM XML (.xml)
                </Button>
              </Card>
            </Col>

            {/* Card 4: Davlat Statistika Shakli */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}
                title={
                  <Space>
                    <IconCheckCircle style={{ color: '#722ed1', fontSize: 18 }} />
                    <Text bold>Davlat Statistika (1-AV)</Text>
                  </Space>
                }
              >
                <Paragraph type="secondary" style={{ minHeight: 90 }}>
                  Davlat statistika qo‘mitasining <b>1-Asosiy vositalar</b> davlat statistika hisoboti va sub-hisoblar kesimidagi taqsimot shakli.
                </Paragraph>
                <Button
                  type="outline"
                  long
                  icon={<IconDownload />}
                  loading={exportMutation.isPending}
                  onClick={() => handleExport('EXCEL_3SHEET')}
                >
                  1-AV Shakli (.xlsx)
                </Button>
              </Card>
            </Col>
          </Row>

          {/* Audit Notice */}
          <Alert
            type="info"
            title="Davlat Axborot Xavfsizligi va Audit Qoidasi"
            content="Har bir eksport qilingan hisobot Bosh hisobchi imzosi va foydalanuvchi ma'lumotlari bilan birgalikda Tizim Audit Jurnalida (SystemAuditLog) qayd etiladi."
          />
        </TabPane>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: MOL ASSET DRILL-DOWN MODAL */}
      {/* ========================================================================= */}
      <Modal
        title={
          <Space>
            <IconUser style={{ color: '#165dff' }} />
            <Text bold>
              {molDetailsData?.mol.fullName || 'MOL'} — Biriktirilgan Ashyolar Reestri
            </Text>
          </Space>
        }
        visible={molModalVisible}
        onCancel={() => setMolModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setMolModalVisible(false)}>
            Yopish
          </Button>
        }
        style={{ width: '80%', maxWidth: 1000 }}
      >
        {molDetailsData?.mol && (
          <Descriptions
            size="small"
            colon=" :"
            style={{ marginBottom: 16 }}
            data={[
              { label: 'Kafedra', value: molDetailsData.mol.department },
              { label: 'Aktivlar Soni', value: `${molDetailsData.totalAssetsCount} ta` },
              { label: 'Jami Qiymati', value: formatMoney(molDetailsData.totalValue) },
            ]}
          />
        )}

        <Table
          rowKey="id"
          loading={isMolDetailsLoading}
          data={molDetailsData?.items || []}
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: 'Inventar №',
              dataIndex: 'inventoryNumber',
              width: 140,
              render: (val: string) => <Tag color="blue">{val}</Tag>,
            },
            {
              title: 'Jihoz Nomi',
              dataIndex: 'name',
              render: (val: string, r: any) => (
                <Space direction="vertical" size={2}>
                  <Text bold>{val}</Text>
                  {r.serialNumber && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      S/N: {r.serialNumber}
                    </Text>
                  )}
                </Space>
              ),
            },
            {
              title: 'Kategoriya',
              dataIndex: 'category',
              width: 130,
            },
            {
              title: 'Xona',
              width: 140,
              render: (_: any, r: any) => `${r.roomNumber} - ${r.roomName}`,
            },
            {
              title: 'Sub-hisob',
              dataIndex: 'subAccountCode',
              width: 100,
              render: (val: string) => <Tag color="cyan">{val}</Tag>,
            },
            {
              title: 'Boshlang‘ich Qiymati',
              dataIndex: 'purchasePrice',
              width: 150,
              render: (val: number) => <Text bold>{formatMoney(val)}</Text>,
            },
            {
              title: 'Holati',
              dataIndex: 'status',
              width: 110,
              render: (val: string) => (
                <Tag color={val === 'ACTIVE' ? 'green' : 'gray'}>{val}</Tag>
              ),
            },
          ]}
        />
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: OS-1 / OS-2 RASMIY DALOLATNOMA MODAL */}
      {/* ========================================================================= */}
      {activeDocData && (
        <OfficialDocModal
          visible={docModalVisible}
          onClose={() => setDocModalVisible(false)}
          docType={activeDocData.docType}
          docNumber={activeDocData.docNumber}
          date={activeDocData.date}
          sourceLocation={activeDocData.sourceLocation}
          targetLocation={activeDocData.targetLocation}
          senderName={activeDocData.senderName}
          receiverName={activeDocData.receiverName}
          items={activeDocData.items}
        />
      )}
    </div>
  );
};

export default ChiefAccountantLedgerPage;
