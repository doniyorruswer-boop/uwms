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
  useUpdateRoomMutation,
  useOrganizationQuery,
  type RoomItem,
  type UpdateRoomData,
} from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface EditRoomModalProps {
  visible: boolean;
  room: RoomItem | null;
  onClose: () => void;
}

export const EditRoomModal: React.FC<EditRoomModalProps> = ({
  visible,
  room,
  onClose,
}) => {
  const [form] = Form.useForm();
  const updateRoomMutation = useUpdateRoomMutation();
  const { allDepartments } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  useEffect(() => {
    if (visible && room) {
      form.setFieldsValue({
        number: room.number,
        name: room.name,
        floor: room.floor,
        building: room.building,
        departmentId: room.departmentId || undefined,
        responsibleUserId: room.responsibleUserId || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [visible, room, form]);

  const handleSubmit = async () => {
    if (!room) return;
    try {
      const values = await form.validate();
      const updateData: UpdateRoomData = {
        number: values.number,
        name: values.name,
        floor: Number(values.floor) || 1,
        building: values.building,
        departmentId: values.departmentId || null,
        responsibleUserId: values.responsibleUserId || null,
      };

      await updateRoomMutation.mutateAsync({
        id: room.id,
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
      title="Xona Ma’lumotlarini Tahrirlash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateRoomMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 600, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={10}>
            <FormItem
              label="Xona Raqami"
              field="number"
              rules={[{ required: true, message: 'Xona raqami kiritilishi shart!' }]}
            >
              <Input placeholder="304, 102" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={14}>
            <FormItem
              label="Xona Nomi / Maqsadi"
              field="name"
              rules={[{ required: true, message: 'Xona nomi kiritilishi shart!' }]}
            >
              <Input placeholder="Xona nomi" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={14}>
            <FormItem
              label="Bino / Korpus"
              field="building"
              rules={[{ required: true, message: 'Bino kiritilishi shart!' }]}
            >
              <Select placeholder="Binoni tanlang" allowCreate style={{ borderRadius: 0 }}>
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
