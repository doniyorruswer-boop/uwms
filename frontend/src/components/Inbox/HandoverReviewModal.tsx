import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Grid,
  Message,
  Tooltip,
  Steps,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconClockCircle,
  IconMobile,
  IconPrinter,
  IconLock,
  IconUser,
  IconFile,
  IconSend,
  IconSafe,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';
import {
  useHandoverDetailQuery,
  useSignHandoverMutation,
  useSubmitHandoverMutation,
  useCancelHandoverMutation,
} from '../../hooks/useHandoverQuery';
import { QRPairingModal } from '../Common/QRPairingModal';
import { RejectReasonModal } from '../Common/RejectReasonModal';
import { ROLE_CONFIG } from '../../constants/roles.constants';
import type { RoleType } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Row, Col } = Grid;

interface HandoverReviewModalProps {
  visible: boolean;
  handoverId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const HandoverReviewModal: React.FC<HandoverReviewModalProps> = ({
  visible,
  handoverId,
  onClose,
  onSuccess,
}) => {
  const { user: currentUser } = useAuthStore();
  const { data: handover, isLoading, refetch } = useHandoverDetailQuery(handoverId || '', {
    enabled: visible && !!handoverId,
  });

  const [docData, setDocData] = useState<any>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [activeSigningRole, setActiveSigningRole] = useState<'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' | 'DEPARTING' | 'SUPER_ADMIN' | null>(null);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);

  const signHandoverMutation = useSignHandoverMutation();
  const submitMutation = useSubmitHandoverMutation();
  const cancelMutation = useCancelHandoverMutation();

  // Load OS-1 HTML and signatories
  const loadDoc = async () => {
    if (!handoverId) return;
    try {
      setIsLoadingDoc(true);
      const res = await apiClient.get(API_ENDPOINTS.HANDOVERS.DOCUMENT(handoverId));
      setDocData(res.data);
    } catch (err) {
      // Document might not be generated yet
    } finally {
      setIsLoadingDoc(false);
    }
  };

  useEffect(() => {
    if (visible && handoverId) {
      loadDoc();
    }
  }, [visible, handoverId]);

  if (!visible || !handoverId) return null;

  // Determine current user's role in this handover
  const departingSig = docData?.signatories?.find((s: any) => s.role === 'DEPARTING');
  const targetSig = docData?.signatories?.find((s: any) => s.role === 'TARGET');
  const commandantSig = docData?.signatories?.find((s: any) => s.role === 'COMMANDANT');
  const accountantSig = docData?.signatories?.find((s: any) => s.role === 'ACCOUNTANT');

  const isTarget = currentUser?.id === handover?.targetUserId;
  const isCommandant =
    currentUser?.id === handover?.commandantUserId ||
    currentUser?.role === 'COMMENDANT';
  const isAccountant =
    currentUser?.id === handover?.accountantUserId ||
    currentUser?.role === 'CHIEF_ACCOUNTANT';
  const isDeparting = currentUser?.id === handover?.departingUserId;
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isExecutive =
    currentUser?.role === 'VICE_RECTOR_FINANCE' ||
    currentUser?.role === 'RECTOR' ||
    currentUser?.role === 'CHIEF_ACCOUNTANT' ||
    currentUser?.role === 'SUPER_ADMIN';

  const isPendingApproval = handover?.status === 'PENDING_APPROVAL';
  const isDraft = handover?.status === 'DRAFT';
  const isCompleted = handover?.status === 'COMPLETED';
  const isRejected = handover?.status === 'REJECTED';
  const isCancelled = handover?.status === 'CANCELLED';

  const handleSubmitDraft = async () => {
    if (!handoverId) return;
    try {
      await submitMutation.mutateAsync(handoverId);
      refetch();
      if (onSuccess) onSuccess();
    } catch (e) {
      // error handled by mutation
    }
  };

  const handleCancelHandover = async () => {
    if (!handoverId) return;
    try {
      await cancelMutation.mutateAsync({ id: handoverId, reason: 'Foydalanuvchi tomonidan bekor qilindi' });
      refetch();
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      // error handled by mutation
    }
  };

  // State Machine Step indexing:
  // Step 0: Topshiruvchi (DRAFT / SUBMITTED)
  // Step 1: Yangi MOL (RECEIVER_REVIEW)
  // Step 2: Bino Komendanti (COMMANDANT_REVIEW)
  // Step 3: Moddiy Hisobchi (ACCOUNTANT_REVIEW)
  // Step 4: Rahbariyat Tasdig'i (PENDING_APPROVAL)
  // Step 5: Muvaffaqiyatli Yakunlandi (COMPLETED)
  let stepCurrent = 0;
  let stepStatus: 'wait' | 'process' | 'finish' | 'error' = 'process';

