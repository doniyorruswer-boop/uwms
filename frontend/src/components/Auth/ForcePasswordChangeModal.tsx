import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Space,
  Message,
} from '@arco-design/web-react';
import {
  IconLock,
  IconSafe,
  IconPoweroff,
  IconCheckCircleFill,
  IconCloseCircleFill,
} from '@arco-design/web-react/icon';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';
import { useAuthStore } from '../../store/authStore';

const FormItem = Form.Item;
const { Text, Paragraph } = Typography;

interface ForcePasswordChangeModalProps {
  visible: boolean;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ visible }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const { logout, setPasswordChanged } = useAuthStore();

  const hasMinLength = newPasswordValue.length >= 8;
  const hasUpperLower = /(?=.*[a-z])(?=.*[A-Z])/.test(newPasswordValue);
  const hasNumber = /\d/.test(newPasswordValue);
  const hasSpecial = /[@$!%*?&#^_-]/.test(newPasswordValue);
  const notDefault = !newPasswordValue.toLowerCase().includes('admin123');

  const allCriteriaMet = hasMinLength && hasUpperLower && hasNumber && hasSpecial && notDefault;

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      if (values.newPassword !== values.confirmPassword) {
        Message.error('Yangi parol va tasdiqlash bir-biriga mos kelmadi!');
        return;
      }

      setLoading(true);
      await apiClient.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });

      Message.success('Xavfsiz parol muvaffaqiyatli o‘rnatildi!');
      setPasswordChanged();
      form.resetFields();
    } catch (err: any) {
      if (err.response?.data?.message) {
        Message.error(err.response.data.message);
      } else if (!err.fields) {
        Message.error('Parolni yangilashda xatolik yuz berdi!');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <IconSafe style={{ fontSize: 20, color: '#ff7d00' }} />
          <span style={{ fontWeight: 600 }}>Majburiy Parol O‘zgartirish (Xavfsizlik Siyosati)</span>
        </Space>
      }
      visible={visible}
      closable={false}
      maskClosable={false}
      escToExit={false}
      footer={null}
      style={{ width: 500 }}
    >
      <Alert
        type="warning"
        style={{ marginBottom: 16 }}
        content={
          <div>
            <Paragraph style={{ margin: 0, fontSize: 13, lineHeight: '1.5' }}>
              Siz tizimga <b>boshlang‘ich standart parol</b> orqali kirdingiz.
              Universitet axborot xavfsizligi qoidalariga ko‘ra, tizimdan foydalanishdan oldin
              shaxsiy kuchli parol o‘rnatishingiz <b>shart</b>.
            </Paragraph>
          </div>
        }
      />

      <Form form={form} layout="vertical" onSubmit={handleSubmit}>
        <FormItem
          label="Amaldagi (boshlang‘ich) parol"
          field="oldPassword"
          rules={[{ required: true, message: 'Amaldagi parolni kiriting!' }]}
        >
          <Input.Password
            prefix={<IconLock />}
            placeholder="Eski parolingiz (masalan, admin123)"
            size="large"
          />
        </FormItem>

        <FormItem
          label="Yangi kuchli parol"
          field="newPassword"
          rules={[
            { required: true, message: 'Yangi parolni kiriting!' },
            {
              validator: (val, cb) => {
                if (!val) return cb();
                if (!allCriteriaMet) {
                  return cb('Parol quyidagi xavfsizlik talablariga to‘liq javob berishi shart');
                }
                cb();
              },
            },
          ]}
        >
          <Input.Password
            prefix={<IconLock />}
            placeholder="Kamida 8 ta belgi, harf, raqam va maxsus belgi"
            size="large"
            onChange={(val) => setNewPasswordValue(val)}
          />
        </FormItem>

        {/* Parol mezonlari indikatori */}
        <div
          style={{
            background: 'var(--color-fill-2)',
            padding: '10px 12px',
            borderRadius: 4,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text-1)' }}>
            Parol murakkabligi talablari:
          </div>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text type={hasMinLength ? 'success' : 'secondary'}>
              {hasMinLength ? <IconCheckCircleFill style={{ color: '#00b42a' }} /> : <IconCloseCircleFill style={{ color: '#86909c' }} />}{' '}
              Kamida 8 ta belgi
            </Text>
            <Text type={hasUpperLower ? 'success' : 'secondary'}>
              {hasUpperLower ? <IconCheckCircleFill style={{ color: '#00b42a' }} /> : <IconCloseCircleFill style={{ color: '#86909c' }} />}{' '}
              Katta va kichik lotin harflari (A-Z, a-z)
            </Text>
            <Text type={hasNumber ? 'success' : 'secondary'}>
              {hasNumber ? <IconCheckCircleFill style={{ color: '#00b42a' }} /> : <IconCloseCircleFill style={{ color: '#86909c' }} />}{' '}
              Kamida bitta raqam (0-9)
            </Text>
            <Text type={hasSpecial ? 'success' : 'secondary'}>
              {hasSpecial ? <IconCheckCircleFill style={{ color: '#00b42a' }} /> : <IconCloseCircleFill style={{ color: '#86909c' }} />}{' '}
              Kamida bitta maxsus belgi (@$!%*?&#^_-)
            </Text>
            <Text type={notDefault ? 'success' : 'error'}>
              {notDefault ? <IconCheckCircleFill style={{ color: '#00b42a' }} /> : <IconCloseCircleFill style={{ color: '#f53f3f' }} />}{' '}
              Standart 'admin123' bo‘lmasligi kerak
            </Text>
          </Space>
        </div>

        <FormItem
          label="Yangi parolni tasdiqlash"
          field="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Yangi parolni qayta kiriting!' },
            {
              validator: (v, cb) => {
                if (v && v !== form.getFieldValue('newPassword')) {
                  return cb('Parollar bir-biriga mos kelmadi!');
                }
                cb();
              },
            },
          ]}
        >
          <Input.Password
            prefix={<IconLock />}
            placeholder="Yangi parolni qayta kiriting"
            size="large"
          />
        </FormItem>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <Button
            type="text"
            status="danger"
            icon={<IconPoweroff />}
            onClick={() => logout()}
          >
            Tizimdan chiqish
          </Button>

          <Button
            type="primary"
            size="large"
            loading={loading}
            disabled={!allCriteriaMet}
            onClick={handleSubmit}
            style={{ minWidth: 160 }}
          >
            Parolni Saqlash va Kirish
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
