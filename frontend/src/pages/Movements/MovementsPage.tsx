import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Input,
  Select,
  Space,
  Button,
  Message,
  Grid,
  Typography,
} from '@arco-design/web-react';
import {
  IconSearch,
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconArrowRight,
  IconSwap,
  IconImport,
  IconExport,
  IconDelete,
  IconArchive,
} from '@arco-design/web-react/icon';
import { useMovementsQuery } from '../../hooks/useWarehouseQuery';
import type { StockMovement, MovementType } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

export const MovementsPage: React.FC = () => {
  const { movements, isLoading, isFetching, refetch } = useMovementsQuery();
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = movements.length;
    const incoming = movements.filter((m) => m.movementType === 'INCOMING').length;
    const transfer = movements.filter((m) => m.movementType === 'TRANSFER').length;
    const writeOff = movements.filter((m) => m.movementType === 'WRITE_OFF' || m.movementType === 'OUTGOING').length;
    return { total, incoming, transfer, writeOff };
  }, [movements]);

  // Filtering
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
      'Qayerdan': m.sourceLocation || '—',
      'Qayerga': m.targetLocation || '—',
      'Asos Hujjati': m.referenceDoc || 'Ichki buyruq',
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
          <Space size="medium">
            <Input
              prefix={<IconSearch />}
              placeholder="Hujjat raqami, vosita, ijrochi..."
              style={{ width: 320, borderRadius: 0 }}
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
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

      {/* Table Card */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isLoading || isFetching}
          data={filteredMovements}
          scroll={{ x: 1080 }}
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
              width: 125,
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
              minWidth: 180,
              render: (summary: string, record: any) => (
                <CategoryThumbnail
                  icon={<IconArchive />}
                  name={summary}
                  tag={record.fundingSource}
                  color="#165DFF"
                />
              ),
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
              title: 'Ijrochi (Mas’ul)',
              dataIndex: 'executedByName',
              width: 130,
              render: (name: string) => <span style={{ whiteSpace: 'nowrap' }}>{name}</span>,
            },
            {
              title: 'Sana va Vaqt',
              dataIndex: 'createdAt',
              width: 105,
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
              width: 140,
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
      </Card>

      {/* OFFICIAL DOCUMENT MODAL */}
      {selectedMovement && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType={
            selectedMovement.movementType === 'INCOMING'
              ? 'KIRIM'
              : selectedMovement.movementType === 'WRITE_OFF'
              ? 'SPISANIE'
              : 'TRANSFER'
          }
          docNumber={selectedMovement.movementNumber}
          date={selectedMovement.createdAt.substring(0, 10)}
          sourceLocation={selectedMovement.sourceLocation}
          targetLocation={selectedMovement.targetLocation}
          senderName={selectedMovement.executedByName}
          receiverName="Moddiy javobgar shaxs"
          reason={selectedMovement.referenceDoc}
          items={
            (selectedMovement as any).items && (selectedMovement as any).items.length > 0
              ? (selectedMovement as any).items.map((it: any, idx: number) => ({
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
