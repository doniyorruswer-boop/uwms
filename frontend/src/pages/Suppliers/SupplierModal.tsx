import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Button,
  Grid,
  Space,
} from '@arco-design/web-react';
import { IconBulb } from '@arco-design/web-react/icon';
import { SupplierItem, NextCodesData } from '../../hooks/useSuppliersQuery';

const { Row, Col } = Grid;
const FormItem = Form.Item;

interface SupplierModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  loading: boolean;
  initialValues?: SupplierItem | null;
  nextCodes?: NextCodesData;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading,
  initialValues,
  nextCodes,
}) => {
  const [form] = Form.useForm();
  const isEdit = !!initialValues;

  useEffect(() => {
    if (visible) {
      if (initialValues) {
        form.setFieldsValue({
          name: initialValues.name,
          inn: initialValues.inn,
          contractNumber: initialValues.contractNumber,
          contractDate: initialValues.contractDate
            ? initialValues.contractDate.split('T')[0]
            : undefined,
          contactPerson: initialValues.contactPerson,
          phone: initialValues.phone,
          email: initialValues.email,
          notes: initialValues.notes,
        });
      } else {
        form.resetFields();
        if (nextCodes) {
          form.setFieldsValue({
            inn: nextCodes.nextInn,
            contractNumber: nextCodes.nextContractNumber,
          });
        }
      }
    }
  }, [visible, initialValues, nextCodes, form]);

  const handleOk = async () => {
    try {
      const values = await form.validate();
      await onSubmit(values);
      onClose();
    } catch {
      // Form validation error
    }
  };

  const handleFillCodes = () => {
    if (nextCodes) {
      form.setFieldsValue({
        inn: nextCodes.nextInn,
        contractNumber: nextCodes.nextContractNumber,
      });
    }
  };

  return (
    <Modal
      title={
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          {isEdit ? 'Ta’minotchi va Shartnomani Tahrirlash' : 'Yangi Ta’minotchi (Kontragent) Qo‘shish'}
        </div>
      }
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText={isEdit ? 'Saqlash' : 'Qo‘shish'}
      cancelText="Bekor qilish"
      style={{ width: 680, borderRadius: 0 }}
      autoFocus={false}
      focusLock={true}
    >
      <Form form={form} layout="vertical">
        {!isEdit && nextCodes && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              backgroundColor: 'var(--color-fill-2)',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
              Standart formatdagi unikal kodlar avtomatik tavsiya etildi
            </span>
            <Button
              size="mini"
              type="outline"
              icon={<IconBulb />}
              onClick={handleFillCodes}
              style={{ borderRadius: 0 }}
            >
              Kodlarni qayta to‘ldirish
            </Button>
          </div>
        )}

        <FormItem
          label="Korxona / Ta’minotchi Nomi"
          field="name"
          rules={[{ required: true, message: 'Korxona nomini kiritish majburiy!' }]}
        >
          <Input placeholder='Masalan: OOO "Texno-Ta’minot Fayz"' style={{ borderRadius: 0 }} />
        </FormItem>

        <Row gutter={16}>
          <Col span={12}>
            <FormItem label="STIR (INN) Raqami" field="inn">
              <Input placeholder="Masalan: 305123456" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem label="Shartnoma Raqami" field="contractNumber">
              <Input placeholder="Masalan: SH-2026-042" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormItem label="Shartnoma Tuzilgan Sana" field="contractDate">
              <DatePicker style={{ width: '100%', borderRadius: 0 }} />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem label="Mas’ul Vakil (F.I.Sh.)" field="contactPerson">
              <Input placeholder="Masalan: Karimov Anvar" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormItem label="Telefon Raqami" field="phone">
              <Input placeholder="+998 90 123 45 67" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem
              label="Elektron Pochta"
              field="email"
              rules={[{ type: 'email', message: 'Elektron pochta formati noto‘g‘ri' }]}
            >
              <Input placeholder="info@korxona.uz" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>
        </Row>

        <FormItem label="Qo‘shimcha Izoh yoki Shartlar" field="notes">
          <Input.TextArea
            placeholder="Yetkazib berish muddati, kafolat majburiyatlari va h.k."
            rows={3}
            style={{ borderRadius: 0 }}
          />
        </FormItem>
      </Form>
    </Modal>
  );
};
