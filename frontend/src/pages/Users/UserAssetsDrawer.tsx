import React from 'react';
import {
  Drawer,
  Typography,
  Descriptions,
  Tag,
  Table,
  Spin,
  Empty,
  Divider,
  Space,
  Card,
  Grid,
} from '@arco-design/web-react';
import {
  IconUser,
  IconHome,
  IconApps,
} from '@arco-design/web-react/icon';
import { useUserAssetsQuery, type UserItem } from '../../hooks/useUsersQuery';
import { RoleType } from '../../types';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

interface UserAssetsDrawerProps {
  visible: boolean;
  user: UserItem | null;
  onClose: () => void;
}

const roleTagColors: Record<RoleType, string> = {
  [RoleType.SUPER_ADMIN]: 'red',
  [RoleType.HEAD_WAREHOUSE]: 'blue',
  [RoleType.MOL]: 'gold',
  [RoleType.AUDITOR]: 'purple',
  [RoleType.EMPLOYEE]: 'gray',
};

const roleLabels: Record<RoleType, string> = {
  [RoleType.SUPER_ADMIN]: 'Super Admin',
  [RoleType.HEAD_WAREHOUSE]: 'Bosh Omborchi',
  [RoleType.MOL]: 'MOL (Moddiy Javobgar)',
  [RoleType.AUDITOR]: 'Auditor',
  [RoleType.EMPLOYEE]: 'Xodim',
};

const statusColors: Record<string, string> = {
  IN_STOCK: 'cyan',
  IN_USE: 'green',
  UNDER_REPAIR: 'orange',
  WRITTEN_OFF: 'red',
  TRANSFERRED: 'purple',
};

const formatUZS = (val?: number | null) => {
  if (val === undefined || val === null) return '—';
  return new Intl.NumberFormat('uz-UZ').format(val) + ' so‘m';
};

export const UserAssetsDrawer: React.FC<UserAssetsDrawerProps> = ({
  visible,
  user,
  onClose,
}) => {
  const { data, isLoading } = useUserAssetsQuery(user?.id || null);

  const assetColumns = [
    {
      title: 'Inventar № / Seriya',
      dataIndex: 'inventoryNumber',
      key: 'inventoryNumber',
      render: (val: string, record: any) => (
        <div>
          <Text bold style={{ fontFamily: 'monospace' }}>{val || '—'}</Text>
          {record.serialNumber && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              SN: {record.serialNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ashyo & Model',
      dataIndex: 'item',
      key: 'item',
      render: (_: any, record: any) => (
        <div>
          <Text bold>{record.item?.name || 'Noma’lum ashyo'}</Text>
          {record.item?.model && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              {record.item.model}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Xona',
      dataIndex: 'room',
      key: 'room',
      render: (_: any, record: any) => (
        <span>
          {record.room
            ? `${record.room.number}-xona (${record.room.building || 'Bino'})`
            : '—'}
        </span>
      ),
    },
    {
      title: 'Qiymati',
      dataIndex: 'price',
      key: 'price',
      render: (val: number) => <span>{formatUZS(val)}</span>,
    },
    {
      title: 'Holati',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status] || 'gray'} size="small" style={{ borderRadius: 0 }}>
          {status}
        </Tag>
      ),
    },
  ];

  return (
    <Drawer
      width={720}
      title={
        <Space>
          <IconUser />
          <span>MOL Mas’ullik Pasporti: {user?.fullName}</span>
        </Space>
      }
      visible={visible}
      onOk={onClose}
      onCancel={onClose}
      cancelButtonProps={{ style: { display: 'none' } }}
      okText="Yopish"
      style={{ borderRadius: 0 }}
    >
      {user && (
        <div style={{ marginBottom: 24 }}>
          <Descriptions
            column={2}
            border
            size="small"
            data={[
              { label: 'F.I.Sh.', value: user.fullName },
              { label: 'Login', value: <Text code>{user.username}</Text> },
              {
                label: 'Rol',
                value: (
                  <Tag color={roleTagColors[user.role]} size="small" style={{ borderRadius: 0 }}>
                    {roleLabels[user.role]}
                  </Tag>
                ),
              },
              { label: 'Bo‘lim / Kafedra', value: user.department?.name || '—' },
              { label: 'Lavozim', value: user.position || '—' },
              { label: 'Telefon', value: user.phone || '—' },
              { label: 'Email', value: user.email || '—' },
              {
                label: 'Holati',
                value: (
                  <Tag color={user.isActive ? 'green' : 'red'} size="small" style={{ borderRadius: 0 }}>
                    {user.isActive ? 'FAOL' : 'NOFAOL'}
                  </Tag>
                ),
              },
            ]}
          />
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="Mas’ul ashyolar va xonalar yuklanmoqda..." />
        </div>
      ) : (
        <>
          <Divider orientation="left" style={{ margin: '16px 0 12px 0' }}>
            <Space>
              <IconHome />
              <Text bold>Javobgar Xonalar ({data?.responsibleRooms?.length || 0})</Text>
            </Space>
          </Divider>

          {data?.responsibleRooms && data.responsibleRooms.length > 0 ? (
            <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
              {data.responsibleRooms.map((r: any) => (
                <Col span={12} key={r.id}>
                  <Card
                    size="small"
                    bordered
                    style={{ borderRadius: 0 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text bold style={{ fontSize: 14 }}>
                        {r.number}-xona: {r.name}
                      </Text>
                      <Tag color="arcoblue" size="small" style={{ borderRadius: 0 }}>
                        {r._count?.itemInstances || 0} ta ashyo
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                      {r.building || 'Asosiy bino'}
                      {r.floor ? `, ${r.floor}-qavat` : ''}
                      {r.department?.name ? ` • ${r.department.name}` : ''}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ padding: '12px 0', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
              Ushbu xodimga to‘g‘ridan-to‘g‘ri biriktirilgan xona mavjud emas.
            </div>
          )}

          <Divider orientation="left" style={{ margin: '20px 0 12px 0' }}>
            <Space>
              <IconApps />
              <Text bold>
                Biriktirilgan Asosiy Vositalar (MOL Balansi: {data?.totalAssetsCount || 0} ta)
              </Text>
            </Space>
          </Divider>

          {data?.responsibleAssets && data.responsibleAssets.length > 0 ? (
            <Card
              bordered
              style={{ borderRadius: 0 }}
              bodyStyle={{ padding: 0 }}
            >
              <Table
                rowKey="id"
                columns={assetColumns}
                data={data.responsibleAssets}
                pagination={false}
                size="small"
              />
            </Card>
          ) : (
            <Empty
              description="Ushbu xodim balansida hozircha asosiy vositalar mavjud emas"
              style={{ padding: '24px 0' }}
            />
          )}
        </>
      )}
    </Drawer>
  );
};
