import React from 'react';
import { Modal, Form, Select, Input, InputNumber, Button, Space, Typography, Alert } from '@arco-design/web-react';
import { IconTool } from '@arco-design/web-react/icon';
import { useRepairsQuery } from '../../hooks/useRepairsQuery';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import type { ItemInstance } from '../../types';

const FormItem = Form.Item;
const { TextArea } = Input;
const { Text } = Typography;

interface CreateRepairModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAsset?: ItemInstance | null;
}

export const CreateRepairModal: React.FC<CreateRepairModalProps> = ({
  visible,
  onClose,
  selectedAsset,
}) => {
  const [form] = Form.useForm();
  const { createRepair, isCreating } = useRepairsQuery();
  const { assets } = useAssetsQuery();

  // Assets that can be sent to repair (not already written off or in repair)
  const eligibleAssets = assets.filter(
    (a) => a.status !== 'WRITTEN_OFF' && a.status !== 'IN_REPAIR',
  );

  const handleOk = async () => {
    try {
      const values = await form.validate();
      await createRepair({
        assetId: selectedAsset ? selectedAsset.id : values.assetId,
        issueDescription: String(values.issueDescription || '').trim(),
        serviceProvider: values.serviceProvider ? String(values.serviceProvider).trim() : undefined,
        cost: values.cost !== undefined && values.cost !== null && values.cost !== '' ? Number(values.cost) : undefined,
        notes: values.notes ? String(values.notes).trim() : undefined,
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
          <IconTool style={{ color: '#F7BA1E' }} />
          <span>Ta’mirlash Talabnomasi Yaratish (Repair Order)</span>
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
            loading={isCreating}
            onClick={handleOk}
            style={{ borderRadius: 0, backgroundColor: '#F7BA1E', color: '#000' }}
          >
            Ta’mirga Yuborish
          </Button>
        </Space>
      }
    >
      <Alert
        type="warning"
        style={{ marginBottom: 16, borderRadius: 0 }}
        content="Ishdan chiqqan yoki nosozlik aniqlangan uskunani ta’mirlashga yuborish. Talabnoma ochilgach uskuna holati avtomatik ravishda 'TA‘MIRDA' (IN_REPAIR) holatiga o‘tadi."
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
              Inventar №: <b>{selectedAsset.inventoryNumber}</b> &nbsp;|&nbsp; Xona: <b>{selectedAsset.roomName}</b> &nbsp;|&nbsp; Mas’ul: <b>{selectedAsset.responsibleUserName}</b>
            </div>
          </div>
        ) : (
          <FormItem
            label="Nosoz Asosiy Vosita"
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
          label="Nosozlik Tavsifi va Sababi"
          field="issueDescription"
          rules={[{ required: true, message: 'Nosozlik tavsifini kiriting!' }]}
        >
          <TextArea
            rows={3}
            placeholder="Masalan: Monitor ekrani yoqilmayapti, blok pitaniya yonib ketgan bo‘lishi mumkin..."
            style={{ borderRadius: 0 }}
          />
        </FormItem>

        <FormItem
          label="Servis Markazi / Ustaxona Nomi"
          field="serviceProvider"
          initialValue="Universitet ichki ustaxonasi"
        >
          <Input placeholder="Masalan: TexnoServis MCHJ yoki OTM ichki ustaxonasi" style={{ borderRadius: 0 }} />
        </FormItem>

        <FormItem label="Taxminiy Ta’mirlash Xarajati (so‘m)" field="cost">
          <InputNumber min={0} placeholder="0" style={{ width: '100%', borderRadius: 0 }} />
        </FormItem>

        <FormItem label="Qo‘shimcha Izoh" field="notes">
          <Input placeholder="Ehtiyot qismlar, topshiruvchi xodim talablari..." style={{ borderRadius: 0 }} />
        </FormItem>
      </Form>
    </Modal>
  );
};
