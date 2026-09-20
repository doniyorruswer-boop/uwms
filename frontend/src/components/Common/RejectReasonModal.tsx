import React, { useEffect } from 'react';
import { Modal, Form, Input, Alert, Button, Space } from '@arco-design/web-react';
import { IconCloseCircle, IconExclamationCircle } from '@arco-design/web-react/icon';

export interface RejectReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title?: string;
  itemIdentifier?: string;
  loading?: boolean;
}

const FormItem = Form.Item;

/**
 * UWMS Standart Rad Etish Sababi Modali (Rule 4.1 & Rule 5.4).
 * Statik avtomatik rad etish xabarlarining oldini olish va davlat standarti
 * bo'yicha har bir rad etish qarorini asosli izoh bilan audit jurnaliga muhrlash uchun.
 */
export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title = 'Talabnomani Rad Etish',
  itemIdentifier,
  loading = false,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.resetFields();
    }
  }, [visible, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await onConfirm(values.reason.trim());
      form.resetFields();
    } catch {
      // Form validation error
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f53f3f' }}>
          <IconCloseCircle style={{ fontSize: 18 }} />
          <span>{itemIdentifier ? `${title} (${itemIdentifier})` : title}</span>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 540 }}
      footer={
        <Space>
          <Button onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            type="primary"
            status="danger"
            loading={loading}
            icon={<IconExclamationCircle />}
            onClick={handleSubmit}
          >
            Rad Etishni Tasdiqlash
          </Button>
        </Space>
      }
    >
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 16, borderRadius: 0 }}
        title="Qat’iy Mas’uliyat Ogohlantirishi"
        content="Talabnomani rad etish qaytarib bo‘lmas huquqiy va moliyaviy harakat hisoblanadi. Rad etish sababi davlat audit jurnalida (Audit Log) muhrlanadi hamda talabgorga rasmiy asos sifatida ko‘rsatiladi. Iltimos, aniq va asosli sababni kiriting."
      />

      <Form form={form} layout="vertical">
        <FormItem
          label="Rad Etish Sababi va Huquqiy Asosi"
          field="reason"
          rules={[
            { required: true, message: 'Rad etish sababini kiritish majburiy!' },
            { min: 5, message: 'Sabab kamida 5 ta belgidan iborat bo‘lishi kerak!' },
          ]}
        >
          <Input.TextArea
            placeholder="Masalan: Kafedraning oylik limit kvotasi to‘lganligi yoki smetada ushbu modda bo‘yicha mablag‘ yetarli emasligi sababli..."
            rows={3}
            maxLength={500}
            showWordLimit
            style={{ borderRadius: 0 }}
            autoFocus
          />
        </FormItem>
      </Form>
    </Modal>
  );
};

export default RejectReasonModal;
