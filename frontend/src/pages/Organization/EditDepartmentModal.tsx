import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Grid,
} from '@arco-design/web-react';
import {
  useUpdateDepartmentMutation,
  useOrganizationQuery,
  type DepartmentItem,
  type UpdateDepartmentData,
} from '../../hooks/useOrganizationQuery';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface EditDepartmentModalProps {
  visible: boolean;
  department: DepartmentItem | null;
  onClose: () => void;
}

export const EditDepartmentModal: React.FC<EditDepartmentModalProps> = ({
  visible,
  department,
  onClose,
}) => {
  const [form] = Form.useForm();
  const updateMutation = useUpdateDepartmentMutation();
  const { allDepartments, buildings } = useOrganizationQuery();
  const [deptType, setDeptType] = useState<string>('CHAIR');

  useEffect(() => {
    if (visible && department) {
      setDeptType(department.type || 'CHAIR');
      form.setFieldsValue({
        name: department.name,
        code: department.code || '',
        type: department.type || 'CHAIR',
        buildingId: department.buildingId || undefined,
        parentId: department.parentId || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [visible, department, form]);

  const handleSubmit = async () => {
    if (!department) return;
    try {
      const values = await form.validate();
      const updateData: UpdateDepartmentData = {
        name: values.name.trim(),
        code: values.code ? values.code.trim().toUpperCase() : undefined,
        type: values.type,
        buildingId: values.buildingId || null,
        parentId: values.parentId || null,
      };

      await updateMutation.mutateAsync({
        id: department.id,
        data: updateData,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  const isChairOrLab = deptType === 'CHAIR' || deptType === 'LAB';
  const isFaculty = deptType === 'FACULTY';
  const facultyOptions = allDepartments.filter((d) => d.id !== department?.id && d.type === 'FACULTY');

  return (
    <Modal
      title="Bo‘lim / Kafedra Ma’lumotlarini Tahrirlash"
      visible={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={updateMutation.isPending}
      okText="Saqlash"
      cancelText="Bekor qilish"
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={24}>
            <FormItem
              label="Tuzilma Turi"
              field="type"
              rules={[{ required: true, message: 'Turi tanlanishi shart!' }]}
            >
              <Select
                placeholder="Turini tanlang"
                style={{ borderRadius: 0 }}
                onChange={(val) => {
                  setDeptType(val);
                  if (val === 'FACULTY') {
                    form.setFieldValue('parentId', undefined);
                  }
                }}
              >
                <Select.Option value="CHAIR">Kafedra</Select.Option>
                <Select.Option value="FACULTY">Fakultet</Select.Option>
                <Select.Option value="DEPARTMENT">Bo‘lim va Xizmatlar (Buxgalteriya, Kadrlar, Xo‘jalik...)</Select.Option>
                <Select.Option value="DIVISION">Boshqarma va Markazlar (ATM, O‘quv boshqarmasi...)</Select.Option>
                <Select.Option value="LAB">Laboratoriya va Ilmiy Markaz</Select.Option>
                <Select.Option value="RECTORATE">Rektorat va Rahbariyat</Select.Option>
                <Select.Option value="LIBRARY">Kutubxona / ARM</Select.Option>
              </Select>
            </FormItem>
          </Col>

          <Col span={isChairOrLab ? 12 : 24}>
            <FormItem
              label="Joylashgan Bino / Korpus"
              field="buildingId"
              rules={isChairOrLab ? [{ required: true, message: 'Binoni tanlash shart!' }] : []}
            >
              <Select
                placeholder="Mavjud binoni tanlang"
                allowClear
                showSearch
                filterOption={(inputValue, option) => {
                  const text = String(option?.props?.children || '');
                  return text.toLowerCase().includes(inputValue.toLowerCase());
                }}
                style={{ borderRadius: 0 }}
              >
                {buildings.map((b) => (
                  <Select.Option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''} — {b.floorsCount} qavat
                  </Select.Option>
                ))}
              </Select>
            </FormItem>
          </Col>

          {isChairOrLab && (
            <Col span={12}>
              <FormItem
                label="Tegishli Fakultet"
                field="parentId"
                rules={[{ required: true, message: 'Kafedra tegishli bo‘lgan fakultetni tanlang!' }]}
              >
                <Select
                  placeholder="Fakultetni tanlang"
                  allowClear
                  showSearch
                  filterOption={(inputValue, option) => {
                    const text = String(option?.props?.children || '');
                    return text.toLowerCase().includes(inputValue.toLowerCase());
                  }}
                  style={{ borderRadius: 0 }}
                >
                  {facultyOptions.map((fac) => (
                    <Select.Option key={fac.id} value={fac.id}>
                      {fac.name} {fac.building?.name ? `(${fac.building.name})` : ''}
                    </Select.Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          )}

          {!isChairOrLab && !isFaculty && (
            <Col span={24}>
              <FormItem
                label="Yuqori Turuvchi Fakultet / Boshqarma / Rektorat"
                field="parentId"
              >
                <Select
                  placeholder="Yuqori bo‘limni tanlang (yoki bo‘sh qoldiring)"
                  allowClear
                  showSearch
                  filterOption={(inputValue, option) => {
                    const text = String(option?.props?.children || '');
                    return text.toLowerCase().includes(inputValue.toLowerCase());
                  }}
                  style={{ borderRadius: 0 }}
                >
                  {allDepartments
                    .filter((d) => d.id !== department?.id && d.type !== 'CHAIR' && d.type !== 'LAB')
                    .map((d) => (
                      <Select.Option key={d.id} value={d.id}>
                        {d.name} ({d.type})
                      </Select.Option>
                    ))}
                </Select>
              </FormItem>
            </Col>
          )}

          <Col span={16}>
            <FormItem
              label={
                isChairOrLab
                  ? 'Kafedra Nomi'
                  : isFaculty
                  ? 'Fakultet Nomi'
                  : 'Bo‘lim / Markaz Nomi'
              }
              field="name"
              rules={[{ required: true, message: 'Nomi kiritilishi shart!' }]}
            >
              <Input
                placeholder="Bo‘lim nomini kiriting"
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={8}>
            <FormItem
              label="Qisqa Kodi"
              field="code"
              rules={[
                {
                  match: /^[A-Z0-9_-]+$/,
                  message: 'Katta lotin harflari va raqamlar',
                },
              ]}
            >
              <Input placeholder="Masalan: DI-KAF" style={{ borderRadius: 0 }} />
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
