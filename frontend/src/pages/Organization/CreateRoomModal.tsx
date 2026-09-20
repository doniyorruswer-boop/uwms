import React, { useState, useEffect } from 'react';
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
  defaultBuildingId?: string;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  visible,
  onClose,
  defaultDepartmentId,
  defaultBuildingId,
}) => {
  const [form] = Form.useForm();
  const createRoomMutation = useCreateRoomMutation();
  const { allDepartments, buildings } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(defaultBuildingId);
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const maxFloor = selectedBuilding?.floorsCount || 20;

  useEffect(() => {
    if (visible) {
      const initialBuildingId = defaultBuildingId || (buildings.length > 0 ? buildings[0].id : undefined);
      setSelectedBuildingId(initialBuildingId);
      form.setFieldsValue({
        floor: 1,
        buildingId: initialBuildingId,
        departmentId: defaultDepartmentId,
      });
    }
  }, [visible, defaultBuildingId, defaultDepartmentId, buildings, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      const buildingObj = buildings.find((b) => b.id === values.buildingId);
      await createRoomMutation.mutateAsync({
        number: values.number?.trim() || undefined,
        name: values.name.trim(),
        floor: Number(values.floor) || 1,
        buildingId: values.buildingId,
        building: buildingObj?.name || 'Bosh bino',
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
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={16}>
          <Col span={14}>
            <FormItem
              label="Bino / Korpus"
              field="buildingId"
              rules={[{ required: true, message: 'Binoni tanlash shart!' }]}
            >
              <Select
                placeholder="Xona joylashgan binoni tanlang"
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
              <Input placeholder="Masalan: 101, 204-A (raqamsiz bo‘lsa bo‘sh qoldiring)" style={{ borderRadius: 0 }} />
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
