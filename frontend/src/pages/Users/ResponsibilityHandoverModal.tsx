import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Steps,
  Card,
  Grid,
  Button,
  Space,
  Table,
  Select,
  Input,
  Tag,
  Alert,
  Result,
  Statistic,
  Spin,
  Empty,
  Typography,
  Progress,
  Message,
  Divider,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconSwap,
  IconHome,
  IconUser,
  IconFile,
  IconSearch,
  IconMobile,
  IconPrinter,
  IconRefresh,
  IconExclamationCircle,
  IconApps,
  IconClockCircle,
  IconLock,
} from '@arco-design/web-react/icon';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';
import {
  useUserClearanceStatusQuery,
  useCreateHandoverMutation,
  useSignHandoverMutation,
  useHandoverDocumentQuery,
  useInitiateHandoverSigningMutation,
  type HandoverSigningSessionResponse,
} from '../../hooks/useHandoverQuery';
import { useUserAssetsQuery, useUsersQuery, type UserItem } from '../../hooks/useUsersQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { useWarehousesQuery } from '../../hooks/useWarehouseQuery';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { QRPairingModal } from '../../components/Common/QRPairingModal';
import { useAuthStore } from '../../store/authStore';
import { ROLE_CONFIG } from '../../constants/roles.constants';
import {
  RoleType,
  type HandoverType,
  type HandoverItemActionType,
  type ResponsibilityHandover,
  type InitSigningSessionPayload,
} from '../../types';

const { Step } = Steps;
const { Row, Col } = Grid;
const { Title, Text, Paragraph } = Typography;

