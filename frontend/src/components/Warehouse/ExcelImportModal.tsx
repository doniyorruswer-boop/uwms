import React, { useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Table,
  Typography,
  Input,
  Select,
  Alert,
  Tag,
} from '@arco-design/web-react';
import {
  IconUpload,
  IconCheckCircle,
  IconDelete,
  IconFile,
} from '@arco-design/web-react/icon';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';

const { Text, Paragraph } = Typography;

interface ParsedAssetRow {
  key: string;
  itemName: string;
  model?: string;
  categoryName?: string;
  inventoryNumber?: string;
  serialNumber?: string;
  purchasePrice?: number;
  fundingSource: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';
  roomNumber?: string;
}

interface ExcelImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { importExcelAssets, isImporting } = useAssetsQuery();
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState<ParsedAssetRow[]>([]);
  const [defaultFunding, setDefaultFunding] = useState<'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT'>('BYUDJET');

  const handleParseText = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsed: ParsedAssetRow[] = [];

    lines.forEach((line, index) => {
      // Split by tab or comma or semicolon
      const parts = line.includes('\t')
        ? line.split('\t')
        : line.includes(';')
        ? line.split(';')
        : line.split(',');

      const cleanParts = parts.map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (cleanParts.length === 0 || !cleanParts[0]) return;

      // Skip header row if contains 'nomi' or 'name'
      if (index === 0 && (cleanParts[0].toLowerCase().includes('nomi') || cleanParts[0].toLowerCase().includes('name'))) {
        return;
      }

      const itemName = cleanParts[0];
      const model = cleanParts[1] || '';
      const categoryName = cleanParts[2] || 'Kompyuter va IT uskunalari';
      const invNumber = cleanParts[3] || '';
      const serialNumber = cleanParts[4] || '';
      const price = cleanParts[5] ? Number(cleanParts[5].replace(/\s/g, '')) || 0 : 0;
      const roomNumber = cleanParts[6] || '';
      const funding = (cleanParts[7] as any) || defaultFunding;

      parsed.push({
        key: `row-${Date.now()}-${index}`,
        itemName,
        model,
        categoryName,
        inventoryNumber: invNumber,
        serialNumber,
        purchasePrice: price,
        fundingSource: funding,
        roomNumber,
      });
    });

    setRows(parsed);
  };

  const handleLoadSample = () => {
    const sample = `Nomi\tModeli\tKategoriya\tInventar Raqam\tSeriya Raqam\tNarxi\tXona Raqami\nKompyuter HP ProDesk\t400 G7\tKompyuter va IT uskunalari\t\tSN-HP-90112\t7500000\t304\nPrinter Canon i-SENSYS\tLBP223dw\tNusxalash va bosma uskunalari\t\tSN-CN-44120\t3800000\t102\nProyektor Epson\tEB-E01\tAudio va video uskunalar\t\tSN-EP-88190\t5200000\t308\nKonditsioner Artel\t18HD\tMebel va maishiy texnika\t\tSN-AR-00129\t6400000\t205\nSmart doska Horion\t65M5A\tAudio va video uskunalar\t\tSN-HR-22910\t18500000\t401`;
    setPasteText(sample);
  };

  const handleDeleteRow = (key: string) => {
    setRows(rows.filter((r) => r.key !== key));
  };

  const handleSubmit = async () => {
    if (rows.length === 0) return;

    await importExcelAssets(
      rows.map((r) => ({
        itemName: r.itemName,
        model: r.model,
        categoryName: r.categoryName,
        inventoryNumber: r.inventoryNumber || undefined,
        serialNumber: r.serialNumber,
        purchasePrice: r.purchasePrice,
        fundingSource: r.fundingSource,
        roomNumber: r.roomNumber,
      })),
    );

    setRows([]);
    setPasteText('');
    onClose();
    if (onSuccess) onSuccess();
  };

  const columns = [
    {
      title: '№',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Aktiv Nomi va Modeli',
      render: (_: any, record: ParsedAssetRow) => (
        <div>
          <Text bold>{record.itemName}</Text>
          {record.model && <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{record.model}</div>}
        </div>
      ),
    },
    {
      title: 'Inventar №',
      render: (_: any, record: ParsedAssetRow) =>
        record.inventoryNumber ? (
          <Tag color="blue" style={{ borderRadius: 0 }}>
            {record.inventoryNumber}
          </Tag>
        ) : (
          <Tag color="arcoblue" style={{ borderRadius: 0, fontStyle: 'italic' }}>
            Avtomatik ketma-ket
          </Tag>
        ),
    },
    {
      title: 'Moliyalashtirish',
      render: (_: any, record: ParsedAssetRow) => {
        const color =
          record.fundingSource === 'BYUDJET'
            ? 'cyan'
            : record.fundingSource === 'KONTRAKT_RIVOJLANTIRISH'
            ? 'purple'
            : 'green';
        return (
          <Tag color={color} style={{ borderRadius: 0 }}>
            {record.fundingSource}
          </Tag>
        );
      },
    },
    {
      title: 'Xona',
      render: (_: any, record: ParsedAssetRow) =>
        record.roomNumber ? (
          <Tag color="gray" style={{ borderRadius: 0 }}>
            {record.roomNumber}-xona
          </Tag>
        ) : (
          <span style={{ color: 'var(--color-text-3)' }}>Markaziy ombor</span>
        ),
    },
    {
      title: 'Narxi (so‘m)',
      render: (_: any, record: ParsedAssetRow) =>
        record.purchasePrice ? record.purchasePrice.toLocaleString('uz-UZ') : '0',
    },
    {
      title: '',
      width: 50,
      render: (_: any, record: ParsedAssetRow) => (
        <Button
          type="text"
          status="danger"
          size="mini"
          icon={<IconDelete />}
          onClick={() => handleDeleteRow(record.key)}
          style={{ borderRadius: 0 }}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconUpload style={{ fontSize: 18, color: '#165DFF' }} />
          <span style={{ fontWeight: 600 }}>
            Mavjud Asosiy Vositalarni Excel / CSV Orqali Ommaviy Yuklash
          </span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 960, borderRadius: 0 }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Yopish
          </Button>
          <Button
            type="primary"
            icon={<IconCheckCircle />}
            disabled={rows.length === 0}
            loading={isImporting}
            onClick={handleSubmit}
            style={{ borderRadius: 0 }}
          >
            {rows.length > 0 ? `${rows.length} ta aktivni bazaga yuklash` : 'Yuklash'}
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        style={{ marginBottom: 16, borderRadius: 0 }}
        content="Universitetning mavjud uskunalar ro‘yxatini Excel jadvalidan to‘g‘ridan-to‘g‘ri nusxalab olib quyidagi maydonga joylang. Inventar raqami bo‘lmagan har bir vositaga tizim unikal, tartibli ketma-ket inventar raqami (INV-YYYY-XXXXX) va QR-kod biriktiradi."
      />

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text bold>Standart Moliyalashtirish Manbasi:</Text>
          <Select
            value={defaultFunding}
            onChange={(v) => setDefaultFunding(v)}
            style={{ width: 220, borderRadius: 0 }}
          >
            <Select.Option value="BYUDJET">Davlat Byudjeti</Select.Option>
            <Select.Option value="KONTRAKT_RIVOJLANTIRISH">To‘lov-Kontrakt jamg‘armasi</Select.Option>
            <Select.Option value="GRANT">Ilmiy Grantlar</Select.Option>
          </Select>
        </Space>
        <Button size="small" type="outline" onClick={handleLoadSample} style={{ borderRadius: 0 }}>
          Namunaviy Excel ma’lumotlarini qo‘yish
        </Button>
      </div>

      <Input.TextArea
        placeholder={`Excel jadvalidan qatorlarni ko‘chirib bu yerga joylang (Ctrl+V)...\nUstunlar tartibi: Nomi | Modeli | Kategoriya | Inventar № | Seriya № | Narxi | Xona №`}
        rows={4}
        value={pasteText}
        onChange={(val) => setPasteText(val)}
        style={{ borderRadius: 0, fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          size="small"
          onClick={handleParseText}
          disabled={!pasteText.trim()}
          style={{ borderRadius: 0 }}
        >
          Matnni Jadvalga O‘tkazish (Tahlil qilish)
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <Text bold>
              Tahlil qilingan aktivlar ro‘yxati: <Tag color="blue" style={{ borderRadius: 0 }}>{rows.length} ta</Tag>
            </Text>
            <Text style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
              Umumiy qiymat: {rows.reduce((acc, r) => acc + (r.purchasePrice || 0), 0).toLocaleString('uz-UZ')} so‘m
            </Text>
          </div>

          <Table
            columns={columns}
            data={rows}
            pagination={{
              pageSize: 5,
              showTotal: (total) => `Jami: ${total} ta qator`,
              sizeCanChange: false,
            }}
            border={{ wrapper: true, cell: true }}
            size="small"
            style={{ borderRadius: 0 }}
          />
        </>
      )}
    </Modal>
  );
};
