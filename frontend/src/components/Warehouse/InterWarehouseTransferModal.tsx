import React, { useState } from 'react';
import { Modal, Form, Select, InputNumber, Input, Button, Space, Typography, Alert } from '@arco-design/web-react';
import { IconSwap } from '@arco-design/web-react/icon';
import { useWarehouseQuery, useWarehousesQuery } from '../../hooks/useWarehouseQuery';

const FormItem = Form.Item;
const { Text } = Typography;

interface InterWarehouseTransferModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InterWarehouseTransferModal: React.FC<InterWarehouseTransferModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm();
  const { stocks, transferStock, isTransferring } = useWarehouseQuery();
  const { warehouses, isLoading: loadingWh } = useWarehousesQuery();

  const [fromWhId, setFromWhId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Filter items available in fromWhId with quantity > 0
  const availableItems = fromWhId
    ? stocks.filter((s) => s.warehouseId === fromWhId && s.quantity > 0)
    : [];

  const selectedStock = availableItems.find((s) => s.itemId === selectedItemId);

  const handleOk = async () => {
    try {
      const values = await form.validate();
      await transferStock({
        fromWarehouseId: values.fromWarehouseId,
        toWarehouseId: values.toWarehouseId,
        itemId: values.itemId,
        quantity: values.quantity,
        note: values.note,
      });
      form.resetFields();
      setFromWhId(null);
      setSelectedItemId(null);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <IconSwap style={{ color: '#FF7D00' }} />
          <span>Omborlararo Ichki Ko‘chirish (Inter-Warehouse Transfer)</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 640, borderRadius: 0 }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Bekor Qilish
          </Button>
          <Button
            type="primary"
            loading={isTransferring}
            onClick={handleOk}
            style={{ borderRadius: 0, backgroundColor: '#FF7D00' }}
          >
            Ko‘chirishni Tasdiqlash
          </Button>
        </Space>
      }
    >
      <Alert
        type="warning"
        style={{ marginBottom: 16, borderRadius: 0 }}
        content="Markaziy ombordan filial yoki fakultet omboriga sarf tovarlarini ko‘chirish. Tranzaksiyada chiqaruvchi ombor qoldig‘i kamayadi va qabul qiluvchi ombor balansi avtomatik oshadi."
      />

      <Form form={form} layout="vertical">
        <FormItem
          label="Chiqaruvchi Omborxona (Jo‘natuvchi)"
          field="fromWarehouseId"
          rules={[{ required: true, message: 'Jo‘natuvchi omborni tanlang!' }]}
        >
          <Select
            placeholder="Omborxonani tanlang..."
            loading={loadingWh}
            onChange={(val) => {
              setFromWhId(val);
              form.setFieldsValue({ itemId: undefined, quantity: 1 });
              setSelectedItemId(null);
            }}
            style={{ borderRadius: 0 }}
          >
            {warehouses.map((w: any) => (
              <Select.Option key={w.id} value={w.id}>
                {w.name} {w.isMain ? '(Asosiy Ombor)' : ''}
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        <FormItem
          label="Ko‘chirilayotgan Sarf Mahsuloti"
          field="itemId"
          rules={[{ required: true, message: 'Mahsulotni tanlang!' }]}
        >
          <Select
            placeholder={fromWhId ? 'Mahsulotni tanlang...' : 'Avval jo‘natuvchi omborni tanlang'}
            disabled={!fromWhId}
            showSearch
            onChange={(val) => setSelectedItemId(val)}
            style={{ borderRadius: 0 }}
          >
            {availableItems.map((s) => (
              <Select.Option key={s.itemId} value={s.itemId}>
                {s.itemName} — Mavjud: {s.quantity} {s.unit} ({s.fundingSource})
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        {selectedStock && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FFF7E8',
              border: '1px solid #FFE58F',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 13 }}>
              Ushbu ombordagi mavjud qoldiq: <b>{selectedStock.quantity} {selectedStock.unit}</b> &nbsp;|&nbsp; Moliyalashtirish: <b>{selectedStock.fundingSource}</b>
            </Text>
          </div>
        )}

        <FormItem
          label="Qabul Qiluvchi Omborxona"
          field="toWarehouseId"
          rules={[{ required: true, message: 'Qabul qiluvchi omborni tanlang!' }]}
        >
          <Select
            placeholder="Qabul qiluvchi omborni tanlang..."
            loading={loadingWh}
            style={{ borderRadius: 0 }}
          >
            {warehouses
              .filter((w: any) => w.id !== fromWhId)
              .map((w: any) => (
                <Select.Option key={w.id} value={w.id}>
                  {w.name} {w.isMain ? '(Asosiy Ombor)' : ''}
                </Select.Option>
              ))}
          </Select>
        </FormItem>

        <FormItem
          label="Ko‘chirilayotgan Miqdor"
          field="quantity"
          initialValue={1}
          rules={[
            { required: true, message: 'Miqdorni kiriting!' },
            {
              validator: (val, cb) => {
                if (selectedStock && val > selectedStock.quantity) {
                  return cb(`Mavjud qoldiqdan (${selectedStock.quantity}) ortiqcha ko‘chirib bo‘lmaydi!`);
                }
                return cb();
              },
            },
          ]}
        >
          <InputNumber min={1} max={selectedStock ? selectedStock.quantity : 10000} style={{ width: '100%', borderRadius: 0 }} />
        </FormItem>

        <FormItem label="Ko‘chirish Asosi / Izoh" field="note">
          <Input placeholder="Masalan: Filial ehtiyojlari uchun sarf materiallari taqsimoti" style={{ borderRadius: 0 }} />
        </FormItem>
      </Form>
    </Modal>
  );
};
