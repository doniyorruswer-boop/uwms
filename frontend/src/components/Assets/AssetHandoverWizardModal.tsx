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
  Badge,
  Descriptions,
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
  IconFile,
} from '@arco-design/web-react/icon';
import { useQueryClient } from '@tanstack/react-query';
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
  initialActionType?: HandoverItemActionType;
}

export const AssetHandoverWizardModal: React.FC<AssetHandoverWizardModalProps> = ({
  visible,
  onClose,
  selectedAssets,
  onSuccess,
  initialActionType,
}) => {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);

  // 1-Qadam: Destination & Specific details
  const [actionType, setActionType] = useState<HandoverItemActionType>('TRANSFER_TO_MOL');
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [repairDescription, setRepairDescription] = useState<string>('');
  const [writeOffReason, setWriteOffReason] = useState<string>('');
  const [shortageReason, setShortageReason] = useState<string>('');

  // 2-Qadam: Participants & General Note
  const [commandantUserId, setCommandantUserId] = useState<string | undefined>(undefined);
  const [accountantUserId, setAccountantUserId] = useState<string | undefined>(undefined);
  const [autoDetectedBuildingName, setAutoDetectedBuildingName] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string>('');

  // Queries
  const { buildings, rooms } = useOrganizationQuery();
  const { warehouses } = useWarehousesQuery();
  const { data: usersData, isLoading: isLoadingUsers } = useUsersQuery({
    page: 1,
    pageSize: 150,
    isActive: true,
  });

  const createHandoverMutation = useCreateHandoverMutation();

  // Reset form and auto-resolve data when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      const chosenAction = initialActionType || 'TRANSFER_TO_MOL';
      setActionType(chosenAction);
      setTargetUserId(undefined);
      setTargetWarehouseId(chosenAction === 'RETURN_TO_WAREHOUSE' && warehouses?.[0]?.id ? warehouses[0].id : undefined);
      setRepairDescription('');
      setWriteOffReason('');
      setShortageReason('');
      setNote('');

      // Determine initial room from first selected asset
      const initialRoomId = selectedAssets[0]?.roomId || undefined;
      setSelectedRoomId(initialRoomId);

      // Auto-resolve building and commandant from first asset's room
      if (initialRoomId) {
        resolveCommandantAndBuilding(initialRoomId);
      } else {
        setCommandantUserId(undefined);
        setAutoDetectedBuildingName(undefined);
      }
    }
  }, [visible, selectedAssets, rooms, buildings, warehouses, initialActionType]);

  // Helper to auto-resolve commandant and building name
  const resolveCommandantAndBuilding = (roomId: string) => {
    const r = rooms.find((rm) => rm.id === roomId);
    if (r) {
      const bld = buildings.find(
        (b) => b.name === r.building || b.id === (r as any).buildingId || b.id === (r as any).building?.id
      );
      if (bld) {
        setAutoDetectedBuildingName(bld.name);
        if (bld.commendantId) {
          setCommandantUserId(bld.commendantId);
          return;
        }
      } else if (r.building) {
        setAutoDetectedBuildingName(r.building);
      }
    }
  };

  // When room changes in Transfer to MOL, update commandant if possible
  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    if (roomId) {
      resolveCommandantAndBuilding(roomId);
    }
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Topshiruvchi mas'ul shaxs har doim joriy tizimga kirgan foydalanuvchi bo'ladi
  const departingUserId = currentUser?.id || '';

  // Modal ichidagi checkboxlar holati (standart barchasi tanlangan bo'ladi)
  const [selectedAssetKeys, setSelectedAssetKeys] = useState<string[]>([]);

  useEffect(() => {
    if (visible && selectedAssets.length > 0) {
      setSelectedAssetKeys(selectedAssets.map((a) => a.id));
    } else {
      setSelectedAssetKeys([]);
    }
  }, [visible, selectedAssets]);

  // Faqat modal ichidagi checkboxlar orqali tanlangan aktivlar
  const effectiveAssets = useMemo(() => {
    return selectedAssets.filter((a) => selectedAssetKeys.includes(a.id));
  }, [selectedAssets, selectedAssetKeys]);

  const availableUsers = useMemo(() => {
    if (!usersData?.items) return [];
    return usersData.items.filter((u) => u.id !== departingUserId && u.isActive);
  }, [usersData, departingUserId]);

  // Potential Accountants
  const accountantUsers = useMemo(() => {
    if (!usersData?.items) return [];
    return usersData.items.filter((u) =>
      ['CHIEF_ACCOUNTANT', 'SUPER_ADMIN', 'VICE_RECTOR_FINANCE'].includes(u.role)
    );
  }, [usersData]);

  // Potential Commandants
  const commandantUsers = useMemo(() => {
    if (!usersData?.items) return [];
    return usersData.items.filter((u) =>
      ['COMMENDANT', 'SUPER_ADMIN'].includes(u.role)
    );
  }, [usersData]);

  // Set default accountant
  useEffect(() => {
    if (accountantUsers.length > 0 && !accountantUserId) {
      const chief = accountantUsers.find((u) => u.role === 'CHIEF_ACCOUNTANT');
      setAccountantUserId(chief?.id || accountantUsers[0].id);
    }
  }, [accountantUsers, accountantUserId]);

  // Step 0 validation before proceeding to Step 1
  const handleProceedToStep2 = () => {
    if (effectiveAssets.length === 0) {
      Message.warning('Iltimos, topshirish uchun kamida bitta aktivni checkbox orqali belgilang!');
      return;
    }

    if (actionType === 'TRANSFER_TO_MOL' && !targetUserId) {
      Message.warning('Iltimos, yangi moddiy javobgar shaxsni (MOL) tanlang!');
      return;
    }

    if (actionType === 'RETURN_TO_WAREHOUSE' && !targetWarehouseId) {
      Message.warning('Iltimos, qabul qiluvchi universitet omborini tanlang!');
      return;
    }

    if (actionType === 'SEND_TO_REPAIR' && !repairDescription.trim()) {
      Message.warning('Iltimos, ta’mirlash sababi yoki nosozlik tavsifini kiriting!');
      return;
    }

    if (actionType === 'WRITE_OFF' && !writeOffReason.trim()) {
      Message.warning('Iltimos, hisobdan chiqarish (yaroqsizlik) sababini kiriting!');
      return;
    }

    if (actionType === 'SHORTAGE' && !shortageReason.trim()) {
      Message.warning('Iltimos, kamomad bo‘yicha tushuntirish yoki sababni kiriting!');
      return;
    }

    setCurrentStep(1);
  };

  // Submit Handover Application
  const handleSubmit = async () => {
    if (effectiveAssets.length === 0) {
      Message.warning('Iltimos, topshirish uchun kamida bitta aktivni checkbox orqali belgilang!');
      return;
    }

    // Determine Handover Type
    let handoverType: HandoverType = 'PARTIAL_TRANSFER';
    if (actionType === 'RETURN_TO_WAREHOUSE') {
      handoverType = 'RETURN_TO_WAREHOUSE';
    } else if (actionType === 'TRANSFER_TO_MOL' && selectedRoomId) {
      handoverType = 'ROOM_TRANSFER';
    }

    // Build items with their individual actions and notes
    const items = effectiveAssets.map((asset) => {
      let conditionNote = `Holati: ${asset.status}`;
      let investigationNote: string | undefined = undefined;

      if (actionType === 'SEND_TO_REPAIR') {
        conditionNote = `Nosozlik: ${repairDescription.trim()}`;
      } else if (actionType === 'WRITE_OFF') {
        conditionNote = `Yaroqsiz: ${writeOffReason.trim()}`;
      } else if (actionType === 'SHORTAGE') {
        investigationNote = shortageReason.trim();
      }

      return {
        itemInstanceId: asset.id,
        actionType,
        targetUserId: actionType === 'TRANSFER_TO_MOL' ? targetUserId : undefined,
        targetWarehouseId: actionType === 'RETURN_TO_WAREHOUSE' ? targetWarehouseId : undefined,
        conditionNote,
        investigationNote,
      };
    });

    try {
      const payload = {
        type: handoverType,
        departingUserId,
        targetUserId: actionType === 'TRANSFER_TO_MOL' ? targetUserId : undefined,
        targetWarehouseId: actionType === 'RETURN_TO_WAREHOUSE' ? targetWarehouseId : undefined,
        roomId: selectedRoomId || effectiveAssets[0]?.roomId,
        commandantUserId,
        accountantUserId,
        note: note.trim() || undefined,
        isDraft: false,
        items,
      };

      const result = await createHandoverMutation.mutateAsync(payload as any);
      Message.success({
        content: `'${result.handoverNumber}' topshirish arizasi muvaffaqiyatli rasmiylashtirildi va ko‘rib chiqish uchun yuborildi!`,
        duration: 5000,
      });

      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
      if (onSuccess) {
        onSuccess(result);
      }
    } catch {
      // Error handled in useCreateHandoverMutation
    }
  };

  // Calculate total book value of selected assets
  const totalBookValue = useMemo(() => {
    return effectiveAssets.reduce((sum, a) => {
      const val = a.currentBookValue !== undefined ? Number(a.currentBookValue) : Number(a.purchasePrice || 0);
      return sum + val;
    }, 0);
  }, [effectiveAssets]);

  const targetUserObj = useMemo(() => {
    return usersData?.items?.find((u) => u.id === targetUserId);
  }, [usersData, targetUserId]);

  const targetWarehouseObj = useMemo(() => {
    return warehouses?.find((w) => w.id === targetWarehouseId);
  }, [warehouses, targetWarehouseId]);

  const selectedRoomObj = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  // Asset Table Columns for Step 1
  const assetColumns = [
    {
      title: 'Inventar №',
      dataIndex: 'inventoryNumber',
      key: 'inventoryNumber',
      width: 140,
      render: (val: string) => <b style={{ color: '#165DFF' }}>{val}</b>,
    },
    {
      title: 'Aktiv Nomi va Modeli',
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
      title: 'Joriy Xonasi',
      dataIndex: 'roomName',
      key: 'roomName',
      width: 160,
      render: (val: string) => val || 'Biriktirilmagan',
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (st: string) => {
        let color = 'arcoblue';
        let label = st;
        if (st === 'IN_USE') {
          color = 'green';
          label = 'Foydalanishda';
        } else if (st === 'NEW') {
          color = 'blue';
          label = 'Yangi';
        } else if (st === 'IN_REPAIR') {
          color = 'orange';
          label = 'Ta’mirda';
        } else if (st === 'WRITTEN_OFF') {
          color = 'red';
          label = 'Spisanie';
        }
        return <Tag color={color} size="small">{label}</Tag>;
      },
    },
    {
      title: 'Qoldiq Qiymati',
      key: 'price',
      width: 130,
      render: (_: any, record: ItemInstance) => {
        const val = record.currentBookValue !== undefined ? record.currentBookValue : record.purchasePrice || 0;
        return <span>{Number(val).toLocaleString('uz-UZ')} so‘m</span>;
      },
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconSwap style={{ color: '#165DFF', fontSize: 20 }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>Aktivlarni Topshirish (Moddiy Javobgarlik Vizardi)</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 840 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={onClose}>Bekor qilish</Button>
          <Space>
            {currentStep === 1 && (
              <Button icon={<IconLeft />} onClick={() => setCurrentStep(0)}>
                Orqaga (Yo‘nalishni o‘zgartirish)
              </Button>
            )}
            {currentStep === 0 ? (
              <Button
                type="primary"
                icon={<IconRight />}
                onClick={handleProceedToStep2}
              >
                Keyingi: Ishtirokchilar va Izoh
              </Button>
            ) : (
              <Button
                type="primary"
                status="success"
                icon={<IconCheckCircle />}
                loading={createHandoverMutation.isPending}
                onClick={handleSubmit}
              >
                Topshirish arizasini yuborish (SUBMIT)
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <Steps current={currentStep} size="small">
          <Step title="1-Qadam: Aktivlar va Harakat (Destination)" description="Aktivlar va yo‘nalishni tanlash" />
          <Step title="2-Qadam: Ishtirokchilar va Izoh" description="Komendant, hisobchi va topshirish asosi" />
        </Steps>
      </div>

      {/* 1-QADAM: AKTIVLAR VA HARAKAT */}
      {currentStep === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            showIcon
            content={
              <span>
                Sizning nomingizdagi jami <strong>{selectedAssets.length} ta</strong> asosiy vositadan <strong>{effectiveAssets.length} tasi</strong> belgilandi.
                Topshirmoqchi bo‘lgan ashyolaringizni jadvaldagi checkboxlar orqali tanlang. Qabul qiluvchi tomon va barcha mas’ullar tasdiqlagach, rasmiy <strong>OS-1 dalolatnomasi</strong> kuchga kiradi.
              </span>
            }
          />

          {/* Tanlangan aktivlar jadvali (ichki checkboxlar bilan) */}
          <Card
            className="uwms-card"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Topshiriladigan aktivlar: <b>{effectiveAssets.length}</b> / {selectedAssets.length} ta belgilandi</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                  Jami qoldiq qiymat: <b style={{ color: '#00B42A' }}>{totalBookValue.toLocaleString('uz-UZ')} so‘m</b>
                </span>
              </div>
            }
            bodyStyle={{ padding: 0 }}
          >
            <Table
              rowKey="id"
              columns={assetColumns}
              data={selectedAssets}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedAssetKeys,
                onChange: (keys) => setSelectedAssetKeys(keys as string[]),
              }}
              pagination={selectedAssets.length > 5 ? { pageSize: 5, sizeCanChange: false } : false}
              size="small"
              scroll={{ y: 220 }}
            />
          </Card>

          {/* Umumiy yo‘nalish tanlash */}
          <Card className="uwms-card" title="Aktivlar qayerga topshiriladi? (Yo‘nalishni tanlang)">
            <Radio.Group
              direction="vertical"
              value={actionType}
              onChange={(val) => setActionType(val as HandoverItemActionType)}
              style={{ width: '100%' }}
            >
              {/* Option 1: Boshqa MOL */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-1)' }}>
                <Radio value="TRANSFER_TO_MOL">
                  <Space align="start">
                    <IconUser style={{ color: '#165DFF', fontSize: 16, marginTop: 2 }} />
                    <div>
                      <Text style={{ fontWeight: 600 }}>Boshqa Moddiy Javobgar Shaxsga (MOL) o‘tkazish</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Kafedraning yangi laboranti, o‘qituvchisi yoki bo‘lim mas’uliga biriktirish
                      </Text>
                    </div>
                  </Space>
                </Radio>
                {actionType === 'TRANSFER_TO_MOL' && (
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 12, background: 'var(--color-fill-1)', borderRadius: 4 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Yangi Moddiy Javobgar Shaxs (Yangi MOL)" required style={{ marginBottom: 0 }}>
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
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Ashyolar joylashadigan Xona" style={{ marginBottom: 0 }}>
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
                      </Col>
                    </Row>
                  </div>
                )}
              </div>

              {/* Option 2: Omborga qaytarish */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-1)' }}>
                <Radio value="RETURN_TO_WAREHOUSE">
                  <Space align="start">
                    <IconHome style={{ color: '#00B42A', fontSize: 16, marginTop: 2 }} />
                    <div>
                      <Text style={{ fontWeight: 600 }}>Universitet Markaziy Omboriga qaytarish</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Foydalanilmayotgan yoki ortiqcha jihozlarni omborxona balansiga topshirish
                      </Text>
                    </div>
                  </Space>
                </Radio>
                {actionType === 'RETURN_TO_WAREHOUSE' && (
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 12, background: 'var(--color-fill-1)', borderRadius: 4 }}>
                    <Form.Item label="Qabul qiluvchi Universitet Omborxonasi" required style={{ marginBottom: 0 }}>
                      <Select
                        placeholder="Omborxonani tanlang..."
                        value={targetWarehouseId}
                        onChange={setTargetWarehouseId}
                      >
                        {warehouses?.map((wh) => (
                          <Select.Option key={wh.id} value={wh.id}>
                            {wh.name} {wh.code ? `(${wh.code})` : ''} {wh.isMain ? '• Bosh omborxona' : ''}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </div>
                )}
              </div>

              {/* Option 3: Ta’mirga yuborish */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-1)' }}>
                <Radio value="SEND_TO_REPAIR">
                  <Space align="start">
                    <IconTool style={{ color: '#FF7D00', fontSize: 16, marginTop: 2 }} />
                    <div>
                      <Text style={{ fontWeight: 600 }}>Ta’mirlash va Servis Xizmatiga yuborish</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Nosoz holatdagi jihozlarni universitet texnik ustaxonasiga topshirish
                      </Text>
                    </div>
                  </Space>
                </Radio>
                {actionType === 'SEND_TO_REPAIR' && (
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 12, background: 'var(--color-fill-1)', borderRadius: 4 }}>
                    <Form.Item label="Nosozlik tavsifi (Defect description)" required style={{ marginBottom: 0 }}>
                      <Input.TextArea
                        placeholder="Jihozda qanday nuqson yoki nosozlik aniqlandi? (Masalan: quvvat blokida nosozlik, ekran darz ketgan, operatsion tizim yuklanmaydi...)"
                        value={repairDescription}
                        onChange={setRepairDescription}
                        rows={2}
                      />
                    </Form.Item>
                  </div>
                )}
              </div>

              {/* Option 4: Hisobdan chiqarish (Spisanie) */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-1)' }}>
                <Radio value="WRITE_OFF">
                  <Space align="start">
                    <IconDelete style={{ color: '#722ED1', fontSize: 16, marginTop: 2 }} />
                    <div>
                      <Text style={{ fontWeight: 600 }}>Hisobdan chiqarishga (Spisanie / OS-4) tavsiya qilish</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Ma’nan eskirgan va tiklab bo‘lmaydigan ashyolarni doimiy komissiyaga taqdim etish
                      </Text>
                    </div>
                  </Space>
                </Radio>
                {actionType === 'WRITE_OFF' && (
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 12, background: 'var(--color-fill-1)', borderRadius: 4 }}>
                    <Form.Item label="Yaroqsizlik sababi va asosi" required style={{ marginBottom: 0 }}>
                      <Input.TextArea
                        placeholder="Jihozning texnik yaroqsizligi, foydalanish muddati o‘tganligi yoki tiklash iqtisodiy jihatdan maqsadga muvofiq emasligi..."
                        value={writeOffReason}
                        onChange={setWriteOffReason}
                        rows={2}
                      />
                    </Form.Item>
                  </div>
                )}
              </div>

              {/* Option 5: Kamomad (Tekshiruv) */}
              <div style={{ padding: '8px 0' }}>
                <Radio value="SHORTAGE">
                  <Space align="start">
                    <IconExclamationCircle style={{ color: '#F53F3F', fontSize: 16, marginTop: 2 }} />
                    <div>
                      <Text style={{ fontWeight: 600 }}>Kamomad sifatida qayd etish (Tekshiruvga yuborish)</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Topilmagan yoki yo‘qolgan ashyolar bo‘yicha ichki xizmat tekshiruvi dalolatnomasi
                      </Text>
                    </div>
                  </Space>
                </Radio>
                {actionType === 'SHORTAGE' && (
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 12, background: 'var(--color-fill-1)', borderRadius: 4 }}>
                    <Form.Item label="Yo‘qolganlik / topilmaganlik sababi" required style={{ marginBottom: 0 }}>
                      <Input.TextArea
                        placeholder="Ashyo qachondan buyon mavjud emas? Oxirgi inventarizatsiya natijasi va sabablari..."
                        value={shortageReason}
                        onChange={setShortageReason}
                        rows={2}
                      />
                    </Form.Item>
                  </div>
                )}
              </div>
            </Radio.Group>
          </Card>
        </div>
      )}

      {/* 2-QADAM: ISHTIROKCHILAR VA IZOH */}
      {currentStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Card */}
          <Card className="uwms-card" style={{ background: '#F7F8FA', border: '1px solid #E5E6EB' }}>
            <Descriptions
              title="Topshirish ma’lumotlari qisqacha mazmuni"
              size="small"
              column={2}
              data={[
                {
                  label: 'Topshiruvchi mas’ul (Eski MOL)',
                  value: <b>{currentUser?.fullName || 'Joriy foydalanuvchi'}</b>,
                },
                {
                  label: 'Aktivlar soni',
                  value: <Badge count={effectiveAssets.length} style={{ backgroundColor: '#165DFF' }} />,
                },
                {
                  label: 'Umumiy qoldiq qiymat',
                  value: <b style={{ color: '#00B42A' }}>{totalBookValue.toLocaleString('uz-UZ')} so‘m</b>,
                },
                {
                  label: 'Tanlangan yo‘nalish',
                  value: (
                    <span>
                      {actionType === 'TRANSFER_TO_MOL' && `Boshqa MOLga: ${targetUserObj?.fullName || '—'}`}
                      {actionType === 'RETURN_TO_WAREHOUSE' && `Omborga: ${targetWarehouseObj?.name || '—'}`}
                      {actionType === 'SEND_TO_REPAIR' && 'Ta’mir va texnik servis xizmati'}
                      {actionType === 'WRITE_OFF' && 'Hisobdan chiqarish (Spisanie / OS-4)'}
                      {actionType === 'SHORTAGE' && 'Kamomad tekshiruvi'}
                    </span>
                  ),
                },
                ...(selectedRoomObj
                  ? [
                      {
                        label: 'Tegishli xona',
                        value: `${selectedRoomObj.number} - ${selectedRoomObj.name} (${selectedRoomObj.building || 'Bino'})`,
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          {/* Form: Commandant, Accountant, Note */}
          <Card className="uwms-card" title="Ishtirokchi mas’ullar va Tasdiqlash zanjiri">
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label={
                      <Space>
                        <span>Bino Komendanti</span>
                        {autoDetectedBuildingName && (
                          <Tag size="small" color="arcoblue">
                            {autoDetectedBuildingName}
                          </Tag>
                        )}
                      </Space>
                    }
                    extra="Xona va ashyolar butunligini joyida tekshiruvchi mas’ul shaxs."
                  >
                    <Select
                      placeholder="Bino komendantini tanlang..."
                      value={commandantUserId}
                      onChange={setCommandantUserId}
                      allowClear
                      loading={isLoadingUsers}
                    >
                      {commandantUsers.map((u) => (
                        <Select.Option key={u.id} value={u.id}>
                          {u.fullName} ({u.position || 'Komendant'})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    label="Moddiy Hisobchi (Buxgalteriya)"
                    extra="Buxgalteriya balansi va moliyaviy o‘tkazmani nazorat qiluvchi hisobchi."
                  >
                    <Select
                      placeholder="Hisobchini tanlang..."
                      value={accountantUserId}
                      onChange={setAccountantUserId}
                      allowClear
                      loading={isLoadingUsers}
                    >
                      {accountantUsers.map((u) => (
                        <Select.Option key={u.id} value={u.id}>
                          {u.fullName} ({u.role === 'CHIEF_ACCOUNTANT' ? 'Bosh hisobchi' : u.position || 'Hisobchi'})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Topshirish Asosi va Izoh (Ixtiyoriy)"
                extra="Masalan: Kafedra mudiri ko‘rsatmasi, o‘quv yili yakuni bo‘yicha inventarizatsiya yoki rotatsiya..."
              >
                <Input.TextArea
                  placeholder="Rasmiy asos, buyruq raqami yoki qo‘shimcha izohni kiriting..."
                  value={note}
                  onChange={setNote}
                  rows={3}
                />
              </Form.Item>
            </Form>
          </Card>

          <Alert
            type="warning"
            showIcon
            content={
              <div>
                <strong>Tasdiqlash tartibi:</strong> Topshirish arizasi yuborilgach, barcha mas’ullarning (Yangi MOL, Bino komendanti, Buxgalter) <code>/inbox</code> bo‘limida harakat vazifalari shakllanadi. Barcha tomonlar to‘liq imzolagandan so‘nggina asosiy vosita egasi serverda rasman yangilanadi.
              </div>
            }
          />
        </div>
      )}
    </Modal>
  );
};
