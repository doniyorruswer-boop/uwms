import React from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Grid,
} from '@arco-design/web-react';
import {
  useCreateRoomMutation,
  useOrganizationQuery,
} from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  defaultDepartmentId?: string;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  visible,
  onClose,
  defaultDepartmentId,
}) => {
  const [form] = Form.useForm();
  const createRoomMutation = useCreateRoomMutation();
  const { allDepartments } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await createRoomMutation.mutateAsync({
        number: values.number,
        name: values.name,
        floor: Number(values.floor) || 1,
        building: values.building || 'Bosh bino',
        departmentId: values.departmentId || undefined,
        responsibleUserId: values.responsibleUserId || undefined,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Yangi Auditoriya / Xona Qo‘shish"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={createRoomMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 600, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          floor: 1,
          building: 'Bosh bino',
          departmentId: defaultDepartmentId,
        }}
      >
        <Row gutter={16}>
          <Col span={10}>
            <FormItem
              label="Xona Raqami"
              field="number"
              rules={[{ required: true, message: 'Xona raqami kiritilishi shart!' }]}
            >
              <Input placeholder="Masalan: 304, 102-A" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={14}>
            <FormItem
              label="Xona Nomi / Maqsadi"
              field="name"
              rules={[{ required: true, message: 'Xona nomi kiritilishi shart!' }]}
            >
              <Input
                placeholder="Masalan: Dasturlash Laboratoriyasi"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={14}>
            <FormItem
              label="Bino / Korpus"
              field="building"
              rules={[{ required: true, message: 'Bino kiritilishi shart!' }]}
            >
              <Select placeholder="Binoni tanlang yoki yozing" allowCreate style={{ borderRadius: 0 }}>
                <Select.Option value="Bosh bino">Bosh bino</Select.Option>
                <Select.Option value="IT Korpus">IT Korpus</Select.Option>
                <Select.Option value="Laboratoriya binosi">Laboratoriya binosi</Select.Option>
                <Select.Option value="2-o‘quv binosi">2-o‘quv binosi</Select.Option>
              </Select>
            </FormItem>
          </Col>

          <Col span={10}>
            <FormItem
              label="Qavat"
              field="floor"
              rules={[{ required: true, message: 'Qavat tanlanishi shart!' }]}
            >
              <InputNumber min={1} max={20} style={{ width: '100%', borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Biriktirilgan Bo‘lim / Kafedra / Xizmat"
              field="departmentId"
            >
              <Select
                placeholder="Tegishli bo‘lim yoki kafedrani tanlang"
                allowClear
                showSearch
                style={{ borderRadius: 0 }}
              >
                {allDepartments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name} — [{d.type}]
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Mas’ul Xodim (MOL / Xona Mudiri)"
              field="responsibleUserId"
            >
              <Select
                placeholder="Xonaga mas’ul shaxsni tanlang (MOL)"
                allowClear
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
        </Row>
      </Form>
    </Modal>
  );
};