  if (isCompleted) {
    stepCurrent = 5;
    stepStatus = 'finish';
  } else if (isRejected || isCancelled) {
    stepStatus = 'error';
    if (isCancelled) stepCurrent = 0;
    else if (!targetSig?.signed) stepCurrent = 1;
    else if (!commandantSig?.signed) stepCurrent = 2;
    else if (!accountantSig?.signed) stepCurrent = 3;
    else stepCurrent = 4;
  } else if (isPendingApproval) {
    stepCurrent = 4;
  } else if (handover?.status === 'ACCOUNTANT_REVIEW') {
    stepCurrent = 3;
  } else if (handover?.status === 'COMMANDANT_REVIEW') {
    stepCurrent = 2;
  } else if (handover?.status === 'RECEIVER_REVIEW' || handover?.status === 'SUBMITTED' || handover?.status === 'PENDING_SIGNATURES') {
    if (targetSig?.signed && !commandantSig?.signed) stepCurrent = 2;
    else if (targetSig?.signed && commandantSig?.signed && !accountantSig?.signed) stepCurrent = 3;
    else stepCurrent = 1;
  } else if (isDraft) {
    stepCurrent = 0;
  }

  // Can the current user sign now?
  let myRoleToSign: 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' | 'DEPARTING' | null = null;
  if (isTarget && !targetSig?.signed) {
    myRoleToSign = 'TARGET';
  } else if (isCommandant && !commandantSig?.signed) {
    myRoleToSign = 'COMMANDANT';
  } else if (isAccountant && !accountantSig?.signed) {
    myRoleToSign = 'ACCOUNTANT';
  } else if (isDeparting && !departingSig?.signed) {
    myRoleToSign = 'DEPARTING';
  } else if (isPendingApproval && isExecutive) {
    myRoleToSign = 'ACCOUNTANT';
  } else if (isSuperAdmin) {
    // SuperAdmin can sign any pending role
    if (!targetSig?.signed && handover?.targetUserId) myRoleToSign = 'TARGET';
    else if (!commandantSig?.signed && handover?.commandantUserId) myRoleToSign = 'COMMANDANT';
    else if (!accountantSig?.signed) myRoleToSign = 'ACCOUNTANT';
    else if (!departingSig?.signed) myRoleToSign = 'DEPARTING';
  }

  const handleOpenQrSign = (role: 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' | 'DEPARTING' | 'SUPER_ADMIN') => {
    setActiveSigningRole(role);
    setIsQrModalVisible(true);
  };

  const handleQrSignSuccess = async (result: any) => {
    if (!handoverId) return;
    setIsQrModalVisible(false);
    try {
      await signHandoverMutation.mutateAsync({
        id: handoverId,
        payload: {
          pin: result.signatureHash || 'QR_BIOMETRIC_VERIFIED',
          note: `QR-Pairing mobil tasdiqlash orqali imzolandi (${result.signerName || currentUser?.fullName}).`,
        },
      });
      Message.success('Dalolatnoma elektron imzo bilan muvaffaqiyatli tasdiqlandi!');
      loadDoc();
      refetch();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Imzo qo‘yishda xatolik yuz berdi');
    }
  };

