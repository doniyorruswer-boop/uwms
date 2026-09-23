import React from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Grid,
} from '@arco-design/web-react';
import {
  useCreateBuildingMutation,
  useOrganizationQuery,
} from '../../hooks/useOrganizationQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface CreateBuildingModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateBuildingModal: React.FC<CreateBuildingModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm();
  const createMutation = useCreateBuildingMutation();
  const { allDepartments } = useOrganizationQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100, isActive: true });

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await createMutation.mutateAsync({
        name: values.name.trim(),
        code: values.code ? values.code.trim().toUpperCase() : undefined,
        floorsCount: Number(values.floorsCount) || 4,
        address: values.address?.trim() || undefined,
        description: values.description?.trim() || undefined,
        commendantId: values.commendantId || undefined,
        departmentIds: values.departmentIds || undefined,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Yangi Bino / Korpus Qo‘shish"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={createMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          floorsCount: 4,
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="Bino / Korpus Nomi"
              field="name"
              rules={[{ required: true, message: 'Bino nomi kiritilishi shart!' }]}
            >
              <Input
                placeholder="Masalan: 1-o‘quv binosi, IT Korpus, Tabiiy fanlar korpusi"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Bino Qisqa Kodi (Unikal)"
              field="code"
              rules={[
                {
                  match: /^[A-Z0-9_-]+$/,
                  message: 'Katta lotin harflari va raqamlar (masalan: B1, IT-CORP)',
                },
              ]}
            >
              <Input
                placeholder="Masalan: B1, IT"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Qavatlar Soni"
              field="floorsCount"
              rules={[{ required: true, message: 'Qavatlar soni kiritilishi shart!' }]}
            >
              <InputNumber
                min={1}
                max={50}
                placeholder="4"
                style={{ width: '100%', borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Manzili (Ixtiyoriy)"
              field="address"
            >
              <Input
                placeholder="Masalan: Universitet ko‘chasi, 2-bino"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Komendanti / Mas’ul Shaxs"
              field="commendantId"
            >
              <Select
                placeholder="Binoga javobgar komendant yoki xodimni tanlang"
                allowClear
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
                style={{ borderRadius: 0 }}
              >
                {usersData?.items.map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.fullName} ({u.role} - {u.position || 'Xodim'})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Ushbu Binoda Joylashgan Fakultet / Bo‘limlar"
              field="departmentIds"
            >
              <Select
                mode="multiple"
                placeholder="Binoga biriktiriladigan fakultet yoki bo‘limlarni tanlang"
                allowClear
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
                style={{ borderRadius: 0 }}
              >
                {allDepartments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name} ({d.type === 'FACULTY' ? 'Fakultet' : d.type === 'CHAIR' ? 'Kafedra' : d.type})
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Bino Haqida Qo‘shimcha Ma’lumot"
              field="description"
            >
              <Input.TextArea
                placeholder="Bino maqsadi, auditoriyalar sig‘imi va h.k."
                style={{ borderRadius: 0 }}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
