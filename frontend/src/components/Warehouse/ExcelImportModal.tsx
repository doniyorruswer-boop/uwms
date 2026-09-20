import React, { useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Table,
  Typography,
  Alert,
  Tag,
  Upload,
  Steps,
  Statistic,
  Radio,
  Tooltip,
  Result,
  Card,
  Message,
} from '@arco-design/web-react';
import {
  IconUpload,
  IconDownload,
  IconCheckCircle,
  IconCloseCircle,
  IconExclamationCircle,
  IconFile,
  IconArrowRight,
  IconArrowLeft,
  IconRefresh,
} from '@arco-design/web-react/icon';
import * as XLSX from 'xlsx';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';

const { Text, Paragraph } = Typography;
const Step = Steps.Step;

export interface ExcelImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RawParsedRow {
  itemName: string;
  model?: string;
  categoryName?: string;
  inventoryNumber?: string;
  serialNumber?: string;
  purchasePrice?: number;
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';
  roomNumber?: string;
  responsibleUsername?: string;
  warrantyMonths?: number;
}

interface PreviewRowItem {
  row: number;
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  data: RawParsedRow;
  resolvedRoom?: { id: string; number: string; name: string } | null;
  resolvedUser?: { id: string; fullName: string; username: string } | null;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const {
    previewImport,
    isPreviewing,
    importExcelAssets,
    isImporting,
    downloadImportTemplate,
    refetch,
  } = useAssetsQuery();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [previewResult, setPreviewResult] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    previewData: PreviewRowItem[];
    errors: Array<{ row: number; field: string; message: string }>;
  } | null>(null);

  const [filterType, setFilterType] = useState<'ALL' | 'VALID' | 'ERROR'>('ALL');
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    failedCount: number;
  } | null>(null);

  const handleReset = () => {
    setCurrentStep(0);
    setSelectedFileName('');
    setParsedRows([]);
    setPreviewResult(null);
    setFilterType('ALL');
    setImportSummary(null);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  // 1. File upload & parsing with SheetJS
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

        // Find primary sheet
        const sheetName =
          workbook.SheetNames.find((s) => s.toLowerCase().includes('aktiv')) ||
          workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          Message.error('Excel faylda ishchi varaq topilmadi!');
          return;
        }

        const rawMatrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        if (!rawMatrix || rawMatrix.length < 2) {
          Message.warning('Faylda sarlavha yoki ma’lumot qatorlari topilmadi!');
          return;
        }

        const headerRow = (rawMatrix[0] as any[]).map((h) =>
          String(h || '').trim().toLowerCase(),
        );

        const colMap: Record<string, number> = {};
        headerRow.forEach((h, colIdx) => {
          if (h.includes('nomi') || h.includes('name') || h.includes('aktiv')) {
            if (colMap['itemName'] === undefined) colMap['itemName'] = colIdx;
          } else if (h.includes('inventar') || h.includes('inv')) {
            if (colMap['inventoryNumber'] === undefined) colMap['inventoryNumber'] = colIdx;
          } else if (h.includes('model')) {
            if (colMap['model'] === undefined) colMap['model'] = colIdx;
          } else if (h.includes('kategoriya') || h.includes('category')) {
            if (colMap['categoryName'] === undefined) colMap['categoryName'] = colIdx;
          } else if (h.includes('seriya') || h.includes('serial') || h.includes('s/n')) {
            if (colMap['serialNumber'] === undefined) colMap['serialNumber'] = colIdx;
          } else if (h.includes('xona') || h.includes('room')) {
            if (colMap['roomNumber'] === undefined) colMap['roomNumber'] = colIdx;
          } else if (
            h.includes('mol') ||
            h.includes('mas’ul') ||
            h.includes('masul') ||
            h.includes('login') ||
            h.includes('xodim')
          ) {
            if (colMap['responsibleUsername'] === undefined) colMap['responsibleUsername'] = colIdx;
          } else if (h.includes('narx') || h.includes('price') || h.includes('summa')) {
            if (colMap['purchasePrice'] === undefined) colMap['purchasePrice'] = colIdx;
          } else if (h.includes('manba') || h.includes('funding') || h.includes('fond')) {
            if (colMap['fundingSource'] === undefined) colMap['fundingSource'] = colIdx;
          } else if (h.includes('kafolat') || h.includes('warranty')) {
            if (colMap['warrantyMonths'] === undefined) colMap['warrantyMonths'] = colIdx;
          }
        });

        // Parse data rows
        const rows: RawParsedRow[] = [];
        for (let i = 1; i < rawMatrix.length; i++) {
          const row = rawMatrix[i] as any[];
          if (!row || row.length === 0) continue;

          // Check if entire row is empty
          const hasContent = row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
          if (!hasContent) continue;

          const getItemVal = (key: string) => {
            const idx = colMap[key];
            if (idx !== undefined && row[idx] !== undefined && row[idx] !== null) {
              return String(row[idx]).trim();
            }
            return '';
          };

          const itemName = getItemVal('itemName');
          const model = getItemVal('model');
          const categoryName = getItemVal('categoryName');
          const inventoryNumber = getItemVal('inventoryNumber');
          const serialNumber = getItemVal('serialNumber');
          const roomNumber = getItemVal('roomNumber');
          const responsibleUsername = getItemVal('responsibleUsername');

          const rawPrice = getItemVal('purchasePrice');
          const cleanPrice = rawPrice ? Number(rawPrice.replace(/[^\d.]/g, '')) : undefined;

          const rawFunding = getItemVal('fundingSource').toUpperCase();
          const fundingSource = (['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'].includes(rawFunding)
            ? rawFunding
            : rawFunding
            ? (rawFunding as any)
            : 'BYUDJET') as any;

          const rawWarranty = getItemVal('warrantyMonths');
          const warrantyMonths = rawWarranty ? Number(rawWarranty.replace(/[^\d]/g, '')) : undefined;

          rows.push({
            itemName,
            model: model || undefined,
            categoryName: categoryName || undefined,
            inventoryNumber: inventoryNumber || undefined,
            serialNumber: serialNumber || undefined,
            purchasePrice: cleanPrice !== undefined && !isNaN(cleanPrice) ? cleanPrice : undefined,
            fundingSource,
            roomNumber: roomNumber || undefined,
            responsibleUsername: responsibleUsername || undefined,
            warrantyMonths: warrantyMonths !== undefined && !isNaN(warrantyMonths) ? warrantyMonths : undefined,
          });
        }

        if (rows.length === 0) {
          Message.warning('Faylda ma’lumot qatorlari topilmadi!');
          return;
        }

        setSelectedFileName(file.name);
        setParsedRows(rows);
        Message.success(`${file.name} o‘qildi: ${rows.length} ta qator aniqlandi.`);
      } catch (err: any) {
        Message.error('Faylni o‘qishda xatolik yuz berdi: ' + (err.message || 'Noto‘g‘ri format'));
      }
    };

    reader.readAsArrayBuffer(file);
    return false;
  };

  // 2. Trigger Dry-Run validation
  const handleRunDryRun = async () => {
    if (parsedRows.length === 0) {
      Message.warning('Tekshirish uchun avval fayl yuklang!');
      return;
    }

    try {
      const res = await previewImport(parsedRows);
      setPreviewResult(res);
      setCurrentStep(2);
      if (res.errorCount === 0) {
        Message.success(`Dry-run yakunlandi: Barcha ${res.validCount} ta qator to‘g‘ri!`);
      } else {
        Message.warning(`Dry-run yakunlandi: ${res.validCount} ta to‘g‘ri, ${res.errorCount} ta xatolik aniqlandi.`);
      }
    } catch {
      // Handled by onError in hook
    }
  };

  // 3. Confirm Import
  const handleConfirmImport = async () => {
    if (!previewResult) return;

    const validRowsToImport = previewResult.previewData
      .filter((r) => r.isValid)
      .map((r) => r.data);

    if (validRowsToImport.length === 0) {
      Message.error('Import qilish uchun birorta ham to‘g‘ri qator mavjud emas!');
      return;
    }

    try {
      const res = await importExcelAssets(validRowsToImport);
      setImportSummary({
        importedCount: res.importedCount,
        failedCount: res.failedCount,
      });
      setCurrentStep(3);
      refetch();
      if (onSuccess) onSuccess();
    } catch {
      // Handled by onError
    }
  };

  // Table columns for dry-run preview
  const previewColumns = [
    {
      title: '№',
      width: 60,
      render: (_: any, record: PreviewRowItem) => (
        <Text bold style={{ color: record.isValid ? '#00B42A' : '#F53F3F' }}>
          #{record.row}
        </Text>
      ),
    },
    {
      title: 'Holati',
      width: 100,
      render: (_: any, record: PreviewRowItem) =>
        record.isValid ? (
          <Tag color="green" icon={<IconCheckCircle />}>
            To‘g‘ri
          </Tag>
        ) : (
          <Tag color="red" icon={<IconCloseCircle />}>
            Xato ({record.errors.length})
          </Tag>
        ),
    },
    {
      title: 'Aktiv Nomi',
      dataIndex: 'data.itemName',
      render: (_: any, record: PreviewRowItem) => (
        <Space direction="vertical" size={2}>
          <Text bold>{record.data.itemName || '—'}</Text>
          {record.data.model && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Model: {record.data.model}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Inventar №',
      dataIndex: 'data.inventoryNumber',
      render: (_: any, record: PreviewRowItem) => {
        const invErr = record.errors.find((e) => e.field === 'inventoryNumber');
        return (
          <Space direction="vertical" size={2}>
            {record.data.inventoryNumber ? (
              <Tag color={invErr ? 'red' : 'arcoblue'}>{record.data.inventoryNumber}</Tag>
            ) : (
              <Tag color="gray">Avtomatik generatsiya</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Joylashuv (Xona)',
      render: (_: any, record: PreviewRowItem) => {
        if (record.resolvedRoom) {
          return (
            <Tag color="cyan">
              {record.resolvedRoom.number}-xona ({record.resolvedRoom.name})
            </Tag>
          );
        }
        if (record.data.roomNumber) {
          return <Tag color="red">Topilmadi: {record.data.roomNumber}</Tag>;
        }
        return <Text type="secondary">Markaziy Ombor</Text>;
      },
    },
    {
      title: 'Mas’ul MOL',
      render: (_: any, record: PreviewRowItem) => {
        if (record.resolvedUser) {
          return (
            <Tag color="purple">
              {record.resolvedUser.fullName} (@{record.resolvedUser.username})
            </Tag>
          );
        }
        if (record.data.responsibleUsername) {
          return <Tag color="red">Topilmadi: @{record.data.responsibleUsername}</Tag>;
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Manba',
      width: 120,
      render: (_: any, record: PreviewRowItem) => {
        const fs = record.data.fundingSource;
        const color =
          fs === 'BYUDJET' ? 'blue' : fs === 'KONTRAKT_RIVOJLANTIRISH' ? 'orange' : 'purple';
        return <Tag color={color}>{fs || 'BYUDJET'}</Tag>;
      },
    },
    {
      title: 'Xatoliklar / Eslatmalar',
      render: (_: any, record: PreviewRowItem) => {
        if (record.isValid) {
          return (
            <Text type="success" style={{ fontSize: 12 }}>
              <IconCheckCircle style={{ marginRight: 4 }} />
              Tekshiruvdan o‘tdi
            </Text>
          );
        }
        return (
          <Space direction="vertical" size={2}>
            {record.errors.map((err, idx) => (
              <Text key={idx} type="error" style={{ fontSize: 12 }}>
                • {err.message}
              </Text>
            ))}
          </Space>
        );
      },
    },
  ];

  const filteredPreviewData = (previewResult?.previewData || []).filter((item) => {
    if (filterType === 'VALID') return item.isValid;
    if (filterType === 'ERROR') return !item.isValid;
    return true;
  });

  return (
    <Modal
      title={
        <Space>
          <IconUpload style={{ fontSize: 20, color: '#165DFF' }} />
          <Text bold style={{ fontSize: 16 }}>
            Asosiy Vositalarni Excel Orqali Ommaviy Import Qilish
          </Text>
        </Space>
      }
      visible={visible}
      onCancel={handleModalClose}
      footer={null}
      style={{ width: 1020, top: 40 }}
      maskClosable={false}
    >
      <div style={{ marginBottom: 24 }}>
        <Steps current={currentStep} size="small">
          <Step title="1. Shablon va Qoidalar" description="Andozani yuklab olish" />
          <Step title="2. Faylni Tanlash" description="Excel faylni yuklash" />
          <Step title="3. Dastlabki Tekshiruv" description="Dry-run tahlili" />
          <Step title="4. Natija" description="Import xulosasi" />
        </Steps>
      </div>

      {/* STEP 0: TEMPLATE & RULES */}
      {currentStep === 0 && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            type="info"
            title="Xavfsiz Ommaviy Import Tizimi"
            content="Tizim ma’lumotlar butunligini ta’minlash maqsadida kiritilayotgan barcha qatorlarni avval sinovdan o‘tkazadi (Dry-Run). Dublikat inventar raqamlar, noto‘g‘ri moliyalashtirish manbalari yoki mavjud bo‘lmagan xonalar avtomatik aniqlanadi."
          />

          <Card
            title="Import Shablonining Asosiy Ustunlari"
            style={{ borderRadius: 4, background: '#F7F8FA' }}
          >
            <Table
              pagination={false}
              size="small"
              columns={[
                { title: 'Ustun Nomi', dataIndex: 'name', width: 220, render: (t) => <Text bold>{t}</Text> },
                {
                  title: 'Majburiyligi',
                  dataIndex: 'required',
                  width: 130,
                  render: (r) => (
                    <Tag color={r === 'Majburiy' ? 'red' : 'arcoblue'}>{r}</Tag>
                  ),
                },
                { title: 'Talab va Qoida', dataIndex: 'desc' },
              ]}
              data={[
                {
                  name: 'Aktiv nomi',
                  required: 'Majburiy',
                  desc: 'Uskunaning to‘liq rasmiy nomi (kamida 2 ta belgi).',
                },
                {
                  name: 'Inventar raqami',
                  required: 'Ixtiyoriy',
                  desc: 'Bo‘sh qoldirilsa tizim avtomatik unikal INV-... generatsiya qiladi. Agar qo‘lda kiritilsa, takrorlanmas bo‘lishi shart.',
                },
                {
                  name: 'Moliyalashtirish manbasi',
                  required: 'Ixtiyoriy',
                  desc: 'Faqat: BYUDJET, KONTRAKT_RIVOJLANTIRISH yoki GRANT. Bo‘sh bo‘lsa BYUDJET hisoblanadi.',
                },
                {
                  name: 'Xona raqami',
                  required: 'Ixtiyoriy',
                  desc: 'OTM bazasidagi mavjud xona raqami (masalan: 101, 304). Kiritilsa status "FOYDALANISHDA" bo‘ladi.',
                },
                {
                  name: 'Mas’ul xodim (MOL logini)',
                  required: 'Ixtiyoriy',
                  desc: 'Moddiy javobgar shaxsning tizimdagi foydalanuvchi logini (username).',
                },
                {
                  name: 'Boshlang‘ich narx',
                  required: 'Ixtiyoriy',
                  desc: 'So‘mda, musbat son.',
                },
              ]}
            />
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="outline"
              icon={<IconDownload />}
              onClick={downloadImportTemplate}
              style={{ borderRadius: 2 }}
            >
              Excel Shablonini Yuklab Olish (.xlsx)
            </Button>

            <Button
              type="primary"
              icon={<IconArrowRight />}
              onClick={() => setCurrentStep(1)}
              style={{ borderRadius: 2 }}
            >
              Keyingisi: Fayl Tanlash
            </Button>
          </div>
        </Space>
      )}

      {/* STEP 1: FILE SELECTION */}
      {currentStep === 1 && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div
            style={{
              border: '2px dashed #C9CDD4',
              borderRadius: 4,
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#F7F8FA',
              cursor: 'pointer',
            }}
          >
            <Upload
              drag
              accept=".xlsx, .xls, .csv"
              showUploadList={false}
              beforeUpload={handleFileUpload}
            >
              <Space direction="vertical" align="center" size="medium">
                <IconFile style={{ fontSize: 48, color: '#165DFF' }} />
                <div>
                  <Paragraph bold style={{ fontSize: 16, margin: 0 }}>
                    Excel faylni bu yerga tashlang yoki tanlash uchun bosing
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Faqat .xlsx, .xls yoki .csv formatidagi fayllar qabul qilinadi
                  </Text>
                </div>
              </Space>
            </Upload>
          </div>

          {selectedFileName && (
            <Card style={{ borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <IconFile style={{ fontSize: 24, color: '#00B42A' }} />
                  <div>
                    <Text bold>{selectedFileName}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Topilgan qatorlar soni:{' '}
                        <Text bold style={{ color: '#165DFF' }}>
                          {parsedRows.length} ta
                        </Text>
                      </Text>
                    </div>
                  </div>
                </Space>
                <Tag color="green">Tayyor</Tag>
              </div>
            </Card>
          )}

          {parsedRows.length > 0 && (
            <div>
              <Text bold style={{ marginBottom: 8, display: 'block' }}>
                Dastlabki 3 ta qator ko‘rinishi:
              </Text>
              <Table
                pagination={false}
                size="small"
                columns={[
                  { title: 'Aktiv Nomi', dataIndex: 'itemName' },
                  { title: 'Inventar №', dataIndex: 'inventoryNumber', render: (t) => t || '—' },
                  { title: 'Xona №', dataIndex: 'roomNumber', render: (t) => t || '—' },
                  { title: 'MOL logini', dataIndex: 'responsibleUsername', render: (t) => t || '—' },
                  { title: 'Manba', dataIndex: 'fundingSource' },
                ]}
                data={parsedRows.slice(0, 3).map((r, i) => ({ ...r, key: i }))}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              icon={<IconArrowLeft />}
              onClick={() => setCurrentStep(0)}
              style={{ borderRadius: 2 }}
            >
              Ortga
            </Button>

            <Button
              type="primary"
              loading={isPreviewing}
              disabled={parsedRows.length === 0}
              icon={<IconArrowRight />}
              onClick={handleRunDryRun}
              style={{ borderRadius: 2 }}
            >
              Tekshirish (Dry-Run Preview)
            </Button>
          </div>
        </Space>
      )}

      {/* STEP 2: DRY-RUN PREVIEW */}
      {currentStep === 2 && previewResult && (
        <Space direction="vertical" size="medium" style={{ width: '100%' }}>
          {/* STATS CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Card style={{ borderRadius: 4, background: '#F7F8FA' }}>
              <Statistic
                title="Jami O‘qilgan Qatorlar"
                value={previewResult.totalRows}
                groupSeparator
              />
            </Card>
            <Card style={{ borderRadius: 4, background: '#E8FFEA' }}>
              <Statistic
                title="To‘g‘ri (Valid) Qatorlar"
                value={previewResult.validCount}
                style={{ color: '#00B42A' }}
                prefix={<IconCheckCircle />}
                groupSeparator
              />
            </Card>
            <Card style={{ borderRadius: 4, background: previewResult.errorCount > 0 ? '#FFECE8' : '#F7F8FA' }}>
              <Statistic
                title="Xatolik Aniqlangan Qatorlar"
                value={previewResult.errorCount}
                style={{ color: previewResult.errorCount > 0 ? '#F53F3F' : '#86909C' }}
                prefix={previewResult.errorCount > 0 ? <IconCloseCircle /> : undefined}
                groupSeparator
              />
            </Card>
          </div>

          {/* STATUS ALERT */}
          {previewResult.errorCount === 0 ? (
            <Alert
              type="success"
              title="Barcha Qatorlar To‘liq Muvaffaqiyatli!"
              content="Hech qanday dublikat yoki ziddiyat aniqlanmadi. Barcha xonalar va mas’ul shaxslar mavjud. Ma’lumotlar bazasiga yozishga to‘liq tayyor."
            />
          ) : previewResult.validCount > 0 ? (
            <Alert
              type="warning"
              title="Ayrim Qatorlarda Xatoliklar Aniqlandi"
              content={`Jami ${previewResult.errorCount} ta qatorda xatolik topildi. Xatoliklar qizil rangda ajratib ko‘rsatilgan. Siz faqat to‘g‘ri bo‘lgan ${previewResult.validCount} ta aktivni import qilishingiz mumkin.`}
            />
          ) : (
            <Alert
              type="error"
              title="Barcha Qatorlarda Xatolik Mavjud!"
              content="Birorta ham qator tekshiruvdan o‘tmadi. Faylni tuzatib qaytadan yuklang."
            />
          )}

          {/* FILTER RADIO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Radio.Group
              type="button"
              value={filterType}
              onChange={(val) => setFilterType(val)}
              style={{ borderRadius: 2 }}
            >
              <Radio value="ALL">Barchasi ({previewResult.totalRows})</Radio>
              <Radio value="VALID">To‘g‘rilar ({previewResult.validCount})</Radio>
              <Radio value="ERROR">Xatoliklar ({previewResult.errorCount})</Radio>
            </Radio.Group>

            <Text type="secondary" style={{ fontSize: 12 }}>
              Ko‘rsatilmoqda: {filteredPreviewData.length} ta qator
            </Text>
          </div>

          {/* PREVIEW TABLE */}
          <Table
            rowKey="row"
            size="small"
            pagination={{ pageSize: 8, showTotal: true }}
            columns={previewColumns}
            data={filteredPreviewData}
            scroll={{ y: 320 }}
          />

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Button
              icon={<IconArrowLeft />}
              onClick={() => setCurrentStep(1)}
              style={{ borderRadius: 2 }}
            >
              Boshqa Fayl Tanlash
            </Button>

            <Button
              type="primary"
              status={previewResult.errorCount > 0 ? 'warning' : 'default'}
              loading={isImporting}
              disabled={previewResult.validCount === 0}
              icon={<IconCheckCircle />}
              onClick={handleConfirmImport}
              style={{ borderRadius: 2 }}
            >
              {previewResult.errorCount > 0
                ? `Xatoliklarni Tashlab, ${previewResult.validCount} ta To‘g‘ri Aktivni Import Qilish`
                : `Importni Tasdiqlash (${previewResult.validCount} ta Aktiv)`}
            </Button>
          </div>
        </Space>
      )}

      {/* STEP 3: RESULT */}
      {currentStep === 3 && importSummary && (
        <div style={{ padding: '24px 0' }}>
          <Result
            status={importSummary.failedCount === 0 ? 'success' : 'info'}
            title={
              importSummary.failedCount === 0
                ? 'Ommaviy Import Muvaffaqiyatli Yakunlandi!'
                : 'Qisman Import Amalga Oshirildi'
            }
            subTitle={
              importSummary.failedCount === 0
                ? `Barcha ${importSummary.importedCount} ta asosiy vosita universitet ma’lumotlar bazasiga kiritildi, unikal inventar raqamlari va audit jurnallari shakllantirildi.`
                : `${importSummary.importedCount} ta to‘g‘ri aktiv bazaga saqlandi. ${importSummary.failedCount} ta xatolik aniqlangan qator rad etildi.`
            }
            extra={[
              <Button
                key="close"
                type="primary"
                onClick={handleModalClose}
                style={{ borderRadius: 2 }}
              >
                Aktivlar Ro‘yxatiga Qaytish
              </Button>,
              <Button
                key="again"
                type="outline"
                icon={<IconRefresh />}
                onClick={handleReset}
                style={{ borderRadius: 2 }}
              >
                Yangi Fayl Yuklash
              </Button>,
            ]}
          />
        </div>
      )}
    </Modal>
  );
};
