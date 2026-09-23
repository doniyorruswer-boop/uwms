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
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | undefined>(undefined);

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const maxFloor = selectedBuilding?.floorsCount || 20;

  // Filter faculties vs chairs
  const facultyOptions = allDepartments.filter((d) => d.type === 'FACULTY' || !d.parentId);
  const chairOptions = selectedFacultyId
    ? allDepartments.filter((d) => d.parentId === selectedFacultyId)
    : allDepartments.filter((d) => d.type === 'CHAIR' || d.type === 'LAB');

  useEffect(() => {
    if (visible && room) {
      const bId = room.buildingId || buildings.find((b) => b.name === room.building)?.id;
      setSelectedBuildingId(bId || undefined);

      let initialFacId: string | undefined = undefined;
      let initialChairId: string | undefined = undefined;

      if (room.departmentId) {
        const dept = allDepartments.find((d) => d.id === room.departmentId);
        if (dept) {
          if (dept.parentId) {
            initialFacId = dept.parentId;
            initialChairId = dept.id;
          } else {
            initialFacId = dept.id;
          }
        }
      }

      setSelectedFacultyId(initialFacId);

      form.setFieldsValue({
        floor: room.floor,
        number: room.number && !room.number.startsWith('RS-') && room.number !== 'RAQAMSIZ' ? room.number : '',
        name: room.name,
        buildingId: bId || undefined,
        facultyId: initialFacId,
        chairId: initialChairId,
        responsibleUserId: room.responsibleUserId || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [visible, room, buildings, allDepartments, form]);

  const handleSubmit = async () => {
    if (!room) return;
    try {
      const values = await form.validate();
      const buildingObj = buildings.find((b) => b.id === values.buildingId);
      const finalDepartmentId = values.chairId || values.facultyId || null;

      const updateData: UpdateRoomData = {
        number: values.number?.trim() || '',
        name: values.name.trim(),
        floor: Number(values.floor) || 1,
        buildingId: values.buildingId || null,
        building: buildingObj?.name || room.building,
        departmentId: finalDepartmentId,
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
      style={{ width: 640, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          {/* 1. Bino / Korpus */}
          <Col span={24}>
            <FormItem
              label="1. Bino / Korpus"
              field="buildingId"
              rules={[{ required: true, message: 'Bino tanlanishi shart!' }]}
            >
              <Select
                placeholder="Binoni tanlang"
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
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

          {/* 2. Fakultet / Bosh Bo'lim */}
          <Col span={12}>
            <FormItem
              label="2. Fakultet / Bosh Bo‘lim"
              field="facultyId"
              rules={[{ required: true, message: 'Fakultet yoki bo‘limni tanlang!' }]}
            >
              <Select
                placeholder="Fakultetni tanlang"
                allowClear
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
                onChange={(facId) => {
                  setSelectedFacultyId(facId);
                  form.setFieldValue('chairId', undefined);
                }}
                style={{ borderRadius: 0 }}
              >
                {facultyOptions.map((f) => (
                  <Select.Option key={f.id} value={f.id}>
                    {f.name} ({f.type === 'FACULTY' ? 'Fakultet' : f.type})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          {/* 3. Kafedra / Quyi Bo'lim */}
          <Col span={12}>
            <FormItem
              label="3. Kafedra / Quyi Bo‘lim (Ixtiyoriy)"
              field="chairId"
            >
              <Select
                placeholder={
                  selectedFacultyId
                    ? chairOptions.length > 0
                      ? 'Kafedrani tanlang (Dekanat uchun bo‘sh qoldiring)'
                      : 'Ushbu bo‘limda kafedra yo‘q'
                    : 'Avval fakultetni tanlang'
                }
                allowClear
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
                style={{ borderRadius: 0 }}
              >
                {chairOptions.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          {/* 4. Qavat, Xona Raqami, Xona Nomi */}
          <Col span={8}>
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

          <Col span={8}>
            <FormItem
              label="Xona Raqami"
              field="number"
            >
              <Input placeholder="Masalan: 304, 102" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          <Col span={8}>
            <FormItem
              label="Xona Nomi / Maqsadi"
              field="name"
              rules={[{ required: true, message: 'Xona nomi kiritilishi shart!' }]}
            >
              <Input placeholder="Xona nomi" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>

          {/* 5. Mas'ul Xodim (MOL / Xona Mudiri) */}
          <Col span={24}>
            <FormItem
              label="Mas’ul Xodim (MOL / Xona Mudiri)"
              field="responsibleUserId"
            >
              <Select
                placeholder="Xonaga mas’ul shaxsni tanlang (MOL)"
                allowClear
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
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
