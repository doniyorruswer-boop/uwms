import React from 'react';
import {
  Drawer,
  Spin,
  Alert,
  Descriptions,
  Tabs,
  Timeline,
  Tag,
  Table,
  Badge,
  Button,
  Empty,
  Space,
  Typography,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconClockCircle,
  IconCloseCircle,
  IconFile,
  IconUser,
  IconHistory,
  IconSafe,
  IconDesktop,
  IconRefresh,
} from '@arco-design/web-react/icon';
import { useHandoverAuditQuery } from '../../hooks/useHandoverQuery';
import type { ResponsibilityHandover } from '../../types';

interface HandoverAuditDrawerProps {
  visible: boolean;
  handoverId: string | null;
  onClose: () => void;
}

export const HandoverAuditDrawer: React.FC<HandoverAuditDrawerProps> = ({
  visible,
  handoverId,
  onClose,
}) => {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useHandoverAuditQuery(handoverId || '', {
    enabled: visible && !!handoverId,
  });

  const handover = data?.handover;
  const auditLogs = data?.auditLogs || [];
  const signingSessions = data?.signingSessions || [];

  // Signature calculation
  const isCompleted = handover?.status === 'COMPLETED';
  const isRejected = handover?.status === 'REJECTED';
  const isCancelled = handover?.status === 'CANCELLED';
  const isPendingAppr = handover?.status === 'PENDING_APPROVAL';
  const isAccRev = handover?.status === 'ACCOUNTANT_REVIEW';
  const isComRev = handover?.status === 'COMMANDANT_REVIEW';

  const depSigned = handover ? handover.status !== 'DRAFT' : false;
  const targetSigned = handover
    ? isCompleted || isPendingAppr || isAccRev || isComRev
    : false;
  const comSigned = handover
    ? !handover.commandantUserId || isCompleted || isPendingAppr || isAccRev
    : false;
  const accSigned = handover
    ? !handover.accountantUserId || isCompleted
    : false;

  const renderStatusBadge = (st?: string) => {
    if (!st) return null;
    if (st === 'COMPLETED') return <Badge status="success" text="Tasdiqlangan / Rasmiylashtirilgan" />;
    if (st === 'REJECTED') return <Badge status="error" text="Rad etilgan" />;
    if (st === 'CANCELLED') return <Badge status="default" text="Bekor qilingan" />;
    if (st === 'DRAFT') return <Badge status="default" text="Qoralama" />;
    if (st === 'PENDING_APPROVAL') return <Badge status="warning" text="Rahbariyat tasdig‘ida" />;
    if (st === 'ACCOUNTANT_REVIEW') return <Badge status="warning" text="Buxgalteriya ko‘rigida" />;
    if (st === 'COMMANDANT_REVIEW') return <Badge status="warning" text="Komendant ko‘rigida" />;
    if (st === 'RECEIVER_REVIEW') return <Badge status="processing" text="Yangi MOL ko‘rigida" />;
    return <Badge status="processing" text="Imzolar kutilmoqda" />;
  };

  const renderActionTag = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Tag color="blue" style={{ borderRadius: 0 }}>Yaratildi</Tag>;
      case 'SUBMIT':
        return <Tag color="arcoblue" style={{ borderRadius: 0 }}>Yuborildi</Tag>;
      case 'SIGN':
      case 'BIOMETRIC_SIGN':
      case 'BIOMETRIC_SIGNED':
        return <Tag color="green" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>Imzolandi</Tag>;
      case 'TRANSFER':
        return <Tag color="purple" style={{ borderRadius: 0 }}>Balans o‘tdi</Tag>;
      case 'REJECT':
        return <Tag color="red" icon={<IconCloseCircle />} style={{ borderRadius: 0 }}>Rad etildi</Tag>;
      case 'CANCEL':
        return <Tag color="gray" style={{ borderRadius: 0 }}>Bekor qilindi</Tag>;
      default:
        return <Tag style={{ borderRadius: 0 }}>{action}</Tag>;
    }
  };

  return (
    <Drawer
      width={780}
      title={
        <Space size="medium">
          <IconHistory style={{ color: '#165DFF', fontSize: 18 }} />
          <span>Dalolatnoma Audit Arxivi — {handover?.handoverNumber || 'Yuklanmoqda...'}</span>
        </Space>
      }
      visible={visible}
      onOk={onClose}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button icon={<IconRefresh />} loading={isFetching} onClick={() => refetch()}>
            Yangilash
          </Button>
          <Button type="primary" onClick={onClose} style={{ borderRadius: 0 }}>
            Yopish
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size={32} tip="Audit ma’lumotlari va arxiv loglari yuklanmoqda..." />
        </div>
      ) : isError ? (
        <Alert
          type="error"
          title="Audit jurnalini yuklashda xatolik yuz berdi"
          action={
            <Button size="small" type="primary" status="danger" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
          style={{ borderRadius: 0 }}
        />
      ) : !handover ? (
        <Empty description="Dalolatnoma ma’lumotlari topilmadi" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Info Banner */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-fill-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <Typography.Text bold style={{ fontSize: 16, color: '#165DFF' }}>
                {handover.handoverNumber}
              </Typography.Text>
              <span style={{ marginLeft: 12 }}>{renderStatusBadge(handover.status)}</span>
            </div>
            {(handover.docArchive?.checksum || handover.docArchive?.documentHash) && (
              <div style={{ fontSize: 11, color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconSafe style={{ color: '#00B42A' }} />
                <span>WORM Hash: </span>
                <code style={{ fontSize: 10, background: 'var(--color-fill-3)', padding: '2px 4px' }}>
                  {(handover.docArchive.checksum || handover.docArchive.documentHash || '').substring(0, 16)}...
                </code>
              </div>
            )}
          </div>

          {/* Details Overview */}
          <Descriptions
            border
            size="small"
            column={2}
            data={[
              {
                label: 'Topshirish turi',
                value: (
                  <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                    {handover.type === 'FULL_TRANSFER'
                      ? 'Yalpi topshirish (To‘liq)'
                      : handover.type === 'PARTIAL_TRANSFER'
                      ? 'Qisman topshirish'
                      : handover.type === 'ROOM_TRANSFER'
                      ? 'Xona topshirish'
                      : handover.type === 'RETURN_TO_WAREHOUSE'
                      ? 'Omborga qaytarish'
                      : handover.type === 'FINAL_CLEARANCE'
                      ? 'Aylanma varaqa'
                      : handover.type}
                  </Tag>
                ),
              },
              {
                label: 'Aktivlar soni',
                value: <b>{handover._count?.items || 0} ta asosiy vosita</b>,
              },
              {
                label: 'Topshiruvchi (Eski MOL)',
                value: (
                  <Space size="small">
                    <IconUser />
                    <span>{handover.departingUser?.fullName || '—'}</span>
                  </Space>
                ),
              },
              {
                label: 'Qabul qiluvchi (Yangi MOL)',
                value: (
                  <span style={{ color: '#165DFF', fontWeight: 600 }}>
                    {handover.targetUser?.fullName || handover.targetWarehouse?.name || '—'}
                  </span>
                ),
              },
              {
                label: 'Bino va xona',
                value: (
                  <div>
                    {handover.building?.name || '—'}{' '}
                    {handover.room ? `(${handover.room.number}-xona)` : ''}
                  </div>
                ),
              },
              {
                label: 'Komendant',
                value: handover.commandantUser?.fullName || 'Biriktirilmagan',
              },
              {
                label: 'Hisobchi',
                value: handover.accountantUser?.fullName || 'Biriktirilmagan',
              },
              {
                label: 'Yaratilgan sana',
                value: new Date(handover.createdAt).toLocaleString('uz-UZ'),
              },
            ]}
          />

          {/* Tabs for Timeline and Logs */}
          <Tabs defaultActiveTab="timeline">
            {/* TAB 1: Signature & Approval Timeline */}
            <Tabs.TabPane key="timeline" title="Imzo va Bosqichlar Xronologiyasi">
              <div style={{ padding: '16px 8px' }}>
                <Timeline>
                  {/* Step 1: Initiated */}
                  <Timeline.Item
                    label={new Date(handover.createdAt).toLocaleString('uz-UZ')}
                    dotColor="#00B42A"
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                      1. Topshirish arizasi yaratildi va yo‘naltirildi
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                      Tashabbuskor (Topshiruvchi):{' '}
                      <b>{handover.departingUser?.fullName}</b>
                    </div>
                    <Tag color="green" size="small" icon={<IconCheckCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                      Topshiruvchi roziligi tasdiqlangan
                    </Tag>
                  </Timeline.Item>

                  {/* Step 2: Receiver Review */}
                  <Timeline.Item
                    label={targetSigned ? 'Tasdiqlangan' : isRejected ? 'Rad etilgan' : 'Kutilmoqda'}
                    dotColor={targetSigned ? '#00B42A' : isRejected ? '#F53F3F' : '#FF7D00'}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                      2. Qabul qiluvchi yangi mas’ul (MOL) ko‘rigi va e-imzosi
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                      Qabul qiluvchi: <b>{handover.targetUser?.fullName || handover.targetWarehouse?.name || '—'}</b>
                    </div>
                    {targetSigned ? (
                      <Tag color="green" size="small" icon={<IconCheckCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                        Qabul qiluvchi tomonidan qabul qilindi va imzolandi
                      </Tag>
                    ) : isRejected ? (
                      <Tag color="red" size="small" icon={<IconCloseCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                        Rad etildi
                      </Tag>
                    ) : (
                      <Tag color="orange" size="small" icon={<IconClockCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                        Qabul qiluvchi ko‘rib chiqishi kutilmoqda
                      </Tag>
                    )}
                  </Timeline.Item>

                  {/* Step 3: Commandant */}
                  {handover.commandantUserId && (
                    <Timeline.Item
                      label={comSigned ? 'Tasdiqlangan' : isRejected ? 'To‘xtatilgan' : 'Kutilmoqda'}
                      dotColor={comSigned ? '#00B42A' : isRejected ? '#F53F3F' : '#FF7D00'}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                        3. Bino komendanti tomonidan xona butunligi ko‘rigi
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                        Mas’ul komendant: <b>{handover.commandantUser?.fullName || '—'}</b>
                      </div>
                      {comSigned ? (
                        <Tag color="green" size="small" icon={<IconCheckCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                          Xona va jihozlar butunligi tasdiqlandi
                        </Tag>
                      ) : (
                        <Tag color="orange" size="small" icon={<IconClockCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                          Komendant xulosasi kutilmoqda
                        </Tag>
                      )}
                    </Timeline.Item>
                  )}

                  {/* Step 4: Accountant Review */}
                  <Timeline.Item
                    label={accSigned ? 'Tasdiqlangan' : isRejected ? 'To‘xtatilgan' : 'Kutilmoqda'}
                    dotColor={accSigned ? '#00B42A' : isRejected ? '#F53F3F' : '#FF7D00'}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                      4. Moddiy hisob buxgalteriyasi tekshiruvi va balans tasdig‘i
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                      Mas’ul buxgalter: <b>{handover.accountantUser?.fullName || 'Bosh buxgalteriya'}</b>
                    </div>
                    {accSigned ? (
                      <Tag color="green" size="small" icon={<IconCheckCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                        Buxgalteriya ko‘rigidan o‘tdi
                      </Tag>
                    ) : (
                      <Tag color="orange" size="small" icon={<IconClockCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                        Buxgalteriya yakuniy tekshiruvi kutilmoqda
                      </Tag>
                    )}
                  </Timeline.Item>

                  {/* Step 5: Final Execution & WORM */}
                  <Timeline.Item
                    label={isCompleted ? new Date(handover.updatedAt).toLocaleString('uz-UZ') : 'Kutilmoqda'}
                    dotColor={isCompleted ? '#00B42A' : isRejected ? '#F53F3F' : '#C9CDD4'}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                      5. Balans o‘tkazmasi ijrosi va WORM arxivlanishi
                    </div>
                    {isCompleted ? (
                      <div style={{ marginTop: 6 }}>
                        <Tag color="green" size="small" icon={<IconCheckCircle />} style={{ borderRadius: 0 }}>
                          Aktivlar yangi mas’ulga o‘tkazildi, WORM arxivi shakllantirildi
                        </Tag>
                        {(handover.docArchive?.checksum || handover.docArchive?.documentHash) && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
                            Elektron Dalolatnoma Checksum: {handover.docArchive.checksum || handover.docArchive.documentHash}
                          </div>
                        )}
                      </div>
                    ) : isRejected ? (
                      <Tag color="red" size="small" icon={<IconCloseCircle />} style={{ marginTop: 6, borderRadius: 0 }}>
                        Dalolatnoma rad etilgan va jarayon to‘xtatilgan
                      </Tag>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                        Barcha tomonlar imzolagandan so‘ng ma’lumotlar bazasida tranzaksion amalga oshiriladi
                      </div>
                    )}
                  </Timeline.Item>
                </Timeline>
              </div>
            </Tabs.TabPane>

            {/* TAB 2: System Audit Logs */}
            <Tabs.TabPane key="audit-logs" title={`Tizim Audit Loglari (${auditLogs.length})`}>
              {auditLogs.length === 0 ? (
                <Empty description="Tizim audit yozuvlari topilmadi" style={{ padding: '30px 0' }} />
              ) : (
                <Table
                  rowKey="id"
                  data={auditLogs}
                  pagination={false}
                  size="small"
                  scroll={{ y: 360 }}
                  columns={[
                    {
                      title: 'Vaqt',
                      dataIndex: 'createdAt',
                      width: 140,
                      render: (d: string) => (
                        <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {new Date(d).toLocaleString('uz-UZ')}
                        </span>
                      ),
                    },
                    {
                      title: 'Harakat',
                      dataIndex: 'action',
                      width: 120,
                      render: (act: string) => renderActionTag(act),
                    },
                    {
                      title: 'Mas’ul Shaxs',
                      width: 160,
                      render: (_, row: any) => (
                        <div style={{ fontSize: 11 }}>
                          <b>{row.user?.fullName || 'Tizim / Anonim'}</b>
                          {row.user?.role && (
                            <div style={{ color: 'var(--color-text-3)', fontSize: 10 }}>
                              {row.user.role}
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: 'IP va Qurilma',
                      width: 120,
                      render: (_, row: any) => (
                        <div style={{ fontSize: 10, color: 'var(--color-text-3)' }}>
                          <div>{row.ipAddress || '—'}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Tafsilotlar',
                      dataIndex: 'details',
                      render: (val: string) => {
                        if (!val) return '—';
                        try {
                          const parsed = JSON.parse(val);
                          return (
                            <div style={{ fontSize: 11, maxHeight: 60, overflow: 'auto' }}>
                              {Object.entries(parsed).map(([k, v]) => (
                                <div key={k}>
                                  <span style={{ color: 'var(--color-text-3)' }}>{k}: </span>
                                  <span>{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        } catch {
                          return <span style={{ fontSize: 11 }}>{val}</span>;
                        }
                      },
                    },
                  ]}
                />
              )}
            </Tabs.TabPane>

            {/* TAB 3: Signing Sessions */}
            <Tabs.TabPane key="sessions" title={`Elektron Imzolar (${signingSessions.length})`}>
              {signingSessions.length === 0 ? (
                <Empty description="Raqamli imzolash sessiyalari mavjud emas" style={{ padding: '30px 0' }} />
              ) : (
                <Table
                  rowKey="id"
                  data={signingSessions}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'Hujjat №',
                      dataIndex: 'docNumber',
                      width: 140,
                      render: (n: string) => <b>{n}</b>,
                    },
                    {
                      title: 'Imzolovchi',
                      width: 180,
                      render: (_, row: any) => (
                        <div>
                          <div>{row.signedBy?.fullName || '—'}</div>
                          <Tag size="small" style={{ borderRadius: 0, marginTop: 2 }}>
                            {row.signedBy?.role || 'MOL'}
                          </Tag>
                        </div>
                      ),
                    },
                    {
                      title: 'Imzo Turi',
                      dataIndex: 'signatureType',
                      width: 150,
                      render: (t: string, row: any) => (
                        <div>
                          <Tag color="arcoblue" style={{ borderRadius: 0 }}>{t || 'BIOMETRIC_PASSKEY'}</Tag>
                          {row.biometricVerified && (
                            <Tag color="green" size="small" style={{ borderRadius: 0, marginTop: 2 }}>
                              Biometrik ✓
                            </Tag>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: 'Holati',
                      dataIndex: 'status',
                      width: 110,
                      render: (st: string) => (
                        <Badge
                          status={st === 'SIGNED' ? 'success' : 'processing'}
                          text={st === 'SIGNED' ? 'Imzolangan' : 'Kutilmoqda'}
                        />
                      ),
                    },
                    {
                      title: 'Sana',
                      dataIndex: 'signedAt',
                      width: 140,
                      render: (d: string) => (d ? new Date(d).toLocaleString('uz-UZ') : '—'),
                    },
                  ]}
                />
              )}
            </Tabs.TabPane>
          </Tabs>
        </div>
      )}
    </Drawer>
  );
};

export default HandoverAuditDrawer;
