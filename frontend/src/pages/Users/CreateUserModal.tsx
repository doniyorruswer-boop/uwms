import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Grid,
  Switch,
} from '@arco-design/web-react';
import { useCreateUserMutation, type CreateUserData } from '../../hooks/useUsersQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useAuthStore } from '../../store/authStore';
import { RoleType } from '../../types';
import { formatUzbekPhoneInput, isUzbekPhoneValid } from '../../utils/formatters';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const createMutation = useCreateUserMutation();
  const { departments } = useOrganizationQuery();
  const { user: currentUser } = useAuthStore();

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      const rawPhone = values.phone ? values.phone.trim() : '';
      const digits = rawPhone.replace(/\D/g, '');
      const normalizedPhone = digits.startsWith('998') ? `+${digits}` : `+998${digits}`;

      await createMutation.mutateAsync({
        fullName: values.fullName,
        username: values.username,
        password: values.password,
        email: values.email || undefined,
        phone: normalizedPhone,
        position: values.position || undefined,
        role: values.role as RoleType,
        departmentId: values.departmentId || undefined,
        isActive: values.isActive ?? true,
      });
      form.resetFields();
      onClose();
    } catch {
      // Form validation error
    }
  };

  return (
    <Modal
      title="Yangi Xodim Qo‘shish (Foydalanuvchi)"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={createMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          role: RoleType.EMPLOYEE,
          isActive: true,
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="F.I.Sh. (To‘liq ism)"
              field="fullName"
              rules={[{ required: true, message: 'F.I.Sh. kiritilishi shart!' }]}
            >
              <Input placeholder="Masalan: Abdullayev Jasur Rustamovich" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Foydalanuvchi Nomi (Login)"
              field="username"
              rules={[
                { required: true, message: 'Login kiritilishi shart!' },
                { match: /^[a-zA-Z0-9_.-]+$/, message: 'Faqat lotin harf va raqamlar' },
              ]}
            >
              <Input placeholder="Masalan: j_abdullayev" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Boshlang‘ich Parol"
              field="password"
              rules={[
                { required: true, message: 'Parol kiritilishi shart!' },
                { minLength: 6, message: 'Kamida 6 ta belgi' },
              ]}
            >
              <Input.Password placeholder="Kamida 6 ta belgi" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem label="Elektron Pochta" field="email">
              <Input placeholder="masalan@univ.uz" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Telefon Raqami (O‘zbekiston)"
              field="phone"
              rules={[
                { required: true, message: 'Telefon raqami kiritilishi shart!' },
                {
                  validator: (value, callback) => {
                    if (!value) {
                      return callback('Telefon raqami kiritilishi shart!');
                    }
                    if (!isUzbekPhoneValid(value)) {
                      return callback('Telefon raqami O‘zbekiston shabloniga to‘liq mos kelishi shart (+998 XX XXX-XX-XX)!');
                    }
                    callback();
                  },
                },
              ]}
            >
              <Input
                placeholder="+998 (90) 123-45-67"
                style={{ borderRadius: 0 }}
                onChange={(val) => {
                  const formatted = formatUzbekPhoneInput(val);
                  form.setFieldValue('phone', formatted);
                }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Tizim Roli"
              field="role"
              rules={[{ required: true, message: 'Rol tanlanishi shart!' }]}
            >
              <Select placeholder="Rolni tanlang" style={{ borderRadius: 0 }}>
                {currentUser?.role === RoleType.SUPER_ADMIN && (
                  <Select.Option value={RoleType.SUPER_ADMIN}>Super Admin (Tizim Boshqaruvchisi)</Select.Option>
                )}
                <Select.Option value={RoleType.ADMIN}>Universitet Administratori</Select.Option>
                <Select.Option value={RoleType.HEAD_WAREHOUSE}>Bosh Omborchi</Select.Option>
                <Select.Option value={RoleType.MOL}>MOL (Moddiy Javobgar Shaxs / Mudir)</Select.Option>
                <Select.Option value={RoleType.AUDITOR}>Auditor / Nazoratchi</Select.Option>
                <Select.Option value={RoleType.EMPLOYEE}>Xodim (O‘qituvchi / Laborant)</Select.Option>
                <Select.Option value={RoleType.CHIEF_ACCOUNTANT}>Bosh Hisobchi</Select.Option>
                <Select.Option value={RoleType.COMMENDANT}>Bino Komendanti</Select.Option>
                <Select.Option value={RoleType.RECTOR}>Rektor</Select.Option>
                <Select.Option value={RoleType.VICE_RECTOR_FINANCE}>Moliya-iqtisodiyot ishlari bo‘yicha prorektor</Select.Option>
              </Select>
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem label="Lavozimi" field="position">
              <Input placeholder="Masalan: Kafedra mudiri, Laborant" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={18}>
            <FormItem label="Fakultet yoki Bo‘lim" field="departmentId">
              <Select placeholder="Bo‘limni tanlang (ixtiyoriy)" allowClear style={{ borderRadius: 0 }}>
                {departments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name} ({d.type})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={6}>
            <FormItem label="Holati (Faol)" field="isActive" triggerPropName="checked">
              <Switch defaultChecked />
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
