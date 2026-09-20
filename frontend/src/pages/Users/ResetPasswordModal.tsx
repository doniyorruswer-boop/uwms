import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Typography,
  Checkbox,
  Space,
  Message,
  Alert,
} from '@arco-design/web-react';
import {
  IconCheckCircleFill,
  IconCloseCircleFill,
  IconLock,
} from '@arco-design/web-react/icon';
import {
  useResetUserPasswordMutation,
  type UserItem,
} from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Text } = Typography;

interface ResetPasswordModalProps {
  visible: boolean;
  user: UserItem | null;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const [form] = Form.useForm();
  const resetMutation = useResetUserPasswordMutation();
  const [passwordValue, setPasswordValue] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Security criteria validation
  const hasMinLength = passwordValue.length >= 8;
  const hasUpperLower = /(?=.*[a-z])(?=.*[A-Z])/.test(passwordValue);
  const hasNumber = /\d/.test(passwordValue);
  const hasSpecial = /[@$!%*?&#^_-]/.test(passwordValue);
  const notDefault = !passwordValue.toLowerCase().includes('admin123');

  const allCriteriaMet =
    hasMinLength && hasUpperLower && hasNumber && hasSpecial && notDefault;

  const handleClose = () => {
    form.resetFields();
    setPasswordValue('');
    setMustChangePassword(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!user) return;
    try {
      const values = await form.validate();

      if (!allCriteriaMet) {
        Message.error('Yangi parol barcha xavfsizlik mezonlariga javob berishi shart!');
        return;
      }

      await resetMutation.mutateAsync({
        id: user.id,
        newPassword: values.newPassword,
        mustChangePassword,
      });

      handleClose();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        Message.error(err.response.data.message);
      } else if (!err?.fields) {
        Message.error('Parolni yangilashda xatolik yuz berdi!');
      }
    }
  };

  return (
    <Modal
      title="Foydalanuvchi Parolini Yangilash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={handleClose}
      confirmLoading={resetMutation.isPending}
      okButtonProps={{ disabled: !allCriteriaMet }}
      okText="Parolni Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 500, borderRadius: 0 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Foydalanuvchi: <Text bold>{user?.fullName}</Text> (
          <Text code>{user?.username}</Text>)
        </Text>
      </div>

      <Form form={form} layout="vertical">
        <FormItem
          label="Yangi Xavfsiz Parol"
          field="newPassword"
          rules={[
            { required: true, message: 'Yangi parol kiritilishi shart!' },
            {
              validator: (val, cb) => {
                if (!val) return cb();
                if (!allCriteriaMet) {
                  return cb('Parol quyidagi xavfsizlik talablariga javob berishi shart');
                }
                cb();
              },
            },
          ]}
        >
          <Input.Password
            prefix={<IconLock />}
            placeholder="Kamida 8 ta belgi, katta-kichik harf, raqam va belgi"
            style={{ borderRadius: 0 }}
            onChange={(val) => setPasswordValue(val)}
          />
        </FormItem>

        {/* Real-time Password Strength Criteria Indicator */}
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
              {hasMinLength ? (
                <IconCheckCircleFill style={{ color: '#00b42a' }} />
              ) : (
                <IconCloseCircleFill style={{ color: '#86909c' }} />
              )}{' '}
              Kamida 8 ta belgi
            </Text>
            <Text type={hasUpperLower ? 'success' : 'secondary'}>
              {hasUpperLower ? (
                <IconCheckCircleFill style={{ color: '#00b42a' }} />
              ) : (
                <IconCloseCircleFill style={{ color: '#86909c' }} />
              )}{' '}
              Katta va kichik lotin harflari (A-Z, a-z)
            </Text>
            <Text type={hasNumber ? 'success' : 'secondary'}>
              {hasNumber ? (
                <IconCheckCircleFill style={{ color: '#00b42a' }} />
              ) : (
                <IconCloseCircleFill style={{ color: '#86909c' }} />
              )}{' '}
              Kamida bitta raqam (0-9)
            </Text>
            <Text type={hasSpecial ? 'success' : 'secondary'}>
              {hasSpecial ? (
                <IconCheckCircleFill style={{ color: '#00b42a' }} />
              ) : (
                <IconCloseCircleFill style={{ color: '#86909c' }} />
              )}{' '}
              Kamida bitta maxsus belgi (@$!%*?&#^_-)
            </Text>
            <Text type={notDefault ? 'success' : 'error'}>
              {notDefault ? (
                <IconCheckCircleFill style={{ color: '#00b42a' }} />
              ) : (
                <IconCloseCircleFill style={{ color: '#f53f3f' }} />
              )}{' '}
              Standart 'admin123' bo‘lmasligi kerak
            </Text>
          </Space>
        </div>

        <FormItem
          label="Yangi Parolni Tasdiqlang"
          field="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Parolni tasdiqlash shart!' },
            {
              validator: (v, cb) => {
                if (form.getFieldValue('newPassword') && v !== form.getFieldValue('newPassword')) {
                  return cb('Kiritilgan parollar bir-biriga mos kelmadi!');
                }
                return cb();
              },
            },
          ]}
        >
          <Input.Password
            prefix={<IconLock />}
            placeholder="Parolni qayta kiriting"
            style={{ borderRadius: 0 }}
          />
        </FormItem>

        <FormItem style={{ marginBottom: 0 }}>
          <Checkbox
            checked={mustChangePassword}
            onChange={(checked) => setMustChangePassword(checked)}
          >
            Foydalanuvchi birinchi marta kirganda parolni yangilashi shart bo‘lsin
          </Checkbox>
        </FormItem>
      </Form>
    </Modal>
  );
};