  const handleConfirmReject = async (reason: string) => {
    if (!handoverId) return;
    try {
      await apiClient.post(API_ENDPOINTS.HANDOVERS.REJECT(handoverId), { reason });
      Message.info('Topshirish arizasi rad etildi va jarayon to‘xtatildi');
      setIsRejectModalVisible(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Message.error(err?.response?.data?.message || 'Rad etishda xatolik yuz berdi');
    }
  };

  const contentHtml = docData?.contentHtml || docData?.htmlContent;

  const itemColumns = [
    {
      title: 'Inventar №',
      dataIndex: 'itemInstance.inventoryNumber',
      key: 'inv',
      width: 140,
      render: (_: any, r: any) => <b style={{ color: '#165DFF' }}>{r.itemInstance?.inventoryNumber}</b>,
    },
    {
      title: 'Aktiv Nomi va Modeli',
      key: 'name',
      render: (_: any, r: any) => (
        <div>
          <Text style={{ fontWeight: 600 }}>{r.itemInstance?.item?.name}</Text>
          {r.itemInstance?.item?.model && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Model: {r.itemInstance?.item?.model}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Seriya №',
      key: 'serial',
      width: 130,
      render: (_: any, r: any) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {r.itemInstance?.serialNumber || '—'}
        </span>
      ),
    },
    {
      title: 'Texnik Holati / Qayd',
      key: 'condition',
      width: 160,
      render: (_: any, r: any) => {
        const cond = r.conditionNote || r.itemInstance?.status;
        let color = 'green';
        if (cond?.includes('Nosoz') || cond === 'IN_REPAIR') color = 'orange';
        if (cond?.includes('Spisanie') || cond === 'WRITTEN_OFF') color = 'red';
        if (cond?.includes('Kamomad') || cond === 'MISSING') color = 'magenta';
        return <Tag color={color} size="small">{cond || 'Soz'}</Tag>;
      },
    },
    {
      title: 'Harakat Turi',
      dataIndex: 'actionType',
      key: 'action',
      width: 150,
      render: (act: string) => {
        if (act === 'TRANSFER_TO_MOL') return <Tag color="blue">Yangi MOLga</Tag>;
        if (act === 'RETURN_TO_WAREHOUSE') return <Tag color="green">Omborga</Tag>;
        if (act === 'SEND_TO_REPAIR') return <Tag color="orange">Ta’mirga</Tag>;
        if (act === 'WRITE_OFF') return <Tag color="purple">Spisanie</Tag>;
        if (act === 'SHORTAGE') return <Tag color="red">Kamomad</Tag>;
        return <Tag>{act}</Tag>;
      },
    },
    {
      title: 'Xonasi',
      key: 'room',
      width: 120,
      render: (_: any, r: any) => r.itemInstance?.room?.number ? `${r.itemInstance.room.number}-xona` : 'Omborda',
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <IconFile style={{ color: '#165DFF', fontSize: 18 }} />
            <span>Dalolatnomani Ko‘rib Chiqish va Imzolash ({handover?.handoverNumber || ''})</span>
          </Space>
        }
        visible={visible}
        onCancel={onClose}
        style={{ width: 880 }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button onClick={onClose}>Yopish</Button>
              {isDraft && (isDeparting || isSuperAdmin) && (
                <Button status="danger" onClick={handleCancelHandover} loading={cancelMutation.isPending}>
                  Qoralamani Bekor Qilish
                </Button>
              )}
            </Space>
            <Space>
              {!isCompleted && !isRejected && !isCancelled && !isDraft && (isDeparting || isSuperAdmin) && (
                <Button
                  status="danger"
                  icon={<IconCloseCircle />}
                  onClick={() => setIsRejectModalVisible(true)}
                >
                  Rad Etish
                </Button>
              )}

              {isDraft && (isDeparting || isSuperAdmin) && (
                <Button
                  type="primary"
                  status="success"
                  icon={<IconSend />}
                  loading={submitMutation.isPending}
                  onClick={handleSubmitDraft}
                >
                  Topshirishga Yuborish
                </Button>
              )}

              {isPendingApproval && isExecutive && (
                <Button
                  type="primary"
                  status="warning"
                  icon={<IconCheckCircle />}
                  onClick={() => handleOpenQrSign('SUPER_ADMIN')}
                >
                  Rahbariyat Nomidan Tasdiqlash
                </Button>
              )}

              {myRoleToSign && !isPendingApproval ? (
                <Button
                  type="primary"
                  status="success"
                  icon={<IconMobile />}
                  onClick={() => handleOpenQrSign(myRoleToSign!)}
                >
                  {myRoleToSign === 'TARGET'
                    ? 'Barchasini qabul qilaman (QR-Imzo)'
                    : myRoleToSign === 'COMMANDANT'
                    ? 'Xona butunligi va kalitlarni tasdiqlash (QR-Imzo)'
                    : myRoleToSign === 'ACCOUNTANT'
                    ? 'Balansni tasdiqlash (QR-Imzo)'
                    : 'QR bilan Imzolash'}
                </Button>
              ) : !isDraft && !isPendingApproval ? (
                <Tooltip
                  content={
                    isCompleted
                      ? "Dalolatnoma barcha mas’ullar tomonidan to‘liq imzolangan"
                      : "Siz ushbu arizada imzo qo‘yuvchi mas’ul emassiz yoki imzoingiz allaqachon qo‘yilgan."
                  }
                >
                  <Button type="primary" disabled icon={<IconCheckCircle />}>
                    {isCompleted ? 'To‘liq Imzolangan' : 'Imzo Kutilmaydi'}
                  </Button>
                </Tooltip>
              ) : null}
            </Space>
          </div>
        }
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Dalolatnoma ma’lumotlari yuklanmoqda..." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Official State Machine Stepper */}
            <Card className="uwms-card" style={{ padding: '12px 16px', background: 'var(--color-fill-1)' }}>
              <Steps current={stepCurrent} status={stepStatus} size="small">
                <Steps.Step title="1. Topshiruvchi" description={isDraft ? 'Qoralama' : 'Yuborildi'} />
                <Steps.Step title="2. Yangi MOL" description={targetSig?.signed ? 'Qabul qilindi' : 'Ko‘rib chiqish'} />
                <Steps.Step title="3. Komendant" description={commandantSig?.signed ? 'Tasdiqlandi' : 'Xona nazorati'} />
                <Steps.Step title="4. Buxgalteriya" description={accountantSig?.signed ? 'Muhrlandi' : 'Balans ko‘rigi'} />
                <Steps.Step
                  title="5. Rahbariyat"
                  description={isCompleted ? 'Tasdiqlandi' : isPendingApproval ? 'Tasdiq kutilmoqda' : 'Yakuniy viza'}
                />
                <Steps.Step title="6. Natija (OS-1)" description={isCompleted ? 'Rasmiylashtirildi' : 'Kutilmoqda'} />
              </Steps>
            </Card>

            {/* Context Alert based on State */}
            {isDraft ? (
              <Alert
                type="info"
                showIcon
                content="Ushbu ariza qoralama (DRAFT) holatida. Barcha aktivlar ro‘yxatini tekshiring va rasmiy topshirish jarayonini boshlash uchun 'Topshirishga Yuborish' tugmasini bosing."
              />
            ) : isPendingApproval ? (
              <Alert
                type="warning"
                showIcon
                content={
                  <span>
                    <strong>Rahbariyat Tasdig‘i Kutilmoqda (PENDING_APPROVAL):</strong> Barcha operatsion tomonlar
                    (Qabul qiluvchi, Komendant, Buxgalter) dalolatnomani imzoladilar. Prorektor yoki Bosh hisobchi
                    tasdiqlaganidan so‘ng mulklar rasman yangi mas’ul balansiga o‘tkaziladi.
                  </span>
                }
              />
            ) : isCompleted ? (
              <Alert
                type="success"
                showIcon
                content={
                  <span>
                    <strong>Muvaffaqiyatli Yakunlangan (COMPLETED):</strong> Ushbu moddiy topshirish dalolatnomasi
                    barcha tomonlar tomonidan to‘liq imzolangan, davlat standarti OS-1 elektron dalolatnomasi
                    muhrlangan va ashyolar yangi mas’ul balansiga o‘tkazilgan.
                  </span>
                }
              />
            ) : isRejected ? (
              <Alert
                type="error"
                showIcon
                content="Topshirish arizasi rad etilgan va jarayon to‘xtatilgan. Aktivlar topshiruvchi xodim hisobida saqlanib qoldi."
              />
            ) : isCancelled ? (
              <Alert
                type="info"
                showIcon
                content="Ushbu topshirish arizasi arizachi yoki ma’mur tomonidan bekor qilingan."
              />
            ) : (
              <Alert
                type="info"
                showIcon
                content={
                  <span>
                    Topshiruvchi: <strong>{handover?.departingUser?.fullName}</strong> ({handover?.departingUser?.position || 'MOL'}). 
                    Qabul qiluvchi: <strong>{handover?.targetUser?.fullName || handover?.targetWarehouse?.name || 'Omborxona'}</strong>. 
                    Ashyolar barcha mas’ullar tasdiqlagandan so‘ng rasman yangi balansga o‘tadi.
                  </span>
                }
              />
            )}

            {/* Signatories 4-Way Status Cards */}
            <Card className="uwms-card" title="Ishtirokchilar Imzosi Holati (4 Tomonlama Vizalash)">
              <Row gutter={[12, 12]}>
                {/* 1. Topshiruvchi */}
                <Col span={12}>
                  <Card
                    className="uwms-card"
                    style={{ border: '1px solid var(--color-border)' }}
                    title="1. Topshiruvchi (Eski MOL)"
                    extra={
                      departingSig?.signed ? (
                        <Tag color="green" icon={<IconCheckCircle />}>Imzolandi</Tag>
                      ) : (
                        <Tag color="gold" icon={<IconClockCircle />}>Kutilmoqda</Tag>
                      )
                    }
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      {handover?.departingUser?.fullName} ({handover?.departingUser?.position || 'MOL'})
                    </div>
                    {departingSig?.signed ? (
                      <Tag color="green">Elektron imzo qo‘yilgan</Tag>
                    ) : isDeparting || isSuperAdmin ? (
                      <Button size="small" type="primary" icon={<IconMobile />} onClick={() => handleOpenQrSign('DEPARTING')}>
                        QR bilan Imzolash
                      </Button>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>Topshiruvchi imzosi kutilmoqda</Text>
                    )}
                  </Card>
                </Col>

                {/* 2. Qabul qiluvchi */}
                <Col span={12}>
                  <Card
                    className="uwms-card"
                    style={{ border: '1px solid var(--color-border)' }}
                    title="2. Qabul Qiluvchi (Yangi MOL)"
                    extra={
                      targetSig?.signed ? (
                        <Tag color="green" icon={<IconCheckCircle />}>Imzolandi</Tag>
                      ) : (
                        <Tag color="gold" icon={<IconClockCircle />}>Kutilmoqda</Tag>
                      )
                    }
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      {handover?.targetUser?.fullName || handover?.targetWarehouse?.name || 'Qabul qiluvchi'}
                    </div>
                    {targetSig?.signed ? (
                      <Tag color="green">Elektron imzo qo‘yilgan</Tag>
                    ) : isTarget || isSuperAdmin ? (
                      <Button size="small" type="primary" status="success" icon={<IconMobile />} onClick={() => handleOpenQrSign('TARGET')}>
                        QR bilan Qabul Qilish
                      </Button>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>Qabul qiluvchi tasdig‘i kutilmoqda</Text>
                    )}
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
                        <Tag color="green" icon={<IconCheckCircle />}>Imzolandi</Tag>
                      ) : (
                        <Tag color="gold" icon={<IconClockCircle />}>Kutilmoqda</Tag>
                      )
                    }
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      {handover?.commandantUser?.fullName || 'Bino komendanti'}
                    </div>
                    {commandantSig?.signed ? (
                      <Tag color="green">Elektron imzo qo‘yilgan</Tag>
                    ) : isCommandant || isSuperAdmin ? (
                      <Button size="small" type="primary" icon={<IconMobile />} onClick={() => handleOpenQrSign('COMMANDANT')}>
                        QR bilan Tasdiqlash
                      </Button>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>Komendant imzosi kutilmoqda</Text>
                    )}
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
                        <Tag color="green" icon={<IconCheckCircle />}>Imzolandi</Tag>
                      ) : (
                        <Tag color="gold" icon={<IconClockCircle />}>Kutilmoqda</Tag>
                      )
                    }
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      {handover?.accountantUser?.fullName || 'Buxgalteriya vakili'}
                    </div>
                    {accountantSig?.signed ? (
                      <Tag color="green">Elektron imzo qo‘yilgan</Tag>
                    ) : isAccountant || isSuperAdmin ? (
                      <Button size="small" type="primary" icon={<IconMobile />} onClick={() => handleOpenQrSign('ACCOUNTANT')}>
                        QR bilan Tasdiqlash
                      </Button>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>Hisobchi imzosi kutilmoqda</Text>
                    )}
                  </Card>
                </Col>
              </Row>
            </Card>

            {/* Role-Specific Direct Action Banner */}
            {isTarget && !targetSig?.signed && (
              <Card className="uwms-card" style={{ background: '#E8FFEA', border: '1px solid #7BE188' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <Typography.Text style={{ fontWeight: 600, color: '#00B42A', fontSize: 14 }}>
                      <IconCheckCircle style={{ marginRight: 6 }} /> Qabul Qiluvchi Mas’ul (Yangi MOL) Ko‘rigi:
                    </Typography.Text>
                    <Typography.Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-2)' }}>
                      Quyidagi {handover?.items?.length || 0} ta asosiy vosita va inventarlarning jismoniy holati hamda seriya raqamlarini to‘liq tekshirib chiqing.
                    </Typography.Paragraph>
                  </div>
                  <Button
                    type="primary"
                    status="success"
                    icon={<IconMobile />}
                    size="large"
                    onClick={() => handleOpenQrSign('TARGET')}
                  >
                    Barchasini qabul qilaman (QR-Imzo)
                  </Button>
                </div>
              </Card>
            )}

            {isCommandant && !commandantSig?.signed && (
              <Card className="uwms-card" style={{ background: '#FFF7E8', border: '1px solid #FFC72E' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <Typography.Text style={{ fontWeight: 600, color: '#D46B08', fontSize: 14 }}>
                      <IconSafe style={{ marginRight: 6 }} /> Bino Komendantining Nazorat Tekshiruvi:
                    </Typography.Text>
                    <Typography.Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-2)' }}>
                      Xonaning jismoniy butunligi, eshik va derazalar sozligi hamda xona kalitlari yangi mas’ulga topshirilgani tekshirildi.
                    </Typography.Paragraph>
                  </div>
                  <Button
                    type="primary"
                    status="warning"
                    icon={<IconMobile />}
                    size="large"
                    onClick={() => handleOpenQrSign('COMMANDANT')}
                  >
                    Xona Butunligi va Kalitlarni Tasdiqlash (QR-Imzo)
                  </Button>
                </div>
              </Card>
            )}

            {isAccountant && !accountantSig?.signed && (
              <Card className="uwms-card" style={{ background: '#F9F0FF', border: '1px solid #D3ADF7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <Typography.Text style={{ fontWeight: 600, color: '#722ED1', fontSize: 14 }}>
                      <IconFile style={{ marginRight: 6 }} /> Moddiy Hisobchi Tekshiruvi (Buxgalteriya):
                    </Typography.Text>
                    <Typography.Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-2)' }}>
                      Ashyolarning buxgalteriya balansi va subschetdagi qoldiqlari tekshirildi, o‘tkazishga tayyor.
                    </Typography.Paragraph>
                  </div>
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#722ED1', borderColor: '#722ED1' }}
                    icon={<IconMobile />}
                    size="large"
                    onClick={() => handleOpenQrSign('ACCOUNTANT')}
                  >
                    Balansni Tasdiqlash (QR-Imzo)
                  </Button>
                </div>
              </Card>
            )}

            {/* Items Table */}
            <Card
              className="uwms-card"
              title={`Topshirilayotgan Asosiy Vositalar (${handover?.items?.length || 0} ta)`}
              style={{ maxHeight: 250, overflowY: 'auto' }}
            >
              <Table
                rowKey="id"
                columns={itemColumns}
                data={handover?.items || []}
                pagination={false}
                size="small"
              />
            </Card>

            {/* Official OS-1 Document HTML Preview */}
            <Card
              className="uwms-card"
              title="OS-1 Rasmiy Davlat Standart Dalolatnomasi Ko‘rinishi"
              extra={
                <Button size="small" icon={<IconPrinter />} onClick={() => window.print()}>
                  Chop Etish
                </Button>
              }
              style={{ maxHeight: 350, overflowY: 'auto' }}
            >
              {isLoadingDoc ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spin tip="Hujjat shakli yuklanmoqda..." />
                </div>
              ) : contentHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                  style={{
                    transform: 'scale(0.92)',
                    transformOrigin: 'top left',
                    width: '108%',
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Text type="secondary">OS-1 rasmiy elektron hujjati tayyorlanmoqda...</Text>
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* QR PAIRING MODAL */}
      {activeSigningRole && handover && (
        <QRPairingModal
          visible={isQrModalVisible}
          onClose={() => setIsQrModalVisible(false)}
          onSuccess={handleQrSignSuccess}
          payload={{
            docNumber: handover.handoverNumber,
            docType: 'OS-1',
            title: `OS-1 Topshirish-Qabul Qilish Dalolatnomasi (${handover.handoverNumber})`,
            departmentName: handover.room ? `${handover.room.number} - ${handover.room.name}` : 'Universitet',
            itemSummary: `${handover.items?.length || 0} ta ashyo topshirilmoqda. Mas’uliyat roli: ${activeSigningRole}`,
            targetSignerRole: activeSigningRole,
            targetSignerName: currentUser?.fullName || 'Mas’ul Shaxs',
            targetUserId: currentUser?.id,
            metadata: {
              handoverId: handover.id,
              handoverNumber: handover.handoverNumber,
              signatoryRole: activeSigningRole,
            },
          }}
        />
      )}

      {/* REJECT MODAL */}
      <RejectReasonModal
        visible={isRejectModalVisible}
        title="Topshirish Dalolatnomasini Rad Etish"
        itemIdentifier={handover?.handoverNumber}
        onClose={() => setIsRejectModalVisible(false)}
        onConfirm={handleConfirmReject}
      />
    </>
  );
};
