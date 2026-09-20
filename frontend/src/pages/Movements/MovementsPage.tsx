import React, { useState, useMemo } from 'react';
import {
  Card,
  Tag,
  Input,
  Select,
  Space,
  Button,
  Message,
  Alert,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconSearch,
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconSwap,
  IconImport,
  IconDelete,
  IconArchive,
  IconFilter,
  IconCheckCircle,
  IconClockCircle,
} from '@arco-design/web-react/icon';
import { useMovementsQuery } from '../../hooks/useWarehouseQuery';
import type { StockMovement, MovementType } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';
import { StandardTable } from '../../components/Common/StandardTable';

export const MovementsPage: React.FC = () => {
  const [fundingSourceFilter, setFundingSourceFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);

  // Backend query with optional fundingSource filter
  const { movements, isLoading, isFetching, isError, refetch } = useMovementsQuery({
    fundingSource: fundingSourceFilter !== 'ALL' ? fundingSourceFilter : undefined,
  });

  // Statistics calculation based on current funding source scope
  const stats = useMemo(() => {
    const total = movements.length;
    const incoming = movements.filter((m) => m.movementType === 'INCOMING').length;
    const transfer = movements.filter((m) => m.movementType === 'TRANSFER').length;
    const writeOff = movements.filter((m) => m.movementType === 'WRITE_OFF' || m.movementType === 'OUTGOING').length;
    return { total, incoming, transfer, writeOff };
  }, [movements]);

  // Client-side Filtering for search text and active tab
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesSearch =
        m.movementNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        m.itemSummary.toLowerCase().includes(searchText.toLowerCase()) ||
        (m.referenceDoc && m.referenceDoc.toLowerCase().includes(searchText.toLowerCase())) ||
        m.executedByName.toLowerCase().includes(searchText.toLowerCase());

      const matchesTab =
        activeTab === 'ALL' ||
        m.movementType === activeTab ||
        (activeTab === 'WRITE_OFF' && (m.movementType === 'WRITE_OFF' || m.movementType === 'OUTGOING'));

      return matchesSearch && matchesTab;
    });
  }, [movements, searchText, activeTab]);

  const handleExportExcel = () => {
    const formatted = filteredMovements.map((m) => ({
      'Harakat Raqami': m.movementNumber,
      'Turi': m.movementType,
      'Mahsulotlar': m.itemSummary,
      'Moliyalashtirish':
        m.fundingSource === 'KONTRAKT_RIVOJLANTIRISH'
          ? 'To‘lov-Kontrakt'
          : m.fundingSource === 'GRANT'
          ? 'Ilmiy Grant'
          : 'Davlat Byudjeti',
      'Qayerdan': m.sourceLocation || '—',
      'Qayerga': m.targetLocation || '—',
      'Asos Hujjati': m.referenceDoc || '—',
      'WORM Holati': m.hasWormStamp || m.stamp?.isValid ? 'WORM Muhrlangan' : 'Muhrlanmagan',
      'Ijrochi': m.executedByName,
      'Sana': m.createdAt,
    }));
    exportToExcel(formatted, 'Ombor_Harakatlari_Auditi', 'Audit Log');
    Message.success('Harakatlar jurnali Excelga muvaffaqiyatli yuklandi!');
  };

  const handleOpenDoc = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setIsDocModalVisible(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ERROR UX STATE (Rule 6.3) */}
      {isError && (
        <Alert
          type="error"
          title="Ombor harakatlari audit jurnalini yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta yuklash
            </Button>
          }
          style={{ borderRadius: 0 }}
        />
      )}

      {/* Tabs */}
      <PageTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'ALL', title: 'Barcha Harakatlar', count: stats.total },
          { key: 'INCOMING', title: 'Kirim Fakturalari', count: stats.incoming },
          { key: 'TRANSFER', title: 'Ichki Siljishlar', count: stats.transfer },
          { key: 'WRITE_OFF', title: 'Chiqim va Spisanie', count: stats.writeOff },
        ]}
      />

      {/* Toolbar */}
      <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space size="medium" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="Hujjat raqami, vosita, ijrochi..."
              style={{ width: 300, borderRadius: 0 }}
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
            <Select
              value={fundingSourceFilter}
              onChange={setFundingSourceFilter}
              style={{ width: 220, borderRadius: 0 }}
              prefix={<IconFilter />}
            >
              <Select.Option value="ALL">Barcha moliyalashtirish</Select.Option>
              <Select.Option value="BYUDJET">Davlat Byudjeti</Select.Option>
              <Select.Option value="KONTRAKT_RIVOJLANTIRISH">To‘lov-Kontrakt</Select.Option>
              <Select.Option value="GRANT">Ilmiy Grant</Select.Option>
            </Select>
          </Space>
          <Space>
            <Button
              icon={<IconRefresh />}
              onClick={() => refetch()}
              style={{ borderRadius: 0 }}
            >
              Yangilash
            </Button>
            <Button
              type="primary"
              icon={<IconDownload />}
              onClick={handleExportExcel}
              style={{ borderRadius: 0 }}
            >
              Excelga Eksport
            </Button>
          </Space>
        </div>
      </Card>

      {/* StandardTable for Stock Movements (Rule 1.1 & 4.2) */}
      <StandardTable<StockMovement>
        rowKey="id"
        loading={isLoading || isFetching}
        data={filteredMovements}
        scrollX={1480}
        emptyText={
          searchText
            ? 'Qidiruv so‘rovi bo‘yicha harakatlar topilmadi'
            : fundingSourceFilter !== 'ALL'
            ? 'Tanlangan moliyalashtirish manbasida harakatlar mavjud emas'
            : 'Ombor harakatlari jurnali bo‘sh'
        }
        columns={[
          {
            title: 'Harakat №',
            dataIndex: 'movementNumber',
            width: 160,
            render: (num: string) => (
              <div style={{ paddingLeft: 8 }}>
                <b style={{ color: '#165DFF', whiteSpace: 'nowrap' }}>{num}</b>
              </div>
            ),
          },
          {
            title: 'Turi',
            dataIndex: 'movementType',
            width: 130,
            render: (type: MovementType) => {
              if (type === 'INCOMING')
                return (
                  <Tag color="green" icon={<IconImport />} style={{ borderRadius: 0 }}>
                    Kirim
                  </Tag>
                );
              if (type === 'TRANSFER')
                return (
                  <Tag color="orange" icon={<IconSwap />} style={{ borderRadius: 0 }}>
                    Ichki Siljish
                  </Tag>
                );
              if (type === 'WRITE_OFF' || type === 'OUTGOING')
                return (
                  <Tag color="red" icon={<IconDelete />} style={{ borderRadius: 0 }}>
                    Spisanie
                  </Tag>
                );
              return <Tag style={{ borderRadius: 0 }}>{type}</Tag>;
            },
          },
          {
            title: 'Harakatdagi Vosita / Mahsulot',
            dataIndex: 'itemSummary',
            minWidth: 220,
            render: (summary: string, record: StockMovement) => (
              <CategoryThumbnail
                icon={<IconArchive />}
                name={summary}
                tag={record.referenceDoc || undefined}
                color="#165DFF"
              />
            ),
          },
          {
            title: 'Moliyalashtirish Manbasi',
            dataIndex: 'fundingSource',
            width: 170,
            render: (source?: string) => {
              if (source === 'KONTRAKT_RIVOJLANTIRISH') {
                return (
                  <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                    To‘lov-Kontrakt
                  </Tag>
                );
              }
              if (source === 'GRANT') {
                return (
                  <Tag color="purple" style={{ borderRadius: 0 }}>
                    Ilmiy Grant
                  </Tag>
                );
              }
              return (
                <Tag color="green" style={{ borderRadius: 0 }}>
                  Davlat Byudjeti
                </Tag>
              );
            },
          },
          {
            title: 'Qayerdan / Qayerga',
            width: 240,
            render: (_, record: StockMovement) => (
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-4)', minWidth: 48, whiteSpace: 'nowrap', marginTop: 1 }}>Chiqish:</span>
                  <span style={{ color: 'var(--color-text-2)', wordBreak: 'break-word' }}>
                    {record.sourceLocation || '—'}
                  </span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: '#165DFF', fontWeight: 600, minWidth: 48, whiteSpace: 'nowrap', marginTop: 1 }}>Kirish:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-1)', wordBreak: 'break-word' }}>
                    {record.targetLocation || '—'}
                  </span>
                </div>
              </div>
            ),
          },
          {
            title: 'WORM Imzo Holati',
            width: 180,
            render: (_, record: StockMovement) => {
              if (record.hasWormStamp || record.stamp?.isValid) {
                const docTypeName =
                  record.stamp?.docType ||
                  (record.movementType === 'INCOMING' ? 'OS-1' : record.movementType === 'WRITE_OFF' ? 'OS-4' : 'OS-2');
                return (
                  <Tooltip
                    content={`WORM Muhrlangan: ${record.stamp?.docNumber || record.referenceDoc || record.movementNumber}. Imzolovchi: ${record.stamp?.signerName || 'Elektron Imzo'}`}
                  >
                    <Tag
                      color="green"
                      icon={<IconCheckCircle />}
                      style={{ borderRadius: 0, fontWeight: 500 }}
                    >
                      WORM Muhrlangan ({docTypeName})
                    </Tag>
                  </Tooltip>
                );
              }
              return (
                <Tooltip content="Ushbu harakat uchun rasmiy WORM raqamli shtampi hali tasdiqlanmagan">
                  <Tag color="gray" icon={<IconClockCircle />} style={{ borderRadius: 0 }}>
                    Muhrlanmagan
                  </Tag>
                </Tooltip>
              );
            },
          },
          {
            title: 'Ijrochi (Mas’ul)',
            dataIndex: 'executedByName',
            width: 140,
            render: (name: string) => <span style={{ whiteSpace: 'nowrap' }}>{name}</span>,
          },
          {
            title: 'Sana va Vaqt',
            dataIndex: 'createdAt',
            width: 115,
            render: (date: string) => {
              const parts = date ? date.split(' ') : [];
              return (
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ color: 'var(--color-text-1)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {parts[0]}
                  </div>
                  <div style={{ color: 'var(--color-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {parts[1] || ''}
                  </div>
                </div>
              );
            },
          },
          {
            title: 'Amallar',
            width: 130,
            fixed: 'right' as const,
            render: (_, record: StockMovement) => (
              <TableActions rightPadding={16}>
                <Button
                  size="small"
                  type="outline"
                  icon={<IconPrinter />}
                  onClick={() => handleOpenDoc(record)}
                  style={{ borderRadius: 0, padding: '0 10px' }}
                >
                  Rasmiy Akt
                </Button>
              </TableActions>
            ),
          },
        ]}
      />

      {/* OFFICIAL DOCUMENT MODAL */}
      {selectedMovement && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          entityId={selectedMovement.stamp?.id || selectedMovement.id}
          docType={
            selectedMovement.movementType === 'INCOMING'
              ? 'KIRIM'
              : selectedMovement.movementType === 'WRITE_OFF'
              ? 'SPISANIE'
              : 'TRANSFER'
          }
          docNumber={selectedMovement.stamp?.docNumber || selectedMovement.referenceDoc || selectedMovement.movementNumber}
          date={selectedMovement.createdAt.substring(0, 10)}
          sourceLocation={selectedMovement.sourceLocation}
          targetLocation={selectedMovement.targetLocation}
          senderName={
            selectedMovement.movementType === 'INCOMING'
              ? selectedMovement.sourceLocation || selectedMovement.executedByName
              : selectedMovement.executedByName
          }
          receiverName={
            selectedMovement.movementType === 'INCOMING'
              ? selectedMovement.executedByName
              : selectedMovement.targetLocation || selectedMovement.executedByName
          }
          supervisorName={
            selectedMovement.stamp?.signerName ||
            (selectedMovement.movementType === 'INCOMING'
              ? "Bosh buxgalter"
              : selectedMovement.movementType === 'WRITE_OFF'
              ? "Moliya va iqtisod bo‘yicha prorektor"
              : "Moddiy hisob buxgalteri")
          }
          reason={selectedMovement.referenceDoc || undefined}
          items={
            selectedMovement.items && selectedMovement.items.length > 0
              ? selectedMovement.items.map((it, idx) => ({
                  inventoryNumber: `${selectedMovement.movementNumber}-${idx + 1}`,
                  name: it.name,
                  quantity: it.quantity,
                  unit: it.unit || 'DONA',
                  price: 0,
                }))
              : [
                  {
                    inventoryNumber: selectedMovement.movementNumber,
                    name: selectedMovement.itemSummary,
                    quantity: 1,
                    unit: 'DONA',
                    price: 0,
                  },
                ]
          }
        />
      )}
    </div>
  );
};

export default MovementsPage;
