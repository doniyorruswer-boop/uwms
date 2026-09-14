import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Message,
  Badge,
  Steps,
  Tabs,
  Descriptions,
  Grid,
  Alert,
  Empty,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconCheck,
  IconClose,
  IconCheckCircle,
  IconEye,
  IconDownload,
  IconFile,
  IconArchive,
  IconSearch,
  IconRefresh,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { useRequestsQuery } from '../../hooks/useRequestsQuery';
import { useWarehouseQuery } from '../../hooks/useWarehouseQuery';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { useAuthStore } from '../../store/authStore';
import type { RequestRecord, RequestStatus } from '../../types';
import { exportToExcel } from '../../utils/exportExcel';
import { OfficialDocModal } from '../../components/OfficialDocument/OfficialDocModal';
import { TableActions } from '../../components/Common/TableActions';

const FormItem = Form.Item;
const Step = Steps.Step;
const TabPane = Tabs.TabPane;
const { Row, Col } = Grid;

export const RequestsPage: React.FC = () => {
  const { requests, isLoading, isFetching, isError, refetch, createRequest, updateRequestStatus } = useRequestsQuery();
  const { stocks } = useWarehouseQuery();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isNewModalVisible, setIsNewModalVisible] = useState(false);
  const [selectedDocRequest, setSelectedDocRequest] = useState<RequestRecord | null>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<any | null>(null);
  const [form] = Form.useForm();

  const getStepCurrent = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return 1;
      case 'APPROVED_BY_HEAD':
        return 2;
      case 'APPROVED_BY_WAREHOUSE':
        return 3;
      case 'FULFILLED':
        return 4;
      case 'REJECTED':
        return 1;
      default:
        return 1;
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter(
    (r) => r.status === 'APPROVED_BY_HEAD' || r.status === 'APPROVED_BY_WAREHOUSE',
  ).length;
  const fulfilledCount = requests.filter((r) => r.status === 'FULFILLED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = requests.filter((r) => {
    const matchesTab =
      activeTab === 'ALL' ||
      (activeTab === 'PENDING' && r.status === 'PENDING') ||
      (activeTab === 'APPROVED' &&
        (r.status === 'APPROVED_BY_HEAD' || r.status === 'APPROVED_BY_WAREHOUSE')) ||
      (activeTab === 'FULFILLED' && r.status === 'FULFILLED') ||
      (activeTab === 'REJECTED' && r.status === 'REJECTED');

    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      !searchText ||
      r.requestNumber.toLowerCase().includes(searchLower) ||
      r.requesterName.toLowerCase().includes(searchLower) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(searchLower)) ||
      r.purpose.toLowerCase().includes(searchLower) ||
      r.items.some((i) => i.itemName.toLowerCase().includes(searchLower));

    return matchesTab && matchesSearch;
  });

  const handleApproveByHead = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    updateRequestStatus({
      id: req.id,
      status: 'APPROVED_BY_HEAD',
      note: 'Kafedra mudiri tomonidan tasdiqlandi',
    });
  };

  const handleFulfillByWarehouse = async (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    try {
      await updateRequestStatus({
        id: req.id,
        status: 'FULFILLED',
        note: 'Ombordan mahsulotlar berildi va hisobdan yechildi',
      });
      setSelectedDocRequest(req);
      setIsDocModalVisible(true);
    } catch {
      // Error handled by mutation
    }
  };

  const handleOpenNakladnoy = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    setSelectedDocRequest(req);
    setIsDocModalVisible(true);
  };

  const handleReject = (req: RequestRecord, e?: any) => {
    e?.stopPropagation?.();
    updateRequestStatus({
      id: req.id,
      status: 'REJECTED',
      note: 'Zaxira yetarli emasligi yoki asossizligi sababli rad etildi',
    });
  };

  const handleOpenDetail = (req: RequestRecord) => {
    setSelectedRequest(req);
    setIsDetailModalVisible(true);
  };

  const handleNewRequestSubmit = () => {
    form.validate().then(async (values) => {
      const matchedStock = stocks.find(
        (s) => s.itemId === values.itemId || s.itemName.toLowerCase() === values.itemName?.toLowerCase(),
      );

      await createRequest({
        purpose: values.purpose,
        items: [
          {
            itemId: matchedStock?.itemId,
            itemName: matchedStock ? matchedStock.itemName : values.itemName,
            quantity: Number(values.quantity),
            unit: values.unit || matchedStock?.unit || 'DONA',
          },
        ],
      });
      setIsNewModalVisible(false);
      form.resetFields();
      setSelectedCatalogItem(null);
    });
  };

  const handleExportExcel = () => {
    const formatted = requests.map((r) => ({
      'Zayavka Raqami': r.requestNumber,
      'Talabgor': r.requesterName,
      'Bo‘lim / Kafedra': r.departmentName || '',
      'Maqsad': r.purpose,
      'Mahsulotlar': r.items.map((i) => `${i.itemName} (${i.requestedQty} ${i.unit})`).join('; '),
      'Holati': r.status,
      'Izoh': r.approvalNote || '',
      'Sana': r.createdAt,
    }));
    exportToExcel(formatted, 'Talabnomalar_Reestri', 'Talabnomalar');
    Message.success('Talabnomalar hisoboti Excelga yuklandi!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs Filter */}
      <PageTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'ALL', title: 'Barcha Zayavkalar', count: requests.length },
          { key: 'PENDING', title: 'Tasdiq Kutilmoqda', count: pendingCount },
          { key: 'APPROVED', title: 'Omborda Tarqatish', count: approvedCount },
          { key: 'FULFILLED', title: 'Bajarilgan (Yopilgan)', count: fulfilledCount },
          { key: 'REJECTED', title: 'Rad Etilganlar', count: rejectedCount },
        ]}
      />

      {/* Actions Toolbar */}
      <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space size="medium" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="Zayavka raqami, talabgor, bo‘lim yoki mahsulot bo‘yicha qidirish..."
              style={{ width: 380, borderRadius: 0 }}
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconRefresh />}
              onClick={() => refetch()}
              style={{ borderRadius: 0 }}
            >
              Yangilash
            </Button>
            <Button icon={<IconDownload />} onClick={handleExportExcel} style={{ borderRadius: 0 }}>
              Excelga Yuklash
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => {
                form.setFieldsValue({ unit: 'PACHKA', quantity: 5 });
                setIsNewModalVisible(true);
              }}
            >
              Yangi Zayavka Yaratish
            </Button>
          </Space>
        </div>
      </Card>

      {/* Requests Table */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={isLoading || isFetching}
          data={filteredRequests}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            sizeCanChange: true,
            sizeOptions: [10, 20, 50, 100],
            showTotal: (total, range) => {
              if (!total || total === 0) return '0/0';
              const to = range ? Math.min(range[1], total) : total;
              return `${to}/${total}`;
            },
          }}
          onRow={(record) => ({
            onClick: () => handleOpenDetail(record),
            style: { cursor: 'pointer' },
          })}
          noDataElement={
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Empty description={searchText ? 'Qidiruv bo‘yicha talabnoma topilmadi' : 'Talabnomalar mavjud emas'} />
            </div>
          }
          columns={[
            {
              title: 'Talabgor & Zayavka №',
              dataIndex: 'requesterName',
              width: 220,
              render: (name: string, record: RequestRecord) => (
                <div style={{ paddingLeft: 8 }}>
                  <CategoryThumbnail
                    icon={<IconUserGroup />}
                    name={name}
                    subtitle={record.departmentName || undefined}
                    tag={record.requestNumber}
                    color="#165DFF"
                    bg="#E8F3FF"
                  />
                </div>
              ),
            },
            {
              title: 'So‘ralayotgan Mahsulotlar',
              minWidth: 360,
              render: (_, record: RequestRecord) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                  {record.items.map((i) => (
                    <Tag
                      key={i.id}
                      color="arcoblue"
                      style={{
                        borderRadius: 0,
                        fontSize: 12,
                        lineHeight: 1.4,
                        height: 'auto',
                        padding: '3px 8px',
                        display: 'inline-block',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                      }}
                    >
                      <span>{i.itemName}:</span>
                      <b style={{ fontWeight: 700, marginLeft: 5, whiteSpace: 'nowrap' }}>
                        {i.requestedQty} {i.unit}
                      </b>
                    </Tag>
                  ))}
                </div>
              ),
            },
            {
              title: 'Maqsad',
              dataIndex: 'purpose',
              width: 200,
              render: (purpose: string) => (
                <div style={{ fontSize: 13, color: 'var(--color-text-1)', wordBreak: 'break-word', lineHeight: 1.35 }}>
                  {purpose}
                </div>
              ),
            },
            {
              title: 'Bosqich',
              dataIndex: 'status',
              width: 160,
              render: (status: RequestStatus) => {
                if (status === 'PENDING') return <Badge status="warning" text="Kafedra ko‘rib chiqmoqda" />;
                if (status === 'APPROVED_BY_HEAD') return <Badge status="processing" text="Mudir tasdiqladi (Omborda)" />;
                if (status === 'APPROVED_BY_WAREHOUSE') return <Badge status="processing" text="Ombor tasdiqladi" />;
                if (status === 'FULFILLED') return <Badge status="success" text="Ombordan berildi" />;
                if (status === 'REJECTED') return <Badge status="error" text="Rad etildi" />;
                return <Tag style={{ borderRadius: 0 }}>{status}</Tag>;
              },
            },
            {
              title: 'Amallar',
              width: 270,
              fixed: 'right' as const,
              render: (_, record: RequestRecord) => {
                const canHeadApprove =
                  record.status === 'PENDING' &&
                  (user?.role === 'MOL' || user?.role === 'SUPER_ADMIN');

                const canWarehouseFulfill =
                  record.status === 'APPROVED_BY_HEAD' &&
                  (user?.role === 'HEAD_WAREHOUSE' || user?.role === 'SUPER_ADMIN');

                return (
                  <TableActions rightPadding={16} gap={5}>
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconEye />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(record);
                      }}
                      style={{ borderRadius: 0, padding: '0 8px' }}
                    >
                      Batafsil
                    </Button>
                    {canHeadApprove && (
                      <Button
                        size="small"
                        type="primary"
                        status="success"
                        icon={<IconCheck />}
                        onClick={(e) => handleApproveByHead(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Tasdiqlash
                      </Button>
                    )}
                    {canWarehouseFulfill && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<IconCheckCircle />}
                        onClick={(e) => handleFulfillByWarehouse(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Tarqatish
                      </Button>
                    )}
                    {record.status === 'FULFILLED' && (
                      <Button
                        size="small"
                        type="outline"
                        icon={<IconFile />}
                        onClick={(e) => handleOpenNakladnoy(record, e)}
                        style={{ borderRadius: 0, padding: '0 8px' }}
                      >
                        Nakladnoy (OS-2)
                      </Button>
                    )}
                    {record.status === 'PENDING' && (
                      <Tooltip content="Rad etish">
                        <Button
                          size="small"
                          type="secondary"
                          status="danger"
                          icon={<IconClose />}
                          onClick={(e) => handleReject(record, e)}
                          style={{ borderRadius: 0 }}
                        />
                      </Tooltip>
                    )}
                  </TableActions>
                );
              },
            },
          ]}
        />
      </Card>

      {/* ARCO STEPS: REQUEST DETAIL MODAL */}
      <Modal
        style={{ width: 680 }}
        title={`Talabnoma Holati: ${selectedRequest?.requestNumber}`}
        visible={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={
          <Space>
            {selectedRequest?.status === 'FULFILLED' && (
              <Button
                type="outline"
                icon={<IconFile />}
                onClick={() => {
                  setIsDetailModalVisible(false);
                  handleOpenNakladnoy(selectedRequest);
                }}
              >
                Rasmiy Nakladnoy (OS-2)
              </Button>
            )}
            <Button type="primary" onClick={() => setIsDetailModalVisible(false)}>
              Yopish
            </Button>
          </Space>
        }
      >
        {selectedRequest && (
          <div>
            {/* Step Progress Tracker */}
            <div style={{ marginBottom: 24, padding: '16px 0', background: 'var(--color-fill-1)' }}>
              <Steps
                current={getStepCurrent(selectedRequest.status)}
                status={selectedRequest.status === 'REJECTED' ? 'error' : 'process'}
              >
                <Step title="1. Yuborildi" description={selectedRequest.createdAt} />
                <Step
                  title="2. Kafedra Mudiri"
                  description={
                    selectedRequest.status !== 'PENDING' ? 'Tasdiqlandi' : 'Kutilmoqda'
                  }
                />
                <Step
                  title="3. Ombor Chiqimi"
                  description={
                    selectedRequest.status === 'FULFILLED' ? 'Berildi' : 'Kutilmoqda'
                  }
                />
                <Step title="4. Qabul qilindi" description="Yopildi" />
              </Steps>
            </div>

            {/* Details Table */}
            <Descriptions
              column={1}
              border
              data={[
                { label: 'Talabnoma Raqami', value: selectedRequest.requestNumber },
                { label: 'Talabgor Xodim', value: selectedRequest.requesterName },
                { label: 'Bo‘lim / Kafedra', value: selectedRequest.departmentName || '—' },
                { label: 'Ehtiyoj Asosi / Maqsad', value: selectedRequest.purpose },
                {
                  label: 'So‘ralgan Mahsulotlar',
                  value: (
                    <div>
                      {selectedRequest.items.map((i) => (
                        <div key={i.id} style={{ fontWeight: 600 }}>
                          • {i.itemName}: {i.requestedQty} {i.unit}
                        </div>
                      ))}
                    </div>
                  ),
                },
                { label: 'Tasdiqlovchi Izohi', value: selectedRequest.approvalNote || 'Kiritilmagan' },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* NEW REQUEST MODAL */}
      <Modal
        title="Omborga Yangi Talabnoma (Zayavka) Yuborish"
        visible={isNewModalVisible}
        onOk={handleNewRequestSubmit}
        onCancel={() => {
          setIsNewModalVisible(false);
          setSelectedCatalogItem(null);
        }}
        okText="Zayavka Yuborish"
        cancelText="Bekor qilish"
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="Ombordagi Mahsulotni Tanlang (Katalogdan)"
            field="itemName"
            rules={[{ required: true, message: 'Mahsulotni tanlang yoki nomini kiriting!' }]}
            extra={
              selectedCatalogItem ? (
                <div style={{ fontSize: 12, color: selectedCatalogItem.quantity > 0 ? '#00b42a' : '#f53f3f', marginTop: 4 }}>
                  <IconArchive style={{ marginRight: 4 }} />
                  Omborda joriy qoldiq: <b>{selectedCatalogItem.quantity} {selectedCatalogItem.unit}</b>
                  {selectedCatalogItem.quantity <= 0 && ' (DIQQAT: Omborda bu tovar qolmagan!)'}
                </div>
              ) : 'Mavjud ombor tovarlaridan tanlashingiz yoki yangi nom kiritishingiz mumkin.'
            }
          >
            <Select
              showSearch
              allowCreate
              placeholder="Ombordagi tovarlardan tanlang..."
              onChange={(val) => {
                const item = stocks.find((s) => s.itemName === val || s.itemId === val);
                if (item) {
                  setSelectedCatalogItem(item);
                  form.setFieldsValue({ itemName: item.itemName, itemId: item.itemId, unit: item.unit });
                } else {
                  setSelectedCatalogItem(null);
                  form.setFieldsValue({ itemName: val, itemId: undefined });
                }
              }}
            >
              {stocks.map((s) => (
                <Select.Option key={s.itemId} value={s.itemName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{s.itemName}</span>
                    <Tag size="small" color={s.quantity > 0 ? 'arcoblue' : 'red'}>
                      {s.quantity} {s.unit}
                    </Tag>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </FormItem>

          <FormItem label="O‘lchov birligi" field="unit">
            <Select>
              <Select.Option value="PACHKA">Pachka</Select.Option>
              <Select.Option value="DONA">Dona</Select.Option>
              <Select.Option value="TO_PLAM">To‘plam</Select.Option>
              <Select.Option value="METR">Metr</Select.Option>
              <Select.Option value="KG">Kg</Select.Option>
            </Select>
          </FormItem>

          <FormItem
            label="Kerakli Miqdor"
            field="quantity"
            rules={[{ required: true, message: 'Miqdorni kiriting!' }]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </FormItem>

          <FormItem
            label="Nima maqsadda zarurligi (Ehtiyoj Asosi)"
            field="purpose"
            rules={[{ required: true, message: 'Maqsadni bayon eting!' }]}
          >
            <Input.TextArea placeholder="Masalan: Talabalarning oraliq va yakuniy nazoratlari hamda kafedra o‘quv jarayoni uchun" />
          </FormItem>
        </Form>
      </Modal>

      {/* RASMIY NAKLADNOY OS-2 MODAL */}
      {selectedDocRequest && (
        <OfficialDocModal
          visible={isDocModalVisible}
          onClose={() => setIsDocModalVisible(false)}
          docType="TRANSFER"
          docNumber={selectedDocRequest.requestNumber}
          date={selectedDocRequest.createdAt}
          sourceLocation="Universitet Bosh Ombori"
          targetLocation={selectedDocRequest.departmentName || 'Kafedra'}
          senderName="Toshmatov Omon (Bosh Omborchi)"
          receiverName={selectedDocRequest.requesterName}
          items={selectedDocRequest.items.map((i, idx) => ({
            inventoryNumber: `SRF-${idx + 1}`,
            name: i.itemName,
            quantity: i.requestedQty,
            unit: i.unit,
          }))}
          reason={selectedDocRequest.purpose}
        />
      )}
    </div>
  );
};
