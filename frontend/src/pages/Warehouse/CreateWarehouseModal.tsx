import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Grid,
} from '@arco-design/web-react';
import { useCreateWarehouseMutation } from '../../hooks/useWarehouseQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface CreateWarehouseModalProps {
  visible: boolean;
  onClose: () => void;
  defaultBuildingId?: string;
}

export const CreateWarehouseModal: React.FC<CreateWarehouseModalProps> = ({
  visible,
  onClose,
  defaultBuildingId,
}) => {
  const [form] = Form.useForm();
  const createMutation = useCreateWarehouseMutation();
  const { buildings } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await createMutation.mutateAsync({
        name: values.name.trim(),
        code: values.code ? values.code.trim().toUpperCase() : undefined,
        buildingId: values.buildingId || undefined,
        location: values.location?.trim() || undefined,
        managerId: values.managerId || undefined,
        isMain: !!values.isMain,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Yangi Omborxona Qo‘shish"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={createMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 600, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          buildingId: defaultBuildingId,
          isMain: false,
        }}
      >
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
            <FormItem field="isMain" triggerPropName="checked" style={{ marginBottom: 8 }}>
              <Space size="medium">
                <Switch size="small" />
                <span style={{ fontSize: 13 }}>
                  Universitetning Bosh Markaziy Ombori sifatida belgilash
                </span>
              </Space>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
