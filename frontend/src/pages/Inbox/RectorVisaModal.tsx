import React, { useEffect } from 'react';
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
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconExclamationCircle,
} from '@arco-design/web-react/icon';
import type { OverQuotaRequestItem } from '../../hooks/useInboxQuery';
import { useRequestsQuery } from '../../hooks/useRequestsQuery';
import { useAuthStore } from '../../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { RoleType } from '../../types';

const { Text } = Typography;
const FormItem = Form.Item;

export interface RectorVisaModalProps {
  visible: boolean;
  request: OverQuotaRequestItem | null;
  onClose: () => void;
  onApproved?: () => void;
}

export const RectorVisaModal: React.FC<RectorVisaModalProps> = ({
  visible,
  request,
  onClose,
  onApproved,
}) => {
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { updateRequestStatus } = useRequestsQuery();

  const isRector = user?.role === RoleType.RECTOR || user?.role === RoleType.SUPER_ADMIN;

  useEffect(() => {
    if (visible && request) {
      form.resetFields();
      form.setFieldsValue({
        decision: isRector ? 'APPROVED_BY_RECTOR' : 'APPROVED_BY_PRORECTOR',
        note: `Kafedra oylik limitidan ortiqcha talabnoma Rektorat qarori bilan ma’qullandi. Ombor zaxirasidan ajratilsin.`,
      });
    }
  }, [visible, request, form, isRector]);

  if (!request) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await updateRequestStatus({
        id: request.id,
        status: values.decision,
        note: values.note.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
      onClose();
      if (onApproved) onApproved();
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
        <Text bold>{record.item?.name || 'Mahsulot'}</Text>
      ),
    },
    {
      title: 'So‘ralgan Miqdor',
      width: 160,
      render: (_: any, record: any) => (
        <Tag color="red" style={{ borderRadius: 0, fontWeight: 600 }}>
          {record.requestedQty} {record.item?.unit || 'dona'}
        </Tag>
      ),
    },
  ];

  const descriptionData = [
    { label: 'Talabnoma №', value: <Tag color="blue" style={{ borderRadius: 0 }}>{request.requestNumber}</Tag> },
    { label: 'Kafedra / Bo‘lim', value: request.department?.name || '—' },
    { label: 'So‘rovchi xodim', value: request.requester?.fullName || '—' },
    { label: 'Talabnoma maqsadi', value: request.purpose },
    { label: 'Sana', value: new Date(request.createdAt).toLocaleString('uz-UZ') },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconExclamationCircle style={{ color: '#F7BA1E', fontSize: 18 }} />
          <span>Rektorat Maxsus Vizasi (Kvotadan Ortgan Talabnoma)</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Bekor qilish
          </Button>
          <Button
            type="primary"
            icon={<IconCheckCircle />}
            style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
            onClick={handleSubmit}
          >
            Viza Qo‘yish va Tasdiqlash
          </Button>
        </Space>
      }
      style={{ width: 680, borderRadius: 0 }}
      unmountOnExit
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Special Warning Banner */}
        <Alert
          type="warning"
          showIcon
          title="Kafedraning Oylik Kvota Limiti Oshirilgan"
          content="Ushbu kafedra joriy oy uchun belgilangan sarflanuvchi materiallar limitidan oshirib so‘rov yuborgan. OTM nizomiga muvofiq, ortiqcha tovarlar ombordan faqat Rektorat rasmiy vizasi (Rektor yoki Moliya-iqtisod Prorektori roziligi) orqali chiqarilishi mumkin."
          style={{ borderRadius: 0 }}
        />

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
            So‘ralayotgan sarf materiallari ro‘yxati:
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
          <FormItem
            label="Rektorat Vizasi Turi"
            field="decision"
            rules={[{ required: true, message: 'Viza turini tanlang' }]}
          >
            <Select style={{ borderRadius: 0 }}>
              <Select.Option value="APPROVED_BY_RECTOR">
                Universitet Rektori Roziligi (APPROVED_BY_RECTOR)
              </Select.Option>
              <Select.Option value="APPROVED_BY_PRORECTOR">
                Moliya-iqtisodiyot ishlari bo‘yicha prorektor Roziligi (APPROVED_BY_PRORECTOR)
              </Select.Option>
            </Select>
          </FormItem>

          <FormItem
            label="Rektorat Qarori / Asoslovchi Izoh"
            field="note"
            rules={[
              { required: true, message: 'Qaror yoki buyruq asosini kiriting' },
              { minLength: 5, message: 'Kamida 5 ta belgi kiriting' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Masalan: Rektorat yig‘ilishi 12-sonli bayonnomasi qaroriga asosan limitdan ortiqcha berilishiga ruxsat etildi..."
              style={{ borderRadius: 0 }}
            />
          </FormItem>
        </Form>
      </div>
    </Modal>
  );
};
