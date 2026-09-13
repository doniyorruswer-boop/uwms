import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Radio,
  Button,
  Space,
  Table,
  Typography,
  Card,
  Grid,
  Divider,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconDelete,
  IconFile,
  IconUser,
  IconCheckCircle,
} from '@arco-design/web-react/icon';
import { useSuppliersQuery } from '../../hooks/useSuppliersQuery';
import { useWarehouseQuery } from '../../hooks/useWarehouseQuery';

const { Row, Col } = Grid;
const { Text } = Typography;

interface IngestItemRow {
  key: string;
  name: string;
  model: string;
  categoryName: string;
  type: 'FIXED_ASSET' | 'CONSUMABLE';
  quantity: number;
  unit: string;
  purchasePrice: number;
}

interface IngestStockModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccessDoc: (doc: any) => void;
}

export const IngestStockModal: React.FC<IngestStockModalProps> = ({
  visible,
  onClose,
  onSuccessDoc,
}) => {
  const [form] = Form.useForm();
  const { suppliers, nextCodes, createSupplier, isCreatingSupplier } = useSuppliersQuery();
  const { ingestStock, isIngesting } = useWarehouseQuery();

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [fundingSource, setFundingSource] = useState<'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT'>('BYUDJET');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  const [items, setItems] = useState<IngestItemRow[]>([
    {
      key: '1',
      name: '',
      model: '',
      categoryName: 'Kompyuter va IT uskunalari',
      type: 'FIXED_ASSET',
      quantity: 1,
      unit: 'dona',
      purchasePrice: 0,
    },
  ]);

  useEffect(() => {
    if (visible && nextCodes) {
      form.setFieldsValue({
        invoiceNumber: nextCodes.nextInvoiceNumber,
      });
    }
  }, [visible, nextCodes, form]);

  const handleAddItem = () => {
    const newKey = String(Date.now());
    setItems([
      ...items,
      {
        key: newKey,
        name: '',
        model: '',
        categoryName: 'Kompyuter va IT uskunalari',
        type: 'FIXED_ASSET',
        quantity: 1,
        unit: 'dona',
        purchasePrice: 0,
      },
    ]);
  };

  const handleRemoveItem = (key: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.key !== key));
  };

  const handleItemChange = (key: string, field: keyof IngestItemRow, value: any) => {
    setItems(
      items.map((item) => {
        if (item.key === key) {
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const handleQuickCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    const res = await createSupplier({
      name: newSupplierName,
      contactPerson: newSupplierContact,
      phone: newSupplierPhone,
      inn: nextCodes?.nextINN,
      contractNumber: nextCodes?.nextContractNumber,
    });
    if (res?.id) {
      setSelectedSupplierId(res.id);
      setShowNewSupplier(false);
      setNewSupplierName('');
      setNewSupplierContact('');
      setNewSupplierPhone('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      form.setFields({
        supplierId: { error: { message: 'Ta’minotchi tanlanishi shart!' } },
      });
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      return;
    }

    const values = await form.validate();

    const payload = {
      supplierId: selectedSupplierId,
      invoiceNumber: values.invoiceNumber || nextCodes?.nextInvoiceNumber,
      fundingSource,
      note: values.note || 'Ta’minotchidan yangi tovarlar qabul qilindi',
      items: validItems.map((it) => ({
        name: it.name,
        model: it.model,
        categoryName: it.categoryName,
        type: it.type,
        quantity: it.quantity,
        unit: it.unit,
        purchasePrice: it.purchasePrice,
      })),
    };

    const result = await ingestStock(payload);
    if (result?.success && result?.officialDoc) {
      onClose();
      onSuccessDoc(result.officialDoc);
    }
  };

  const itemColumns = [
    {
      title: 'Aktiv Nomi',
      dataIndex: 'name',
      render: (_: any, record: IngestItemRow) => (
        <Input
          placeholder="Masalan: Monoblok Lenovo"
          value={record.name}
          onChange={(val) => handleItemChange(record.key, 'name', val)}
          style={{ borderRadius: 0 }}
        />
      ),
    },
    {
      title: 'Turi',
      dataIndex: 'type',
      width: 140,
      render: (_: any, record: IngestItemRow) => (
        <Select
          value={record.type}
          onChange={(val) => handleItemChange(record.key, 'type', val)}
          style={{ borderRadius: 0, width: '100%' }}
        >
          <Select.Option value="FIXED_ASSET">Asosiy vosita</Select.Option>
          <Select.Option value="CONSUMABLE">Sarf materiali</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Model',
      dataIndex: 'model',
      width: 130,
      render: (_: any, record: IngestItemRow) => (
        <Input
          placeholder="Modeli"
          value={record.model}
          onChange={(val) => handleItemChange(record.key, 'model', val)}
          style={{ borderRadius: 0 }}
        />
      ),
    },
    {
      title: 'Miqdori',
      dataIndex: 'quantity',
      width: 100,
      render: (_: any, record: IngestItemRow) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={(val) => handleItemChange(record.key, 'quantity', val)}
          style={{ borderRadius: 0, width: '100%' }}
        />
      ),
    },
    {
      title: 'Narxi (so‘m)',
      dataIndex: 'purchasePrice',
      width: 140,
      render: (_: any, record: IngestItemRow) => (
        <InputNumber
          min={0}
          step={50000}
          value={record.purchasePrice}
          onChange={(val) => handleItemChange(record.key, 'purchasePrice', val)}
          style={{ borderRadius: 0, width: '100%' }}
        />
      ),
    },
    {
      title: '',
      width: 50,
      render: (_: any, record: IngestItemRow) => (
        <Button
          type="text"
          status="danger"
          icon={<IconDelete />}
          disabled={items.length <= 1}
          onClick={() => handleRemoveItem(record.key)}
          style={{ borderRadius: 0 }}
        />
      ),
    },
  ];

  const totalSum = items.reduce((acc, it) => acc + (it.purchasePrice || 0) * (it.quantity || 1), 0);

  return (
    <Modal
      title={
        <Space>
          <IconFile style={{ fontSize: 18, color: '#165DFF' }} />
          <span style={{ fontWeight: 600 }}>
            Ta’minotchidan Kirim Qilish va OS-1 Rasmiy Aktini Shakllantirish
          </span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 920, borderRadius: 0 }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Bekor qilish
          </Button>
          <Button
            type="primary"
            icon={<IconCheckCircle />}
            loading={isIngesting}
            onClick={handleSubmit}
            style={{ borderRadius: 0 }}
          >
            Kirim Qilish va OS-1 Aktini Chiqarish
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              label={
                <Space>
                  <span>Ta’minotchi Korxona</span>
                  {!showNewSupplier && (
                    <Button
                      size="mini"
                      type="text"
                      icon={<IconPlus />}
                      onClick={() => setShowNewSupplier(true)}
                    >
                      Yangi qo‘shish
                    </Button>
                  )}
                </Space>
              }
              required
            >
              {!showNewSupplier ? (
                <Select
                  placeholder="Ta’minotchini tanlang"
                  value={selectedSupplierId}
                  onChange={(val) => setSelectedSupplierId(val)}
                  style={{ borderRadius: 0 }}
                >
                  {suppliers.map((s) => (
                    <Select.Option key={s.id} value={s.id}>
                      {s.name} (STIR: {s.inn} | Shartnoma: {s.contractNumber || '—'})
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                <Card
                  style={{
                    borderRadius: 0,
                    border: '1px dashed #165DFF',
                    background: 'var(--color-fill-1)',
                    padding: '8px 12px',
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text bold style={{ fontSize: 12 }}>
                        Yangi Ta’minotchi (Avto STIR: {nextCodes?.nextINN} | Shartnoma: {nextCodes?.nextContractNumber})
                      </Text>
                      <Button size="mini" type="text" onClick={() => setShowNewSupplier(false)}>
                        Bekor qilish
                      </Button>
                    </div>
                    <Input
                      placeholder="Ta’minotchi nomi (masalan: 'Artel MCHJ')"
                      value={newSupplierName}
                      onChange={(v) => setNewSupplierName(v)}
                      style={{ borderRadius: 0 }}
                    />
                    <Row gutter={8}>
                      <Col span={12}>
                        <Input
                          placeholder="Mas’ul shaxs (F.I.SH)"
                          value={newSupplierContact}
                          onChange={(v) => setNewSupplierContact(v)}
                          style={{ borderRadius: 0 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Input
                          placeholder="Telefon raqami"
                          value={newSupplierPhone}
                          onChange={(v) => setNewSupplierPhone(v)}
                          style={{ borderRadius: 0 }}
                        />
                      </Col>
                    </Row>
                    <Button
                      type="primary"
                      size="small"
                      loading={isCreatingSupplier}
                      onClick={handleQuickCreateSupplier}
                      style={{ borderRadius: 0 }}
                    >
                      Saqlash va Tanlash
                    </Button>
                  </Space>
                </Card>
              )}
            </Form.Item>
          </Col>

          <Col span={10}>
            <Form.Item
              label="Hisob-Faktura Raqami"
              field="invoiceNumber"
              rules={[{ required: true, message: 'Invoys raqami kiritilishi shart!' }]}
            >
              <Input
                placeholder="HF-2026-0001"
                style={{ borderRadius: 0, fontFamily: 'monospace', fontWeight: 'bold' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="Moliyalashtirish Manbasi (Funding Source)" required>
              <Radio.Group
                type="button"
                value={fundingSource}
                onChange={(val) => setFundingSource(val)}
                style={{ width: '100%', borderRadius: 0 }}
              >
                <Radio value="BYUDJET" style={{ flex: 1, textAlign: 'center', borderRadius: 0 }}>
                  Davlat Byudjeti (BYUDJET)
                </Radio>
                <Radio
                  value="KONTRAKT_RIVOJLANTIRISH"
                  style={{ flex: 1, textAlign: 'center', borderRadius: 0 }}
                >
                  To‘lov-Kontrakt va Rivojlantirish
                </Radio>
                <Radio value="GRANT" style={{ flex: 1, textAlign: 'center', borderRadius: 0 }}>
                  Ilmiy Grantlar Jamg‘armasi
                </Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text bold style={{ fontSize: 14 }}>
            Kirim qilinayotgan moddiy buyumlar va uskunalar
          </Text>
          <Button
            type="outline"
            size="small"
            icon={<IconPlus />}
            onClick={handleAddItem}
            style={{ borderRadius: 0 }}
          >
            Yana qator qo‘shish
          </Button>
        </div>

        <Table
          columns={itemColumns}
          data={items}
          pagination={false}
          border={{ wrapper: true, cell: true }}
          size="small"
          style={{ marginBottom: 16 }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'var(--color-fill-2)',
            marginBottom: 16,
          }}
        >
          <Text>Jami kiritilayotgan turlar: <b>{items.length} ta</b></Text>
          <Text style={{ fontSize: 15 }}>
            Umumiy qiymati:{' '}
            <b style={{ color: '#165DFF', fontSize: 16 }}>
              {totalSum.toLocaleString('uz-UZ')} so‘m
            </b>
          </Text>
        </div>

        <Form.Item label="Qo‘shimcha Izoh va Asos" field="note">
          <Input.TextArea
            placeholder="Omborga kirim qilish asosi, yuk xati yoki buyruq ma’lumotlari"
            rows={2}
            style={{ borderRadius: 0 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
