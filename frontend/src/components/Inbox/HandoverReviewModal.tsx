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
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';
import { useHandoverDetailQuery, useSignHandoverMutation } from '../../hooks/useHandoverQuery';
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
  const [activeSigningRole, setActiveSigningRole] = useState<'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' | 'DEPARTING' | null>(null);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);

  const signHandoverMutation = useSignHandoverMutation();

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
  } else if (isSuperAdmin) {
    // SuperAdmin can sign any pending role
    if (!targetSig?.signed && handover?.targetUserId) myRoleToSign = 'TARGET';
    else if (!commandantSig?.signed && handover?.commandantUserId) myRoleToSign = 'COMMANDANT';
    else if (!accountantSig?.signed) myRoleToSign = 'ACCOUNTANT';
    else if (!departingSig?.signed) myRoleToSign = 'DEPARTING';
  }

  const handleOpenQrSign = (role: 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' | 'DEPARTING') => {
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
      render: (_: any, r: any) => <Tag color="blue">{r.itemInstance?.inventoryNumber}</Tag>,
    },
    {
      title: 'Aktiv Nomi',
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
      title: 'Harakat Turi',
      dataIndex: 'actionType',
      key: 'action',
      width: 160,
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
      width: 140,
      render: (_: any, r: any) => r.itemInstance?.room?.number || 'Omborda',
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
            <Button onClick={onClose}>Yopish</Button>
            <Space>
              <Button
                status="danger"
                icon={<IconCloseCircle />}
                onClick={() => setIsRejectModalVisible(true)}
              >
                Rad Etish
              </Button>
              {myRoleToSign ? (
                <Button
                  type="primary"
                  status="success"
                  icon={<IconMobile />}
                  onClick={() => handleOpenQrSign(myRoleToSign!)}
                >
                  QR bilan Qabul Qilish / Imzolash
                </Button>
              ) : (
                <Tooltip content="Siz ushbu arizada imzo qo‘yuvchi mas’ul emassiz yoki imzoingiz allaqachon qo‘yilgan.">
                  <Button type="primary" disabled icon={<IconCheckCircle />}>
                    Imzo Kutilmaydi
                  </Button>
                </Tooltip>
              )}
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
            {/* Context Alert */}
            <Alert
              type="info"
              showIcon
              content={
                <span>
                  Topshiruvchi: <strong>{handover?.departingUser?.fullName}</strong> ({handover?.departingUser?.position || 'MOL'}). 
                  Qabul qiluvchi: <strong>{handover?.targetUser?.fullName || handover?.targetWarehouse?.name || 'Omborxona'}</strong>. 
                  Ashyolar barcha 4 tomonlama mas’ullar tasdiqlagandan so‘ng rasman yangi balansga o‘tadi.
                </span>
              }
            />

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
