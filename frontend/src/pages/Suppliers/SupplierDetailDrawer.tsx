import React, { useState } from 'react';
import {
  Drawer,
  Spin,
  Descriptions,
  Tag,
  Tabs,
  Table,
  Button,
  Space,
  Empty,
  Badge,
} from '@arco-design/web-react';
import {
  IconFile,
  IconPlus,
  IconDesktop,
  IconStorage,
  IconPhone,
  IconEmail,
  IconUser,
  IconIdcard,
} from '@arco-design/web-react/icon';
import { useSupplierDetailQuery, SupplierItem } from '../../hooks/useSuppliersQuery';

const TabPane = Tabs.TabPane;

interface SupplierDetailDrawerProps {
  visible: boolean;
  onClose: () => void;
  supplierId: string | null;
  onOpenCreateInvoice: (supplier: SupplierItem) => void;
}

export const SupplierDetailDrawer: React.FC<SupplierDetailDrawerProps> = ({
  visible,
  onClose,
  supplierId,
  onOpenCreateInvoice,
}) => {
  const { data: supplier, isLoading } = useSupplierDetailQuery(supplierId);
  const [activeTab, setActiveTab] = useState('invoices');

  const formatPrice = (val?: number | string | null) => {
    if (!val) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `${num.toLocaleString('uz-UZ')} so‘m`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return dateStr.split('T')[0];
  };

  return (
    <Drawer
      width={740}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconIdcard style={{ color: '#165DFF', fontSize: 18 }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>
            {supplier?.name || 'Ta’minotchi Pasporti'}
          </span>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      footer={null}
      style={{ borderRadius: 0 }}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size={32} tip="Ta’minotchi ma’lumotlari yuklanmoqda..." />
        </div>
      ) : !supplier ? (
        <Empty description="Ta’minotchi topilmadi" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Info Card */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--color-fill-2)',
              borderLeft: '4px solid #165DFF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, color: 'var(--color-text-1)' }}>
                  {supplier.name}
                </h3>
                <Space size="medium" wrap>
                  <span style={{ fontSize: 13 }}>
                    STIR: <b style={{ color: '#165DFF' }}>{supplier.inn || '—'}</b>
                  </span>
                  <span style={{ fontSize: 13 }}>
                    Shartnoma: <b>{supplier.contractNumber || '—'}</b>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                    Sana: {formatDate(supplier.contractDate)}
                  </span>
                </Space>
              </div>

              <Button
                type="primary"
                icon={<IconPlus />}
                onClick={() => onOpenCreateInvoice(supplier)}
                style={{ borderRadius: 0 }}
              >
                Yangi Faktura Biriktirish
              </Button>
            </div>
          </div>

          {/* Details Grid */}
          <Descriptions
            column={2}
            border
            size="small"
            data={[
              {
                label: (
                  <Space size="mini">
                    <IconUser /> Mas’ul vakil
                  </Space>
                ),
                value: supplier.contactPerson || 'Belgilanmagan',
              },
              {
                label: (
                  <Space size="mini">
                    <IconPhone /> Telefon
                  </Space>
                ),
                value: supplier.phone || '—',
              },
              {
                label: (
                  <Space size="mini">
                    <IconEmail /> Elektron pochta
                  </Space>
                ),
                value: supplier.email || '—',
              },
              {
                label: 'Keltirilgan ashyolar',
                value: (
                  <Badge
                    count={supplier.itemInstances?.length || 0}
                    style={{ backgroundColor: '#00B42A' }}
                  />
                ),
              },
              {
                label: 'Izoh / Shartlar',
                value: supplier.notes || 'Izoh kiritilmagan',
                span: 2,
              },
            ]}
          />

          {/* Content Tabs */}
          <Tabs activeTab={activeTab} onChange={setActiveTab} type="line">
            <TabPane
              key="invoices"
              title={
                <span>
                  <IconFile style={{ marginRight: 6 }} />
                  Hisob-fakturalar ({supplier.invoices?.length || 0})
                </span>
              }
            >
              <Table
                rowKey="id"
                data={supplier.invoices || []}
                pagination={false}
                size="small"
                noDataElement={<Empty description="Biriktirilgan hisob-fakturalar mavjud emas" />}
                columns={[
                  {
                    title: 'Faktura №',
                    dataIndex: 'invoiceNumber',
                    render: (num: string) => <b style={{ color: '#165DFF' }}>{num}</b>,
                  },
                  {
                    title: 'Sana',
                    dataIndex: 'invoiceDate',
                    render: (date: string) => formatDate(date),
                  },
                  {
                    title: 'Summa',
                    dataIndex: 'totalAmount',
                    render: (amount: any) => (
                      <span style={{ fontWeight: 600 }}>{formatPrice(amount)}</span>
                    ),
                  },
                  {
                    title: 'Ashyolar soni',
                    render: (_, r: any) => (
                      <Tag color="arcoblue">{r._count?.instances || 0} ta</Tag>
                    ),
                  },
                  {
                    title: 'Izoh',
                    dataIndex: 'notes',
                    render: (txt: string) => txt || '—',
                  },
                ]}
              />
            </TabPane>

            <TabPane
              key="assets"
              title={
                <span>
                  <IconDesktop style={{ marginRight: 6 }} />
                  Yetkazilgan Ashyolar ({supplier.itemInstances?.length || 0})
                </span>
              }
            >
              <Table
                rowKey="id"
                data={supplier.itemInstances || []}
                pagination={{ pageSize: 5, sizeCanChange: false }}
                size="small"
                noDataElement={<Empty description="Hali birorta asosiy vosita kirim qilinmagan" />}
                columns={[
                  {
                    title: 'Inventar №',
                    dataIndex: 'inventoryNumber',
                    render: (inv: string) => <b style={{ color: '#165DFF' }}>{inv}</b>,
                  },
                  {
                    title: 'Nomi & Model',
                    render: (_, r: any) => (
                      <div>
                        <div style={{ fontWeight: 500 }}>{r.item?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          {r.item?.model || 'Model ko‘rsatilmagan'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Joriy Xona',
                    render: (_, r: any) =>
                      r.room ? `${r.room.number}-xona (${r.room.name})` : 'Omborda',
                  },
                  {
                    title: 'Qiymati',
                    dataIndex: 'purchasePrice',
                    render: (p: any) => formatPrice(p),
                  },
                  {
                    title: 'Holati',
                    dataIndex: 'status',
                    render: (st: string) => {
                      if (st === 'NEW') return <Tag color="green">Yangi</Tag>;
                      if (st === 'IN_USE') return <Tag color="blue">Foydalanishda</Tag>;
                      if (st === 'IN_REPAIR') return <Tag color="orange">Ta’mirda</Tag>;
                      return <Tag>{st}</Tag>;
                    },
                  },
                ]}
              />
            </TabPane>

            <TabPane
              key="movements"
              title={
                <span>
                  <IconStorage style={{ marginRight: 6 }} />
                  Ombor Kirimlari ({supplier.movements?.length || 0})
                </span>
              }
            >
              <Table
                rowKey="id"
                data={supplier.movements || []}
                pagination={{ pageSize: 5, sizeCanChange: false }}
                size="small"
                noDataElement={<Empty description="Ombor kirim harakatlari mavjud emas" />}
                columns={[
                  {
                    title: 'Harakat №',
                    dataIndex: 'movementNumber',
                    render: (num: string) => <b style={{ color: '#165DFF' }}>{num}</b>,
                  },
                  {
                    title: 'Turi',
                    dataIndex: 'movementType',
                    render: (type: string) => <Tag color="blue">{type}</Tag>,
                  },
                  {
                    title: 'Ombor',
                    render: (_, r: any) => r.toWarehouse?.name || 'Markaziy ombor',
                  },
                  {
                    title: 'Sana',
                    dataIndex: 'createdAt',
                    render: (d: string) => formatDate(d),
                  },
                ]}
              />
            </TabPane>
          </Tabs>
        </div>
      )}
    </Drawer>
  );
};
