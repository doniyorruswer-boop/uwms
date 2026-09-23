import React, { useState } from 'react';
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
  defaultBuildingId?: string;
  defaultParentId?: string;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  visible,
  onClose,
  defaultBuildingId,
  defaultParentId,
}) => {
  const [form] = Form.useForm();
  const createMutation = useCreateDepartmentMutation();
  const { allDepartments, buildings } = useOrganizationQuery();
  const [deptType, setDeptType] = useState<string>('CHAIR');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(defaultBuildingId);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      await createMutation.mutateAsync({
        name: values.name.trim(),
        code: values.code ? values.code.trim().toUpperCase() : undefined,
        type: values.type || 'CHAIR',
        parentId: values.parentId || undefined,
        buildingId: values.buildingId || undefined,
      });
      form.resetFields();
      onClose();
    } catch {
      // Validation error
    }
  };

  const isChairOrLab = deptType === 'CHAIR' || deptType === 'LAB';
  const isFaculty = deptType === 'FACULTY';

  // Available faculties for Kafedra: if a building is selected, sort or filter faculties
  const facultyOptions = allDepartments.filter((d) => d.type === 'FACULTY');

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
      style={{ width: 620, borderRadius: 0 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: 'CHAIR',
          buildingId: defaultBuildingId,
          parentId: defaultParentId,
        }}
      >
        <Row gutter={16}>
          {/* 1. Bo'lim Turi Har doim birinchi aniqlanadi */}
          <Col span={24}>
            <FormItem
              label="Qo‘shilayotgan Tuzilma Turi"
              field="type"
              rules={[{ required: true, message: 'Tuzilma turi tanlanishi shart!' }]}
            >
              <Select
                placeholder="Tuzilma turini tanlang"
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

          {/* 2. Agar Kafedra bo'lsa: 1-Bino, 2-Fakultet, 3-Kafedra nomi va kodi tartibida */}
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
                onChange={(bId) => {
                  setSelectedBuildingId(bId);
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
                  onChange={(facId) => {
                    if (facId && !selectedBuildingId) {
                      const fac = allDepartments.find((d) => d.id === facId);
                      if (fac?.buildingId) {
                        form.setFieldValue('buildingId', fac.buildingId);
                        setSelectedBuildingId(fac.buildingId);
                      }
                    }
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
                label="Yuqori Turuvchi Boshqarma / Rektorat (Ixtiyoriy)"
                field="parentId"
              >
                <Select
                  placeholder="Agar quyi bo‘lim bo‘lsa, tegishli yuqori organni tanlang"
                  allowClear
                  showSearch
                  filterOption={(inputValue, option) => {
                    const text = String(option?.props?.children || '');
                    return text.toLowerCase().includes(inputValue.toLowerCase());
                  }}
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
          )}

          {/* 3. Nomi va Kodi */}
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
                placeholder={
                  isChairOrLab
                    ? 'Masalan: Dasturiy Injiniring Kafedrasi'
                    : isFaculty
                    ? 'Masalan: Raqamli Iqtisodiyot Fakulteti'
                    : 'Masalan: Buxgalteriya va Moliya Bo‘limi'
                }
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>

          <Col span={8}>
            <FormItem
              label="Qisqa Kodi (Unikal)"
              field="code"
              rules={[
                {
                  match: /^[A-Z0-9_-]+$/,
                  message: 'Katta lotin harflari va raqamlar',
                },
              ]}
            >
              <Input
                placeholder={isChairOrLab ? 'DI-KAF' : isFaculty ? 'RIF' : 'BUX'}
                style={{ borderRadius: 0 }}
              />
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
