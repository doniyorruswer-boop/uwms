import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Grid,
  Switch,
} from '@arco-design/web-react';
import {
  useUpdateUserMutation,
  type UserItem,
  type UpdateUserData,
} from '../../hooks/useUsersQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { RoleType } from '../../types';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface EditUserModalProps {
  visible: boolean;
  user: UserItem | null;
  onClose: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const [form] = Form.useForm();
  const updateMutation = useUpdateUserMutation();
  const { departments } = useOrganizationQuery();

  useEffect(() => {
    if (visible && user) {
      form.setFieldsValue({
        fullName: user.fullName,
        email: user.email || '',
        phone: user.phone || '',
        position: user.position || '',
        role: user.role,
        departmentId: user.departmentId || undefined,
        isActive: user.isActive,
      });
    } else {
      form.resetFields();
    }
  }, [visible, user, form]);

  const handleSubmit = async () => {
    if (!user) return;
    try {
      const values = await form.validate();
      const updateData: UpdateUserData = {
        fullName: values.fullName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        position: values.position || undefined,
        role: values.role as RoleType,
        departmentId: values.departmentId || null,
        isActive: values.isActive ?? true,
      };

      await updateMutation.mutateAsync({
        id: user.id,
        data: updateData,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Xodim Ma’lumotlarini Tahrirlash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="F.I.Sh. (To‘liq ism)"
              field="fullName"
              rules={[{ required: true, message: 'F.I.Sh. kiritilishi shart!' }]}
            >
              <Input
                placeholder="Masalan: Abdullayev Jasur Rustamovich"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem label="Elektron Pochta" field="email">
              <Input placeholder="masalan@univ.uz" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem label="Telefon Raqami" field="phone">
              <Input placeholder="+998 90 123 45 67" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Tizim Roli"
              field="role"
              rules={[{ required: true, message: 'Rol tanlanishi shart!' }]}
            >
              <Select placeholder="Rolni tanlang" style={{ borderRadius: 0 }}>
                <Select.Option value={RoleType.SUPER_ADMIN}>
                  Super Admin (Tizim Boshqaruvchisi)
                </Select.Option>
                <Select.Option value={RoleType.HEAD_WAREHOUSE}>
                  Bosh Omborchi
                </Select.Option>
                <Select.Option value={RoleType.MOL}>
                  MOL (Moddiy Javobgar Shaxs / Mudir)
                </Select.Option>
                <Select.Option value={RoleType.AUDITOR}>
                  Auditor / Nazoratchi
                </Select.Option>
                <Select.Option value={RoleType.EMPLOYEE}>
                  Xodim (O‘qituvchi / Laborant)
                </Select.Option>
                <Select.Option value={RoleType.CHIEF_ACCOUNTANT}>
                  Bosh Hisobchi
                </Select.Option>
                <Select.Option value={RoleType.COMMENDANT}>
                  Bino Komendanti
                </Select.Option>
                <Select.Option value={RoleType.RECTOR}>
                  Rektor
                </Select.Option>
                <Select.Option value={RoleType.VICE_RECTOR_FINANCE}>
                  Moliya-iqtisodiyot ishlari bo‘yicha prorektor
                </Select.Option>
              </Select>
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem label="Lavozimi" field="position">
              <Input
                placeholder="Masalan: Kafedra mudiri, Laborant"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={18}>
            <FormItem label="Fakultet yoki Bo‘lim" field="departmentId">
              <Select
                placeholder="Bo‘limni tanlang (ixtiyoriy)"
                allowClear
                style={{ borderRadius: 0 }}
              >
                {departments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name} ({d.type})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={6}>
            <FormItem
              label="Holati (Faol)"
              field="isActive"
              triggerPropName="checked"
            >
              <Switch />
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
