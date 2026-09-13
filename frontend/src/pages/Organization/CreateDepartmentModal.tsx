import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Grid,
} from '@arco-design/web-react';
import {
  useCreateDepartmentMutation,
  useOrganizationQuery,
} from '../../hooks/useOrganizationQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface CreateDepartmentModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm();
  const createMutation = useCreateDepartmentMutation();
  const { allDepartments } = useOrganizationQuery();

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await createMutation.mutateAsync({
        name: values.name,
        code: values.code ? values.code.trim().toUpperCase() : undefined,
        type: values.type || 'CHAIR',
        parentId: values.parentId || undefined,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  return (
    <Modal
      title="Yangi Fakultet / Bo‘lim / Kafedra Qo‘shish"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={createMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 560, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: 'CHAIR',
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="Bo‘lim / Kafedra Nomi"
              field="name"
              rules={[{ required: true, message: 'Nomi kiritilishi shart!' }]}
            >
              <Input
                placeholder="Masalan: Raqamli Iqtisodiyot Fakulteti yoki Dasturiy Injiniring Kafedrasi"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Bo‘lim Qisqa Kodi (Unikal)"
              field="code"
              rules={[
                {
                  match: /^[A-Z0-9_-]+$/,
                  message: 'Katta lotin harflari va raqamlar (masalan: DI-KAF)',
                },
              ]}
            >
              <Input
                placeholder="Masalan: DI-KAF"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={12}>
            <FormItem
              label="Bo‘lim Turi"
              field="type"
              rules={[{ required: true, message: 'Turi tanlanishi shart!' }]}
            >
              <Select placeholder="Turini tanlang" style={{ borderRadius: 0 }}>
                <Select.Option value="RECTORATE">Rektorat va Rahbariyat</Select.Option>
                <Select.Option value="DIVISION">Boshqarma va Markazlar</Select.Option>
                <Select.Option value="DEPARTMENT">Bo‘lim va Xizmatlar (Buxgalteriya, Kadrlar, Xo‘jalik...)</Select.Option>
                <Select.Option value="FACULTY">Fakultet</Select.Option>
                <Select.Option value="CHAIR">Kafedra</Select.Option>
                <Select.Option value="LIBRARY">Kutubxona / ARM</Select.Option>
                <Select.Option value="LAB">Laboratoriya va Ilmiy Markaz</Select.Option>
              </Select>
            </FormItem>
          </Col>

          <Col span={24}>
            <FormItem
              label="Yuqori Turuvchi Fakultet / Boshqarma / Rektorat (Ixtiyoriy)"
              field="parentId"
            >
              <Select
                placeholder="Agar quyi bo‘lim yoki kafedra bo‘lsa, tegishli yuqori organni tanlang"
                allowClear
                style={{ borderRadius: 0 }}
              >
                {allDepartments
                  .filter((d) => d.type !== 'CHAIR' && d.type !== 'LAB')
                  .map((d) => (
                    <Select.Option key={d.id} value={d.id}>
                      {d.name} ({d.type})
                    </Select.Option>
                  ))}
              </Select>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
