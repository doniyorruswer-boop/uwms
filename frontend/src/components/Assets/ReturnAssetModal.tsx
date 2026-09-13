import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, Typography } from '@arco-design/web-react';
import { IconUndo } from '@arco-design/web-react/icon';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import { useWarehousesQuery } from '../../hooks/useWarehouseQuery';
import type { ItemInstance } from '../../types';

const FormItem = Form.Item;
const { TextArea } = Input;
const { Text } = Typography;

interface ReturnAssetModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAsset?: ItemInstance | null;
}

export const ReturnAssetModal: React.FC<ReturnAssetModalProps> = ({
  visible,
  onClose,
  selectedAsset,
}) => {
  const [form] = Form.useForm();
  const { returnAsset, isReturning, assets } = useAssetsQuery();
  const { warehouses, isLoading: loadingWh } = useWarehousesQuery();

  const handleOk = async () => {
    try {
      const values = await form.validate();
      await returnAsset({
        assetId: selectedAsset ? selectedAsset.id : values.assetId,
        warehouseId: values.warehouseId,
        reason: values.reason,
        note: values.note,
      });
      form.resetFields();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  // Only assets that are in use (assigned to a room)
  const availableAssets = assets.filter(
    (a) => a.status === 'IN_USE' || (a.status !== 'WRITTEN_OFF' && a.roomId),
  );

  return (
    <Modal
      title={
        <Space>
          <IconUndo style={{ color: '#165DFF' }} />
          <span>Kafedradan Omborga Qaytarish (Return Workflow)</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 620, borderRadius: 0 }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Bekor Qilish
          </Button>
          <Button
            type="primary"
            loading={isReturning}
            onClick={handleOk}
            style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
          >
            Qaytarish Talabnomasini Yuborish
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Kafedra yoki laboratoriyada ortiqcha qolgan yoki foydalanilmayotgan ashyoni markaziy omborga
          qaytarish uchun ariza yuboriladi. Bosh omborchi qabul qilgach, ashyo xonadan yechilib, ombor balansiga o‘tadi.
        </Text>
      </div>

      <Form form={form} layout="vertical">
        {selectedAsset ? (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-fill-2)',
              marginBottom: 16,
              border: '1px solid var(--color-border-2)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedAsset.itemName}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
              Inventar №: <b>{selectedAsset.inventoryNumber}</b> &nbsp;|&nbsp; Joriy joylashuv: <b>{selectedAsset.roomName}</b> &nbsp;|&nbsp; Mas’ul: <b>{selectedAsset.responsibleUserName}</b>
            </div>
          </div>
        ) : (
          <FormItem
            label="Qaytarilayotgan Asosiy Vosita"
            field="assetId"
            rules={[{ required: true, message: 'Asosiy vositani tanlang!' }]}
          >
            <Select
              placeholder="Asosiy vositani tanlang..."
              showSearch
              filterOption={(inputValue, option) =>
                String(option.props.children || '').toLowerCase().includes(inputValue.toLowerCase())
              }
              style={{ borderRadius: 0 }}
            >
              {availableAssets.map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {a.inventoryNumber} — {a.itemName} ({a.roomName})
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        )}

        <FormItem
          label="Qabul Qiluvchi Omborxona"
          field="warehouseId"
          initialValue={warehouses[0]?.id}
          rules={[{ required: true, message: 'Omborxonani tanlang!' }]}
        >
          <Select
            placeholder="Omborxonani tanlang..."
            loading={loadingWh}
            style={{ borderRadius: 0 }}
          >
            {warehouses.map((w: any) => (
              <Select.Option key={w.id} value={w.id}>
                {w.name} {w.isMain ? '(Asosiy Markaziy Ombor)' : ''}
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        <FormItem
          label="Qaytarish Sababi"
          field="reason"
          rules={[{ required: true, message: 'Qaytarish sababini kiriting!' }]}
        >
          <Input
            placeholder="Masalan: Kafedrada ortiqcha, laboratoriya optimallashtirildi"
            style={{ borderRadius: 0 }}
          />
        </FormItem>

        <FormItem label="Qo‘shimcha Izoh yoki Jihoz Holati" field="note">
          <TextArea
            rows={3}
            placeholder="Jihozning texnik holati, butunligi va topshirish shartlari bo‘yicha izoh..."
            style={{ borderRadius: 0 }}
          />
        </FormItem>
      </Form>
    </Modal>
  );
};
