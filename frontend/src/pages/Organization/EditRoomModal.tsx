import React, { useEffect, useState } from 'react';
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
  const { allDepartments, buildings } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>();
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const maxFloor = selectedBuilding?.floorsCount || 20;

  useEffect(() => {
    if (visible && room) {
      const bId = room.buildingId || buildings.find((b) => b.name === room.building)?.id;
      setSelectedBuildingId(bId || undefined);
      form.setFieldsValue({
        floor: room.floor,
        number: room.number && !room.number.startsWith('RS-') && room.number !== 'RAQAMSIZ' ? room.number : '',
        name: room.name,
        buildingId: room.buildingId || undefined,
        departmentId: room.departmentId || undefined,
        responsibleUserId: room.responsibleUserId || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [visible, room, buildings, form]);

  const handleSubmit = async () => {
    if (!room) return;
    try {
      const values = await form.validate();
      const buildingObj = buildings.find((b) => b.id === values.buildingId);
      const updateData: UpdateRoomData = {
        number: values.number?.trim() || '',
        name: values.name.trim(),
        floor: Number(values.floor) || 1,
        buildingId: values.buildingId || null,
        building: buildingObj?.name || room.building,
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
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={14}>
            <FormItem
              label="Bino / Korpus"
              field="buildingId"
              rules={[{ required: true, message: 'Bino tanlanishi shart!' }]}
            >
              <Select
                placeholder="Binoni tanlang"
                style={{ borderRadius: 0 }}
                onChange={(val) => {
                  setSelectedBuildingId(val);
                  const b = buildings.find((x) => x.id === val);
                  if (b && form.getFieldValue('floor') > b.floorsCount) {
                    form.setFieldValue('floor', 1);
                  }
                }}
              >
                {buildings.map((b) => (
                  <Select.Option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''} — {b.floorsCount} qavatli
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={10}>
            <FormItem
              label={`Qavat (1 dan ${maxFloor} gacha)`}
              field="floor"
              rules={[{ required: true, message: 'Qavat tanlanishi shart!' }]}
            >
              <InputNumber
                min={1}
                max={maxFloor}
                style={{ width: '100%', borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={10}>
            <FormItem
              label="Xona Raqami (Ixtiyoriy)"
              field="number"
            >
              <Input placeholder="Masalan: 304, 102 (raqamsiz bo‘lsa bo‘sh)" style={{ borderRadius: 0 }} />
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
        </Row>
      </Form>
    </Modal>
  );
};
