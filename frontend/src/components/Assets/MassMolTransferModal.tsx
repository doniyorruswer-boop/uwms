import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Button, Space, Typography, Alert } from '@arco-design/web-react';
import { IconUserGroup } from '@arco-design/web-react/icon';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';

const FormItem = Form.Item;
const { TextArea } = Input;
const { Text } = Typography;

interface MassMolTransferModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (transferResult: any) => void;
}

export const MassMolTransferModal: React.FC<MassMolTransferModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const { massMolHandoff, isHandoffPending, assets } = useAssetsQuery();
  const { rooms } = useOrganizationQuery();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedFromUser, setSelectedFromUser] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLoadingUsers(true);
      apiClient
        .get(API_ENDPOINTS.WAREHOUSE.USERS)
        .then((res) => setUsers(res.data || []))
        .catch((err) => console.error(err))
        .finally(() => setLoadingUsers(false));
    }
  }, [visible]);

  // Calculate count of assets belonging to selectedFromUser
  const assetsCount = selectedFromUser
    ? assets.filter(
        (a) => a.responsibleUserId === selectedFromUser && a.status !== 'WRITTEN_OFF',
      ).length
    : 0;

  const handleOk = async () => {
    try {
      const values = await form.validate();
      const res = await massMolHandoff({
        fromUserId: values.fromUserId,
        toUserId: values.toUserId,
        roomId: values.roomId,
        note: values.note,
      });
      form.resetFields();
      setSelectedFromUser(null);
      onClose();
      if (res && onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <IconUserGroup style={{ color: '#00B42A' }} />
          <span>MOL (Moddiy Javobgar Shaxs) Yalpi Almashinuvi</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 680, borderRadius: 0 }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 0 }}>
            Bekor Qilish
          </Button>
          <Button
            type="primary"
            loading={isHandoffPending}
            onClick={handleOk}
            style={{ borderRadius: 0, backgroundColor: '#00B42A' }}
          >
            Yalpi Dalolatnomani Rasmiylashtirish
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        style={{ marginBottom: 16, borderRadius: 0 }}
        content="Kafedra mudiri yoki laboratoriya mas’uli almashganda ashyolarni birma-bir ko‘chirib o‘tirmasdan, barcha biriktirilgan ashyolar yangi mudirga bitta rasmiy topshirish dalolatnomasi orqali yalpi o‘tkaziladi."
      />

      <Form form={form} layout="vertical">
        <FormItem
          label="Topshiruvchi Mas’ul Shaxs (Eski MOL)"
          field="fromUserId"
          rules={[{ required: true, message: 'Topshiruvchi xodimni tanlang!' }]}
        >
          <Select
            placeholder="Topshiruvchi xodimni tanlang..."
            loading={loadingUsers}
            showSearch
            onChange={(val) => setSelectedFromUser(val)}
            style={{ borderRadius: 0 }}
          >
            {users.map((u) => (
              <Select.Option key={u.id} value={u.id}>
                {u.fullName} ({u.role}) — {u.department?.name || 'Kafedra'}
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        {selectedFromUser && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: assetsCount > 0 ? '#E8FFEA' : '#FFF7E8',
              border: `1px solid ${assetsCount > 0 ? '#B7EB8F' : '#FFE58F'}`,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: 500 }}>
              Ushbu xodimga biriktirilgan faol asosiy vositalar soni: <b>{assetsCount} ta</b>
            </Text>
          </div>
        )}

        <FormItem
          label="Qabul Qiluvchi Yangi Mas’ul Shaxs (Yangi MOL)"
          field="toUserId"
          rules={[{ required: true, message: 'Qabul qiluvchi yangi xodimni tanlang!' }]}
        >
          <Select
            placeholder="Yangi kafedra mudiri / mas’ulni tanlang..."
            loading={loadingUsers}
            showSearch
            style={{ borderRadius: 0 }}
          >
            {users
              .filter((u) => u.id !== selectedFromUser)
              .map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.fullName} ({u.role}) — {u.department?.name || 'Kafedra'}
                </Select.Option>
              ))}
          </Select>
        </FormItem>

        <FormItem
          label="Muayyan Xona (Ixtiyoriy — barcha xonalarni o‘tkazish uchun bo‘sh qoldiring)"
          field="roomId"
        >
          <Select
            placeholder="Barcha biriktirilgan xonalar bo‘yicha"
            allowClear
            showSearch
            style={{ borderRadius: 0 }}
          >
            {rooms.map((r: any) => (
              <Select.Option key={r.id} value={r.id}>
                {r.number}-xona: {r.name}
              </Select.Option>
            ))}
          </Select>
        </FormItem>

        <FormItem
          label="Yalpi Topshirish Asosi / Buyruq Raqami"
          field="note"
          rules={[{ required: true, message: 'Topshirish asosini kiriting!' }]}
          initialValue="Kafedra mudiri lavozimiga tayinlanishi munosabati bilan moddiy javobgarlikni topshirish-qabul qilish"
        >
          <TextArea rows={3} style={{ borderRadius: 0 }} />
        </FormItem>
      </Form>
    </Modal>
  );
};
