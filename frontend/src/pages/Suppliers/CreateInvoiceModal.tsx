import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
} from '@arco-design/web-react';
import { IconBulb } from '@arco-design/web-react/icon';
import { SupplierItem, NextCodesData } from '../../hooks/useSuppliersQuery';

const FormItem = Form.Item;

interface CreateInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  loading: boolean;
  supplier: SupplierItem | null;
  nextCodes?: NextCodesData;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading,
  supplier,
  nextCodes,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.resetFields();
      if (nextCodes) {
        form.setFieldsValue({
          invoiceNumber: nextCodes.nextInvoiceNumber,
        });
      }
    }
  }, [visible, nextCodes, form]);

  const handleOk = async () => {
    try {
      const values = await form.validate();
      await onSubmit(values);
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title={
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          Yangi Hisob-Faktura Biriktirish
        </div>
      }
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText="Fakturani Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 540, borderRadius: 0 }}
      autoFocus={false}
      focusLock={true}
    >
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: 'var(--color-fill-2)',
          marginBottom: 16,
          borderLeft: '3px solid #165DFF',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {supplier?.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
          Shartnoma: <b>{supplier?.contractNumber || 'Mavjud emas'}</b> • STIR: {supplier?.inn || '—'}
        </div>
      </div>

      <Form form={form} layout="vertical">
        <FormItem
          label="Hisob-Faktura Raqami"
          field="invoiceNumber"
          rules={[{ required: true, message: 'Faktura raqami kiritilishi shart!' }]}
          extra={
            nextCodes && (
              <Button
                size="mini"
                type="text"
                icon={<IconBulb />}
                onClick={() =>
                  form.setFieldsValue({ invoiceNumber: nextCodes.nextInvoiceNumber })
                }
                style={{ padding: 0, marginTop: 4, height: 'auto' }}
              >
                Tavsiya etilgan kodni qo‘llash ({nextCodes.nextInvoiceNumber})
              </Button>
            )
          }
        >
          <Input placeholder="Masalan: FAK-2026-0089" style={{ borderRadius: 0 }} />
        </FormItem>

        <FormItem label="Faktura Sanasi" field="invoiceDate">
          <DatePicker style={{ width: '100%', borderRadius: 0 }} />
        </FormItem>

        <FormItem label="Umumiy Summa (so‘mda)" field="totalAmount">
          <InputNumber
            style={{ width: '100%', borderRadius: 0 }}
            placeholder="Masalan: 45000000"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            parser={(value) => value.replace(/\s/g, '')}
            min={0}
          />
        </FormItem>

        <FormItem label="Izoh yoki Partiya Tavsifi" field="notes">
          <Input.TextArea
            placeholder="Faktura bo‘yicha keltirilgan mahsulotlar va to‘lov shartlari"
            rows={2}
            style={{ borderRadius: 0 }}
          />
        </FormItem>
      </Form>
    </Modal>
  );
};
