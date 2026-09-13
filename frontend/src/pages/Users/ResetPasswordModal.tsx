import React from 'react';
import { Modal, Form, Input, Typography } from '@arco-design/web-react';
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

  const handleSubmit = async () => {
    if (!user) return;
    try {
      const values = await form.validate();
      await resetMutation.mutateAsync({
        id: user.id,
        newPassword: values.newPassword,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Foydalanuvchi Parolini Yangilash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={resetMutation.isPending}
      okText="Parolni Yangilash"
      cancelText="Bekor qilish"
      style={{ width: 480, borderRadius: 0 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Foydalanuvchi: <Text bold>{user?.fullName}</Text> (
          <Text code>{user?.username}</Text>)
        </Text>
      </div>

      <Form form={form} layout="vertical">
        <FormItem
          label="Yangi Parol"
          field="newPassword"
          rules={[
            { required: true, message: 'Yangi parol kiritilishi shart!' },
            { minLength: 6, message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak!' },
          ]}
        >
          <Input.Password
            placeholder="Kamida 6 ta belgi"
            style={{ borderRadius: 0 }}
          />
        </FormItem>

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
            placeholder="Parolni qayta kiriting"
            style={{ borderRadius: 0 }}
          />
        </FormItem>
      </Form>
    </Modal>
  );
};
