import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Grid,
} from '@arco-design/web-react';
import { useUpdateWarehouseMutation, type WarehouseItem } from '../../hooks/useWarehouseQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface EditWarehouseModalProps {
  visible: boolean;
  warehouse: WarehouseItem | null;
  onClose: () => void;
}

export const EditWarehouseModal: React.FC<EditWarehouseModalProps> = ({
  visible,
  warehouse,
  onClose,
}) => {
  const [form] = Form.useForm();
  const updateMutation = useUpdateWarehouseMutation();
  const { buildings } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  useEffect(() => {
    if (visible && warehouse) {
      form.setFieldsValue({
        name: warehouse.name,
        code: warehouse.code || undefined,
        buildingId: warehouse.buildingId || undefined,
        location: warehouse.location || undefined,
        managerId: warehouse.managerId || undefined,
        isMain: !!warehouse.isMain,
      });
    } else {
      form.resetFields();
    }
  }, [visible, warehouse, form]);

  const handleSubmit = async () => {
    if (!warehouse) return;
    try {
      const values = await form.validate();
      await updateMutation.mutateAsync({
        id: warehouse.id,
        data: {
          name: values.name.trim(),
          code: values.code ? values.code.trim().toUpperCase() : null,
          buildingId: values.buildingId || null,
          location: values.location?.trim() || null,
          managerId: values.managerId || null,
          isMain: !!values.isMain,
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
      title="Omborxona Ma’lumotlarini Tahrirlash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 600, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="Omborxona Nomi"
              field="name"
              rules={[{ required: true, message: 'Ombor nomi kiritilishi shart!' }]}
            >
              <Input
                placeholder="Masalan: Axborot Texnologiyalari Sarf Omborxonasi"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Ombor Qisqa Kodi (Unikal)"
              field="code"
              rules={[
                {
                  match: /^[A-Z0-9_-]+$/,
                  message: 'Katta lotin harflari va raqamlar (masalan: WH-IT)',
                },
              ]}
            >
              <Input
                placeholder="Masalan: WH-IT, WH-MAIN"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Joylashgan Bino / Korpus"
              field="buildingId"
            >
              <Select
                placeholder="Binoni tanlang"
                allowClear
                style={{ borderRadius: 0 }}
              >
                {buildings.map((b) => (
                  <Select.Option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Ichidagi Aniq Joylashuvi (Xona / Yerto‘la)"
              field="location"
            >
              <Input
                placeholder="Masalan: 1-bino yerto‘la, 004-xona"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Mas’ul Ombor Mudiri (HEAD_WAREHOUSE / Xodim)"
              field="managerId"
            >
              <Select
                placeholder="Omborga javobgar mudirni tanlang"
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
            <FormItem field="isMain">
              <Checkbox>
                Universitetning Bosh Markaziy Ombori sifatida belgilash
              </Checkbox>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
