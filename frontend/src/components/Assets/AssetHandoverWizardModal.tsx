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
  Checkbox,
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
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [isRoomlessDepartment, setIsRoomlessDepartment] = useState<boolean>(false);
  const [repairDescription, setRepairDescription] = useState<string>('');
  const [writeOffReason, setWriteOffReason] = useState<string>('');
  const [shortageReason, setShortageReason] = useState<string>('');

  // 2-Qadam: Participants & General Note
  const [commandantUserId, setCommandantUserId] = useState<string | undefined>(undefined);
  const [accountantUserId, setAccountantUserId] = useState<string | undefined>(undefined);
  const [autoDetectedBuildingName, setAutoDetectedBuildingName] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string>('');

  // Queries
  const { buildings, rooms, allDepartments } = useOrganizationQuery();
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
      setIsRoomlessDepartment(false);

      // Auto-resolve building and commandant from first asset's room
      if (initialRoomId) {
        resolveCommandantAndBuilding(initialRoomId);
      } else {
        setSelectedBuildingId(undefined);
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
        setSelectedBuildingId(bld.id);
        setAutoDetectedBuildingName(bld.name);
        if (bld.commendantId) {
          setCommandantUserId(bld.commendantId);
          return;
        }
      } else if (r.building) {
        setAutoDetectedBuildingName(r.building);
        const bldByName = buildings.find((b) => b.name === r.building);
        if (bldByName) {
          setSelectedBuildingId(bldByName.id);
          if (bldByName.commendantId) {
            setCommandantUserId(bldByName.commendantId);
          }
        }
      }
    }
  };

  // When building changes in Transfer to MOL, filter rooms and update commandant
  const handleBuildingChange = (buildingId?: string) => {
    setSelectedBuildingId(buildingId);
    if (buildingId) {
      const bld = buildings.find((b) => b.id === buildingId);
      if (bld) {
        setAutoDetectedBuildingName(bld.name);
        if (bld.commendantId) {
          setCommandantUserId(bld.commendantId);
        }
      }
      // If currently selected room is not in this building, clear selected room
      if (selectedRoomId) {
        const curRoom = rooms.find((rm) => rm.id === selectedRoomId);
        const curRoomBldId =
          (curRoom as any)?.buildingId ||
          (curRoom as any)?.building?.id ||
          buildings.find((b) => b.name === curRoom?.building)?.id;
        if (curRoom && curRoomBldId && curRoomBldId !== buildingId) {
          setSelectedRoomId(undefined);
        }
      }
    } else {
      setAutoDetectedBuildingName(undefined);
    }
  };

  // When room changes in Transfer to MOL, update building and commandant if possible
  const handleRoomChange = (roomId?: string) => {
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

  const EXCLUDED_RECIPIENT_ROLES = [
    'RECTOR',
    'VICE_RECTOR_FINANCE',
    'CHIEF_ACCOUNTANT',
    'AUDITOR',
    'SUPER_ADMIN',
    'ADMIN',
  ];

  const availableUsers = useMemo(() => {
    if (!usersData?.items) return [];
    const filtered = usersData.items.filter(
      (u) =>
        u.id !== departingUserId &&
        u.isActive &&
        !EXCLUDED_RECIPIENT_ROLES.includes(u.role)
    );

    return filtered.sort((a, b) => {
      const aIsOwn = Boolean(
        currentUser?.departmentId && a.departmentId && a.departmentId === currentUser.departmentId
      );
      const bIsOwn = Boolean(
        currentUser?.departmentId && b.departmentId && b.departmentId === currentUser.departmentId
      );
      if (aIsOwn !== bIsOwn) {
        return aIsOwn ? -1 : 1; // Own department comes first!
      }
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [usersData, departingUserId, currentUser?.departmentId]);

  const ownDeptUsers = useMemo(() => {
    return availableUsers.filter(
      (u) => Boolean(currentUser?.departmentId && u.departmentId === currentUser.departmentId)
    );
  }, [availableUsers, currentUser?.departmentId]);

  const otherDeptUsers = useMemo(() => {
    return availableUsers.filter(
      (u) => !currentUser?.departmentId || u.departmentId !== currentUser.departmentId
    );
  }, [availableUsers, currentUser?.departmentId]);

  // Determine user's primary/associated buildings (department building, asset rooms building)
  const userBuildingIds = useMemo(() => {
    const ids = new Set<string>();

    // 1. User's department building
    if (currentUser?.departmentId && allDepartments) {
      const userDept = allDepartments.find((d) => d.id === currentUser.departmentId);
      if (userDept?.buildingId) ids.add(userDept.buildingId);
      if (userDept?.building?.id) ids.add(userDept.building.id);
    }

    // 2. Buildings containing user's department
    if (currentUser?.departmentId && buildings) {
      buildings.forEach((b) => {
        if (b.departments?.some((d) => d.id === currentUser.departmentId)) {
          ids.add(b.id);
        }
      });
    }

    // 3. User's rooms or current selected assets' building
    selectedAssets.forEach((a) => {
      if (a.roomId) {
        const rm = rooms.find((r) => r.id === a.roomId);
        if (rm) {
          if ((rm as any).buildingId) ids.add((rm as any).buildingId);
          const bld = buildings.find((b) => b.name === rm.building);
          if (bld) ids.add(bld.id);
        }
      }
    });

    return Array.from(ids);
  }, [currentUser?.departmentId, allDepartments, buildings, selectedAssets, rooms]);

  const sortedBuildings = useMemo(() => {
    if (!buildings) return [];
    return [...buildings].sort((a, b) => {
      const aIsOwn = userBuildingIds.includes(a.id);
      const bIsOwn = userBuildingIds.includes(b.id);
      if (aIsOwn !== bIsOwn) {
        return aIsOwn ? -1 : 1; // User's own building comes first!
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [buildings, userBuildingIds]);

  const ownBuildings = useMemo(() => {
    return sortedBuildings.filter((b) => userBuildingIds.includes(b.id));
  }, [sortedBuildings, userBuildingIds]);

  const otherBuildings = useMemo(() => {
    return sortedBuildings.filter((b) => !userBuildingIds.includes(b.id));
  }, [sortedBuildings, userBuildingIds]);

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

  const targetUserObj = useMemo(() => {
    return usersData?.items?.find((u) => u.id === targetUserId);
  }, [usersData, targetUserId]);

  const isSameDepartment = useMemo(() => {
    if (!currentUser?.departmentId || !targetUserObj?.departmentId) return false;
    return currentUser.departmentId === targetUserObj.departmentId;
  }, [currentUser?.departmentId, targetUserObj?.departmentId]);

  const isInterDepartment = actionType === 'TRANSFER_TO_MOL' && !!targetUserId && !isSameDepartment;

  // Set default accountant ONLY for inter-departmental transfers
  useEffect(() => {
    if (isInterDepartment && accountantUsers.length > 0 && !accountantUserId) {
      const chief = accountantUsers.find((u) => u.role === 'CHIEF_ACCOUNTANT');
      setAccountantUserId(chief?.id || accountantUsers[0].id);
    } else if (isSameDepartment && actionType === 'TRANSFER_TO_MOL') {
      setAccountantUserId(undefined);
    }
  }, [isInterDepartment, isSameDepartment, actionType, accountantUsers, accountantUserId]);

  // Step 0 validation before proceeding to Step 1
  const handleProceedToStep2 = () => {
    if (effectiveAssets.length === 0) {
      Message.warning('Iltimos, topshirish uchun kamida bitta aktivni checkbox orqali belgilang!');
      return;
    }

    if (actionType === 'TRANSFER_TO_MOL') {
      if (!targetUserId) {
        Message.warning('Iltimos, yangi moddiy javobgar shaxsni (Yangi MOL) tanlang!');
        return;
      }
      if (!isRoomlessDepartment && !selectedRoomId) {
        Message.warning('Iltimos, ashyolar joylashadigan bino va aniq xonani tanlang!');
        return;
      }
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
    } else if (actionType === 'TRANSFER_TO_MOL' && selectedRoomId && !isRoomlessDepartment) {
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

    if (actionType === 'TRANSFER_TO_MOL' && isInterDepartment && !isRoomlessDepartment) {
      if (!commandantUserId) {
        Message.warning('Kafedralararo o‘tkazishda Bino Komendantini tanlash shart!');
        return;
      }
    }
    if (actionType === 'TRANSFER_TO_MOL' && isInterDepartment) {
      if (!accountantUserId) {
        Message.warning('Kafedralararo o‘tkazishda Moddiy Hisobchini (Buxgalteriya) tanlash shart!');
        return;
      }
    }

    try {
      const payload = {
        type: handoverType,
        departingUserId,
        targetUserId: actionType === 'TRANSFER_TO_MOL' ? targetUserId : undefined,
        targetWarehouseId: actionType === 'RETURN_TO_WAREHOUSE' ? targetWarehouseId : undefined,
        buildingId: isRoomlessDepartment ? undefined : selectedBuildingId,
        roomId: isRoomlessDepartment ? undefined : (selectedRoomId || effectiveAssets[0]?.roomId),
        commandantUserId: isRoomlessDepartment ? undefined : (isInterDepartment ? commandantUserId : (commandantUserId || undefined)),
        accountantUserId: isInterDepartment ? accountantUserId : (accountantUserId || undefined),
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

  const targetWarehouseObj = useMemo(() => {
    return warehouses?.find((w) => w.id === targetWarehouseId);
  }, [warehouses, targetWarehouseId]);

  const selectedRoomObj = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  const selectedBuildingObj = useMemo(() => {
    return buildings.find((b) => b.id === selectedBuildingId || b.name === autoDetectedBuildingName);
  }, [buildings, selectedBuildingId, autoDetectedBuildingName]);

  const availableRooms = useMemo(() => {
    let list = rooms;
    if (selectedBuildingId) {
      list = list.filter((rm) => {
        const bldId =
          (rm as any).buildingId ||
          (rm as any).building?.id ||
          buildings.find((b) => b.name === rm.building)?.id;
        return bldId === selectedBuildingId;
      });
    }

    return [...list].sort((a, b) => {
      const aIsOwnDept = Boolean(
        currentUser?.departmentId && a.departmentId && a.departmentId === currentUser.departmentId
      );
      const bIsOwnDept = Boolean(
        currentUser?.departmentId && b.departmentId && b.departmentId === currentUser.departmentId
      );
      if (aIsOwnDept !== bIsOwnDept) {
        return aIsOwnDept ? -1 : 1; // Own department's rooms first!
      }
      return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
    });
  }, [rooms, selectedBuildingId, buildings, currentUser?.departmentId]);

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
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 14, background: 'var(--color-fill-1)', borderRadius: 6, border: '1px solid var(--color-border-2)' }}>
                    <Form layout="vertical">
                      <Row gutter={[16, 12]}>
                        <Col span={12}>
                          <Form.Item label="Yangi Moddiy Javobgar Shaxs (MOL)" required style={{ marginBottom: 0 }}>
                            <Select
                              placeholder="Yangi mas’ul xodimni tanlang..."
                              value={targetUserId}
                              onChange={setTargetUserId}
                              loading={isLoadingUsers}
                              showSearch
                              triggerProps={{
                                autoAlignPopupWidth: false,
                                position: 'bl',
                              }}
                              dropdownMenuStyle={{
                                maxHeight: 280,
                                overflowX: 'auto',
                                overflowY: 'auto',
                                minWidth: 460,
                              }}
                              renderFormat={(option) => {
                                const u = availableUsers.find((user) => user.id === option?.value);
                                if (!u) return option?.children;
                                return `${u.fullName}${u.position ? ` (${u.position})` : ''}`;
                              }}
                              filterOption={(input, option) => {
                                const u = availableUsers.find((user) => user.id === option.props.value);
                                if (!u) return false;
                                const q = input.toLowerCase().trim();
                                return (
                                  u.fullName?.toLowerCase().includes(q) ||
                                  u.username?.toLowerCase().includes(q) ||
                                  (u.position && u.position.toLowerCase().includes(q)) ||
                                  (u.department?.name && u.department.name.toLowerCase().includes(q))
                                );
                              }}
                            >
                              {ownDeptUsers.length > 0 && (
                                <Select.OptGroup label={`🏢 Kafedrangiz / Bo‘limingiz xodimlari (${ownDeptUsers.length})`}>
                                  {ownDeptUsers.map((u) => (
                                    <Select.Option key={u.id} value={u.id}>
                                      <div
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          gap: 16,
                                          whiteSpace: 'nowrap',
                                          minWidth: 'max-content',
                                        }}
                                      >
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                          <b>{u.fullName}</b>
                                          {u.position && (
                                            <span style={{ color: 'var(--color-text-3)', marginLeft: 6, fontSize: 12 }}>
                                              ({u.position})
                                            </span>
                                          )}
                                        </span>
                                        <Tag size="small" color="green" style={{ flexShrink: 0 }}>
                                          Kafedrangiz xodimi
                                        </Tag>
                                      </div>
                                    </Select.Option>
                                  ))}
                                </Select.OptGroup>
                              )}
                              {otherDeptUsers.length > 0 && (
                                <Select.OptGroup label={`🏛 Boshqa kafedra va bo‘limlar (${otherDeptUsers.length})`}>
                                  {otherDeptUsers.map((u) => {
                                    const deptName = u.department?.name || (u as any).departmentName;
                                    return (
                                      <Select.Option key={u.id} value={u.id}>
                                        <div
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 16,
                                            whiteSpace: 'nowrap',
                                            minWidth: 'max-content',
                                          }}
                                        >
                                          <span style={{ whiteSpace: 'nowrap' }}>
                                            <b>{u.fullName}</b>
                                            {u.position && (
                                              <span style={{ color: 'var(--color-text-3)', marginLeft: 6, fontSize: 12 }}>
                                                ({u.position})
                                              </span>
                                            )}
                                          </span>
                                          <Tag size="small" color="orange" style={{ flexShrink: 0 }}>
                                            {deptName || 'Boshqa bo‘lim'}
                                          </Tag>
                                        </div>
                                      </Select.Option>
                                    );
                                  })}
                                </Select.OptGroup>
                              )}
                            </Select>
                          </Form.Item>
                        </Col>

                        <Col span={24}>
                          <div style={{ padding: '8px 12px', background: 'var(--color-bg-2)', borderRadius: 4, border: '1px dashed var(--color-border-2)' }}>
                            <Checkbox
                              checked={isRoomlessDepartment}
                              onChange={(checked) => {
                                setIsRoomlessDepartment(checked);
                                if (checked) {
                                  setSelectedRoomId(undefined);
                                  setSelectedBuildingId(undefined);
                                  setCommandantUserId(undefined);
                                  setAutoDetectedBuildingName(undefined);
                                }
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>🏢 Xonasiz / Bo‘lim tasarrufidagi aktiv</span>
                              <span style={{ color: 'var(--color-text-3)', fontSize: 12, marginLeft: 8 }}>
                                (Qurilish va ta’mirlash, Garaj, IT infratuzilma yoki binosiz bo‘limlar — aniq xona talab etilmaydi)
                              </span>
                            </Checkbox>
                          </div>
                        </Col>

                        {!isRoomlessDepartment ? (
                          <>
                            <Col span={12}>
                              <Form.Item
                                label="Joylashuv: Bino / Korpus (Filtr)"
                                style={{ marginBottom: 0 }}
                                extra={selectedBuildingId ? `Tanlandi: ${autoDetectedBuildingName || 'Bino'}` : undefined}
                              >
                                <Select
                                  placeholder="Binoni tanlang (filtrlash)..."
                                  value={selectedBuildingId}
                                  onChange={handleBuildingChange}
                                  showSearch
                                  allowClear
                                  triggerProps={{
                                    autoAlignPopupWidth: false,
                                    position: 'bl',
                                  }}
                                  dropdownMenuStyle={{
                                    maxHeight: 280,
                                    overflowX: 'auto',
                                    overflowY: 'auto',
                                    minWidth: 440,
                                  }}
                                  filterOption={(input, option) => {
                                    const bld = buildings.find((b) => b.id === option.props.value);
                                    if (!bld) return false;
                                    const q = input.toLowerCase().trim();
                                    return (
                                      bld.name?.toLowerCase().includes(q) ||
                                      (bld.code && bld.code.toLowerCase().includes(q)) ||
                                      (bld.address && bld.address.toLowerCase().includes(q))
                                    );
                                  }}
                                >
                                  {ownBuildings.length > 0 && (
                                    <Select.OptGroup label={`🏢 Kafedrangiz joylashgan asosiy bino (${ownBuildings.length})`}>
                                      {ownBuildings.map((b) => (
                                        <Select.Option key={b.id} value={b.id}>
                                          <div
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              gap: 16,
                                              whiteSpace: 'nowrap',
                                              minWidth: 'max-content',
                                            }}
                                          >
                                            <span>
                                              <b>{b.name}</b> ({b.floorsCount} qavatli{b._count?.rooms ? `, ${b._count.rooms} ta xona` : ''})
                                            </span>
                                            <Tag size="small" color="green" style={{ flexShrink: 0 }}>
                                              Asosiy binongiz
                                            </Tag>
                                          </div>
                                        </Select.Option>
                                      ))}
                                    </Select.OptGroup>
                                  )}
                                  {otherBuildings.length > 0 && (
                                    <Select.OptGroup label={`🏛 Universitetning boshqa binolari (${otherBuildings.length})`}>
                                      {otherBuildings.map((b) => (
                                        <Select.Option key={b.id} value={b.id}>
                                          <div
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              gap: 16,
                                              whiteSpace: 'nowrap',
                                              minWidth: 'max-content',
                                            }}
                                          >
                                            <span>
                                              <b>{b.name}</b> ({b.floorsCount} qavatli{b._count?.rooms ? `, ${b._count.rooms} ta xona` : ''})
                                            </span>
                                            <Tag size="small" color="gray" style={{ flexShrink: 0 }}>
                                              Boshqa bino
                                            </Tag>
                                          </div>
                                        </Select.Option>
                                      ))}
                                    </Select.OptGroup>
                                  )}
                                </Select>
                              </Form.Item>
                            </Col>

                            <Col span={12}>
                              <Form.Item
                                label="Ashyolar joylashadigan Aniq Xona / Auditoriya"
                                required
                                style={{ marginBottom: 0 }}
                                extra={
                                  selectedBuildingId
                                    ? `"${autoDetectedBuildingName || 'Bino'}" dagi mavjud ${availableRooms.length} ta xona ko‘rsatilmoqda`
                                    : 'Xona tanlanganda uning binosi va komendanti avtomatik aniqlanadi.'
                                }
                              >
                                <Select
                                  placeholder={
                                    selectedBuildingId
                                      ? `${autoDetectedBuildingName || 'Bino'} bo‘yicha xonani tanlang...`
                                      : 'Xona yoki auditoriyani tanlang...'
                                  }
                                  value={selectedRoomId}
                                  onChange={handleRoomChange}
                                  showSearch
                                  allowClear
                                  triggerProps={{
                                    autoAlignPopupWidth: false,
                                    position: 'bl',
                                  }}
                                  dropdownMenuStyle={{
                                    maxHeight: 280,
                                    overflowX: 'auto',
                                    overflowY: 'auto',
                                    minWidth: 460,
                                  }}
                                  filterOption={(input, option) => {
                                    const rm = rooms.find((r) => r.id === option.props.value);
                                    if (!rm) return false;
                                    const q = input.toLowerCase().trim();
                                    return (
                                      rm.number?.toLowerCase().includes(q) ||
                                      rm.name?.toLowerCase().includes(q) ||
                                      (rm.building && rm.building.toLowerCase().includes(q)) ||
                                      `${rm.floor}`.includes(q)
                                    );
                                  }}
                                >
                                  {availableRooms.map((rm) => {
                                    const isOwnDeptRoom = Boolean(
                                      currentUser?.departmentId && rm.departmentId === currentUser.departmentId
                                    );
                                    return (
                                      <Select.Option key={rm.id} value={rm.id}>
                                        <div
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 16,
                                            whiteSpace: 'nowrap',
                                            minWidth: 'max-content',
                                          }}
                                        >
                                          <span style={{ whiteSpace: 'nowrap' }}>
                                            <b style={{ color: '#165DFF', marginRight: 6 }}>{rm.number}-xona:</b>
                                            <span>{rm.name}</span>
                                          </span>
                                          <Space size={4} style={{ flexShrink: 0 }}>
                                            {isOwnDeptRoom && <Tag size="small" color="green">Kafedrangiz xonasi</Tag>}
                                            <Tag size="small" color="blue">{rm.floor}-qavat</Tag>
                                            {!selectedBuildingId && (
                                              <Tag size="small" color="gray">{rm.building || 'Bino'}</Tag>
                                            )}
                                          </Space>
                                        </div>
                                      </Select.Option>
                                    );
                                  })}
                                </Select>
                              </Form.Item>
                            </Col>
                          </>
                        ) : (
                          <Col span={24}>
                            <Alert
                              type="success"
                              showIcon
                              content={
                                <span>
                                  Aktivlar <b>{targetUserObj?.fullName || 'Tanlangan mas’ul xodim'}</b> tasarrufiga umumiy ekspluatatsiya sifatida biriktiriladi (Joylashuvi: <em>"Bo‘lim tasarrufida / Obyektda (Xonasiz)"</em>). Bino komendanti talab etilmaydi.
                                </span>
                              }
                            />
                          </Col>
                        )}
                      </Row>
                    </Form>

                    {selectedRoomObj && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: '12px 16px',
                          background: 'var(--color-bg-2)',
                          borderRadius: 4,
                          border: '1px solid var(--color-border-2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                          <Space>
                            <Tag color="arcoblue" style={{ fontWeight: 600 }}>
                              Aniq Joylashuv
                            </Tag>
                            <Text bold style={{ fontSize: 13, color: 'var(--color-text-1)' }}>
                              🏢 {selectedRoomObj.building || autoDetectedBuildingName || 'Bino'} • {selectedRoomObj.number}-xona
                            </Text>
                          </Space>
                          <Tag color="green" size="small" style={{ fontWeight: 600 }}>
                            {selectedRoomObj.floor}-qavat
                          </Tag>
                        </div>
                        <Row gutter={[16, 6]}>
                          <Col span={12}>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                              Xona nomi va vazifasi:
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: 500 }}>
                              {selectedRoomObj.name}
                            </Text>
                          </Col>
                          <Col span={12}>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                              Mas’ul bino komendanti:
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: 500, color: '#165DFF' }}>
                              {commandantUsers.find((c) => c.id === commandantUserId)?.fullName || 'Avtomatik biriktiriladi (2-bosqichda)'}
                            </Text>
                          </Col>
                        </Row>
                      </div>
                    )}
                    {targetUserObj && isSameDepartment && (
                      <Alert
                        type="success"
                        showIcon
                        style={{ marginTop: 12, borderRadius: 6 }}
                        title="Kafedra ichki biriktiruvi (Audit izi to‘liq muhrlanadi)"
                        content={
                          <span>
                            Tanlangan xodim <b>{targetUserObj.fullName}</b> sizning kafedrangiz/bo‘limingiz tarkibida. Asosiy vosita kafedra balansida qoladi. Buxgalteriya va bino komendanti vizasini kutish talab etilmaydi — rasmiy ichki dalolatnoma tuziladi va aktiv tarixiga yoziladi.
                          </span>
                        }
                      />
                    )}

                    {targetUserObj && isInterDepartment && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 12, borderRadius: 6 }}
                        title="Kafedralararo rasmiy o‘tkazish (MOL Almashinuvi)"
                        content={
                          <span>
                            Tanlangan xodim boshqa kafedra/bo‘limga <b>({targetUserObj.department?.name || (targetUserObj as any).departmentName || 'Boshqa bo‘lim'})</b> mansub. Moddiy javobgarlik boshqa kafedraga o‘tayotganligi sababli, 2-bosqichda <b>Bino Komendanti</b> (joyida tekshirish uchun) va <b>Moddiy Hisobchi</b> (balans o‘tkazmasi uchun) ishtirok etishi shart!
                          </span>
                        }
                      />
                    )}
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
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 14, background: 'var(--color-fill-1)', borderRadius: 6, border: '1px solid var(--color-border-2)' }}>
                    <Form layout="vertical">
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
                    </Form>
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
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 14, background: 'var(--color-fill-1)', borderRadius: 6, border: '1px solid var(--color-border-2)' }}>
                    <Form layout="vertical">
                      <Form.Item label="Nosozlik tavsifi (Defect description)" required style={{ marginBottom: 0 }}>
                        <Input.TextArea
                          placeholder="Jihozda qanday nuqson yoki nosozlik aniqlandi? (Masalan: quvvat blokida nosozlik, ekran darz ketgan, operatsion tizim yuklanmaydi...)"
                          value={repairDescription}
                          onChange={setRepairDescription}
                          rows={2}
                        />
                      </Form.Item>
                    </Form>
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
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 14, background: 'var(--color-fill-1)', borderRadius: 6, border: '1px solid var(--color-border-2)' }}>
                    <Form layout="vertical">
                      <Form.Item label="Yaroqsizlik sababi va asosi" required style={{ marginBottom: 0 }}>
                        <Input.TextArea
                          placeholder="Jihozning texnik yaroqsizligi, foydalanish muddati o‘tganligi yoki tiklash iqtisodiy jihatdan maqsadga muvofiq emasligi..."
                          value={writeOffReason}
                          onChange={setWriteOffReason}
                          rows={2}
                        />
                      </Form.Item>
                    </Form>
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
                  <div style={{ marginLeft: 28, marginTop: 12, padding: 14, background: 'var(--color-fill-1)', borderRadius: 6, border: '1px solid var(--color-border-2)' }}>
                    <Form layout="vertical">
                      <Form.Item label="Yo‘qolganlik / topilmaganlik sababi" required style={{ marginBottom: 0 }}>
                        <Input.TextArea
                          placeholder="Ashyo qachondan buyon mavjud emas? Oxirgi inventarizatsiya natijasi va sabablari..."
                          value={shortageReason}
                          onChange={setShortageReason}
                          rows={2}
                        />
                      </Form.Item>
                    </Form>
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
                ...(isRoomlessDepartment
                  ? [
                      {
                        label: 'Joylashuv',
                        value: (
                          <Tag color="cyan" style={{ fontWeight: 600 }}>
                            🏢 Bo‘lim tasarrufida / Obyektda (Xonasiz)
                          </Tag>
                        ),
                      },
                    ]
                  : selectedRoomObj
                  ? [
                      {
                        label: 'Bino / Korpus',
                        value: (
                          <Tag color="arcoblue" style={{ fontWeight: 600 }}>
                            {selectedRoomObj.building || autoDetectedBuildingName || 'Bino'}
                          </Tag>
                        ),
                      },
                      {
                        label: 'Ashyolar joylashadigan Xona',
                        value: (
                          <span>
                            <b style={{ color: '#165DFF' }}>{selectedRoomObj.number}-xona</b> ({selectedRoomObj.name}, {selectedRoomObj.floor}-qavat)
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          {/* Contextual Alert for Step 2 based on Intra vs Inter department */}
          {actionType === 'TRANSFER_TO_MOL' && isSameDepartment && (
            <Alert
              type="success"
              showIcon
              style={{ borderRadius: 6 }}
              title="Kafedra ichki qabul qilish-topshirish dalolatnomasi (Audit izi to‘liq saqlanadi)"
              content={
                <div>
                  Ushbu o‘tkazma kafedra ichki ekspluatatsiyasi hisoblanadi. Topshiruvchi (<b>{currentUser?.fullName}</b>) va Qabul qiluvchi (<b>{targetUserObj?.fullName}</b>) o‘rtasida rasmiy <b>AKT</b> tuziladi va aktiv tarixiga (audit registriga) muhrlanadi. Buxgalteriya va bino komendanti vizasi talab etilmaydi.
                </div>
              }
            />
          )}

          {actionType === 'TRANSFER_TO_MOL' && isInterDepartment && !isRoomlessDepartment && (
            <Alert
              type="warning"
              showIcon
              style={{ borderRadius: 6 }}
              title="Kafedralararo Rasmiy Tasdiqlash Zanjiri (Majburiy)"
              content={
                <div>
                  Ashyolar boshqa kafedra (<b>{targetUserObj?.department?.name || (targetUserObj as any)?.departmentName || 'Boshqa bo‘lim'}</b>) balansiga o‘tkazilayotganligi sababli, <b>Bino Komendanti</b> (ashyolarni xatlovdan o‘tkazish uchun) va <b>Moddiy Hisobchi</b> (balans va sub-hisob o‘zgarishi uchun) ishtirok etishi va imzolashi <b>shart</b>!
                </div>
              }
            />
          )}

          {actionType === 'TRANSFER_TO_MOL' && isInterDepartment && isRoomlessDepartment && (
            <Alert
              type="info"
              showIcon
              style={{ borderRadius: 6 }}
              title="Xonasiz Bo‘limga O‘tkazish (Komendantsiz soddalashtirilgan zanjir)"
              content={
                <div>
                  Ushbu bo‘lim xonasiz yoki bevosita obyektda faoliyat yuritishi tufayli <b>Bino Komendanti ishtiroki talab etilmaydi</b>. Balans va sub-hisob o‘zgarishi uchun faqat <b>Moddiy Hisobchi</b> tasdiqlashi kifoya.
                </div>
              }
            />
          )}

          {/* Form: Commandant, Accountant, Note */}
          <Card
            className="uwms-card"
            title={
              actionType === 'TRANSFER_TO_MOL' && isSameDepartment
                ? 'Qo‘shimcha Ma’lumotlar va Izoh'
                : 'Ishtirokchi mas’ullar va Tasdiqlash zanjiri'
            }
          >
            <Form layout="vertical">
              {!(actionType === 'TRANSFER_TO_MOL' && isSameDepartment) ? (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          <span>Bino Komendanti</span>
                          {isInterDepartment && !isRoomlessDepartment && <Tag size="small" color="red">Majburiy</Tag>}
                          {isRoomlessDepartment && <Tag size="small" color="gray">Talab etilmaydi (Xonasiz)</Tag>}
                          {autoDetectedBuildingName && (
                            <Tag size="small" color="arcoblue">
                              {autoDetectedBuildingName}
                            </Tag>
                          )}
                        </Space>
                      }
                      required={isInterDepartment && !isRoomlessDepartment}
                      extra={
                        isRoomlessDepartment
                          ? "Bo‘lim xonasiz / obyektda bo‘lgani sababli komendant biriktirish talab etilmaydi."
                          : "Binolararo xatlov va ashyolar butunligini joyida tekshiruvchi mas’ul shaxs."
                      }
                    >
                      <Select
                        placeholder={isRoomlessDepartment ? "Komendant talab etilmaydi (Xonasiz bo‘lim)" : "Bino komendantini tanlang..."}
                        value={commandantUserId}
                        onChange={setCommandantUserId}
                        disabled={isRoomlessDepartment}
                        allowClear
                        loading={isLoadingUsers}
                        triggerProps={{
                          autoAlignPopupWidth: false,
                          position: 'bl',
                        }}
                        dropdownMenuStyle={{
                          maxHeight: 280,
                          overflowX: 'auto',
                          overflowY: 'auto',
                          minWidth: 380,
                        }}
                      >
                        {commandantUsers.map((u) => (
                          <Select.Option key={u.id} value={u.id}>
                            <div style={{ whiteSpace: 'nowrap' }}>
                              {u.fullName} ({u.position || 'Komendant'})
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          <span>Moddiy Hisobchi (Buxgalteriya)</span>
                          {isInterDepartment && <Tag size="small" color="red">Majburiy</Tag>}
                        </Space>
                      }
                      required={isInterDepartment}
                      extra="Buxgalteriya balansi va moliyaviy o‘tkazmani nazorat qiluvchi hisobchi."
                    >
                      <Select
                        placeholder="Hisobchini tanlang..."
                        value={accountantUserId}
                        onChange={setAccountantUserId}
                        allowClear
                        loading={isLoadingUsers}
                        triggerProps={{
                          autoAlignPopupWidth: false,
                          position: 'bl',
                        }}
                        dropdownMenuStyle={{
                          maxHeight: 280,
                          overflowX: 'auto',
                          overflowY: 'auto',
                          minWidth: 380,
                        }}
                      >
                        {accountantUsers.map((u) => (
                          <Select.Option key={u.id} value={u.id}>
                            <div style={{ whiteSpace: 'nowrap' }}>
                              {u.fullName} ({u.role === 'CHIEF_ACCOUNTANT' ? 'Bosh hisobchi' : u.position || 'Hisobchi'})
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              ) : null}

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
            type={actionType === 'TRANSFER_TO_MOL' && isSameDepartment ? 'success' : 'warning'}
            showIcon
            content={
              <div>
                <strong>Tasdiqlash tartibi:</strong> Topshirish arizasi yuborilgach,{' '}
                {actionType === 'TRANSFER_TO_MOL' && isSameDepartment ? (
                  <span>
                    Qabul qiluvchi xodim o‘z kabinetida dalolatnomani tasdiqlashi bilan aktiv uning xonasiga rasman biriktiriladi va audit tarixi muhrlanadi.
                  </span>
                ) : (
                  <span>
                    barcha tomonlar (Yangi MOL, Bino komendanti, Buxgalter) <code>/inbox</code> bo‘limida to‘liq imzolagandan so‘nggina mulk huquqi serverda rasman yangilanadi.
                  </span>
                )}
              </div>
            }
          />
        </div>
      )}
    </Modal>
  );
};
