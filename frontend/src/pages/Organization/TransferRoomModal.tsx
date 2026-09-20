import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Grid,
  Space,
  Typography,
  Tag,
  Alert,
  Switch,
  InputNumber,
  Message,
} from '@arco-design/web-react';
import { IconSwap, IconBranch, IconHome, IconUser } from '@arco-design/web-react/icon';
import {
  useUpdateRoomMutation,
  useOrganizationQuery,
  type RoomItem,
  type UpdateRoomData,
} from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;
const { Text } = Typography;

const departmentTypeLabels: Record<string, string> = {
  RECTORATE: 'Rektorat',
  DIVISION: 'Boshqarma / Markaz',
  DEPARTMENT: 'Bo‘lim va Xizmat',
  FACULTY: 'Fakultet',
  CHAIR: 'Kafedra',
  LIBRARY: 'ARM / Kutubxona',
  LAB: 'Laboratoriya',
};

interface TransferRoomModalProps {
  visible: boolean;
  room: RoomItem | null;
  onClose: () => void;
}

export const TransferRoomModal: React.FC<TransferRoomModalProps> = ({
  visible,
  room,
  onClose,
}) => {
  const [form] = Form.useForm();
  const updateRoomMutation = useUpdateRoomMutation();
  const { allDepartments, buildings } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 150, isActive: true });

  const [changeLocation, setChangeLocation] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>();
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const maxFloor = selectedBuilding?.floorsCount || 20;

  useEffect(() => {
    if (visible && room) {
      setChangeLocation(false);
      setSelectedBuildingId(room.buildingId || undefined);
      form.setFieldsValue({
        departmentId: room.departmentId || undefined,
        responsibleUserId: room.responsibleUserId || undefined,
        changeLocation: false,
        buildingId: room.buildingId || undefined,
        floor: room.floor || 1,
      });
    } else {
      form.resetFields();
      setChangeLocation(false);
    }
  }, [visible, room, form]);

  const handleSubmit = async () => {
    if (!room) return;
    try {
      const values = await form.validate();
      const targetDept = allDepartments.find((d) => d.id === values.departmentId);

      const updateData: UpdateRoomData = {
        departmentId: values.departmentId || null,
        responsibleUserId: values.responsibleUserId || null,
      };

      if (changeLocation && values.buildingId) {
        const bld = buildings.find((b) => b.id === values.buildingId);
        updateData.buildingId = values.buildingId;
        updateData.building = bld?.name || room.building;
        updateData.floor = Number(values.floor) || room.floor;
      }

      await updateRoomMutation.mutateAsync({
        id: room.id,
        data: updateData,
      });

      const roomLabel = room.number && !room.number.startsWith('RS-')
        ? `${room.number}-xona`
        : room.name;

      Message.success(
        targetDept
          ? `'${roomLabel}' muvaffaqiyatli '${targetDept.name}' tasarrufiga o‘tkazildi!`
          : `'${roomLabel}' biriktirilgan bo‘limdan chiqarildi!`
      );
      onClose();
    } catch {
      // Validation error handled by Arco form
    }
  };

  const isUnnumbered = !room?.number || room.number.startsWith('RS-') || room.number === 'RAQAMSIZ';
  const roomDisplayName = room ? (isUnnumbered ? room.name : `${room.number}-xona: ${room.name}`) : '';

  return (
    <Modal
      title={
        <Space>
          <IconSwap style={{ color: '#165DFF', fontSize: 18 }} />
          <span>Xonani Boshqa Kafedra / Bo‘limga O‘tkazish</span>
        </Space>
      }
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateRoomMutation.isPending}
      okText="O‘tkazishni Tasdiqlash"
      cancelText="Bekor qilish"
      style={{ width: 620, borderRadius: 0 }}
    >
      {room && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current Room Information Card */}
          <div
            style={{
              background: 'var(--color-fill-2)',
              padding: '12px 16px',
              border: '1px solid var(--color-border-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text bold style={{ fontSize: 14 }}>
                {roomDisplayName}
              </Text>
              <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                {room.building} • {room.floor}-qavat
              </Tag>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              <span>Hozirgi bo‘lim: </span>
              <Text bold>{room.departmentName || 'Biriktirilmagan'}</Text>
              {room.responsibleUserName && (
                <span style={{ marginLeft: 12 }}>
                  MOL: <Text bold>{room.responsibleUserName}</Text>
                </span>
              )}
            </div>
            {room.itemCount > 0 && (
              <Alert
                type="info"
                style={{ marginTop: 4, padding: '4px 10px', fontSize: 12 }}
                content={`Eslatma: Ushbu xonadagi ${room.itemCount} ta asosiy vosita (jihoz) xona bilan birgalikda yangi bo‘lim balansiga o‘tkaziladi.`}
              />
            )}
          </div>

          {/* Transfer Form */}
          <Form form={form} layout="vertical">
            <FormItem
              label="Yangi Biriktiriladigan Kafedra / Bo‘lim / Xizmat"
              field="departmentId"
              rules={[{ required: true, message: 'Yangi bo‘limni tanlang!' }]}
              extra="Xona qaysi fakultet, kafedra yoki bo‘lim ixtiyoriga o‘tkazilayotganini belgilang"
            >
              <Select
                placeholder="Bo‘lim yoki kafedrani qidiring va tanlang..."
                showSearch
                filterOption={(input, option) =>
                  String(option.props.children || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                style={{ borderRadius: 0 }}
              >
                {allDepartments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name} ({departmentTypeLabels[dept.type] || dept.type}
                    {dept.parent ? ` • ${dept.parent.name}` : ''})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>

            <FormItem
              label="Yangi Moddiy Javobgar Shaxs (MOL)"
              field="responsibleUserId"
              extra="Agar kafedra o‘zgarganda xonaga javobgar shaxs ham o‘zgarsa, yangi xodimni tanlang (yoki avvalgisi qoladi)"
            >
              <Select
                placeholder="Yangi moddiy javobgar shaxsni tanlang (Ixtiyoriy)"
                showSearch
                allowClear
                filterOption={(input, option) =>
                  String(option.props.children || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                style={{ borderRadius: 0 }}
              >
                {(usersData?.items || []).map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.fullName} ({u.role}
                    {u.department?.name ? ` • ${u.department.name}` : ''})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>

            {/* Optional Physical Location Transfer */}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--color-border-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>Bino va qavatni ham ko‘chirish</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Agar xona boshqa binoga ko‘chirilayotgan bo‘lsa
                  </div>
                </div>
                <Switch
                  checked={changeLocation}
                  onChange={(val) => setChangeLocation(val)}
                />
              </div>

              {changeLocation && (
                <Row gutter={16}>
                  <Col span={14}>
                    <FormItem
                      label="Yangi Bino / Korpus"
                      field="buildingId"
                      rules={[{ required: changeLocation, message: 'Binoni tanlang!' }]}
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
                            {b.name} ({b.floorsCount} qavat)
                          </Select.Option>
                        ))}
                      </Select>
                    </FormItem>
                  </Col>

                  <Col span={10}>
                    <FormItem
                      label={`Qavat (1 - ${maxFloor})`}
                      field="floor"
                      rules={[{ required: changeLocation, message: 'Qavatni tanlang!' }]}
                    >
                      <InputNumber
                        min={1}
                        max={maxFloor}
                        style={{ width: '100%', borderRadius: 0 }}
                      />
                    </FormItem>
                  </Col>
                </Row>
              )}
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
};
