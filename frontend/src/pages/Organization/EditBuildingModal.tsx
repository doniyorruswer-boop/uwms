import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Grid,
} from '@arco-design/web-react';
import {
  useUpdateBuildingMutation,
  type BuildingItem,
} from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface EditBuildingModalProps {
  visible: boolean;
  building: BuildingItem | null;
  onClose: () => void;
}

export const EditBuildingModal: React.FC<EditBuildingModalProps> = ({
  visible,
  building,
  onClose,
}) => {
  const [form] = Form.useForm();
  const updateMutation = useUpdateBuildingMutation();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  useEffect(() => {
    if (building) {
      form.setFieldsValue({
        name: building.name,
        code: building.code || undefined,
        floorsCount: building.floorsCount || 4,
        address: building.address || undefined,
        description: building.description || undefined,
        commendantId: building.commendantId || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [building, form]);

  const handleSubmit = async () => {
    if (!building) return;
    try {
      const values = await form.validate();
      await updateMutation.mutateAsync({
        id: building.id,
        data: {
          name: values.name.trim(),
          code: values.code ? values.code.trim().toUpperCase() : null,
          floorsCount: Number(values.floorsCount) || 4,
          address: values.address?.trim() || null,
          description: values.description?.trim() || null,
          commendantId: values.commendantId || null,
        },
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Bino / Korpus Ma’lumotlarini Tahrirlash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 580, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="Bino / Korpus Nomi"
              field="name"
              rules={[{ required: true, message: 'Bino nomi kiritilishi shart!' }]}
            >
              <Input
                placeholder="Masalan: 1-o‘quv binosi"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Bino Qisqa Kodi (Unikal)"
              field="code"
              rules={[
                {
                  match: /^[A-Z0-9_-]+$/,
                  message: 'Katta lotin harflari va raqamlar (masalan: B1, IT)',
                },
              ]}
            >
              <Input
                placeholder="Masalan: B1, IT"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Qavatlar Soni"
              field="floorsCount"
              rules={[{ required: true, message: 'Qavatlar soni kiritilishi shart!' }]}
            >
              <InputNumber
                min={1}
                max={50}
                style={{ width: '100%', borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Manzili"
              field="address"
            >
              <Input
                placeholder="Masalan: Universitet ko‘chasi, 2-bino"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Komendanti / Mas’ul Shaxs"
              field="commendantId"
            >
              <Select
                placeholder="Binoga javobgar komendant yoki xodimni tanlang"
                allowClear
                showSearch
                style={{ borderRadius: 0 }}
              >
                {usersData?.items.map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.fullName} ({u.role} - {u.position || 'Xodim'})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Haqida Qo‘shimcha Ma’lumot"
              field="description"
            >
              <Input.TextArea
                placeholder="Bino maqsadi, auditoriyalar sig‘imi va h.k."
                style={{ borderRadius: 0 }}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
