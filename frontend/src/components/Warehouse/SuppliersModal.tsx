import React, { useState } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Form,
  Input,
  Typography,
  Tag,
  Card,
  Grid,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconCheckCircle,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { useSuppliersQuery, SupplierItem } from '../../hooks/useSuppliersQuery';

const { Row, Col } = Grid;
const { Text } = Typography;

interface SuppliersModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SuppliersModal: React.FC<SuppliersModalProps> = ({ visible, onClose }) => {
  const { suppliers, isLoading, nextCodes, createSupplier, isCreatingSupplier } = useSuppliersQuery();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async () => {
    const values = await form.validate();
    await createSupplier({
      name: values.name,
      inn: values.inn || nextCodes?.nextINN,
      contractNumber: values.contractNumber || nextCodes?.nextContractNumber,
      contactPerson: values.contactPerson,
      phone: values.phone,
      address: values.address,
    });
    form.resetFields();
    setShowAddForm(false);
  };

  const columns = [
    {
      title: '№',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Ta’minotchi Nomi',
      dataIndex: 'name',
      render: (name: string, record: SupplierItem) => (
        <div>
          <Text bold>{name}</Text>
          {record.address && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{record.address}</div>
          )}
        </div>
      ),
    },
    {
      title: 'STIR / INN (9 xona)',
      dataIndex: 'inn',
      width: 140,
      render: (inn: string) => (
        <Tag color="arcoblue" style={{ borderRadius: 0, fontFamily: 'monospace', fontWeight: 'bold' }}>
          {inn}
        </Tag>
      ),
    },
    {
      title: 'Shartnoma №',
      dataIndex: 'contractNumber',
      width: 140,
      render: (num: string) => (
        <Tag color="cyan" style={{ borderRadius: 0, fontFamily: 'monospace' }}>
          {num || '—'}
        </Tag>
      ),
    },
    {
      title: 'Aloqa Shaxsi / Tel',
      render: (_: any, record: SupplierItem) => (
        <div>
          <div>{record.contactPerson || '—'}</div>
          {record.phone && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{record.phone}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Kirimlar',
      render: (_: any, record: SupplierItem) => (
        <Tag color="green" style={{ borderRadius: 0 }}>
          {record._count?.movements || 0} ta operatsiya
        </Tag>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <IconUserGroup style={{ fontSize: 18, color: '#165DFF' }} />
          <span style={{ fontWeight: 600 }}>
            Tashqi Ta’minotchi Korxonalar va Shartnomalar Reestri
          </span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      style={{ width: 880, borderRadius: 0 }}
      footer={
        <Button onClick={onClose} style={{ borderRadius: 0 }}>
          Yopish
        </Button>
      }
    >
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text>
          Jami ro‘yxatdagi rasmiy ta’minotchilar: <b>{suppliers.length} ta</b>
        </Text>
        {!showAddForm && (
          <Button
            type="primary"
            size="small"
            icon={<IconPlus />}
            onClick={() => {
              setShowAddForm(true);
              form.setFieldsValue({
                inn: nextCodes?.nextINN,
                contractNumber: nextCodes?.nextContractNumber,
              });
            }}
            style={{ borderRadius: 0 }}
          >
            Yangi Ta’minotchi Ro‘yxatga Olish
          </Button>
        )}
      </div>

      {showAddForm && (
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 0,
            border: '1px solid #165DFF',
            background: 'var(--color-fill-1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text bold>Yangi Korxona Ma’lumotlarini Kiritish</Text>
            <Button size="mini" type="text" onClick={() => setShowAddForm(false)}>
              Yopish
            </Button>
          </div>
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Korxona Nomi"
                  field="name"
                  rules={[{ required: true, message: 'Korxona nomi shart!' }]}
                >
                  <Input placeholder="Masalan: 'Artel Savdo MCHJ'" style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="STIR / INN (9 xonali)"
                  field="inn"
                  rules={[{ required: true, message: 'STIR shart!' }]}
                >
                  <Input style={{ borderRadius: 0, fontFamily: 'monospace' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="Shartnoma Raqami"
                  field="contractNumber"
                  rules={[{ required: true, message: 'Shartnoma raqami shart!' }]}
                >
                  <Input style={{ borderRadius: 0, fontFamily: 'monospace' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Mas’ul Vakil" field="contactPerson">
                  <Input placeholder="F.I.SH" style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Telefon" field="phone">
                  <Input placeholder="+998 90 123 45 67" style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Yuridik Manzili" field="address">
                  <Input placeholder="Toshkent sh., Chilonzor..." style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              size="small"
              icon={<IconCheckCircle />}
              loading={isCreatingSupplier}
              onClick={handleCreate}
              style={{ borderRadius: 0 }}
            >
              Ta’minotchini Bazaga Saqlash
            </Button>
          </Form>
        </Card>
      )}

      <Table
        columns={columns}
        data={suppliers}
        loading={isLoading}
        pagination={{
          pageSize: 6,
          showTotal: (total) => `Jami: ${total} ta ta’minotchi`,
          sizeCanChange: false,
        }}
        border={{ wrapper: true, cell: true }}
        size="small"
        style={{ borderRadius: 0 }}
      />
    </Modal>
  );
};
