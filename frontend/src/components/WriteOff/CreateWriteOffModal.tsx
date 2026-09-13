import React from 'react';
import { Modal, Form, Select, Input, Button, Space, Typography, Alert } from '@arco-design/web-react';
import { IconDelete } from '@arco-design/web-react/icon';
import { useWriteOffQuery } from '../../hooks/useWriteOffQuery';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import type { ItemInstance } from '../../types';

const FormItem = Form.Item;
const { TextArea } = Input;
const { Text } = Typography;

interface CreateWriteOffModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAsset?: ItemInstance | null;
}

export const CreateWriteOffModal: React.FC<CreateWriteOffModalProps> = ({
  visible,
  onClose,
  selectedAsset,
}) => {
  const [form] = Form.useForm();
  const { createWriteOff, isCreating } = useWriteOffQuery();
  const { assets } = useAssetsQuery();

  // Assets that can be written off (not already written off)
  const eligibleAssets = assets.filter((a) => a.status !== 'WRITTEN_OFF');

  const handleOk = async () => {
    try {
      const values = await form.validate();
      await createWriteOff({
        assetId: selectedAsset ? selectedAsset.id : values.assetId,
        reason: values.reason,
        technicalConclusion: values.technicalConclusion,
      });
      form.resetFields();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <IconDelete style={{ color: '#F53F3F' }} />
          <span>Hisobdan Chiqarish Jarayonini Boshlash (OS-4 Spisanie)</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 660, borderRadius: 0 }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Bekor Qilish
          </Button>
          <Button
            type="primary"
            loading={isCreating}
            onClick={handleOk}
            style={{ borderRadius: 0, backgroundColor: '#F53F3F' }}
          >
            Komissiyaga Yuborish
          </Button>
        </Space>
      }
    >
      <Alert
        type="error"
        style={{ marginBottom: 16, borderRadius: 0 }}
        content="Universitet me’yorlariga ko‘ra, mulkni hisobdan chiqarish uchun ko‘p a’zoli davlat komissiyasi (Rektorat, Bosh buxgalter, Bosh mexanik, Yurist) tasdiqlashi shart. Barcha a’zolar ovoz berib tasdiqlagach, rasmiy OS-4 dalolatnomasi shakllanadi va aktiv hisobdan o‘chiriladi."
      />

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
              Inventar №: <b>{selectedAsset.inventoryNumber}</b> &nbsp;|&nbsp; Xona: <b>{selectedAsset.roomName}</b> &nbsp;|&nbsp; Boshlang‘ich narxi: <b>{(selectedAsset.purchasePrice || 0).toLocaleString()} so‘m</b>
            </div>
          </div>
        ) : (
          <FormItem
            label="Hisobdan Chiqarilayotgan Asosiy Vosita"
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
              {eligibleAssets.map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {a.inventoryNumber} — {a.itemName} ({a.roomName})
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        )}

        <FormItem
          label="Hisobdan Chiqarish Sababi"
          field="reason"
          rules={[{ required: true, message: 'Sababni kiriting!' }]}
          initialValue="Jismoniy va ma’nan to‘liq eskirgan, ta’mirlash iqtisodiy jihatdan samarasiz"
        >
          <TextArea rows={2} style={{ borderRadius: 0 }} />
        </FormItem>

        <FormItem
          label="Texnik Ekspertiza Xulosasi"
          field="technicalConclusion"
          rules={[{ required: true, message: 'Texnik ekspertiza xulosasini kiriting!' }]}
          initialValue="OTM mutaxassislari ko‘rigi natijasida mikrosxemalar va asosiy bloklar qayta tiklab bo‘lmas darajada kuyganligi tasdiqlandi. Tiklash imkoni yo‘q."
        >
          <TextArea rows={3} style={{ borderRadius: 0 }} />
        </FormItem>

        <div style={{ padding: '10px 14px', backgroundColor: '#F2F3F5', fontSize: 12, color: '#4E5969' }}>
          ℹ️ Tizim avtomatik ravishda <b>Rektorat vakili, Bosh buxgalter, Bosh mexanik va Yurist</b> a’zoligidagi komissiyani biriktiradi va har bir a’zoning kabinetiga elektron ovoz berish vazifasini yuboradi.
        </div>
      </Form>
    </Modal>
  );
};
