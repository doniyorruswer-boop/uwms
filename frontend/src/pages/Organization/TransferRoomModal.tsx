import React, { useEffect, useState, useMemo } from 'react';
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
  Input,
  Message,
  Table,
  Spin,
} from '@arco-design/web-react';
import {
  IconSwap,
  IconHome,
  IconUser,
  IconFile,
  IconCheckCircle,
  IconApps,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import {
  useUpdateRoomMutation,
  useOrganizationQuery,
  type RoomItem,
  type UpdateRoomData,
} from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import { useCreateHandoverMutation } from '../../hooks/useHandoverQuery';
import { useAuthStore } from '../../store/authStore';

const FormItem = Form.Item;
const { Row, Col } = Grid;
const { Text } = Typography;
const { TextArea } = Input;

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
  const { user: currentUser } = useAuthStore();
  const updateRoomMutation = useUpdateRoomMutation();
  const createHandoverMutation = useCreateHandoverMutation();
  const { allDepartments, buildings } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 150, isActive: true });

  // 1. Load active assets assigned to this room
  const { assets: allRoomAssets, isLoading: isLoadingRoomAssets } = useAssetsQuery(
    room?.id ? { roomId: room.id, limit: 200 } : undefined
  );
  const roomAssets = useMemo(() => {
    if (!room?.id) return [];
    return (allRoomAssets || []).filter(
      (a) => a.roomId === room.id && a.status !== 'WRITTEN_OFF'
    );
  }, [allRoomAssets, room?.id]);

  const [changeLocation, setChangeLocation] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>();
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const maxFloor = selectedBuilding?.floorsCount || 20;

  // 2. Resolve building commandant & chief accountant
  const roomBuilding = useMemo(() => {
    if (!room) return null;
    return buildings.find((b) => b.id === room.buildingId || b.name === room.building);
  }, [buildings, room]);

  const commandantUsers = useMemo(() => {
    return (usersData?.items || []).filter(
      (u) => u.role === 'COMMENDANT' || u.role === 'SUPER_ADMIN'
    );
  }, [usersData]);

  const accountantUsers = useMemo(() => {
    return (usersData?.items || []).filter(
      (u) => u.role === 'CHIEF_ACCOUNTANT' || u.role === 'SUPER_ADMIN' || u.role === 'VICE_RECTOR_FINANCE'
    );
  }, [usersData]);

  const chiefAccountant = useMemo(() => {
    return (
      usersData?.items?.find((u) => u.role === 'CHIEF_ACCOUNTANT') ||
      accountantUsers[0]
    );
  }, [usersData, accountantUsers]);

  const defaultCommandantId = useMemo(() => {
    return (
      roomBuilding?.commendantId ||
      roomBuilding?.commendant?.id ||
      commandantUsers[0]?.id ||
      undefined
    );
  }, [roomBuilding, commandantUsers]);

  const isUnnumbered = !room?.number || room.number.startsWith('RS-') || room.number === 'RAQAMSIZ';
  const roomDisplayName = room ? (isUnnumbered ? room.name : `${room.number}-xona: ${room.name}`) : '';

  useEffect(() => {
    if (visible && room) {
      setChangeLocation(false);
      setSelectedBuildingId(room.buildingId || undefined);
      form.setFieldsValue({
        departmentId: room.departmentId || undefined,
        responsibleUserId: room.responsibleUserId || undefined,
        commandantUserId: defaultCommandantId,
        accountantUserId: chiefAccountant?.id || undefined,
        note: `Xona topshiruvi (${roomDisplayName}): xona va uning ${roomAssets.length} ta asosiy vositasi topshirilmoqda.`,
        changeLocation: false,
        buildingId: room.buildingId || undefined,
        floor: room.floor || 1,
      });
    } else {
      form.resetFields();
      setChangeLocation(false);
    }
  }, [visible, room, form, defaultCommandantId, chiefAccountant, roomDisplayName, roomAssets.length]);

  const handleSubmit = async () => {
    if (!room) return;
    try {
      const values = await form.validate();
      const targetDept = allDepartments.find((d) => d.id === values.departmentId);
      const isNewMOL = Boolean(values.responsibleUserId && values.responsibleUserId !== room.responsibleUserId);

      // 1. If room has assets -> Create ROOM_TRANSFER Handover to route to /inbox
      if (roomAssets.length > 0 && values.responsibleUserId) {
        const departingUserId =
          room.responsibleUserId ||
          roomAssets.find((a) => a.responsibleUserId)?.responsibleUserId ||
          currentUser?.id ||
          '';

        await createHandoverMutation.mutateAsync({
          type: 'ROOM_TRANSFER',
          departingUserId,
          targetUserId: values.responsibleUserId,
          roomId: room.id,
          buildingId: room.buildingId || undefined,
          commandantUserId: values.commandantUserId || defaultCommandantId || undefined,
          accountantUserId: values.accountantUserId || chiefAccountant?.id || undefined,
          note:
            values.note ||
            `Xona topshiruvi (${roomDisplayName}): xona va uning ${roomAssets.length} ta aktivlari rasmiy tarzda yangi mas’ul shaxsga o‘tkazilmoqda.`,
          items: roomAssets.map((asset) => ({
            itemInstanceId: asset.id,
            actionType: 'TRANSFER_TO_MOL',
            targetUserId: values.responsibleUserId,
            conditionNote: `Xona: ${roomDisplayName} | Holati: ${asset.status}`,
          })),
        });
      }

      // 2. Update room department / location if changed
      const updateData: UpdateRoomData = {
        departmentId: values.departmentId || null,
        responsibleUserId:
          roomAssets.length > 0 && isNewMOL
            ? room.responsibleUserId // Keep current until handover is fully signed in /inbox!
            : values.responsibleUserId || null,
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

      const roomLabel =
        room.number && !room.number.startsWith('RS-')
          ? `${room.number}-xona`
          : room.name;

      if (roomAssets.length > 0 && values.responsibleUserId) {
        Message.success(
          `'${roomLabel}' va uning ${roomAssets.length} ta asosiy vositasi bo‘yicha topshirish dalolatnomasi (OS-1) shakllantirildi va tasdiqlash uchun /inbox bo‘limiga yuborildi!`
        );
      } else {
        Message.success(
          targetDept
            ? `'${roomLabel}' muvaffaqiyatli '${targetDept.name}' tasarrufiga o‘tkazildi!`
            : `'${roomLabel}' ma’lumotlari yangilandi!`
        );
      }
      onClose();
    } catch {
      // Validation error handled by Arco form
    }
  };

  const assetColumns = [
    {
      title: 'Inventar №',
      dataIndex: 'inventoryNumber',
      width: 140,
      render: (val: string) => (
        <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 600 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Asosiy Vosita Nomi',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>
            {r.itemName || r.item?.name || 'Asosiy vosita'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
            {r.categoryName || r.item?.category?.name || 'Jihoz'}
            {r.serialNumber ? ` • Seriya: ${r.serialNumber}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      width: 120,
      render: (st: string) => (
        <Tag color={st === 'IN_USE' ? 'green' : 'orange'} style={{ borderRadius: 0, fontSize: 11 }}>
          {st === 'IN_USE' ? 'Foydalanishda' : st}
        </Tag>
      ),
    },
    {
      title: 'Xarid Narxi',
      dataIndex: 'purchasePrice',
      width: 130,
      render: (val: number) => (val ? `${val.toLocaleString()} so‘m` : '—'),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconSwap style={{ color: '#165DFF', fontSize: 18 }} />
          <span>Xona va Jihozlar Javobgarligini Topshirish (Facility Transfer)</span>
        </Space>
      }
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateRoomMutation.isPending || createHandoverMutation.isPending}
      okText={
        roomAssets.length > 0
          ? `Topshirish arizasini yaratish (${roomAssets.length} ta aktiv)`
          : 'O‘tkazishni Tasdiqlash'
      }
      cancelText="Bekor qilish"
      style={{ width: 680, borderRadius: 0 }}
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
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text bold style={{ fontSize: 15 }}>
                {roomDisplayName}
              </Text>
              <Space>
                <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                  {room.building} • {room.floor}-qavat
                </Tag>
                {room.departmentName && (
                  <Tag color="green" style={{ borderRadius: 0 }}>
                    {room.departmentName}
                  </Tag>
                )}
              </Space>
            </div>

            <div style={{ fontSize: 12, display: 'flex', gap: 16, color: 'var(--color-text-2)' }}>
              <span>
                Joriy Mas’ul (MOL):{' '}
                <Text bold>{room.responsibleUserName || 'MOL belgilanmagan'}</Text>
                {room.responsibleUserPhone ? ` (${room.responsibleUserPhone})` : ''}
              </span>
              <span>
                Bino Komendanti:{' '}
                <Text bold>{roomBuilding?.commendant?.fullName || 'Belgilanmagan'}</Text>
              </span>
            </div>

            {roomAssets.length > 0 ? (
              <Alert
                type="warning"
                icon={<IconFile />}
                style={{ padding: '8px 12px', fontSize: 12 }}
                content={
                  <span>
                    Ushbu xonada <strong>{roomAssets.length} ta asosiy vosita</strong> mavjud. Yangi
                    MOL tanlanganda, avtomatik ravishda <strong>OS-1 Topshirish arizasi</strong>{' '}
                    shakllantirilib, barcha mas’ullar (Yangi MOL, Komendant, Buxgalter) imzolashi
                    uchun <code>/inbox</code> markaziga yuboriladi.
                  </span>
                }
              />
            ) : (
              <Alert
                type="info"
                icon={<IconInfoCircle />}
                style={{ padding: '6px 12px', fontSize: 12 }}
                content="Ushbu xonada hozircha asosiy vositalar ro‘yxatga olinmagan. Xona bevosita yangi bo‘lim yoki mas’ul tasarrufiga o‘tkaziladi."
              />
            )}
          </div>

          {/* Assets in this Room Table Preview */}
          {isLoadingRoomAssets ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Spin tip="Xona aktivlari yuklanmoqda..." />
            </div>
          ) : roomAssets.length > 0 ? (
            <div style={{ border: '1px solid var(--color-border-2)', padding: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text bold style={{ fontSize: 13 }}>
                  <IconApps style={{ marginRight: 6, color: '#165DFF' }} />
                  Xonadagi topshiriladigan asosiy vositalar ({roomAssets.length} ta)
                </Text>
                <Tag color="green" size="small" style={{ borderRadius: 0 }}>
                  <IconCheckCircle style={{ marginRight: 4 }} />
                  Barchasi arizaga kiritiladi
                </Tag>
              </div>
              <Table
                rowKey="id"
                size="small"
                border={{ wrapper: true, cell: true }}
                pagination={roomAssets.length > 5 ? { pageSize: 5, size: 'mini' } : false}
                data={roomAssets}
                columns={assetColumns}
                scroll={{ y: 180 }}
              />
            </div>
          ) : null}

          {/* Transfer Form */}
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <FormItem
                  label="Biriktiriladigan Kafedra / Bo‘lim / Xizmat"
                  field="departmentId"
                  rules={[{ required: true, message: 'Bo‘limni tanlang!' }]}
                  extra="Xona qaysi fakultet, kafedra yoki bo‘lim tasarrufiga o‘tkazilmoqda"
                >
                  <Select
                    placeholder="Bo‘lim yoki kafedrani tanlang..."
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
              </Col>

              <Col span={12}>
                <FormItem
                  label="Yangi Moddiy Javobgar Shaxs (Yangi MOL)"
                  field="responsibleUserId"
                  rules={
                    roomAssets.length > 0
                      ? [{ required: true, message: 'Yangi moddiy javobgar shaxsni (MOL) tanlang!' }]
                      : []
                  }
                  extra={
                    roomAssets.length > 0
                      ? 'Xona va jihozlar javobgarligini qabul qiluvchi yangi xodim'
                      : 'Xona javobgari (Ixtiyoriy)'
                  }
                >
                  <Select
                    placeholder="Yangi moddiy javobgar shaxsni tanlang..."
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
              </Col>
            </Row>

            {/* Commandant & Chief Accountant fields for Handover signing */}
            <Row gutter={16}>
              <Col span={12}>
                <FormItem
                  label="Bino Komendanti (Nazorat qiluvchi)"
                  field="commandantUserId"
                  extra={
                    roomBuilding?.commendant
                      ? `Bino komendanti avtomatik belgilandi (${roomBuilding.commendant.fullName})`
                      : 'Xona joylashgan bino komendanti'
                  }
                >
                  <Select
                    placeholder="Bino komendantini tanlang..."
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      String(option.props.children || '')
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                    style={{ borderRadius: 0 }}
                  >
                    {commandantUsers.map((u) => (
                      <Select.Option key={u.id} value={u.id}>
                        {u.fullName} ({u.role}
                        {u.phone ? ` • ${u.phone}` : ''})
                      </Select.Option>
                    ))}
                  </Select>
                </FormItem>
              </Col>

              <Col span={12}>
                <FormItem
                  label="Bosh / Moddiy Hisobchi"
                  field="accountantUserId"
                  extra="Buxgalteriya hisobida asosiy vositalarni qayta ro‘yxatga oluvchi mas’ul"
                >
                  <Select
                    placeholder="Bosh hisobchini tanlang..."
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      String(option.props.children || '')
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                    style={{ borderRadius: 0 }}
                  >
                    {accountantUsers.map((u) => (
                      <Select.Option key={u.id} value={u.id}>
                        {u.fullName} ({u.role}
                        {u.phone ? ` • ${u.phone}` : ''})
                      </Select.Option>
                    ))}
                  </Select>
                </FormItem>
              </Col>
            </Row>

            <FormItem
              label="Topshirish Asosi va Izoh (Dalolatnoma uchun)"
              field="note"
            >
              <TextArea
                placeholder="Masalan: Kafedra mudiri buyrug‘i, yangi o‘quv yili taqsimoti yoki xonani qayta taqsimlash munosabati bilan..."
                rows={2}
                style={{ borderRadius: 0 }}
              />
            </FormItem>

            {/* Optional Physical Location Transfer */}
            <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--color-border-2)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>Bino va qavatni ham ko‘chirish</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Agar xona boshqa binoga ko‘chirilayotgan bo‘lsa yoqing
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

