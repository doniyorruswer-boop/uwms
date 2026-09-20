import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Radio,
  Grid,
  Table,
  Tag,
  Card,
  Steps,
  Message,
} from '@arco-design/web-react';
import {
  IconSwap,
  IconCheckCircle,
  IconUser,
  IconHome,
  IconTool,
  IconDelete,
  IconExclamationCircle,
  IconRight,
  IconLeft,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useWarehousesQuery } from '../../hooks/useWarehouseQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';
import { useCreateHandoverMutation } from '../../hooks/useHandoverQuery';
import type { ItemInstance, HandoverType, HandoverItemActionType } from '../../types';

const { Text, Title, Paragraph } = Typography;
const { Row, Col } = Grid;
const Step = Steps.Step;

interface AssetHandoverWizardModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAssets: ItemInstance[];
  onSuccess?: (createdHandover: any) => void;
}

export const AssetHandoverWizardModal: React.FC<AssetHandoverWizardModalProps> = ({
  visible,
  onClose,
  selectedAssets,
  onSuccess,
}) => {
  const { user: currentUser } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();

  // Action / Target
  const [actionType, setActionType] = useState<HandoverItemActionType>('TRANSFER_TO_MOL');
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [commandantUserId, setCommandantUserId] = useState<string | undefined>(undefined);
  const [accountantUserId, setAccountantUserId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string>('');

  // Queries
  const { buildings, rooms } = useOrganizationQuery();
  const { warehouses } = useWarehousesQuery();
  const { data: usersData, isLoading: isLoadingUsers } = useUsersQuery({
    page: 1,
    pageSize: 100,
    isActive: true,
  });

  const createHandoverMutation = useCreateHandoverMutation();

  // Reset form on open
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setActionType('TRANSFER_TO_MOL');
      setTargetUserId(undefined);
      setTargetWarehouseId(undefined);
      setSelectedRoomId(selectedAssets[0]?.roomId || undefined);
      setNote('');

      // Try auto-resolving building & commandant from first asset room
      const firstRoomId = selectedAssets[0]?.roomId;
      if (firstRoomId) {
        const r = rooms.find((rm) => rm.id === firstRoomId);
        if (r) {
          const b = buildings.find((bld) => bld.name === r.building || bld.id === (r as any).buildingId);
          if (b?.commendantId) {
            setCommandantUserId(b.commendantId);
          }
        }
      }
    }
  }, [visible, selectedAssets, rooms, buildings]);

  // When room changes, auto-resolve commandant
  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    const r = rooms.find((rm) => rm.id === roomId);
    if (r) {
      const b = buildings.find((bld) => bld.name === r.building || bld.id === (r as any).buildingId);
      if (b?.commendantId) {
        setCommandantUserId(b.commendantId);
      }
    }
  };

  // Potential MOLs (excluding current user)
  const availableUsers = useMemo(() => {
    if (!usersData?.items) return [];
    return usersData.items.filter((u) => u.id !== currentUser?.id && u.isActive);
  }, [usersData, currentUser]);

  // Potential Accountants
  const accountantUsers = useMemo(() => {
    if (!usersData?.items) return [];
    return usersData.items.filter((u) =>
      ['CHIEF_ACCOUNTANT', 'SUPER_ADMIN', 'VICE_RECTOR_FINANCE'].includes(u.role)
    );
  }, [usersData]);

  // Set default accountant
  useEffect(() => {
    if (accountantUsers.length > 0 && !accountantUserId) {
      setAccountantUserId(accountantUsers[0].id);
    }
  }, [accountantUsers, accountantUserId]);

  const handleSubmit = async () => {
    if (selectedAssets.length === 0) {
      Message.warning('Iltimos, kamida bitta aktivni tanlang!');
      return;
    }
    if (actionType === 'TRANSFER_TO_MOL' && !targetUserId) {
      Message.warning('Iltimos, yangi moddiy javobgar shaxsni (MOL) tanlang!');
      return;
    }
    if (actionType === 'RETURN_TO_WAREHOUSE' && !targetWarehouseId) {
      Message.warning('Iltimos, qabul qiluvchi omborni tanlang!');
      return;
    }

    // Map handover type
    let handoverType: HandoverType = 'PARTIAL_TRANSFER';
    if (actionType === 'RETURN_TO_WAREHOUSE') {
      handoverType = 'RETURN_TO_WAREHOUSE';
    } else if (actionType === 'TRANSFER_TO_MOL' && selectedRoomId) {
      handoverType = 'ROOM_TRANSFER';
    }

    const items = selectedAssets.map((asset) => ({
      itemInstanceId: asset.id,
      actionType,
      targetUserId: actionType === 'TRANSFER_TO_MOL' ? targetUserId : undefined,
      targetWarehouseId: actionType === 'RETURN_TO_WAREHOUSE' ? targetWarehouseId : undefined,
      conditionNote: `Holati: ${asset.status}`,
      investigationNote: actionType === 'SHORTAGE' ? note || 'Kamomad qayd etildi' : undefined,
    }));

    try {
      const payload = {
        type: handoverType,
        departingUserId: currentUser?.id || '',
        targetUserId: actionType === 'TRANSFER_TO_MOL' ? targetUserId : undefined,
        targetWarehouseId: actionType === 'RETURN_TO_WAREHOUSE' ? targetWarehouseId : undefined,
        roomId: selectedRoomId,
        commandantUserId,
        accountantUserId,
        note: note.trim() || undefined,
        items,
      };

      const result = await createHandoverMutation.mutateAsync(payload as any);
      Message.success({
        content: `Aktivlarni topshirish arizasi (${result.handoverNumber}) muvaffaqiyatli shakllantirildi va tasdiqlash uchun /inbox bo‘limiga yuborildi!`,
        duration: 5000,
      });
      onClose();
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      // Error handled in mutation
    }
  };

  const assetColumns = [
    {
      title: 'Inventar №',
      dataIndex: 'inventoryNumber',
      key: 'inventoryNumber',
      width: 140,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'Aktiv Nomi',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (_: any, record: ItemInstance) => (
        <div>
          <Text style={{ fontWeight: 600 }}>{record.itemName}</Text>
          {record.itemModel && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Model: {record.itemModel}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Joriy Xona',
      dataIndex: 'roomName',
      key: 'roomName',
      width: 160,
      render: (val: string) => val || 'Biriktirilmagan',
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (st: string) => (
        <Tag color={st === 'ACTIVE' ? 'green' : st === 'IN_REPAIR' ? 'orange' : 'arcoblue'}>
          {st}
        </Tag>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconSwap style={{ color: '#165DFF', fontSize: 18 }} />
          <span>Aktivlarni Topshirish (Moddiy Javobgarlik Rotatsiyasi)</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 780 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={onClose}>Bekor qilish</Button>
          <Space>
            {currentStep === 1 && (
              <Button icon={<IconLeft />} onClick={() => setCurrentStep(0)}>
                Orqaga
              </Button>
            )}
            {currentStep === 0 ? (
              <Button
                type="primary"
                icon={<IconRight />}
                onClick={() => {
                  if (selectedAssets.length === 0) {
                    Message.warning('Iltimos, kamida bitta aktivni tanlang!');
                    return;
                  }
                  setCurrentStep(1);
                }}
              >
                Keyingi: Qabul Qiluvchi va Mas’ullar
              </Button>
            ) : (
              <Button
                type="primary"
                status="success"
                icon={<IconCheckCircle />}
                loading={createHandoverMutation.isPending}
                onClick={handleSubmit}
              >
                Topshirish Arizasini Yuborish (SUBMIT)
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <Steps current={currentStep} size="small">
          <Step title="Aktivlar va Yo‘nalish" description="Qayerga topshiriladi?" />
          <Step title="Qabul Qiluvchi va Imzolar" description="Yangi MOL va Mas’ullar" />
        </Steps>
      </div>

      {currentStep === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            showIcon
            content={
              <span>
                Siz <strong>{selectedAssets.length} ta</strong> asosiy vositani topshirish jarayonini boshlayapsiz. 
                Arizani yuborganingizda aktivlar hali hisobingizdan chiqmaydi; qabul qiluvchi tomon va bino komendanti 
                tasdiqlagandan so‘ng rasmiy OS-1 dalolatnomasi bilan kuchga kiradi.
              </span>
            }
          />

          {/* Destination Selector */}
          <Card className="uwms-card" title="Aktivlar Qayerga Topshiriladi?">
            <Radio.Group
              direction="vertical"
              value={actionType}
              onChange={(val) => setActionType(val as HandoverItemActionType)}
              style={{ width: '100%' }}
            >
              <Radio value="TRANSFER_TO_MOL" style={{ marginBottom: 10 }}>
                <Space>
                  <IconUser style={{ color: '#165DFF' }} />
                  <div>
                    <Text style={{ fontWeight: 600 }}>Boshqa Moddiy Javobgar Shaxsga (MOL)</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Kafedraning yangi laboranti, o‘qituvchisi yoki kafedra mudiriga biriktirish
                    </Text>
                  </div>
                </Space>
              </Radio>

              <Radio value="RETURN_TO_WAREHOUSE" style={{ marginBottom: 10 }}>
                <Space>
                  <IconHome style={{ color: '#00B42A' }} />
                  <div>
                    <Text style={{ fontWeight: 600 }}>Universitet Markaziy Omboriga Qaytarish</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Foydalanilmayotgan yoki ortiqcha jihozlarni ombor balansiga topshirish
                    </Text>
                  </div>
                </Space>
              </Radio>

              <Radio value="SEND_TO_REPAIR" style={{ marginBottom: 10 }}>
                <Space>
                  <IconTool style={{ color: '#FF7D00' }} />
                  <div>
                    <Text style={{ fontWeight: 600 }}>Ta’mirlash va Servis Xizmatiga Yuborish</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Nosoz ashyolarni universitet servis ustaxonasiga topshirish
                    </Text>
                  </div>
                </Space>
              </Radio>

              <Radio value="WRITE_OFF" style={{ marginBottom: 10 }}>
                <Space>
                  <IconDelete style={{ color: '#722ED1' }} />
                  <div>
                    <Text style={{ fontWeight: 600 }}>Hisobdan Chiqarishga (Spisanie / OS-4) Tavsiya Qilish</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Ma’nan eskirgan va yaroqsiz mulklarni komissiyaga taqdim etish
                    </Text>
                  </div>
                </Space>
              </Radio>

              <Radio value="SHORTAGE">
                <Space>
                  <IconExclamationCircle style={{ color: '#F53F3F' }} />
                  <div>
                    <Text style={{ fontWeight: 600 }}>Kamomad Sifatida Qayd Etish (Tekshiruvga)</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Mavjud bo‘lmagan yoki topilmagan ashyolar bo‘yicha ichki tekshiruv dalolatnomasi
                    </Text>
                  </div>
                </Space>
              </Radio>
            </Radio.Group>
          </Card>

          {/* Selected Assets Table */}
          <Card
            className="uwms-card"
            title={`Tanlangan Asosiy Vositalar (${selectedAssets.length} ta)`}
            style={{ maxHeight: 250, overflowY: 'auto' }}
          >
            <Table
              rowKey="id"
              columns={assetColumns}
              data={selectedAssets}
              pagination={false}
              size="small"
            />
          </Card>
        </div>
      )}

      {currentStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card className="uwms-card" title="Qabul Qiluvchi Tomon va Mas’ullar">
            <Form layout="vertical">
              {/* If Transfer to MOL */}
              {actionType === 'TRANSFER_TO_MOL' && (
                <>
                  <Form.Item
                    label="Yangi Moddiy Javobgar Shaxs (Yangi MOL)"
                    required
                    extra="Ushbu xodim o‘z /inbox sahifasiga kirib, ashyolarni qabul qilishi shart."
                  >
                    <Select
                      placeholder="Yangi mas’ul xodimni tanlang..."
                      value={targetUserId}
                      onChange={setTargetUserId}
                      loading={isLoadingUsers}
                      showSearch
                      filterOption={(input, option) =>
                        String(option.props.children || '')
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {availableUsers.map((u) => (
                        <Select.Option key={u.id} value={u.id}>
                          {u.fullName} ({u.role} • {u.position || 'Xodim'})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label="Ashyolar Qaysi Xona/Auditoriyaga Biriktiriladi?"
                    extra="Jihozlar qabul qilingandan keyin joylashadigan xona."
                  >
                    <Select
                      placeholder="Xonani tanlang..."
                      value={selectedRoomId}
                      onChange={handleRoomChange}
                      showSearch
                      allowClear
                      filterOption={(input, option) =>
                        String(option.props.children || '')
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {rooms.map((rm) => (
                        <Select.Option key={rm.id} value={rm.id}>
                          {rm.number} - {rm.name} ({rm.building || 'Bino'})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </>
              )}

              {/* If Return to Warehouse */}
              {actionType === 'RETURN_TO_WAREHOUSE' && (
                <Form.Item
                  label="Qabul Qiluvchi Omborxona"
                  required
                  extra="Ashyolar qabul qilingach, ushbu omborxona balansiga kirim qilinadi."
                >
                  <Select
                    placeholder="Omborni tanlang..."
                    value={targetWarehouseId}
                    onChange={setTargetWarehouseId}
                  >
                    {warehouses?.map((wh) => (
                      <Select.Option key={wh.id} value={wh.id}>
                        {wh.name} {wh.code ? `(${wh.code})` : ''} {wh.isMain ? '• Bosh ombor' : ''}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              {/* Commandant & Accountant */}
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Bino Komendanti"
                    extra="Xona va mulk butunligini tasdiqlovchi xolis mas’ul."
                  >
                    <Select
                      placeholder="Bino komendantini tanlang..."
                      value={commandantUserId}
                      onChange={setCommandantUserId}
                      allowClear
                    >
                      {usersData?.items
                        ?.filter((u) => ['COMMENDANT', 'SUPER_ADMIN'].includes(u.role))
                        ?.map((u) => (
                          <Select.Option key={u.id} value={u.id}>
                            {u.fullName} (Komendant)
                          </Select.Option>
                        ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Moddiy Hisobchi"
                    extra="Buxgalteriya qoldiqlarini tekshiruvchi mutaxassis."
                  >
                    <Select
                      placeholder="Hisobchini tanlang..."
                      value={accountantUserId}
                      onChange={setAccountantUserId}
                      allowClear
                    >
                      {accountantUsers.map((u) => (
                        <Select.Option key={u.id} value={u.id}>
                          {u.fullName} ({u.position || 'Hisobchi'})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Note */}
              <Form.Item label="Topshirish Asosi va Izoh (Ixtiyoriy)">
                <Input.TextArea
                  placeholder="Masalan: Kafedra mudiri topshirig'i, o'quv yili yakuni bo'yicha rotatsiya yoki laboratoriya ta'miri..."
                  value={note}
                  onChange={setNote}
                  rows={2}
                />
              </Form.Item>
            </Form>
          </Card>

          <Alert
            type="warning"
            showIcon
            content="Arizani yuborishingiz bilan barcha mas’ullarning /inbox (Action Center) bo‘limida yangi vazifa paydo bo‘ladi va ular biometrik mobil QR-imzo orqali tasdiqlashlari mumkin bo‘ladi."
          />
        </div>
      )}
    </Modal>
  );
};
