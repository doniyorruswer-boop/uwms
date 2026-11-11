import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Typography,
  Table,
  Space,
  Button,
  Tag,
  Descriptions,
  Message,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconExclamationCircle,
  IconMobile,
  IconLock,
  IconSafe,
} from '@arco-design/web-react/icon';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants/api.constants';
import type { PendingRequestItem, OverQuotaRequestItem } from '../../hooks/useInboxQuery';
import { useRequestsQuery } from '../../hooks/useRequestsQuery';
import { useTwoFactorStatusQuery } from '../../hooks/useTwoFactorQuery';
import { TwoFactorSetupModal } from '../../components/Auth/TwoFactorSetupModal';
import { useAuthStore } from '../../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { RoleType, type RequestStatus, type RequestRecord } from '../../types';

const { Text } = Typography;
const FormItem = Form.Item;

export interface RectorVisaModalProps {
  visible: boolean;
  request: PendingRequestItem | OverQuotaRequestItem | RequestRecord | any | null;
  onClose: () => void;
  onApproved?: () => void;
  onOpenQrSign?: (request: any, note: string, totpCode?: string) => void;
  onReject?: (request: any) => void;
}

export const RectorVisaModal: React.FC<RectorVisaModalProps> = ({
  visible,
  request,
  onClose,
  onApproved,
  onOpenQrSign,
  onReject,
}) => {
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { updateRequestStatus } = useRequestsQuery();
  const { data: twoFactorStatus } = useTwoFactorStatusQuery();
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);

  const isRector = user?.role === RoleType.RECTOR;
  const isProrektor = user?.role === RoleType.VICE_RECTOR_FINANCE;
  const isSuperAdmin = user?.role === RoleType.SUPER_ADMIN || user?.role === RoleType.ADMIN;

  const defaultDecision: RequestStatus = isRector
    ? 'APPROVED_BY_RECTOR'
    : isProrektor
    ? 'APPROVED_BY_PRORECTOR'
    : request?.status === 'APPROVED_BY_PRORECTOR'
    ? 'APPROVED_BY_RECTOR'
    : 'APPROVED_BY_PRORECTOR';

  useEffect(() => {
    if (visible && request) {
      form.resetFields();
      let defaultNote = '';
      if (isRector) {
        defaultNote = request.isOverQuota
          ? 'Kafedra oylik limitidan ortiqcha talabnomaga Rektor farmoyishi bilan ruxsat berildi. Xarid va ta’minot amalga oshirilsin.'
          : 'Universitet Rektori tomonidan xarid talabnomasiga ruxsat berildi (viza). Davlat xaridlari (auksion) bo‘limiga yo‘naltirilsin.';
      } else if (isProrektor) {
        defaultNote = request.isOverQuota
          ? 'Kafedra oylik limitidan ortiqcha talabnoma Moliya-iqtisodiyot ishlari bo‘yicha prorektor tomonidan ko‘rib chiqildi va ma’qullandi.'
          : 'Moliya-iqtisodiyot ishlari bo‘yicha prorektor tomonidan ko‘rib chiqildi va viza qo‘yildi. Rektorat tasdig‘iga yo‘naltirilsin.';
      } else {
        defaultNote = 'Rektorat vizasi berildi. Xarid talabnomasi ma’qullandi.';
      }

      form.setFieldsValue({
        decision: defaultDecision,
        note: defaultNote,
        totpCode: '',
      });
    }
  }, [visible, request, form, isRector, isProrektor, defaultDecision]);

  if (!request) return null;

  const handleSubmit = async () => {
    try {
      if (!twoFactorStatus?.enabled) {
        Message.warning('Xavfsizlik talablariga ko‘ra viza qo‘yishdan oldin Google Authenticator (2FA) himoyasini yoqishingiz shart!');
        setIsTwoFactorModalOpen(true);
        return;
      }

      const values = await form.validate();
      const totpCode = values.totpCode?.trim();

      if (!totpCode) {
        Message.error('Google Authenticator 2FA kodini kiriting!');
        return;
      }

      setIsVerifyingTotp(true);
      try {
        await apiClient.post(API_ENDPOINTS.AUTH.TWO_FACTOR_VERIFY, { code: totpCode });
      } catch (err: any) {
        setIsVerifyingTotp(false);
        Message.error(err?.response?.data?.message || 'Google Authenticator 2FA kodi noto‘g‘ri yoki muddati o‘tgan!');
        return;
      }
      setIsVerifyingTotp(false);

      if (onOpenQrSign) {
        onClose();
        onOpenQrSign(request, values.note.trim(), totpCode);
      } else {
        await updateRequestStatus({
          id: request.id,
          status: values.decision || defaultDecision,
          note: values.note.trim(),
          totpCode,
        });
        queryClient.invalidateQueries({ queryKey: ['inbox'] });
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        queryClient.invalidateQueries({ queryKey: ['quotas'] });
        onClose();
        if (onApproved) onApproved();
      }
    } catch {
      // Form validation error
    }
  };

  const itemColumns = [
    {
      title: '№',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Mahsulot / Sarf Materiali',
      render: (_: any, record: any) => (
        <div>
          <Text bold>{record.item?.name || record.itemName || 'Mahsulot'}</Text>
          {record.item?.model && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              Model: {record.item.model}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'So‘ralgan Miqdor',
      width: 170,
      render: (_: any, record: any) => (
        <Tag
          color={request.isOverQuota ? 'red' : 'arcoblue'}
          style={{ borderRadius: 0, fontWeight: 600 }}
        >
          {record.requestedQty} {record.item?.unit || record.unit || 'dona'}
        </Tag>
      ),
    },
  ];

  const descriptionData = [
    {
      label: 'Talabnoma №',
      value: <Tag color="blue" style={{ borderRadius: 0 }}>{request.requestNumber}</Tag>,
    },
    { label: 'Kafedra / Bo‘lim', value: request.department?.name || (request as any).departmentName || '—' },
    { label: 'So‘rovchi xodim', value: request.requester?.fullName || (request as any).requesterName || '—' },
    { label: 'Talabnoma maqsadi', value: request.purpose },
    { label: 'Sana', value: new Date(request.createdAt).toLocaleString('uz-UZ') },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconCheckCircle
            style={{
              color: isRector ? '#722ED1' : '#165DFF',
              fontSize: 18,
            }}
          />
          <span>
            {isRector
              ? 'Universitet Rektori Vizasi (Ko‘rib Chiqish va Tasdiqlash)'
              : isProrektor
              ? 'Moliya-iqtisodiyot Prorektori Vizasi (Ko‘rib Chiqish va Tasdiqlash)'
              : 'Rektorat Vizasi (Ko‘rib Chiqish va Tasdiqlash)'}
          </span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {onReject ? (
            <Button
              status="danger"
              style={{ borderRadius: 0 }}
              onClick={() => {
                onClose();
                onReject(request);
              }}
            >
              Rad etish
            </Button>
          ) : (
            <div />
          )}
          <Space>
            <Button onClick={onClose} style={{ borderRadius: 0 }}>
              Bekor qilish
            </Button>
            <Button
              type="primary"
              icon={<IconMobile />}
              loading={isVerifyingTotp}
              style={{
                borderRadius: 0,
                backgroundColor: isRector ? '#722ED1' : '#165DFF',
                borderColor: isRector ? '#722ED1' : '#165DFF',
                fontWeight: 600,
                padding: '0 20px',
              }}
              onClick={handleSubmit}
            >
              Viza Qo‘yish va QR-Imzolash
            </Button>
          </Space>
        </div>
      }
      style={{ width: 720, maxWidth: '95vw', borderRadius: 0 }}
      unmountOnExit
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Status Alert Banner */}
        {request.isOverQuota ? (
          <Alert
            type="warning"
            showIcon
            title="Kafedraning Oylik Kvota Limiti Oshirilgan"
            content={`Ushbu kafedra joriy oy uchun belgilangan sarflanuvchi materiallar limitidan oshirib so‘rov yuborgan. OTM nizomiga muvofiq, ortiqcha tovarlar ombordan faqat maxsus ruxsat (${
              isRector ? 'Universitet Rektori' : 'Moliya-iqtisodiyot Prorektori'
            } vizasi) orqali chiqarilishi mumkin.`}
            style={{ borderRadius: 0 }}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            title="Talabnoma Bo‘yicha Xarid Materiallari Tarkibi"
            content="Talabnomani tasdiqlashdan oldin quyidagi ro‘yxatda ko‘rsatilgan mahsulotlar nomi, miqdori va kafedra ehtiyojini tekshirib chiqing."
            style={{ borderRadius: 0 }}
          />
        )}

        {/* Request Details */}
        <Descriptions
          column={2}
          data={descriptionData}
          border
          size="small"
          style={{ borderRadius: 0 }}
        />

        {/* Requested Items Table */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            So‘ralayotgan sarf materiallari va mahsulotlar ro‘yxati:
          </div>
          <Table
            rowKey={(r) => r.id || String(Math.random())}
            columns={itemColumns}
            data={request.items || []}
            pagination={false}
            size="small"
            border
            style={{ borderRadius: 0 }}
          />
        </div>

        {/* Approval Form */}
        <Form form={form} layout="vertical">
          <FormItem label="Tasdiqlovchi Mas’ul va Viza Turi">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isRector ? (
                <Tag
                  color="purple"
                  size="large"
                  style={{ borderRadius: 4, fontWeight: 600, padding: '6px 14px', fontSize: 13 }}
                >
                  🏛 Universitet Rektori Roziligi va Vizasi (APPROVED_BY_RECTOR)
                </Tag>
              ) : isProrektor ? (
                <Tag
                  color="arcoblue"
                  size="large"
                  style={{ borderRadius: 4, fontWeight: 600, padding: '6px 14px', fontSize: 13 }}
                >
                  💼 Moliya-iqtisodiyot ishlari bo‘yicha prorektor Vizasi (APPROVED_BY_PRORECTOR)
                </Tag>
              ) : (
                <Tag
                  color="gray"
                  size="large"
                  style={{ borderRadius: 4, fontWeight: 600, padding: '6px 14px', fontSize: 13 }}
                >
                  Bosh Administrator Vizasi
                </Tag>
              )}
            </div>
          </FormItem>

          {isSuperAdmin && (
            <FormItem
              label="Viza Bosqichini Tanlang (Faqat Administrator uchun)"
              field="decision"
              rules={[{ required: true, message: 'Viza turini tanlang' }]}
            >
              <Select style={{ borderRadius: 0 }}>
                <Select.Option value="APPROVED_BY_PRORECTOR">
                  Moliya-iqtisodiyot ishlari bo‘yicha prorektor Roziligi (APPROVED_BY_PRORECTOR)
                </Select.Option>
                <Select.Option value="APPROVED_BY_RECTOR">
                  Universitet Rektori Roziligi (APPROVED_BY_RECTOR)
                </Select.Option>
              </Select>
            </FormItem>
          )}

          <FormItem
            label="Qaror / Asoslovchi Rezolyutsiya"
            field="note"
            rules={[
              { required: true, message: 'Qaror yoki ko‘rsatmani kiriting' },
              { minLength: 5, message: 'Kamida 5 ta belgi kiriting' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Qaror yoki ko‘rsatmani kiriting..."
              style={{ borderRadius: 0 }}
            />
          </FormItem>

          {/* GOOGLE AUTHENTICATOR (2FA) SECTION */}
          {twoFactorStatus?.enabled ? (
            <FormItem
              label={
                <Space>
                  <IconLock style={{ color: '#165DFF' }} />
                  <span style={{ fontWeight: 600 }}>Google Authenticator (2FA) 6 Xonali Tasdiqlash Kodi *</span>
                </Space>
              }
              field="totpCode"
              rules={[
                { required: true, message: 'Google Authenticator ilovangizdagi 6 xonali kodni kiriting!' },
                { match: /^\d{6}$/, message: 'Kod aynan 6 ta raqamdan iborat bo‘lishi kerak!' },
              ]}
              extra="Shaxsiy telefoningizdagi Google Authenticator ilovasini ochib, joriy 6 xonali kodni kiriting. Kod tekshirilgach, QR-imzolash ochiladi."
            >
              <Input
                placeholder="Masalan: 384910"
                maxLength={6}
                prefix={<IconLock />}
                style={{
                  letterSpacing: 6,
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 0,
                  height: 42,
                }}
              />
            </FormItem>
          ) : (
            <Alert
              type="error"
              showIcon
              title="Google Authenticator (2FA) Himoyasi Yoqilmagan!"
              content="Universitet axborot xavfsizligi qoidalariga muvofiq, rektorat vizasini qo‘yish va QR-imzolash uchun Google Authenticator (2FA) yoqilgan bo‘lishi shart! Begona shaxslar hisobingizdan viza qo‘ya olmasligi uchun avval 2FA ni faollashtiring."
              action={
                <Button
                  size="small"
                  type="primary"
                  status="danger"
                  style={{ borderRadius: 0, whiteSpace: 'nowrap' }}
                  onClick={() => setIsTwoFactorModalOpen(true)}
                >
                  2FA ni Yoqish
                </Button>
              }
              style={{ borderRadius: 0, marginTop: 8 }}
            />
          )}
        </Form>
      </div>

      {/* Two Factor Setup Modal */}
      <TwoFactorSetupModal
        visible={isTwoFactorModalOpen}
        onClose={() => setIsTwoFactorModalOpen(false)}
      />
    </Modal>
  );
};
