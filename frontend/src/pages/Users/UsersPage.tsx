import React, { useState, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Typography,
  Grid,
  Popconfirm,
  Result,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconLock,
  IconUserGroup,
  IconCheckCircle,
  IconSafe,
  IconApps,
  IconUser,
  IconDownload,
} from '@arco-design/web-react/icon';
import { StandardTable } from '../../components/Common/StandardTable';
import { useAuthStore } from '../../store/authStore';
import { useOrganizationQuery } from '../../hooks/useOrganizationQuery';
import {
  useUsersQuery,
  useToggleUserStatusMutation,
  type UserItem,
} from '../../hooks/useUsersQuery';
import { RoleType } from '../../types';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { UserAssetsDrawer } from './UserAssetsDrawer';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { PageTabs } from '../../components/Common/PageTabs';
import { TableActions } from '../../components/Common/TableActions';
import { exportToExcel } from '../../utils/exportExcel';

const { Title, Text } = Typography;
const { Row, Col } = Grid;

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

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const { departments } = useOrganizationQuery();

  // Filters & Pagination state
  const [search, setSearch] = useState('');
  const [roleTab, setRoleTab] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [resettingUser, setResettingUser] = useState<UserItem | null>(null);
  const [drawerUser, setDrawerUser] = useState<UserItem | null>(null);

  // Map role tab to query param
  const activeRoleQuery = useMemo(() => {
    if (roleTab === 'MOL') return RoleType.MOL;
    if (roleTab === 'ADMIN') return RoleType.SUPER_ADMIN;
    if (roleTab === 'EMPLOYEE') return RoleType.EMPLOYEE;
    return undefined;
  }, [roleTab]);

  // Queries & Mutations
  const { data, isLoading, isError, refetch } = useUsersQuery({
    search: search.trim() || undefined,
    role: activeRoleQuery,
    departmentId: deptFilter !== 'ALL' ? deptFilter : undefined,
    isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
    page,
    pageSize,
  });

  const toggleStatusMutation = useToggleUserStatusMutation();

  // Summary statistics calculation
  const totalUsers = data?.total || 0;
  const activeUsers = data?.items.filter((u) => u.isActive).length || 0;
  const molCount = data?.items.filter((u) => u.role === RoleType.MOL).length || 0;
  const adminCount =
    data?.items.filter((u) => u.role === RoleType.SUPER_ADMIN || u.role === RoleType.HEAD_WAREHOUSE)
      .length || 0;

  // Permission Check: Only SUPER_ADMIN has full control
  if (currentUser?.role !== RoleType.SUPER_ADMIN) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Result
          status="403"
          title="Ruxsat Cheklangan"
          subTitle="Xodimlar va rollarni boshqarish reestri faqat Tizim Super Admini (Rektorat/AKT) uchun ochiq."
          style={{ borderRadius: 0 }}
        />
      </div>
    );
  }

  const handleToggleStatus = (u: UserItem) => {
    toggleStatusMutation.mutate({
      id: u.id,
      isActive: !u.isActive,
    });
  };

  const handleExportUsersExcel = () => {
    const exportData = (data?.items || []).map((u) => ({
      'F.I.Sh.': u.fullName,
      'Login (Username)': u.username,
      'Roli': roleLabels[u.role] || u.role,
      'Bo‘lim / Kafedra': u.department?.name || '-',
      'Lavozim': u.position || '-',
      'Telefon': u.phone || '-',
      'Email': u.email || '-',
      'Holati': u.isActive ? 'FAOL' : 'NOFAOL',
      'Biriktirilgan Ashyolar': u._count?.responsibleInstances || 0,
      'Javobgar Xonalar': u._count?.responsibleRooms || 0,
    }));
    exportToExcel(exportData, 'Foydalanuvchilar_va_Xodimlar_Reestri');
  };

  const columns = [
    {
      title: 'F.I.Sh. & Login',
      dataIndex: 'fullName',
      key: 'fullName',
      minWidth: 220,
      render: (_: any, record: UserItem) => (
        <div style={{ paddingLeft: 8 }}>
          <CategoryThumbnail
            icon={<IconUser />}
            name={record.fullName}
            subtitle={`Login: ${record.username}${record.position ? ` | ${record.position}` : ''}`}
            tag={record.department?.name || undefined}
            color="#165DFF"
            bg="#E8F3FF"
          />
        </div>
      ),
    },
    {
      title: 'Tizim Roli',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: RoleType) => (
        <Tag color={roleTagColors[role]} size="small" style={{ borderRadius: 0, fontWeight: 500 }}>
          {roleLabels[role] || role}
        </Tag>
      ),
    },
    {
      title: 'Aloqa',
      key: 'contact',
      width: 160,
      render: (_: any, record: UserItem) => (
        <div style={{ fontSize: 13 }}>
          <div>{record.phone || '—'}</div>
          {record.email && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              {record.email}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Mas’ul Asosiy Vositalar',
      key: 'assets',
      width: 175,
      render: (_: any, record: UserItem) => {
        const assetCount = record._count?.responsibleInstances || 0;
        const roomCount = record._count?.responsibleRooms || 0;

        return (
          <Button
            size="mini"
            type="outline"
            icon={<IconApps />}
            style={{ borderRadius: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setDrawerUser(record);
            }}
          >
            {assetCount} ta ashyo / {roomCount} xona
          </Button>
        );
      },
    },
    {
      title: 'Holati',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 105,
      render: (isActive: boolean, record: UserItem) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title="Foydalanuvchi holatini o‘zgartirish"
            content={`Rostdan ham '${record.fullName}' foydalanuvchisini ${
              isActive ? 'faolsizlantirmoqchimisiz' : 'faollashtirmoqchimisiz'
            }?`}
            okText="Ha, o‘zgartirish"
            cancelText="Yo‘q"
            onOk={() => handleToggleStatus(record)}
            disabled={record.id === currentUser?.id}
          >
            <Tooltip content={record.id === currentUser?.id ? 'O‘z hisobingizni o‘zgartira olmaysiz' : 'Holatni almashtirish uchun bosing'}>
              <Tag
                color={isActive ? 'green' : 'red'}
                size="small"
                style={{
                  borderRadius: 0,
                  cursor: record.id === currentUser?.id ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {isActive ? 'FAOL' : 'NOFAOL'}
              </Tag>
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 88,
      fixed: 'right' as const,
      render: (_: any, record: UserItem) => (
        <div onClick={(e) => e.stopPropagation()}>
          <TableActions rightPadding={0} gap={6}>
            <Tooltip content="Ma’lumotlarni tahrirlash">
              <Button
                size="small"
                type="secondary"
                icon={<IconEdit />}
                style={{ borderRadius: 0 }}
                onClick={() => setEditingUser(record)}
              />
            </Tooltip>

            <Tooltip content="Parolni yangilash">
              <Button
                size="small"
                type="secondary"
                icon={<IconLock />}
                style={{ borderRadius: 0 }}
                onClick={() => setResettingUser(record)}
              />
            </Tooltip>
          </TableActions>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page Tabs */}
      <PageTabs
        activeTab={roleTab}
        onChange={setRoleTab}
        tabs={[
          { key: 'ALL', title: 'Barcha Xodimlar', count: totalUsers },
          { key: 'MOL', title: 'Moddiy Javobgarlar (MOL)', count: molCount },
          { key: 'ADMIN', title: 'Administratorlar', count: adminCount },
          { key: 'EMPLOYEE', title: 'Oddiy Xodimlar' },
        ]}
      />

      {/* Actions Toolbar */}
      <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space size="medium" wrap>
            <Input
              prefix={<IconSearch />}
              placeholder="F.I.Sh., login yoki lavozim..."
              style={{ width: 260, borderRadius: 0 }}
              value={search}
              onChange={setSearch}
              allowClear
            />

            <Select
              placeholder="Kafedra / Bo‘lim"
              style={{ width: 220, borderRadius: 0 }}
              value={deptFilter}
              onChange={setDeptFilter}
              allowClear
            >
              <Select.Option value="ALL">Barcha Kafedralar</Select.Option>
              {departments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>

            <Select
              style={{ width: 150, borderRadius: 0 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="ALL">Barcha status</Select.Option>
              <Select.Option value="ACTIVE">Faol</Select.Option>
              <Select.Option value="INACTIVE">Nofaol</Select.Option>
            </Select>
          </Space>

          <Space size="medium" wrap>
            <Button
              icon={<IconRefresh />}
              style={{ borderRadius: 0 }}
              onClick={() => refetch()}
              loading={isLoading}
            >
              Yangilash
            </Button>

            <Button
              icon={<IconDownload />}
              style={{ borderRadius: 0 }}
              onClick={handleExportUsersExcel}
            >
              Excel
            </Button>

            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0, backgroundColor: '#165DFF' }}
              onClick={() => setIsCreateOpen(true)}
            >
              Yangi Xodim Qo‘shish
            </Button>
          </Space>
        </div>
      </Card>

      {/* Users Table */}
      <StandardTable<UserItem>
        rowKey="id"
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        scrollX={950}
        onRowClick={(record) => setDrawerUser(record)}
        emptyText={
          search || deptFilter !== 'ALL' || statusFilter !== 'ALL'
            ? 'Tanlangan parametrlar bo‘yicha xodimlar topilmadi'
            : 'Foydalanuvchilar ro‘yxati bo‘sh'
        }
        pagination={{
          current: page,
          pageSize,
          total: totalUsers,
          onChange: (p, s) => {
            setPage(p);
            if (s) setPageSize(s);
          },
        }}
      />

      {/* MODALS */}
      <CreateUserModal
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <EditUserModal
        visible={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
      />

      <ResetPasswordModal
        visible={!!resettingUser}
        user={resettingUser}
        onClose={() => setResettingUser(null)}
      />

      <UserAssetsDrawer
        visible={!!drawerUser}
        user={drawerUser}
        onClose={() => setDrawerUser(null)}
      />
    </div>
  );
};