interface ResponsibilityHandoverModalProps {
  visible: boolean;
  user: UserItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ItemAllocation {
  actionType: HandoverItemActionType;
  conditionNote: string;
  investigationNote?: string;
}

export const ResponsibilityHandoverModal: React.FC<ResponsibilityHandoverModalProps> = ({
  visible,
  user,
  onClose,
  onSuccess,
}) => {
  // Master wizard current step (0: Audit, 1: Allocation, 2: Signatories, 3: OS-1 Preview & Sign, 4: Result)
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Step 0: Audit & Intent state
  const [handoverType, setHandoverType] = useState<HandoverType>('FULL_TRANSFER');
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [handoverNote, setHandoverNote] = useState<string>('');

  // Step 1: Asset Allocations state
  const [allocations, setAllocations] = useState<Record<string, ItemAllocation>>({});
  const [assetSearch, setAssetSearch] = useState<string>('');

  // Step 2: Signatories state
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string | undefined>(undefined);
  const [buildingId, setBuildingId] = useState<string | undefined>(undefined);
  const [commandantUserId, setCommandantUserId] = useState<string | undefined>(undefined);
  const [accountantUserId, setAccountantUserId] = useState<string | undefined>(undefined);

  // Step 3 & 4: Created Handover & Signing state
  const [createdHandover, setCreatedHandover] = useState<ResponsibilityHandover | null>(null);

  // Dynamic QR-Pairing Modal state (official system signing component)
  const [qrModalVisible, setQrModalVisible] = useState<boolean>(false);
  const [pendingQrRole, setPendingQrRole] = useState<'DEPARTING' | 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' | null>(null);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Current logged in user from auth store
  const { user: currentUser } = useAuthStore();

  // Direct PIN Modal state
  const [pinModalVisible, setPinModalVisible] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  // Backend queries
  const userId = user?.id || '';
  const { data: clearance, isLoading: clearanceLoading, refetch: refetchClearance } = useUserClearanceStatusQuery(
    userId,
    visible && !!userId
  );
  const { data: userAssetsData, isLoading: assetsLoading } = useUserAssetsQuery(userId);
  const { buildings, rooms } = useOrganizationQuery();
  const { warehouses } = useWarehousesQuery();
  const { data: allUsersData } = useUsersQuery({ pageSize: 100 });

  // Mutations
  const createHandoverMutation = useCreateHandoverMutation();
  const initiateSigningMutation = useInitiateHandoverSigningMutation();
  const signHandoverMutation = useSignHandoverMutation();

  // Document query (when handover is created)
  const { data: handoverDoc, refetch: refetchDoc } = useHandoverDocumentQuery(
    createdHandover?.id || '',
    { enabled: !!createdHandover?.id }
  );

  const responsibleAssets = useMemo(() => userAssetsData?.responsibleAssets || [], [userAssetsData]);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (visible && user) {
      setCurrentStep(0);
      setHandoverType('FULL_TRANSFER');
      setSelectedRoomId(undefined);
      setHandoverNote('');
      setTargetUserId(undefined);
      setTargetWarehouseId(undefined);
      setBuildingId(undefined);
      setCommandantUserId(undefined);
      setAccountantUserId(undefined);
      setCreatedHandover(null);
    }
  }, [visible, user]);

  // Pre-populate asset allocations when assets load
  useEffect(() => {
    if (responsibleAssets.length > 0) {
      setAllocations((prev) => {
        const next: Record<string, ItemAllocation> = {};
        responsibleAssets.forEach((asset: any) => {
          next[asset.id] = prev[asset.id] || {
            actionType: 'TRANSFER_TO_MOL',
            conditionNote: 'Soz holatda',
          };
        });
        return next;
      });

      // Auto-detect building from first asset
      if (!buildingId && responsibleAssets[0]?.room?.building) {
        const foundBld = buildings.find(
          (b) => b.name === responsibleAssets[0].room.building || b.code === responsibleAssets[0].room.building
        );
        if (foundBld) {
          setBuildingId(foundBld.id);
          if (foundBld.commendantId) {
            setCommandantUserId(foundBld.commendantId);
          }
        }
      }
    }
  }, [responsibleAssets, buildings, buildingId]);

  // Auto-detect accountant
  useEffect(() => {
    if (!accountantUserId && allUsersData?.items) {
      const acc = allUsersData.items.find(
        (u) => u.role === RoleType.CHIEF_ACCOUNTANT || u.role === RoleType.VICE_RECTOR_FINANCE
      );
      if (acc) {
        setAccountantUserId(acc.id);
      }
    }
  }, [accountantUserId, allUsersData]);



  // Quick Batch allocation templates
  const applyBatchAction = (actionType: HandoverItemActionType) => {
    setAllocations((prev) => {
      const next: Record<string, ItemAllocation> = {};
      Object.keys(prev).forEach((id) => {
        next[id] = {
          ...prev[id],
          actionType,
        };
      });
      return next;
    });
    Message.info(`Barcha ashyolarga '${actionType}' taqdiri belgilandi`);
  };

  // Check if any asset requires Target MOL or Target Warehouse
  const needsTargetMol = useMemo(() => {
    return Object.values(allocations).some((a) => a.actionType === 'TRANSFER_TO_MOL');
  }, [allocations]);

  const needsTargetWarehouse = useMemo(() => {
    return Object.values(allocations).some(
      (a) => a.actionType === 'RETURN_TO_WAREHOUSE' || a.actionType === 'SEND_TO_REPAIR'
    );
  }, [allocations]);

  // Allocation counters
  const allocationSummary = useMemo(() => {
    let molCount = 0;
    let whCount = 0;
    let repairCount = 0;
    let writeOffCount = 0;
    let shortageCount = 0;

    Object.values(allocations).forEach((a) => {
      if (a.actionType === 'TRANSFER_TO_MOL') molCount++;
      if (a.actionType === 'RETURN_TO_WAREHOUSE') whCount++;
      if (a.actionType === 'SEND_TO_REPAIR') repairCount++;
      if (a.actionType === 'WRITE_OFF') writeOffCount++;
      if (a.actionType === 'SHORTAGE') shortageCount++;
    });

    return { molCount, whCount, repairCount, writeOffCount, shortageCount };
  }, [allocations]);

  // Filtered assets for table
  const filteredAssets = useMemo(() => {
    if (!assetSearch.trim()) return responsibleAssets;
    const q = assetSearch.toLowerCase();
    return responsibleAssets.filter((a: any) => {
      return (
        a.inventoryNumber?.toLowerCase().includes(q) ||
        a.item?.name?.toLowerCase().includes(q) ||
        a.room?.name?.toLowerCase().includes(q) ||
        a.room?.number?.toLowerCase().includes(q)
      );
    });
  }, [responsibleAssets, assetSearch]);

  // Building selection change handler
  const handleBuildingChange = (bldId: string) => {
    setBuildingId(bldId);
    const bld = buildings.find((b) => b.id === bldId);
    if (bld?.commendantId) {
      setCommandantUserId(bld.commendantId);
    } else {
      setCommandantUserId(undefined);
    }
  };

  // Step 2 Submission -> Create Handover on Backend
  const handleCreateHandover = async () => {
    if (!user) return;

    if (needsTargetMol && !targetUserId) {
      Message.error('Aktivlarni qabul qiluvchi yangi mas’ul shaxs (MOL) tanlanishi shart!');
      return;
    }
    if (needsTargetWarehouse && !targetWarehouseId) {
      Message.error('Aktivlar omborga qaytarilayotgani sababli omborxona tanlanishi shart!');
      return;
    }

    const itemsPayload = Object.entries(allocations).map(([itemInstanceId, val]) => ({
      itemInstanceId,
      actionType: val.actionType,
      targetUserId: val.actionType === 'TRANSFER_TO_MOL' ? targetUserId : undefined,
      targetWarehouseId:
        val.actionType === 'RETURN_TO_WAREHOUSE' || val.actionType === 'SEND_TO_REPAIR'
          ? targetWarehouseId
          : undefined,
      conditionNote: val.conditionNote,
      investigationNote: val.investigationNote,
    }));

    try {
      const res = await createHandoverMutation.mutateAsync({
        type: handoverType,
        departingUserId: user.id,
        targetUserId: targetUserId || undefined,
        targetWarehouseId: targetWarehouseId || undefined,
        buildingId: buildingId || undefined,
        commandantUserId: commandantUserId || undefined,
        accountantUserId: accountantUserId || undefined,
        roomId: selectedRoomId || undefined,
        note: handoverNote || undefined,
        items: itemsPayload,
      });

      setCreatedHandover(res);
      setCurrentStep(3);
    } catch (err) {
      // Error handled by mutation onError
    }
  };

  // Payload for the system's official 60s Dynamic QRPairingModal
  const qrSignPayload: InitSigningSessionPayload | null = useMemo(() => {
    if (!createdHandover || !pendingQrRole) return null;
    let targetSignerName = user?.fullName || '';
    let targetSignerRole = user?.position || (user?.role ? (ROLE_CONFIG[user.role]?.label || user.role) : 'Topshiruvchi MOL');
    let targetSignerId = user?.id || '';

    if (pendingQrRole === 'TARGET') {
      const tUser = allUsersData?.items?.find((u) => u.id === targetUserId);
      targetSignerName = tUser?.fullName || 'Qabul qiluvchi';
      targetSignerRole = tUser?.position || (tUser?.role ? (ROLE_CONFIG[tUser.role]?.label || tUser.role) : 'Qabul qiluvchi MOL');
      targetSignerId = targetUserId || '';
    } else if (pendingQrRole === 'COMMANDANT') {
      const cUser = allUsersData?.items?.find((u) => u.id === commandantUserId);
      targetSignerName = cUser?.fullName || 'Bino Komendanti';
      targetSignerRole = cUser?.position || (cUser?.role ? (ROLE_CONFIG[cUser.role]?.label || cUser.role) : 'Bino Komendanti');
      targetSignerId = commandantUserId || '';
    } else if (pendingQrRole === 'ACCOUNTANT') {
      const aUser = allUsersData?.items?.find((u) => u.id === accountantUserId);
      targetSignerName = aUser?.fullName || 'Moddiy Hisobchi';
      targetSignerRole = aUser?.position || (aUser?.role ? (ROLE_CONFIG[aUser.role]?.label || aUser.role) : 'Moddiy Hisobchi');
      targetSignerId = accountantUserId || '';
    }

    return {
      docNumber: createdHandover.handoverNumber,
      docType: 'OS_1',
      title: `Moddiy Javobgarlikni Topshirish Dalolatnomasi (OS-1) — ${createdHandover.handoverNumber}`,
      departmentName: user?.department?.name || 'Universitet',
      roomName: createdHandover.room?.name,
      itemSummary: `${createdHandover.items?.length || responsibleAssets.length} ta aktiv topshirilmoqda`,
      targetSignerName,
      targetSignerRole,
      targetUserId: targetSignerId,
      metadata: {
        handoverId: createdHandover.id,
        handoverNumber: createdHandover.handoverNumber,
        signatoryRole: pendingQrRole,
        isHandover: true,
      },
    };
  }, [createdHandover, pendingQrRole, user, allUsersData, targetUserId, commandantUserId, accountantUserId, responsibleAssets]);

  // Open 60s Dynamic QR Signing Modal for a specific role
  const handleOpenQrSigning = (
    role: 'DEPARTING' | 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT'
  ) => {
    setPendingQrRole(role);
    setQrModalVisible(true);
  };

  // Success callback from QRPairingModal
  const handleQrSignSuccess = () => {
    Message.success('Elektron imzo mobil biometrika orqali muvaffaqiyatli qayd etildi!');
    setQrModalVisible(false);
    setPendingQrRole(null);
    refetchDoc();
    refetchClearance();
  };

  // Check whether all required parties have signed
  const isFullySigned = Boolean(
    handoverDoc?.isFullySigned || createdHandover?.status === 'COMPLETED'
  );

  // Officially finalize handover in backend transaction
  const handleFinalizeHandover = async () => {
    if (!createdHandover) return;
    if (!isFullySigned) {
      Message.warning('Barcha 4 tomonlama mas’ullar elektron imzo qo‘ygandan so‘nggina topshirishni yakunlash mumkin!');
      return;
    }

    try {
      setIsFinalizing(true);
      await signHandoverMutation.mutateAsync({
        id: createdHandover.id,
        payload: { note: 'Barcha tomonlar to‘liq imzolaganidan so‘ng rasman tasdiqlandi' },
      });
      Message.success('Moddiy javobgarlik topshirish rasman yakunlandi va tizimda tasdiqlandi!');
      await refetchDoc();
      await refetchClearance();
      setCurrentStep(4);
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Topshirishni yakunlashda xatolik yuz berdi');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Direct PIN signing
  const handleDirectPinSign = async () => {
    if (!createdHandover) return;
    try {
      await signHandoverMutation.mutateAsync({
        id: createdHandover.id,
        payload: { pin: pinInput, note: 'Tizim orqali bevosita tasdiqlandi' },
      });
      setPinModalVisible(false);
      setPinInput('');
      refetchDoc();
      refetchClearance();
    } catch {
      // Handled by mutation onError
    }
  };

  // Print OS-1 Act in clean print window
  const handlePrintDocument = () => {
    if (!handoverDoc?.contentHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(handoverDoc.contentHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleFinishAndClose = () => {
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <>
      <Modal
        visible={visible}
        title={
          <Space>
            <IconSwap style={{ color: 'var(--color-primary-6)' }} />
            <span>Moddiy Javobgarlikni Topshirish va Zimmasidan Chiqarish (MOL Offboarding)</span>
          </Space>
        }
        onCancel={onClose}
        style={{ width: 960, maxWidth: '95vw', top: 20 }}
        footer={null}
        unmountOnExit
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 5-Step Master Wizard Navigation */}
          <Steps current={currentStep} onChange={(step) => step < currentStep && setCurrentStep(step)}>
            <Step title="1. Audit" description="Diagnostika" icon={<IconSearch />} />
            <Step title="2. Taqsimot" description="Ashyolar taqdiri" icon={<IconApps />} />
            <Step title="3. Mas’ullar" description="Ishtirokchilar" icon={<IconUser />} />
            <Step title="4. OS-1 Imzo" description="Elektron hujjat" icon={<IconFile />} />
            <Step title="5. Natija" description="Yakunlash" icon={<IconCheckCircle />} />
          </Steps>

          <Divider style={{ margin: '4px 0' }} />

          {/* =========================================================
              STEP 0: AUDIT VA ASOSIY DIAGNOSTIKA
              ========================================================= */}
          {currentStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Departing User Card */}
              <Card
                className="uwms-card"
                title={
                  <Space>
                    <IconUser />
                    <span>Topshiruvchi Mas’ul Shaxs Ma’lumotlari</span>
                  </Space>
                }
              >
                <Row gutter={[16, 12]}>
                  <Col span={8}>
                    <Text type="secondary">F.I.Sh.:</Text>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.fullName}</div>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Lavozimi va Roli:</Text>
                    <div>
                      <Tag color="gold" style={{ marginRight: 6 }}>
                        {user?.role}
                      </Tag>
                      <span>{user?.position || 'Moddiy javobgar'}</span>
                    </div>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Bo‘lim / Kafedra:</Text>
                    <div>{user?.department?.name || 'Mavjud emas'}</div>
                  </Col>
                </Row>
              </Card>

              {/* Clearance Status Diagnostics */}
              {clearanceLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin tip="Xodim javobgarlik holati tekshirilmoqda..." />
                </div>
              ) : (
                <Row gutter={[12, 12]}>
                  <Col span={6}>
                    <Card className="uwms-card" style={{ textAlign: 'center' }}>
                      <Statistic
                        title="Zimmasidagi Aktivlar"
                        value={clearance?.activeAssets ?? responsibleAssets.length}
                        suffix="ta"
                        style={{
                          color: (clearance?.activeAssets || 0) > 0 ? '#F53F3F' : '#00B42A',
                          fontWeight: 700,
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="uwms-card" style={{ textAlign: 'center' }}>
                      <Statistic
                        title="Mas’ul Xonalar"
                        value={clearance?.responsibleRooms ?? 0}
                        suffix="ta"
                        style={{
                          color: (clearance?.responsibleRooms || 0) > 0 ? '#FF7D00' : '#00B42A',
                          fontWeight: 700,
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="uwms-card" style={{ textAlign: 'center' }}>
                      <Statistic
                        title="Kutilayotgan Handovers"
                        value={clearance?.pendingHandovers ?? 0}
                        suffix="ta"
                        style={{
                          color: (clearance?.pendingHandovers || 0) > 0 ? '#165DFF' : 'var(--color-text-2)',
                          fontWeight: 700,
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="uwms-card" style={{ textAlign: 'center' }}>
                      <Statistic
                        title="Ochiq Kamomadlar"
                        value={clearance?.openShortages ?? 0}
                        suffix="ta"
                        style={{
                          color: (clearance?.openShortages || 0) > 0 ? '#F53F3F' : '#00B42A',
                          fontWeight: 700,
                        }}
                      />
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Clearance Summary Alert */}
              {clearance?.canDeactivate ? (
                <Alert
                  type="success"
                  title="Javobgarlikdan To‘liq Ozod Qilingan (Clearance Passed)"
                  content="Ushbu xodim zimmasida aktivlar yoki majburiyatlar mavjud emas. Foydalanuvchini bemalol deaktivatsiya qilish yoki topshirish aktini rasmiylashtirish mumkin."
                  showIcon
                />
              ) : (
                <Alert
                  type="warning"
                  title="Moddiy Majburiyatlar Mavjud"
                  content={`Zimmasida ${clearance?.activeAssets || 0} ta faol aktiv va ${clearance?.responsibleRooms || 0} ta mas’ul xona mavjud. Ishdan bo‘shash yoki deaktivatsiyadan avval mazkur dalolatnoma orqali ashyolar yangi shaxsga yoki omborga o‘tkazilishi shart.`}
                  showIcon
                />
              )}

              {/* Handover Intent Form */}
              <Card className="uwms-card" title="Topshirish Maqsadi va Asosi">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Topshirish Turi (Handover Type):
                    </Text>
                    <Select
                      value={handoverType}
                      onChange={(val) => setHandoverType(val as HandoverType)}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="FULL_TRANSFER">
                        To‘liq topshirish — barcha aktivlar yangi MOLga yoki omborga o‘tkaziladi
                      </Select.Option>
                      <Select.Option value="PARTIAL_TRANSFER">
                        Qisman topshirish — faqat tanlangan ayrim aktivlar o‘tkaziladi
                      </Select.Option>
                      <Select.Option value="ROOM_TRANSFER">
                        Xona/Auditoriya topshirish — bitta xonadagi barcha jihozlar boshqa shaxsga beriladi
                      </Select.Option>
                      <Select.Option value="RETURN_TO_WAREHOUSE">
                        Omborga qaytarish — aktivlar universitet markaziy omboriga qaytariladi
                      </Select.Option>
                      <Select.Option value="FINAL_CLEARANCE">
                        Yakuniy hisob-kitob (Ishdan bo‘shash) — to‘liq ozod qilish dalolatnomasi
                      </Select.Option>
                    </Select>
                  </div>

                  {handoverType === 'ROOM_TRANSFER' && (
                    <div>
                      <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Topshirilayotgan Auditoriya / Xona:
                      </Text>
                      <Select
                        placeholder="Xonani tanlang..."
                        value={selectedRoomId}
                        onChange={setSelectedRoomId}
                        style={{ width: '100%' }}
                        allowClear
                      >
                        {rooms.map((r) => (
                          <Select.Option key={r.id} value={r.id}>
                            {r.number ? `${r.number}-xona: ${r.name}` : r.name} ({r.floor}-qavat • {r.building})
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div>
                    <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Topshirish Asosi / Buyruq / Izoh:
                    </Text>
                    <Input.TextArea
                      placeholder="Masalan: Rektorning 2026-yil 12-sentabrdagi 45-sonli buyrug‘i, xodimning boshqa kafedraga o‘tishi munosabati bilan..."
                      value={handoverNote}
                      onChange={setHandoverNote}
                      rows={3}
                    />
                  </div>
                </div>
              </Card>

              {/* Step 0 Footer Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <Button onClick={onClose}>Bekor qilish</Button>
                <Button
                  type="primary"
                  onClick={() => {
                    if (handoverType === 'ROOM_TRANSFER' && !selectedRoomId) {
                      Message.warning('Iltimos, topshirilayotgan xonani tanlang!');
                      return;
                    }
                    setCurrentStep(1);
                  }}
                >
                  Keyingi bosqich: Ashyolar Taftishi
                </Button>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 1: ASHYOLAR TAFTISHI VA TAQSIMOT (ALLOCATION)
              ========================================================= */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Quick Batch Actions & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <Space wrap>
                  <Text style={{ fontWeight: 600 }}>Tezkor andozalar:</Text>
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconSwap />}
                    onClick={() => applyBatchAction('TRANSFER_TO_MOL')}
                  >
                    Barchasini Yangi MOLga
                  </Button>
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconHome />}
                    onClick={() => applyBatchAction('RETURN_TO_WAREHOUSE')}
                  >
                    Barchasini Omborga
                  </Button>
                  <Button
                    size="small"
                    type="outline"
                    status="warning"
                    icon={<IconExclamationCircle />}
                    onClick={() => applyBatchAction('WRITE_OFF')}
                  >
                    Barchasini Hisobdan Chiqarishga
                  </Button>
                </Space>

                <Input
                  prefix={<IconSearch />}
                  placeholder="Inventar yoki nom bo‘yicha izlash..."
                  style={{ width: 260 }}
                  value={assetSearch}
                  onChange={setAssetSearch}
                  allowClear
                />
              </div>

              {/* Assets Allocation Table */}
              {assetsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin tip="Xodimning asosiy vositalari ro‘yxati olinmoqda..." />
                </div>
              ) : responsibleAssets.length === 0 ? (
                <Empty description="Ushbu xodim zimmasida hech qanday ashyo topilmadi" />
              ) : (
                <Table
                  data={filteredAssets}
                  rowKey="id"
                  pagination={{ pageSize: 8, showTotal: true }}
                  size="small"
                  border
                  columns={[
                    {
                      title: 'Inventar & Ashyo',
                      key: 'item',
                      minWidth: 220,
                      render: (_: any, record: any) => (
                        <CategoryThumbnail
                          icon={<IconApps />}
                          name={record.item?.name || 'Ashyo'}
                          subtitle={`Inv: ${record.inventoryNumber}`}
                          tag={record.item?.model || undefined}
                          color="#165DFF"
                          bg="#E8F3FF"
                        />
                      ),
                    },
                    {
                      title: 'Joylashuvi',
                      key: 'room',
                      width: 160,
                      render: (_: any, record: any) => (
                        <div style={{ fontSize: 12 }}>
                          <div>{record.room?.name || 'Xona belgilanmagan'}</div>
                          <div style={{ color: 'var(--color-text-3)' }}>
                            {record.room?.number ? `${record.room.number}-xona` : ''}{' '}
                            {record.room?.building ? `• ${record.room.building}` : ''}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Aktiv Taqdiri (Harakat)',
                      key: 'actionType',
                      width: 220,
                      render: (_: any, record: any) => {
                        const current = allocations[record.id]?.actionType || 'TRANSFER_TO_MOL';
                        return (
                          <Select
                            size="small"
                            value={current}
                            onChange={(val) => {
                              setAllocations((prev) => ({
                                ...prev,
                                [record.id]: {
                                  ...(prev[record.id] || { conditionNote: 'Soz holatda' }),
                                  actionType: val as HandoverItemActionType,
                                },
                              }));
                            }}
                            style={{ width: '100%' }}
                          >
                            <Select.Option value="TRANSFER_TO_MOL">Yangi MOLga topshirish</Select.Option>
                            <Select.Option value="RETURN_TO_WAREHOUSE">Omborga qaytarish</Select.Option>
                            <Select.Option value="SEND_TO_REPAIR">Ta’mirga yuborish</Select.Option>
                            <Select.Option value="WRITE_OFF">Hisobdan chiqarish (OS-4)</Select.Option>
                            <Select.Option value="SHORTAGE">Kamomad / Topilmadi</Select.Option>
                          </Select>
                        );
                      },
                    },
                    {
                      title: 'Jismoniy Holati / Izoh',
                      key: 'condition',
                      minWidth: 180,
                      render: (_: any, record: any) => {
                        const current = allocations[record.id]?.conditionNote || '';
                        return (
                          <Input
                            size="small"
                            placeholder="Soz / Ta’mirtalab / Izoh..."
                            value={current}
                            onChange={(val) => {
                              setAllocations((prev) => ({
                                ...prev,
                                [record.id]: {
                                  ...(prev[record.id] || { actionType: 'TRANSFER_TO_MOL' }),
                                  conditionNote: val,
                                },
                              }));
                            }}
                          />
                        );
                      },
                    },
                  ]}
                />
              )}

              {/* Allocation Summary Footer Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-fill-2)',
                  padding: '10px 16px',
                  borderRadius: 4,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space wrap size="medium">
                  <Text style={{ fontWeight: 600 }}>Taqsimot xulosasi:</Text>
                  <Tag color="blue">Yangi MOLga: {allocationSummary.molCount} ta</Tag>
                  <Tag color="green">Omborga: {allocationSummary.whCount} ta</Tag>
                  <Tag color="orange">Ta’mirga: {allocationSummary.repairCount} ta</Tag>
                  <Tag color="purple">Hisobdan chiqarish: {allocationSummary.writeOffCount} ta</Tag>
                  <Tag color="red">Kamomad: {allocationSummary.shortageCount} ta</Tag>
                </Space>

                <Space>
                  <Button onClick={() => setCurrentStep(0)}>Orqaga</Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      if (responsibleAssets.length > 0 && Object.keys(allocations).length === 0) {
                        Message.warning('Iltimos, ashyolar taqdirini belgilang!');
                        return;
                      }
                      setCurrentStep(2);
                    }}
                  >
                    Keyingi bosqich: Mas’ullarni Belgilash
                  </Button>
                </Space>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 2: ISHTIROKCHILAR VA MAS’ULLARNI BELGILASH
              ========================================================= */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card className="uwms-card" title="Dalolatnoma Ishtirokchilari (4 Tomonlama Mas’ullar)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Target MOL */}
                  {needsTargetMol && (
                    <div>
                      <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Qabul Qiluvchi Yangi Mas’ul Shaxs (Yangi MOL) <span style={{ color: '#F53F3F' }}>*</span>:
                      </Text>
                      <Select
                        placeholder="Yangi MOLni tanlang..."
                        value={targetUserId}
                        onChange={setTargetUserId}
                        style={{ width: '100%' }}
                        showSearch
                        filterOption={(input, option) =>
                          String(option.props.children || '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                      >
                        {allUsersData?.items
                          ?.filter((u) => u.id !== user?.id && u.isActive)
                          ?.map((u) => (
                            <Select.Option key={u.id} value={u.id}>
                              {u.fullName} ({u.role} • {u.position || 'Xodim'})
                            </Select.Option>
                          ))}
                      </Select>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                        {allocationSummary.molCount} ta ashyo ushbu xodim balansiga to‘liq qonuniy o‘tkaziladi.
                      </Text>
                    </div>
                  )}

                  {/* Target Warehouse */}
                  {needsTargetWarehouse && (
                    <div>
                      <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Qabul Qiluvchi Omborxona <span style={{ color: '#F53F3F' }}>*</span>:
                      </Text>
                      <Select
                        placeholder="Omborxonani tanlang..."
                        value={targetWarehouseId}
                        onChange={setTargetWarehouseId}
                        style={{ width: '100%' }}
                      >
                        {warehouses?.map((w) => (
                          <Select.Option key={w.id} value={w.id}>
                            {w.name} {w.code ? `(${w.code})` : ''} {w.isMain ? '• Bosh ombor' : ''}
                          </Select.Option>
                        ))}
                      </Select>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                        {allocationSummary.whCount + allocationSummary.repairCount} ta ashyo ombor zaxirasiga kirim qilinadi.
                      </Text>
                    </div>
                  )}

                  {/* Building & Commandant */}
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Bino (Obyekt):
                      </Text>
                      <Select
                        placeholder="Binoni tanlang..."
                        value={buildingId}
                        onChange={handleBuildingChange}
                        style={{ width: '100%' }}
                        allowClear
                      >
                        {buildings.map((b) => (
                          <Select.Option key={b.id} value={b.id}>
                            {b.name} ({b.floorsCount} qavat)
                          </Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={12}>
                      <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Bino Komendanti:
                      </Text>
                      <Select
                        placeholder="Komendantni tanlang..."
                        value={commandantUserId}
                        onChange={setCommandantUserId}
                        style={{ width: '100%' }}
                        allowClear
                      >
                        {allUsersData?.items
                          ?.filter((u) => u.role === RoleType.COMMENDANT || u.role === RoleType.HEAD_WAREHOUSE)
                          ?.map((u) => (
                            <Select.Option key={u.id} value={u.id}>
                              {u.fullName} ({u.role})
                            </Select.Option>
                          ))}
                      </Select>
                    </Col>
                  </Row>

                  {/* Moddiy Buxgalter */}
                  <div>
                    <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Moddiy Hisobchi (Buxgalteriya vakili):
                    </Text>
                    <Select
                      placeholder="Buxgalteriya vakilini tanlang..."
                      value={accountantUserId}
                      onChange={setAccountantUserId}
                      style={{ width: '100%' }}
                      allowClear
                    >
                      {allUsersData?.items
                        ?.filter(
                          (u) =>
                            u.role === RoleType.CHIEF_ACCOUNTANT ||
                            u.role === RoleType.VICE_RECTOR_FINANCE ||
                            u.role === RoleType.SUPER_ADMIN
                        )
                        ?.map((u) => (
                          <Select.Option key={u.id} value={u.id}>
                            {u.fullName} ({u.role})
                          </Select.Option>
                        ))}
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Step 2 Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button onClick={() => setCurrentStep(1)}>Orqaga</Button>
                <Button
                  type="primary"
                  loading={createHandoverMutation.isPending}
                  icon={<IconFile />}
                  onClick={handleCreateHandover}
                >
                  Dalolatnomani Rasmiylashtirish va OS-1 Shakllantirish
                </Button>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 3: OS-1 HUJJATI VA ELEKTRON IMZOLASH
              ========================================================= */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Bar with Document Info */}
              <Card
                className="uwms-card"
                bodyStyle={{ padding: '12px 16px' }}
                style={{ background: 'var(--color-fill-2)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <Space>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>
                        Dalolatnoma: {createdHandover?.handoverNumber || 'AKT-2026-XXXX'}
                      </span>
                      <Tag color="orange">Kutilmoqda (PENDING_SIGNATURES)</Tag>
                    </Space>
                    {handoverDoc?.documentHash && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
                        SHA-256 HMAC Xesh: <code>{handoverDoc.documentHash.slice(0, 32)}...</code>
                      </div>
                    )}
                  </div>

                  <Space>
                    <Button icon={<IconRefresh />} size="small" onClick={() => refetchDoc()}>
                      Yangilash
                    </Button>
                    <Button icon={<IconPrinter />} size="small" onClick={handlePrintDocument}>
                      Chop Etish
                    </Button>
                  </Space>
                </div>
              </Card>

              {/* OS-1 Official Act Document Preview */}
              {(() => {
                const contentHtml = handoverDoc?.contentHtml || (handoverDoc as any)?.htmlContent;
                const departingSig = handoverDoc?.signatories?.find((s) => s.role === 'DEPARTING');
                const targetSig = handoverDoc?.signatories?.find((s) => s.role === 'TARGET');
                const commandantSig = handoverDoc?.signatories?.find((s) => s.role === 'COMMANDANT');
                const accountantSig = handoverDoc?.signatories?.find((s) => s.role === 'ACCOUNTANT');

                const canSignDeparting = !departingSig?.signed && (currentUser?.id === user?.id || currentUser?.role === 'SUPER_ADMIN');
                const canSignTarget = Boolean(
                  targetUserId &&
                  !targetSig?.signed &&
                  (currentUser?.id === targetUserId || currentUser?.role === 'SUPER_ADMIN')
                );
                const canSignCommandant = Boolean(
                  commandantUserId &&
                  !commandantSig?.signed &&
                  (currentUser?.id === commandantUserId || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COMMENDANT')
                );
                const canSignAccountant = Boolean(
                  accountantUserId &&
                  !accountantSig?.signed &&
                  (currentUser?.id === accountantUserId || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'CHIEF_ACCOUNTANT')
                );

                return (
                  <>
                    <Card
                      className="uwms-card"
                      title="OTM OS-1 Standart Elektron Dalolatnomasi Ko‘rigi"
                      style={{ maxHeight: 380, overflowY: 'auto' }}
                    >
                      {contentHtml ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: contentHtml }}
                          style={{
                            transform: 'scale(0.92)',
                            transformOrigin: 'top left',
                            width: '108%',
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: 30 }}>
                          <Spin tip="OS-1 elektron hujjati shakllantirilmoqda..." />
                        </div>
                      )}
                    </Card>

                    {/* 4-Way Signature Cards */}
                    <Card className="uwms-card" title="Ishtirokchilar Imzosi Holati (4 Tomonlama Tasdiqlash)">
                      <Row gutter={[12, 12]}>
                        {/* 1. Topshiruvchi */}
                        <Col span={12}>
                          <Card
                            className="uwms-card"
                            style={{ border: '1px solid var(--color-border)' }}
                            title="1. Topshiruvchi (Eski MOL)"
                            extra={
                              departingSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>
                                  Imzolandi
                                </Tag>
                              ) : (
                                <Tag color="gold" icon={<IconClockCircle />}>
                                  Kutilmoqda
                                </Tag>
                              )
                            }
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                              {user?.fullName} ({user?.position || (user?.role ? (ROLE_CONFIG[user.role]?.label || user.role) : 'MOL')})
                            </div>
                            <Space>
                              {departingSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>Elektron imzo qo‘yilgan</Tag>
                              ) : canSignDeparting ? (
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<IconMobile />}
                                  onClick={() => handleOpenQrSigning('DEPARTING')}
                                >
                                  QR bilan Imzolash
                                </Button>
                              ) : (
                                <Tooltip content={`Ushbu imzo faqat biriktirilgan mas’ul (${user?.fullName}) tomonidan QR-pairing orqali qo‘yilishi shart.`}>
                                  <Tag color="gray" icon={<IconLock />}>Faqat biriktirilgan shaxs imzolaydi</Tag>
                                </Tooltip>
                              )}
                            </Space>
                          </Card>
                        </Col>

                        {/* 2. Qabul Qiluvchi */}
                        <Col span={12}>
                          <Card
                            className="uwms-card"
                            style={{ border: '1px solid var(--color-border)' }}
                            title="2. Qabul Qiluvchi (Yangi MOL / Ombor)"
                            extra={
                              targetSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>
                                  Imzolandi
                                </Tag>
                              ) : (
                                <Tag color="gold" icon={<IconClockCircle />}>
                                  Kutilmoqda
                                </Tag>
                              )
                            }
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                              {allUsersData?.items?.find((u) => u.id === targetUserId)?.fullName ||
                                warehouses?.find((w) => w.id === targetWarehouseId)?.name ||
                                'Belgilanmagan'}
                            </div>
                            <Space>
                              {targetSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>Elektron imzo qo‘yilgan</Tag>
                              ) : canSignTarget ? (
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<IconMobile />}
                                  onClick={() => handleOpenQrSigning('TARGET')}
                                >
                                  QR bilan Imzolash
                                </Button>
                              ) : (
                                <Tooltip content={`Ushbu imzo faqat qabul qiluvchi mas’ul tomonidan QR-pairing orqali qo‘yilishi shart.`}>
                                  <Tag color="gray" icon={<IconLock />}>Faqat biriktirilgan shaxs imzolaydi</Tag>
                                </Tooltip>
                              )}
                            </Space>
                          </Card>
                        </Col>

                        {/* 3. Bino Komendanti */}
                        <Col span={12}>
                          <Card
                            className="uwms-card"
                            style={{ border: '1px solid var(--color-border)' }}
                            title="3. Bino Komendanti"
                            extra={
                              commandantSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>
                                  Imzolandi
                                </Tag>
                              ) : !commandantUserId ? (
                                <Tag color="gray">Talab etilmaydi</Tag>
                              ) : (
                                <Tag color="gold" icon={<IconClockCircle />}>
                                  Kutilmoqda
                                </Tag>
                              )
                            }
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                              {allUsersData?.items?.find((u) => u.id === commandantUserId)?.fullName ||
                                'Bino komendanti tayinlanmagan'}
                            </div>
                            <Space>
                              {commandantSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>Elektron imzo qo‘yilgan</Tag>
                              ) : !commandantUserId ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>Bino komendanti talab etilmaydi</Text>
                              ) : canSignCommandant ? (
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<IconMobile />}
                                  onClick={() => handleOpenQrSigning('COMMANDANT')}
                                >
                                  QR bilan Imzolash
                                </Button>
                              ) : (
                                <Tooltip content={`Ushbu imzo faqat bino komendanti tomonidan QR-pairing orqali qo‘yilishi shart.`}>
                                  <Tag color="gray" icon={<IconLock />}>Faqat komendant imzolaydi</Tag>
                                </Tooltip>
                              )}
                            </Space>
                          </Card>
                        </Col>

                        {/* 4. Moddiy Hisobchi */}
                        <Col span={12}>
                          <Card
                            className="uwms-card"
                            style={{ border: '1px solid var(--color-border)' }}
                            title="4. Moddiy Hisobchi"
                            extra={
                              accountantSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>
                                  Imzolandi
                                </Tag>
                              ) : !accountantUserId ? (
                                <Tag color="gray">Talab etilmaydi</Tag>
                              ) : (
                                <Tag color="gold" icon={<IconClockCircle />}>
                                  Kutilmoqda
                                </Tag>
                              )
                            }
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                              {allUsersData?.items?.find((u) => u.id === accountantUserId)?.fullName ||
                                'Buxgalteriya hisobchisi'}
                            </div>
                            <Space>
                              {accountantSig?.signed ? (
                                <Tag color="green" icon={<IconCheckCircle />}>Elektron imzo qo‘yilgan</Tag>
                              ) : !accountantUserId ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>Buxgalteriya tasdig‘i talab etilmaydi</Text>
                              ) : canSignAccountant ? (
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<IconMobile />}
                                  onClick={() => handleOpenQrSigning('ACCOUNTANT')}
                                >
                                  QR bilan Imzolash
                                </Button>
                              ) : (
                                <Tooltip content={`Ushbu imzo faqat moddiy hisobchi tomonidan QR-pairing orqali qo‘yilishi shart.`}>
                                  <Tag color="gray" icon={<IconLock />}>Faqat hisobchi imzolaydi</Tag>
                                </Tooltip>
                              )}
                            </Space>
                          </Card>
                        </Col>
                      </Row>
                    </Card>

                    {/* Step 3 Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Button onClick={() => setCurrentStep(2)}>Orqaga</Button>
                      <Tooltip
                        content={
                          !isFullySigned
                            ? 'Barcha 4 tomonlama mas’ullar (Topshiruvchi, Qabul qiluvchi, Komendant, Buxgalter) elektron imzo qo‘ygandan so‘nggina topshirishni yakunlash mumkin!'
                            : 'Dalolatnomani rasman kuchga kiritish va aktivlarni yangi mas’ulga biriktirish'
                        }
                      >
                        <Button
                          type="primary"
                          status="success"
                          icon={<IconCheckCircle />}
                          disabled={!isFullySigned}
                          loading={isFinalizing}
                          onClick={handleFinalizeHandover}
                        >
                          Topshirishni Yakunlash (Keyingi Qadam)
                        </Button>
                      </Tooltip>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* =========================================================
              STEP 4: NATIJA VA DALOLATNOMANI YAKUNLASH
              ========================================================= */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Result
                status="success"
                title="Moddiy Javobgarlik Muvaffaqiyatli Topshirildi!"
                subTitle={`Dalolatnoma ${createdHandover?.handoverNumber || ''} raqami bilan ro‘yxatga olindi va OTM arxivida saqlandi.`}
                extra={[
                  <Button key="print" type="primary" icon={<IconPrinter />} onClick={handlePrintDocument}>
                    Dalolatnomani Chop Etish / PDF
                  </Button>,
                  <Button key="close" type="secondary" onClick={handleFinishAndClose}>
                    Yopish va Xodimlar Ro‘yxatiga Qaytish
                  </Button>,
                ]}
              >
                <div
                  style={{
                    background: 'var(--color-fill-2)',
                    padding: '16px 20px',
                    borderRadius: 4,
                    maxWidth: 600,
                    margin: '0 auto',
                    textAlign: 'left',
                  }}
                >
                  <Paragraph style={{ marginBottom: 6 }}>
                    <strong>Topshiruvchi:</strong> {user?.fullName} ({user?.role})
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 6 }}>
                    <strong>Topshirish turi:</strong> {handoverType}
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 6 }}>
                    <strong>Taqsimlangan ashyolar soni:</strong> {responsibleAssets.length} ta
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    <strong>Xulosa:</strong> Topshirilgan aktivlar yangi mas’ul shaxslar va ombor balansiga o‘tkazildi. Xodim moddiy javobgarlikdan ozod etildi.
                  </Paragraph>
                </div>
              </Result>
            </div>
          )}
        </div>
      </Modal>

      {/* 60s Dynamic QR-Pairing Modal for Mobile Biometric Signing (Official System Component) */}
      {qrSignPayload && (
        <QRPairingModal
          visible={qrModalVisible}
          onClose={() => {
            setQrModalVisible(false);
            setPendingQrRole(null);
          }}
          onSuccess={handleQrSignSuccess}
          payload={qrSignPayload}
        />
      )}

      {/* Direct PIN Sign Modal */}
      <Modal
        visible={pinModalVisible}
        title="PIN-kod orqali tasdiqlash"
        onCancel={() => {
          setPinModalVisible(false);
          setPinInput('');
        }}
        onOk={handleDirectPinSign}
        okText="Tasdiqlash"
        cancelText="Bekor qilish"
        confirmLoading={signHandoverMutation.isPending}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text>Ushbu dalolatnomani tasdiqlash uchun xavfsizlik PIN-kodini kiriting:</Text>
          <Input.Password
            placeholder="PIN-kod..."
            value={pinInput}
            onChange={setPinInput}
            maxLength={8}
          />
        </div>
      </Modal>
    </>
  );
};
