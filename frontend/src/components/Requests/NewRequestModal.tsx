import React, { useState, useEffect, useMemo } from 'react';
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
  Tag,
  Badge,
  Alert,
  Empty,
  Drawer,
  Message,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconDelete,
  IconArchive,
  IconSearch,
  IconEye,
  IconCheckCircle,
} from '@arco-design/web-react/icon';
import { useWarehouseQuery } from '../../hooks/useWarehouseQuery';
import { useQuotasQuery, useCheckQuotaQuery } from '../../hooks/useQuotasQuery';
import { useAuthStore } from '../../store/authStore';
import type { StockItem } from '../../types';

const { Row, Col } = Grid;
const { Text } = Typography;
const FormItem = Form.Item;

export interface DraftItemRow {
  key: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  unit: string;
  isCustomNew?: boolean;
  currentQuantity?: number;
  minStockLimit?: number;
  categoryName?: string;
  isOverQuota?: boolean;
}

interface NewRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    purpose: string;
    items: Array<{ itemId?: string; itemName: string; quantity: number; unit?: string }>;
  }) => Promise<void>;
  initialDraftItems?: Array<{
    itemId?: string;
    itemName: string;
    quantity: number;
    unit: string;
    currentQuantity?: number;
    minStockLimit?: number;
  }>;
  initialPurpose?: string;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialDraftItems = [],
  initialPurpose = '',
}) => {
  const [form] = Form.useForm();
  const { stocks, isLoading: isLoadingStocks } = useWarehouseQuery();
  const { user } = useAuthStore();

  // Mode: EXISTING (Ombordagi zaxiradan) vs NEW (Hali omborda mavjud bo'lmagan yangi tovar)
  const [addMode, setAddMode] = useState<'EXISTING' | 'NEW'>('EXISTING');

  // Input states for Mode EXISTING
  const [selectedStockId, setSelectedStockId] = useState<string | undefined>(undefined);
  const [stockQuantityInput, setStockQuantityInput] = useState<number>(1);

  // Quota verification for selected warehouse item (Rule 5.4)
  const { data: quotaInfo } = useCheckQuotaQuery(
    {
      departmentId: user?.departmentId,
      itemId: selectedStockId,
      requestedQty: stockQuantityInput,
    },
    Boolean(user?.departmentId && selectedStockId),
  );

  // Input states for Mode NEW
  const [newCustomName, setNewCustomName] = useState<string>('');
  const [newCustomUnit, setNewCustomUnit] = useState<string>('DONA');
  const [newCustomQty, setNewCustomQty] = useState<number>(1);

  // Draft cart items list
  const [draftItems, setDraftItems] = useState<DraftItemRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Warehouse Live Catalog Drawer state
  const [isCatalogDrawerVisible, setIsCatalogDrawerVisible] = useState<boolean>(false);
  const [catalogSearchText, setCatalogSearchText] = useState<string>('');

  // When modal opens or initialDraftItems change, load them into draftItems
  useEffect(() => {
    if (visible) {
      if (initialDraftItems && initialDraftItems.length > 0) {
        setDraftItems(
          initialDraftItems.map((item, idx) => ({
            key: `init-${idx}-${item.itemId || item.itemName}`,
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit || 'DONA',
            isCustomNew: !item.itemId,
            currentQuantity: item.currentQuantity,
            minStockLimit: item.minStockLimit,
          }))
        );
      } else {
        setDraftItems([]);
      }

      form.setFieldsValue({
        purpose: initialPurpose || '',
      });

      setSelectedStockId(undefined);
      setStockQuantityInput(1);
      setNewCustomName('');
      setNewCustomUnit('DONA');
      setNewCustomQty(1);
    }
  }, [visible, initialDraftItems, initialPurpose, form]);

  // Selected Stock Item details
  const selectedStockItem = useMemo(() => {
    if (!selectedStockId) return null;
    return stocks.find((s) => s.itemId === selectedStockId || s.id === selectedStockId) || null;
  }, [selectedStockId, stocks]);

  // Add item from Mode: EXISTING
  const handleAddExistingStockItem = () => {
    if (!selectedStockItem) {
      Message.warning('Iltimos, ombordagi tovarlardan birini tanlang!');
      return;
    }
    if (stockQuantityInput <= 0) {
      Message.warning('Miqdor kamida 1 bo‘lishi kerak!');
      return;
    }

    // Check if already in draft list
    const existingIndex = draftItems.findIndex((d) => d.itemId === selectedStockItem.itemId);
    const isExceeded = Boolean(quotaInfo?.hasLimit && quotaInfo?.isExceeded);
    if (existingIndex >= 0) {
      setDraftItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + stockQuantityInput, isOverQuota: isExceeded }
            : item
        )
      );
      Message.info(`"${selectedStockItem.itemName}" miqdori oshirildi (+${stockQuantityInput})`);
    } else {
      const newRow: DraftItemRow = {
        key: `stock-${Date.now()}-${selectedStockItem.itemId}`,
        itemId: selectedStockItem.itemId,
        itemName: selectedStockItem.itemName,
        quantity: stockQuantityInput,
        unit: selectedStockItem.unit,
        isCustomNew: false,
        currentQuantity: selectedStockItem.quantity,
        minStockLimit: selectedStockItem.minStockLimit,
        categoryName: selectedStockItem.categoryName,
        isOverQuota: isExceeded,
      };
      setDraftItems((prev) => [...prev, newRow]);
      Message.success(`"${selectedStockItem.itemName}" talabnoma ro‘yxatiga qo‘shildi`);
    }

    setSelectedStockId(undefined);
    setStockQuantityInput(1);
  };

  // Add item from Mode: NEW (Omborda hali yo'q bo'lgan tovar)
  const handleAddNewCustomItem = () => {
    const trimmedName = newCustomName.trim();
    if (!trimmedName) {
      Message.warning('Iltimos, yangi mahsulot nomini to‘liq kiriting!');
      return;
    }
    if (newCustomQty <= 0) {
      Message.warning('Miqdor kamida 1 bo‘lishi kerak!');
      return;
    }

    // Check if duplicate name already exists
    const duplicateIndex = draftItems.findIndex(
      (d) => d.itemName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateIndex >= 0) {
      setDraftItems((prev) =>
        prev.map((item, idx) =>
          idx === duplicateIndex
            ? { ...item, quantity: item.quantity + newCustomQty }
            : item
        )
      );
      Message.info(`"${trimmedName}" miqdori oshirildi (+${newCustomQty})`);
    } else {
      const newRow: DraftItemRow = {
        key: `custom-${Date.now()}`,
        itemId: undefined,
        itemName: trimmedName,
        quantity: newCustomQty,
        unit: newCustomUnit,
        isCustomNew: true,
        currentQuantity: 0,
      };
      setDraftItems((prev) => [...prev, newRow]);
      Message.success(`Yangi mahsulot "${trimmedName}" xarid ro‘yxatiga qo‘shildi`);
    }

    setNewCustomName('');
    setNewCustomQty(1);
  };

  // Direct add from Warehouse Catalog Drawer
  const handleAddDirectFromCatalog = (stock: StockItem) => {
    const existingIndex = draftItems.findIndex((d) => d.itemId === stock.itemId);
    if (existingIndex >= 0) {
      setDraftItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
      Message.info(`"${stock.itemName}" miqdori 1 taga oshirildi`);
    } else {
      const newRow: DraftItemRow = {
        key: `catalog-${Date.now()}-${stock.itemId}`,
        itemId: stock.itemId,
        itemName: stock.itemName,
        quantity: 1,
        unit: stock.unit,
        isCustomNew: false,
        currentQuantity: stock.quantity,
        minStockLimit: stock.minStockLimit,
        categoryName: stock.categoryName,
      };
      setDraftItems((prev) => [...prev, newRow]);
      Message.success(`"${stock.itemName}" talabnomaga qo‘shildi`);
    }
  };

  // Remove item from draft
  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update item quantity
  const handleUpdateQuantity = (index: number, qty: number) => {
    setDraftItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: qty } : item))
    );
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    try {
      const values = await form.validate();
      if (draftItems.length === 0) {
        Message.error('Talabnoma yuborish uchun kamida 1 ta mahsulot qo‘shilishi shart!');
        return;
      }

      setIsSubmitting(true);
      await onSubmit({
        purpose: values.purpose,
        items: draftItems.map((d) => ({
          itemId: d.itemId,
          itemName: d.itemName,
          quantity: Number(d.quantity) || 1,
          unit: d.unit || 'DONA',
        })),
      });

      onClose();
    } catch (err: any) {
      if (err?.message) {
        Message.error(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Statistics
  const inStockCount = draftItems.filter((d) => !d.isCustomNew && (d.currentQuantity || 0) > 0).length;
  const outOfStockOrNewCount = draftItems.filter(
    (d) => d.isCustomNew || (d.currentQuantity || 0) <= 0
  ).length;

  // Filtered stocks for Drawer
  const filteredStocks = useMemo(() => {
    if (!catalogSearchText) return stocks;
    const term = catalogSearchText.toLowerCase();
    return stocks.filter(
      (s) =>
        s.itemName.toLowerCase().includes(term) ||
        s.categoryName?.toLowerCase().includes(term) ||
        s.unit?.toLowerCase().includes(term)
    );
  }, [stocks, catalogSearchText]);

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconArchive style={{ fontSize: 20, color: '#165DFF' }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>Yangi Talabnoma (Zayavka) Shakllantirish</span>
          </div>
        }
        visible={visible}
        style={{ width: 840, top: 24 }}
        onCancel={onClose}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              Jami tanlangan: <b>{draftItems.length}</b> ta pozitsiya (
              <span style={{ color: '#00b42a' }}>Ombordan: {inStockCount}</span>,{' '}
              <span style={{ color: '#165DFF' }}>Xarid zarur: {outOfStockOrNewCount}</span>)
            </div>
            <Space>
              <Button onClick={onClose}>Bekor qilish</Button>
              <Button
                type="primary"
                loading={isSubmitting}
                disabled={draftItems.length === 0}
                icon={<IconCheckCircle />}
                onClick={handleFinalSubmit}
              >
                Talabnomani Shakllantirish va Yuborish
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          {/* TOP SECTION: PURPOSE / EHTIYOJ ASOSI */}
          <FormItem
            label="Nima maqsadda zarurligi (Ehtiyoj Asosi)"
            field="purpose"
            rules={[{ required: true, message: 'Talabnoma maqsadi kiritilishi shart!' }]}
          >
            <Input.TextArea
              placeholder="Masalan: 2026-o‘quv yili oraliq va yakuniy nazoratlari, kafedra xodimlari va laboratoriya mashg‘ulotlari uchun zarur ashyolar"
              rows={2}
            />
          </FormItem>

          <Divider style={{ margin: '14px 0' }} />

          {/* ITEM ADDER PANEL */}
          <Card
            style={{
              background: 'var(--color-fill-2)',
              border: '1px solid var(--color-border-2)',
              borderRadius: 4,
              marginBottom: 16,
            }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Text bold style={{ fontSize: 13 }}>Mahsulot Kiritish Turi:</Text>
                <Radio.Group
                  type="button"
                  value={addMode}
                  onChange={(val) => setAddMode(val)}
                  size="small"
                >
                  <Radio value="EXISTING">
                    <IconArchive style={{ marginRight: 4 }} />
                    Ombordan tanlash (Mavjud zaxira)
                  </Radio>
                  <Radio value="NEW">
                    <IconPlus style={{ marginRight: 4 }} />
                    Yangi tovar (Omborda yo‘q buyum)
                  </Radio>
                </Radio.Group>
              </div>

              {/* QUICK WAREHOUSE EXPLORER BUTTON */}
              <Button
                size="small"
                type="outline"
                icon={<IconEye />}
                onClick={() => setIsCatalogDrawerVisible(true)}
              >
                Ombor Qoldiqlarini Ko‘rish ({stocks.length})
              </Button>
            </div>

            {/* MODE 1: EXISTING WAREHOUSE STOCK SELECTION */}
            {addMode === 'EXISTING' ? (
              <div>
                <Row gutter={12} align="center">
                  <Col span={14}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-2)' }}>
                      Ombordagi tovar katalogidan qidiring:
                    </div>
                    <Select
                      showSearch
                      allowClear
                      loading={isLoadingStocks}
                      value={selectedStockId}
                      placeholder="Tovarni nomi yoki kategoriyasi bo‘yicha qidiring..."
                      style={{ width: '100%' }}
                      onChange={(val) => setSelectedStockId(val)}
                      filterOption={(input, option: any) => {
                        const label = String(option?.children || '').toLowerCase();
                        return label.includes(input.toLowerCase());
                      }}
                    >
                      {stocks.map((s) => (
                        <Select.Option key={s.itemId} value={s.itemId}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              <b>{s.itemName}</b>
                              <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 8 }}>
                                ({s.categoryName})
                              </span>
                            </span>
                            <Tag
                              size="small"
                              color={s.quantity > (s.minStockLimit || 0) ? 'green' : s.quantity > 0 ? 'orange' : 'red'}
                            >
                              {s.quantity > 0 ? `Qoldiq: ${s.quantity} ${s.unit}` : 'Tugagan (0)'}
                            </Tag>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>

                  <Col span={6}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-2)' }}>
                      So‘ralayotgan Miqdor:
                    </div>
                    <InputNumber
                      min={1}
                      max={10000}
                      value={stockQuantityInput}
                      onChange={(val) => setStockQuantityInput(val || 1)}
                      suffix={selectedStockItem?.unit || 'birlik'}
                      style={{ width: '100%' }}
                    />
                  </Col>

                  <Col span={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ height: 20 }} />
                    <Button
                      type="primary"
                      icon={<IconPlus />}
                      onClick={handleAddExistingStockItem}
                      disabled={!selectedStockItem}
                      style={{ width: '100%' }}
                    >
                      Qo‘shish
                    </Button>
                  </Col>
                </Row>

                {/* REAL-TIME SELECTED STOCK DETAIL BADGE */}
                {selectedStockItem && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--color-bg-2)',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                      }}
                    >
                      <Space size="large">
                        <span>
                          Kategoriya: <b>{selectedStockItem.categoryName}</b>
                        </span>
                        <span>
                          Hozirgi Ombor Qoldig‘i:{' '}
                          <b style={{ color: selectedStockItem.quantity > 0 ? '#00b42a' : '#f53f3f', fontSize: 13 }}>
                            {selectedStockItem.quantity} {selectedStockItem.unit}
                          </b>
                        </span>
                        <span>
                          Minimal Limit: <b>{selectedStockItem.minStockLimit} {selectedStockItem.unit}</b>
                        </span>
                      </Space>
                      {selectedStockItem.quantity <= 0 ? (
                        <Tag color="red">DIQQAT: Omborda bu tovardan qolmagan, yangi xarid talab etiladi!</Tag>
                      ) : (
                        <Tag color="green">Ombordan zudlik bilan berilishi mumkin</Tag>
                      )}
                    </div>

                    {/* KAFEDRA OYLIK KVOTA STATUSI VA OGOHLANTIRISHI (Rule 5.4) */}
                    {quotaInfo?.hasLimit && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Tag color="purple" style={{ borderRadius: 0 }}>
                            Kafedra oylik kvotasi: {quotaInfo.monthlyLimit} {selectedStockItem.unit}
                          </Tag>
                          <Tag color="cyan" style={{ borderRadius: 0 }}>
                            Ishlatilgan: {quotaInfo.usedQuantity} {selectedStockItem.unit}
                          </Tag>
                          <Tag
                            color={quotaInfo.remaining && quotaInfo.remaining > 0 ? 'green' : 'red'}
                            style={{ borderRadius: 0 }}
                          >
                            Qoldiq kvota: {quotaInfo.remaining ?? 0} {selectedStockItem.unit}
                          </Tag>
                        </div>

                        {quotaInfo.isExceeded && (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginTop: 8, borderRadius: 0 }}
                            title="Kafedra Oylik Kvotasi Oshmoqda (Rule 5.4)"
                            content={
                              <span>
                                Siz so‘rayotgan miqdor (<b>{stockQuantityInput} {selectedStockItem.unit}</b>) kafedrangizning joriy oylik qoldiq kvotasidan (<b>{quotaInfo.remaining ?? 0} {selectedStockItem.unit}</b>) oshib ketmoqda.
                                Davlat OTM qoidalariga binoan, mazkur talabnoma faqat <b>Universitet Rektoratining maxsus ruxsati (APPROVED_BY_RECTOR)</b> orqali qanoatlantirilishi mumkin.
                              </span>
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* MODE 2: NEW ITEM ENTRY (NOT YET IN WAREHOUSE) */
              <div>
                <Alert
                  type="info"
                  style={{ marginBottom: 10 }}
                  content="Universitet omborida hali ro‘yxatga olinmagan maxsus jihoz, asbob yoki sarf ashyolari xaridini so‘rash uchun quyidagi maydonlarni to‘ldiring. Tasdiqlangach, xarid qilinadi va ombor kirimiga olinadi."
                />
                <Row gutter={12} align="center">
                  <Col span={11}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-2)' }}>
                      Yangi Mahsulot Nomi va Rusumi:
                    </div>
                    <Input
                      placeholder="Masalan: Interaktiv doska 75 dyuym, Sensorli panel..."
                      value={newCustomName}
                      onChange={(val) => setNewCustomName(val)}
                      onPressEnter={handleAddNewCustomItem}
                    />
                  </Col>

                  <Col span={5}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-2)' }}>
                      O‘lchov Birligi:
                    </div>
                    <Select
                      value={newCustomUnit}
                      onChange={(val) => setNewCustomUnit(val)}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="DONA">Dona</Select.Option>
                      <Select.Option value="PACHKA">Pachka</Select.Option>
                      <Select.Option value="TO_PLAM">To‘plam</Select.Option>
                      <Select.Option value="METR">Metr</Select.Option>
                      <Select.Option value="KG">Kg</Select.Option>
                      <Select.Option value="LITR">Litr</Select.Option>
                      <Select.Option value="QUTI">Quti</Select.Option>
                      <Select.Option value="KOMPLEKT">Komplekt</Select.Option>
                    </Select>
                  </Col>

                  <Col span={4}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-2)' }}>
                      Kerakli Miqdor:
                    </div>
                    <InputNumber
                      min={1}
                      max={10000}
                      value={newCustomQty}
                      onChange={(val) => setNewCustomQty(val || 1)}
                      style={{ width: '100%' }}
                    />
                  </Col>

                  <Col span={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ height: 20 }} />
                    <Button
                      type="primary"
                      status="success"
                      icon={<IconPlus />}
                      onClick={handleAddNewCustomItem}
                      style={{ width: '100%' }}
                    >
                      Qo‘shish
                    </Button>
                  </Col>
                </Row>
              </div>
            )}
          </Card>

          {/* DRAFT ITEMS TABLE (TALAB QILINAYOTGAN TAVARLAR RO‘YXATI) */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text bold style={{ fontSize: 13 }}>
                Talabnoma Tarkibi ({draftItems.length} ta mahsulot):
              </Text>
              {draftItems.length > 0 && (
                <Button
                  size="mini"
                  type="text"
                  status="danger"
                  onClick={() => setDraftItems([])}
                >
                  Ro‘yxatni tozalash
                </Button>
              )}
            </div>

            {draftItems.length === 0 ? (
              <Card style={{ textAlign: 'center', background: 'var(--color-fill-1)' }}>
                <Empty
                  icon={<IconArchive style={{ fontSize: 32, color: 'var(--color-text-4)' }} />}
                  description="Talabnoma ro‘yxati hozircha bo‘sh. Yuqoridagi formadan ombordagi tovarlardan tanlang yoki yangi tovar qo‘shing."
                />
              </Card>
            ) : (
              <Table
                rowKey="key"
                data={draftItems}
                pagination={false}
                size="small"
                border={{ cell: true }}
                columns={[
                  {
                    title: '#',
                    width: 50,
                    render: (_, __, idx) => idx + 1,
                  },
                  {
                    title: 'Mahsulot Nomi va Ta’minot Turi',
                    render: (_, r) => (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.itemName}</div>
                        <div style={{ marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {r.isCustomNew ? (
                            <Tag size="small" color="arcoblue">
                              Yangi xarid (Omborda mavjud emas)
                            </Tag>
                          ) : (r.currentQuantity || 0) > 0 ? (
                            <Tag size="small" color="green">
                              Omborda mavjud: {r.currentQuantity} {r.unit}
                            </Tag>
                          ) : (
                            <Tag size="small" color="red">
                              Omborda qolmagan (0 {r.unit}) — Xarid zarur
                            </Tag>
                          )}
                          {r.isOverQuota && (
                            <Tag size="small" color="red">
                              ⚠️ Kvotadan oshgan (Rektorat ruxsati zarur)
                            </Tag>
                          )}
                          {r.categoryName && (
                            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                              [{r.categoryName}]
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Birlik',
                    dataIndex: 'unit',
                    width: 90,
                    render: (u) => <Tag size="small">{u}</Tag>,
                  },
                  {
                    title: 'So‘ralayotgan Miqdor',
                    width: 150,
                    render: (_, r, idx) => (
                      <InputNumber
                        min={1}
                        max={10000}
                        value={r.quantity}
                        onChange={(val) => handleUpdateQuantity(idx, val || 1)}
                        style={{ width: '100%' }}
                        size="small"
                      />
                    ),
                  },
                  {
                    title: 'O‘chirish',
                    width: 70,
                    align: 'center',
                    render: (_, __, idx) => (
                      <Button
                        size="mini"
                        type="text"
                        status="danger"
                        icon={<IconDelete />}
                        onClick={() => handleRemoveDraftItem(idx)}
                      />
                    ),
                  },
                ]}
              />
            )}

            {draftItems.some((d) => d.isOverQuota) && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12, borderRadius: 0 }}
                title="Kafedra Oylik Kvotasidan Oshgan Talabnoma (Rule 5.4)"
                content="Talabnomadagi tovarlar kafedraning oylik limit kvotasidan oshganligi sababli, ariza tasdiqlash uchun to‘g‘ridan-to‘g‘ri Universitet Rektorati maxsus nazoratiga yo‘naltiriladi."
              />
            )}
          </div>
        </Form>
      </Modal>

      {/* DRAWER: LIVE WAREHOUSE STOCK EXPLORER */}
      <Drawer
        width={680}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconArchive style={{ color: '#165DFF' }} />
            <span>Universitet Ombordagi Real Qoldiqlar Ma’lumotnomasi</span>
          </div>
        }
        visible={isCatalogDrawerVisible}
        onCancel={() => setIsCatalogDrawerVisible(false)}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" onClick={() => setIsCatalogDrawerVisible(false)}>
              Yopish
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Input
            prefix={<IconSearch />}
            placeholder="Ombordagi tovar nomi yoki kategoriyasini qidiring..."
            value={catalogSearchText}
            onChange={(val) => setCatalogSearchText(val)}
            allowClear
          />
        </div>

        <Table
          rowKey="itemId"
          data={filteredStocks}
          loading={isLoadingStocks}
          pagination={{ pageSize: 12, size: 'small', showTotal: true }}
          size="small"
          border={{ cell: true }}
          columns={[
            {
              title: 'Mahsulot',
              dataIndex: 'itemName',
              render: (name, record) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{record.categoryName}</div>
                </div>
              ),
            },
            {
              title: 'Qoldiq Miqdor',
              width: 140,
              render: (_, record) => {
                const isOutOfStock = record.quantity <= 0;
                const isLow = record.quantity <= record.minStockLimit;
                return (
                  <div>
                    <Badge
                      status={isOutOfStock ? 'error' : isLow ? 'warning' : 'success'}
                      text={`${record.quantity} ${record.unit}`}
                    />
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                      Limit: {record.minStockLimit} {record.unit}
                    </div>
                  </div>
                );
              },
            },
            {
              title: 'Holati',
              width: 110,
              render: (_, record) => (
                <Tag
                  size="small"
                  color={
                    record.quantity > record.minStockLimit
                      ? 'green'
                      : record.quantity > 0
                      ? 'orange'
                      : 'red'
                  }
                >
                  {record.quantity > record.minStockLimit
                    ? 'Yetarli'
                    : record.quantity > 0
                    ? 'Kam qolgan'
                    : 'Omborda yo‘q'}
                </Tag>
              ),
            },
            {
              title: 'Amal',
              width: 90,
              align: 'center',
              render: (_, record) => (
                <Button
                  size="mini"
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => handleAddDirectFromCatalog(record)}
                >
                  Olish
                </Button>
              ),
            },
          ]}
        />
      </Drawer>
    </>
  );
};
