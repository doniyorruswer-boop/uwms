import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Card,
  Grid,
  Select,
  Button,
  Input,
  Space,
  Tag,
  Alert,
  Table,
  Message,
  Popconfirm,
  Switch,
  Typography,
  Empty,
} from '@arco-design/web-react';
import {
  IconScan,
  IconCheckCircle,
  IconCloseCircle,
  IconExclamationCircle,
  IconDownload,
  IconRefresh,
  IconSound,
  IconCamera,
  IconStop,
  IconFile,
} from '@arco-design/web-react/icon';
import { Html5Qrcode } from 'html5-qrcode';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useAuditsQuery } from '../../hooks/useAuditsQuery';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import type { ItemInstance } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { playScannerBeep } from '../../utils/audio';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { StockLevelGauge } from '../../components/Common/StockLevelGauge';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

export const AuditScannerPage: React.FC = () => {
  const { assets } = useAssetsQuery();
  const { rooms } = useOrganizationQuery();
  const { scanCode, completeAudit, isCompleting, audits } = useAuditsQuery();

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const activeRoom = selectedRoomId || (rooms.length > 0 ? rooms[0].id : '');
  const currentRoom = rooms.find((r) => r.id === activeRoom);

  // Expected assets in this room
  const expectedAssets = useMemo(() => {
    return assets.filter((a) => a.roomId === activeRoom);
  }, [assets, activeRoom]);

  // Audit calculations
  const matchedAssets = useMemo(() => {
    return expectedAssets.filter((a) => scannedCodes.includes(a.qrCode));
  }, [expectedAssets, scannedCodes]);

  const missingAssets = useMemo(() => {
    return expectedAssets.filter((a) => !scannedCodes.includes(a.qrCode));
  }, [expectedAssets, scannedCodes]);

  const unexpectedAssets = useMemo(() => {
    return assets.filter(
      (a) => a.roomId !== activeRoom && scannedCodes.includes(a.qrCode)
    );
  }, [assets, activeRoom, scannedCodes]);

  const completionPercent = expectedAssets.length > 0
    ? Math.round((matchedAssets.length / expectedAssets.length) * 100)
    : 0;

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      const html5QrCode = new Html5Qrcode('audit-qr-reader');
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {}
      );
      setIsCameraRunning(true);
      Message.success('Kamera muvaffaqiyatli ishga tushirildi');
    } catch (err: any) {
      console.error('Camera start error:', err);
      Message.error('Kamerani ochib bo‘lmadi. Brauzer ruxsatini tekshiring.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      setIsCameraRunning(false);
      Message.info('Kamera to‘xtatildi');
    }
  };

  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    if (scannedCodes.includes(trimmed)) {
      Message.warning('Ushbu QR kod avvalroq o‘qilgan!');
      return;
    }

    try {
      if (soundEnabled) {
        playScannerBeep();
      }

      setScannedCodes((prev) => [...prev, trimmed]);

      // Verify asset in room
      const foundInRoom = expectedAssets.find((a) => a.qrCode === trimmed);
      const foundElsewhere = assets.find((a) => a.qrCode === trimmed);

      if (foundInRoom) {
        Message.success(`Topildi: ${foundInRoom.itemName} (${foundInRoom.inventoryNumber})`);
      } else if (foundElsewhere) {
        Message.warning(`Diqqat! Ushbu uskuna boshqa xonaga tegishli: ${foundElsewhere.itemName}`);
      } else {
        Message.info(`Noma’lum kod: ${trimmed}`);
      }

      try {
        const scanRes = await scanCode({ qrCode: trimmed, roomId: activeRoom });
        if (scanRes && scanRes.auditId) {
          setActiveAuditId(scanRes.auditId);
        }
      } catch {
        // Continue scanning even if audit log request fails
      }
      setManualCode('');
    } catch (err: any) {
      Message.error(err.response?.data?.message || 'Skanerlashda xatolik yuz berdi!');
    }
  };

  const handleCompleteAudit = async () => {
    if (!activeAuditId) {
      Message.warning('Hali birorta ham uskuna skanerlanmadi yoki faol audit sessiyasi topilmadi!');
      return;
    }
    try {
      await completeAudit({
        auditId: activeAuditId,
        notes: `${currentRoom?.name || 'Xona'} inventarizatsiyasi yakunlandi. Kamomadlar qayd etildi.`,
      });
      setIsCompleted(true);
      setIsDocModalVisible(true);
    } catch {
      // Handled by onError in useAuditsQuery
    }
  };

  const handleResetAudit = () => {
    setScannedCodes([]);
    setActiveAuditId(null);
    setIsCompleted(false);
    Message.info('Inventarizatsiya qayta boshlandi.');
  };

  const handleExportAuditExcel = () => {
    const reportData = [
      ...matchedAssets.map((a) => ({
        'Inventar №': a.inventoryNumber,
        'Nomi': a.itemName,
        'Model': a.itemModel || '',
        'Kutilgan Xona': currentRoom?.name || '',
        'Audit Natijasi': 'TOPILDI (Mavjud)',
        'Mas’ul Shaxs': a.responsibleUserName || '',
      })),
      ...missingAssets.map((a) => ({
        'Inventar №': a.inventoryNumber,
        'Nomi': a.itemName,
        'Model': a.itemModel || '',
        'Kutilgan Xona': currentRoom?.name || '',
        'Audit Natijasi': 'KAMOMAD (Topilmadi)',
        'Mas’ul Shaxs': a.responsibleUserName || '',
      })),
      ...unexpectedAssets.map((a) => ({
        'Inventar №': a.inventoryNumber,
        'Nomi': a.itemName,
        'Model': a.itemModel || '',
        'Kutilgan Xona': a.roomName || 'Boshqa xona',
        'Audit Natijasi': 'BEGONA XONADAN TOPILDI',
        'Mas’ul Shaxs': a.responsibleUserName || '',
      })),
    ];

    exportToExcel(
      reportData,
      `Audit_${currentRoom?.number || 'xona'}_Dalolatnomasi`,
      'Inventarizatsiya Dalolatnomasi'
    );
    Message.success('Audit dalolatnomasi Excel faylga yuklandi!');
  };

  const auditDocItems = [
    ...matchedAssets.map((a) => ({
      inventoryNumber: a.inventoryNumber,
      name: a.itemName,
      model: `${a.itemModel || ''} [TOPILDI - MAVJUD]`,
      serialNumber: a.serialNumber || '—',
      price: a.purchasePrice,
      quantity: 1,
      unit: 'dona',
    })),
    ...missingAssets.map((a) => ({
      inventoryNumber: a.inventoryNumber,
      name: a.itemName,
      model: `${a.itemModel || ''} [KAMOMAD / TOPILMADI]`,
      serialNumber: a.serialNumber || '—',
      price: a.purchasePrice,
      quantity: 1,
      unit: 'dona',
    })),
    ...unexpectedAssets.map((a) => ({
      inventoryNumber: a.inventoryNumber,
      name: a.itemName,
      model: `${a.itemModel || ''} [BEGONA XONADAN: ${a.roomName || 'Boshqa joy'}]`,
      serialNumber: a.serialNumber || '—',
      price: a.purchasePrice,
      quantity: 1,
      unit: 'dona',
    })),
  ];

  // Table items based on tab
  const getTableData = () => {
    if (activeTab === 'MATCHED') return matchedAssets;
    if (activeTab === 'MISSING') return missingAssets;
    if (activeTab === 'UNEXPECTED') return unexpectedAssets;
    return [...expectedAssets, ...unexpectedAssets];
  };

  const totalAuditExpected = expectedAssets.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Room Selection and Options Header */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '16px 20px' }}>
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
              {currentRoom ? `${currentRoom.number}-xona: ${currentRoom.name}` : 'Mobil QR Audit va Inventarizatsiya'}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Moddiy javobgar: <b>{currentRoom?.responsibleUserName || 'Belgilanmagan'}</b> | Bino: {currentRoom?.building || 'Bosh bino'}
            </Text>
          </div>

          <Space size="medium" wrap>
            <Space size="small">
              <IconSound style={{ color: soundEnabled ? '#165DFF' : '#86909C' }} />
              <span style={{ fontSize: 13 }}>Skaner ovozi:</span>
              <Switch checked={soundEnabled} onChange={setSoundEnabled} size="small" />
            </Space>

            <span style={{ fontWeight: 600, fontSize: 13 }}>Xonani tanlash:</span>
            <Select
              value={selectedRoomId}
              onChange={(val) => {
                setSelectedRoomId(val);
                setScannedCodes([]);
              }}
              style={{ width: 260, borderRadius: 0 }}
            >
              {rooms.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.number}-xona: {r.name}
                </Select.Option>
              ))}
            </Select>

            <Popconfirm
              title="Ushbu xona auditini qayta boshlaysizmi?"
              onOk={handleResetAudit}
              okText="Ha"
              cancelText="Yo‘q"
            >
              <Button icon={<IconRefresh />} style={{ borderRadius: 0 }}>
                Qayta Boshlash
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      {/* Main Scanner and Discrepancy Table Section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0 }}
            title={
              <Space>
                <IconScan style={{ color: '#165DFF' }} />
                <span>QR Skanerlash Moduli</span>
              </Space>
            }
          >
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div
                style={{
                  width: '100%',
                  minHeight: isCameraRunning ? 240 : 160,
                  border: isCameraRunning ? '2px solid #165DFF' : '2px dashed #C9CDD4',
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isCameraRunning ? '#000' : 'var(--color-fill-1)',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <div
                  id="audit-qr-reader"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: isCameraRunning ? 'block' : 'none',
                  }}
                />
                {!isCameraRunning && (
                  <div style={{ color: 'var(--color-text-3)', padding: 16 }}>
                    <IconCamera style={{ fontSize: 36, marginBottom: 8, color: '#86909C' }} />
                    <div style={{ fontSize: 13 }}>Kamera hozirda o‘chiq</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Jonli skanerlash uchun kamerani yoqing yoki qo‘lda kod kiriting
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                {!isCameraRunning ? (
                  <Button
                    type="primary"
                    icon={<IconCamera />}
                    onClick={startCamera}
                    style={{ borderRadius: 0, backgroundColor: '#165DFF', width: '100%' }}
                  >
                    Kamerani Yoqish
                  </Button>
                ) : (
                  <Button
                    status="danger"
                    icon={<IconStop />}
                    onClick={stopCamera}
                    style={{ borderRadius: 0, width: '100%' }}
                  >
                    Kamerani To‘xtatish
                  </Button>
                )}
              </div>

              {/* Input for manual scanner / barcode guns */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Input
                  placeholder="QR kod yoki inventar №..."
                  value={manualCode}
                  onChange={setManualCode}
                  onPressEnter={() => handleScan(manualCode)}
                  style={{ borderRadius: 0 }}
                />
                <Button
                  type="primary"
                  onClick={() => handleScan(manualCode)}
                  style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
                >
                  O‘qish
                </Button>
              </div>

              {/* Quick simulation chips */}
              <div style={{ textAlign: 'left', marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 8 }}>
                  Tezkor test simulyatsiyasi:
                </div>
                <Space wrap size="mini">
                  {expectedAssets.map((a) => (
                    <Button
                      key={a.id}
                      size="mini"
                      type={scannedCodes.includes(a.qrCode) ? 'primary' : 'outline'}
                      status={scannedCodes.includes(a.qrCode) ? 'success' : 'default'}
                      onClick={() => handleScan(a.qrCode)}
                      style={{ borderRadius: 0 }}
                    >
                      {a.inventoryNumber}
                    </Button>
                  ))}
                  {assets.find((a) => a.roomId !== selectedRoomId) && (
                    <Button
                      size="mini"
                      status="warning"
                      style={{ borderRadius: 0 }}
                      onClick={() => {
                        const foreign = assets.find((a) => a.roomId !== selectedRoomId);
                        if (foreign) handleScan(foreign.qrCode);
                      }}
                    >
                      Begona Uskuna (Test)
                    </Button>
                  )}
                </Space>
              </div>
            </div>
          </Card>
        </Col>

        {/* Audit Results & Discrepancy Table */}
        <Col xs={24} md={16}>
          <Card
            className="uwms-card"
            style={{ borderRadius: 0 }}
            title={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span>
                  Audit Jarayoni (Mas’ul: <b>{currentRoom?.responsibleUserName || 'MOL'}</b>)
                </span>
                <Space size="small">
                  <Button
                    type="outline"
                    size="small"
                    icon={<IconDownload />}
                    onClick={handleExportAuditExcel}
                    style={{ borderRadius: 0 }}
                  >
                    Excelga
                  </Button>
                  <Popconfirm
                    title="Auditni yakunlash va Kamomadlarni (MISSING) qayd etish"
                    content="Haqiqatan ham ushbu xona inventarizatsiyasini yakunlamoqchimisiz? Topilmagan barcha ashyolar bazada kamomad sifatida saqlanadi."
                    okText="Ha, yakunlash"
                    cancelText="Bekor qilish"
                    onOk={handleCompleteAudit}
                    disabled={!activeAuditId || isCompleted}
                  >
                    <Button
                      type="primary"
                      status="warning"
                      size="small"
                      icon={<IconCheckCircle />}
                      loading={isCompleting}
                      disabled={!activeAuditId || isCompleted}
                      style={{ borderRadius: 0 }}
                    >
                      {isCompleted ? 'Audit Yakunlangan' : 'Auditni Yakunlash (DB)'}
                    </Button>
                  </Popconfirm>
                  <Button
                    type="primary"
                    status="success"
                    size="small"
                    icon={<IconFile />}
                    onClick={() => setIsDocModalVisible(true)}
                    disabled={scannedCodes.length === 0}
                    style={{ borderRadius: 0 }}
                  >
                    INV-19 Dalolatnomasi
                  </Button>
                </Space>
              </div>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <StockLevelGauge
                percent={completionPercent}
                label={<span>Inventarizatsiya mosligi:</span>}
                subLabel={
                  <b>
                    {matchedAssets.length} / {expectedAssets.length} ta vosita tasdiqlandi ({completionPercent}%)
                  </b>
                }
                status={completionPercent === 100 ? 'success' : 'normal'}
                color={completionPercent === 100 ? '#00B42A' : '#165DFF'}
                strokeWidth={8}
                width="100%"
              />
            </div>

            {/* Foreign assets alert */}
            {unexpectedAssets.length > 0 && (
              <Alert
                type="warning"
                icon={<IconExclamationCircle />}
                title="Boshqa xonaga tegishli uskunalar aniqlandi!"
                content={
                  <div>
                    Quyidagi vositalar bu xonaga biriktirilmagan bo‘lsa-da, shu xonadan topildi:{' '}
                    <b>
                      {unexpectedAssets.map((a) => `${a.itemName} (${a.inventoryNumber})`).join(', ')}
                    </b>
                  </div>
                }
                style={{ marginBottom: 16, borderRadius: 0 }}
              />
            )}

            {/* Reusable PageTabs Filter */}
            <PageTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  key: 'ALL',
                  title: 'Barcha Uskunalar',
                  count: expectedAssets.length + unexpectedAssets.length,
                },
                {
                  key: 'MATCHED',
                  title: 'Topildi (Mavjud)',
                  count: matchedAssets.length,
                },
                {
                  key: 'MISSING',
                  title: 'Kamomad / Topilmadi',
                  count: missingAssets.length,
                },
                ...(unexpectedAssets.length > 0
                  ? [
                      {
                        key: 'UNEXPECTED',
                        title: 'Begona Xonadan',
                        count: unexpectedAssets.length,
                      },
                    ]
                  : []),
              ]}
            />

            <Table
              rowKey="id"
              scroll={{ x: 750 }}
              pagination={{
                pageSize: 10,
                sizeCanChange: true,
                sizeOptions: [10, 20, 50, 100],
                showTotal: (total, range) => {
                  if (!total || total === 0) return '0/0';
                  const to = range ? Math.min(range[1], total) : total;
                  return `${to}/${total}`;
                },
              }}
              size="small"
              data={getTableData()}
              style={{ borderRadius: 0, marginTop: 12 }}
              noDataElement={
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Empty description="Ushbu toifadagi uskunalar mavjud emas" />
                </div>
              }
              columns={[
                {
                  title: 'Audit Natijasi',
                  width: 170,
                  render: (_, record: ItemInstance) => {
                    const isForeign = record.roomId !== activeRoom;
                    const isScanned = scannedCodes.includes(record.qrCode);

                    if (isForeign && isScanned) {
                      return (
                        <Tag
                          color="gold"
                          icon={<IconExclamationCircle />}
                          style={{ borderRadius: 0, fontWeight: 500 }}
                        >
                          Begona Xonadan
                        </Tag>
                      );
                    }
                    if (isScanned) {
                      return (
                        <Tag
                          color="green"
                          icon={<IconCheckCircle />}
                          style={{ borderRadius: 0, fontWeight: 500 }}
                        >
                          Mavjud (Topildi)
                        </Tag>
                      );
                    }
                    return (
                      <Tag
                        color="red"
                        icon={<IconCloseCircle />}
                        style={{ borderRadius: 0, fontWeight: 500 }}
                      >
                        Kutilmoqda (Kamomad)
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Asosiy Vosita',
                  render: (_, record: ItemInstance) => (
                    <CategoryThumbnail
                      icon={<IconScan />}
                      name={record.itemName}
                      subtitle={`Inv: ${record.inventoryNumber}${record.itemModel ? ` | ${record.itemModel}` : ''}`}
                      tag={record.serialNumber ? `SN: ${record.serialNumber}` : undefined}
                      color="#165DFF"
                      bg="#E8F3FF"
                    />
                  ),
                },
                {
                  title: 'Kutilgan Xona',
                  dataIndex: 'roomName',
                  width: 140,
                  render: (val: string) => val || currentRoom?.name || '—',
                },
                {
                  title: 'Mas’ul Shaxs',
                  dataIndex: 'responsibleUserName',
                  width: 160,
                  render: (val: string) => val || '—',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Official State Standard INV-19 Document Modal */}
      <OfficialDocModal
        visible={isDocModalVisible}
        onClose={() => setIsDocModalVisible(false)}
        docType="AUDIT"
        docNumber={`INV-19-${currentRoom?.number || '01'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`}
        date={new Date().toLocaleDateString('uz-UZ')}
        sourceLocation={`${currentRoom?.number}-xona: ${currentRoom?.name}`}
        senderName={currentRoom?.responsibleUserName || 'Kafedra Mas’uli (MOL)'}
        receiverName="Ichki Audit va Inventarizatsiya Komissiyasi"
        reason={`Davriy auditorlik tekshiruvi va solishtirma dalolatnomasi. Jami ${expectedAssets.length} ta kutilgan vositadan ${matchedAssets.length} tasi mavjud, ${missingAssets.length} tasi kamomad, ${unexpectedAssets.length} tasi begona uskunalar deb topildi.`}
        items={auditDocItems}
      />
    </div>
  );
};
