import React, { useState, useMemo } from 'react';
import {
  Card,
  Grid,
  Tree,
  Typography,
  Tag,
  Table,
  Space,
  Button,
  Input,
  Select,
  Popconfirm,
  Tooltip,
  Empty,
  Badge,
} from '@arco-design/web-react';
import {
  IconBranch,
  IconHome,
  IconUser,
  IconPlus,
  IconEdit,
  IconDelete,
  IconRefresh,
  IconSearch,
  IconApps,
  IconCheckCircle,
  IconDownload,
} from '@arco-design/web-react/icon';
import {
  useOrganizationQuery,
  useDeleteDepartmentMutation,
  useDeleteRoomMutation,
  type DepartmentItem,
  type RoomItem,
} from '../../hooks/useOrganizationQuery';
import { useAssetsQuery } from '../../hooks/useAssetsQuery';
import { useAuthStore } from '../../store/authStore';
import { PageTabs } from '../../components/Common/PageTabs';
import { CategoryThumbnail } from '../../components/Common/CategoryThumbnail';
import { TableActions } from '../../components/Common/TableActions';
import { CreateDepartmentModal } from './CreateDepartmentModal';
import { EditDepartmentModal } from './EditDepartmentModal';
import { CreateRoomModal } from './CreateRoomModal';
import { EditRoomModal } from './EditRoomModal';
import { exportToExcel } from '../../utils/exportExcel';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

const departmentTypeLabels: Record<string, string> = {
  RECTORATE: 'Rektorat va Rahbariyat',
  DIVISION: 'Boshqarma va Markazlar',
  DEPARTMENT: 'Bo‘lim va Xizmatlar',
  FACULTY: 'Fakultet',
  CHAIR: 'Kafedra',
  LIBRARY: 'Kutubxona / ARM',
  LAB: 'Laboratoriya va Ilmiy Markaz',
};

const departmentTypeColors: Record<string, string> = {
  RECTORATE: 'magenta',
  DIVISION: 'purple',
  DEPARTMENT: 'green',
  FACULTY: 'arcoblue',
  CHAIR: 'cyan',
  LIBRARY: 'gold',
  LAB: 'orange',
};

export const OrganizationPage: React.FC = () => {
  const { departments, allDepartments, rooms, isLoading, refetch } = useOrganizationQuery();
  const { assets } = useAssetsQuery();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Tabs state
  const [activeTab, setActiveTab] = useState<'TREE' | 'DEPARTMENTS' | 'ROOMS'>('TREE');
  const [selectedKey, setSelectedKey] = useState<string>('');

  // Modals state
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);

  // Filters for Tables
  const [deptSearch, setDeptSearch] = useState('');
  const [deptTypeFilter, setDeptTypeFilter] = useState('ALL');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomBuildingFilter, setRoomBuildingFilter] = useState('ALL');

  // Mutations
  const deleteDeptMutation = useDeleteDepartmentMutation();
  const deleteRoomMutation = useDeleteRoomMutation();

  // Active room for Tree view
  const activeRoomId = selectedKey || (rooms.length > 0 ? rooms[0].id : '');
  const selectedRoom = rooms.find((r) => r.id === activeRoomId);
  const roomAssets = assets.filter((a) => a.roomId === activeRoomId);

  // Tree data calculation (includes both chairs and direct department rooms)
  const treeData = [
    {
      title: 'Universitet Bosh Tuzilmasi',
      key: 'root',
      icon: <IconHome />,
      children: departments.map((dep) => {
        const chairNodes = (dep.children || []).map((chair) => ({
          title: `${chair.name} (${departmentTypeLabels[chair.type] || chair.type})`,
          key: chair.id,
          icon: <IconBranch />,
          children: rooms
            .filter((r) => r.departmentId === chair.id || r.departmentName === chair.name)
            .map((room) => ({
              title: `${room.number}-xona: ${room.name}`,
              key: room.id,
              icon: <IconHome />,
            })),
        }));

        const directRoomNodes = rooms
          .filter((r) => r.departmentId === dep.id || r.departmentName === dep.name)
          .map((room) => ({
            title: `${room.number}-xona: ${room.name}`,
            key: room.id,
            icon: <IconHome />,
          }));

        return {
          title: `${dep.name} (${departmentTypeLabels[dep.type] || dep.type || 'Tuzilma'})`,
          key: dep.id,
          icon: <IconBranch />,
          children: [...chairNodes, ...directRoomNodes],
        };
      }),
    },
  ];

  // Statistics calculation
  const facultiesCount = allDepartments.filter((d) => d.type === 'FACULTY').length;
  const chairsCount = allDepartments.filter((d) => d.type === 'CHAIR' || d.type === 'LAB').length;
  const totalRoomsCount = rooms.length;
  const roomsWithMolCount = rooms.filter((r) => r.responsibleUserId).length;

  // Filtered Departments Table
  const filteredDepartments = useMemo(() => {
    return allDepartments.filter((d) => {
      const matchesSearch =
        deptSearch.trim() === '' ||
        d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
        (d.code && d.code.toLowerCase().includes(deptSearch.toLowerCase()));
      const matchesType = deptTypeFilter === 'ALL' || d.type === deptTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [allDepartments, deptSearch, deptTypeFilter]);

  // Filtered Rooms Table
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        roomSearch.trim() === '' ||
        r.number.toLowerCase().includes(roomSearch.toLowerCase()) ||
        r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
        (r.departmentName && r.departmentName.toLowerCase().includes(roomSearch.toLowerCase())) ||
        (r.responsibleUserName && r.responsibleUserName.toLowerCase().includes(roomSearch.toLowerCase()));
      const matchesBuilding = roomBuildingFilter === 'ALL' || r.building === roomBuildingFilter;
      return matchesSearch && matchesBuilding;
    });
  }, [rooms, roomSearch, roomBuildingFilter]);

  const handleExportDepartmentsExcel = () => {
    const data = filteredDepartments.map((d) => ({
      'Nomi': d.name,
      'Kodi': d.code || '-',
      'Turi': departmentTypeLabels[d.type] || d.type,
      'Yuqori Bo‘lim': d.parent?.name || 'Bosh Bo‘lim',
      'Xonalar Soni': d._count?.rooms || 0,
      'Xodimlar Soni': d._count?.users || 0,
    }));
    exportToExcel(data, 'Universitet_Kafedralar_Tuzilmasi');
  };

  const handleExportRoomsExcel = () => {
    const data = filteredRooms.map((r) => ({
      'Xona №': r.number,
      'Xona Nomi': r.name,
      'Bino': r.building || '-',
      'Qavat': r.floor || '-',
      'Kafedra': r.departmentName || '-',
      'Mas’ul Shaxs (MOL)': r.responsibleUserName || 'Belgilanmagan',
      'Aloqa': r.responsibleUserPhone || '-',
      'Biriktirilgan Ashyolar': r.itemCount || 0,
    }));
    exportToExcel(data, 'Universitet_Auditoriyalar_Reestri');
  };

  const departmentColumns = [
    {
      title: 'Bo‘lim / Kafedra Nomi',
      dataIndex: 'name',
      key: 'name',
      minWidth: 260,
      render: (_: any, record: DepartmentItem) => (
        <CategoryThumbnail
          icon={<IconBranch />}
          name={record.name}
          subtitle={record.code ? `Kodi: ${record.code}` : undefined}
          tag={departmentTypeLabels[record.type] || record.type}
          color="#165DFF"
          bg="#E8F3FF"
        />
      ),
    },
    {
      title: 'Yuqori Bo‘lim (Fakultet)',
      dataIndex: 'parent',
      key: 'parent',
      minWidth: 200,
      render: (_: any, record: DepartmentItem) => (
        <span style={{ fontSize: 13 }}>{record.parent ? record.parent.name : '— (Bosh Bo‘lim)'}</span>
      ),
    },
    {
      title: 'Xonalar Soni',
      key: 'roomsCount',
      width: 130,
      render: (_: any, record: DepartmentItem) => (
        <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 600 }}>
          {record._count?.rooms || 0} ta xona
        </Tag>
      ),
    },
    {
      title: 'Xodimlar Soni',
      key: 'usersCount',
      width: 140,
      render: (_: any, record: DepartmentItem) => (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {record._count?.users || 0} nafar
        </span>
      ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: DepartmentItem) => (
        <TableActions
          onDelete={isSuperAdmin ? () => deleteDeptMutation.mutate(record.id) : undefined}
          deleteConfirmTitle={`'${record.name}' bo‘limini o‘chirishni tasdiqlaysizmi?`}
          deleteOkText="Ha, o‘chirish"
          deleteCancelText="Yo‘q"
          deleteTooltip="O‘chirish"
          rightPadding={16}
        >
          <Tooltip content="Tahrirlash">
            <Button
              size="small"
              type="secondary"
              icon={<IconEdit />}
              style={{ borderRadius: 0 }}
              onClick={() => setEditingDept(record)}
            />
          </Tooltip>
        </TableActions>
      ),
    },
  ];

  const roomColumns = [
    {
      title: 'Xona № & Bino',
      key: 'roomNumber',
      minWidth: 260,
      render: (_: any, record: RoomItem) => (
        <CategoryThumbnail
          icon={<IconHome />}
          name={`${record.number}-xona: ${record.name}`}
          subtitle={`${record.building}, ${record.floor}-qavat`}
          tag={record.departmentName || undefined}
          color="#00B42A"
          bg="#E8FFEA"
        />
      ),
    },
    {
      title: 'Mas’ul Shaxs (MOL)',
      key: 'responsibleUser',
      minWidth: 200,
      render: (_: any, record: RoomItem) => (
        <div>
          {record.responsibleUserName ? (
            <Space size="mini">
              <IconUser style={{ color: '#165DFF' }} />
              <Text bold>{record.responsibleUserName}</Text>
            </Space>
          ) : (
            <Text type="secondary" style={{ fontStyle: 'italic' }}>
              Belgilanmagan
            </Text>
          )}
          {record.responsibleUserPhone && (
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
              {record.responsibleUserPhone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Jihozlar Balansi',
      key: 'itemCount',
      width: 160,
      render: (_: any, record: RoomItem) => (
        <Button
          size="mini"
          type="outline"
          icon={<IconApps />}
          style={{ borderRadius: 0 }}
          onClick={() => {
            setSelectedKey(record.id);
            setActiveTab('TREE');
          }}
        >
          {record.itemCount || 0} ta ashyo
        </Button>
      ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: RoomItem) => (
        <TableActions
          onDelete={isSuperAdmin ? () => deleteRoomMutation.mutate(record.id) : undefined}
          deleteConfirmTitle={`'${record.number}-xona (${record.name})'ni o‘chirishni tasdiqlaysizmi?`}
          deleteOkText="Ha, o‘chirish"
          deleteCancelText="Yo‘q"
          deleteTooltip="O‘chirish"
          rightPadding={16}
        >
          <Tooltip content="Xonani tahrirlash">
            <Button
              size="small"
              type="secondary"
              icon={<IconEdit />}
              style={{ borderRadius: 0 }}
              onClick={() => setEditingRoom(record)}
            />
          </Tooltip>
        </TableActions>
      ),
    },
  ];

  const uniqueBuildings = Array.from(new Set(rooms.map((r) => r.building).filter(Boolean)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Toolbar: Tabs + Quick Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <PageTabs
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as any)}
          tabs={[
            { key: 'TREE', title: 'Iyerarxiya va Jihozlar (Interaktiv)' },
            { key: 'DEPARTMENTS', title: 'Bo‘limlar, Fakultet va Kafedralar', count: allDepartments.length },
            { key: 'ROOMS', title: 'Auditoriyalar va Xizmat Xonalari', count: rooms.length },
          ]}
        />

        <Space wrap>
          <Button
            type="outline"
            icon={<IconRefresh />}
            style={{ borderRadius: 0 }}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Yangilash
          </Button>

          <Button
            type="secondary"
            icon={<IconBranch />}
            style={{ borderRadius: 0 }}
            onClick={() => setIsCreateDeptOpen(true)}
          >
            Yangi Bo‘lim Qo‘shish
          </Button>

          <Button
            type="primary"
            icon={<IconPlus />}
            style={{ borderRadius: 0 }}
            onClick={() => setIsCreateRoomOpen(true)}
          >
            Yangi Xona Qo‘shish
          </Button>
        </Space>
      </div>

      {/* TAB 1: TREE & ROOM DETAILS */}
      {activeTab === 'TREE' && (
        <Row gutter={[16, 16]}>
          {/* LEFT TREE */}
          <Col xs={24} md={9}>
            <Card
              bordered
              style={{ borderRadius: 0, height: '100%' }}
              title={
                <Space>
                  <IconBranch style={{ color: '#165DFF' }} />
                  <span>Universitet Iyerarxiyasi</span>
                </Space>
              }
            >
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 12 }}>
                Fakultet, kafedra yoki auditoriyani tanlab, undagi ashyolar balansini ko‘rishingiz mumkin:
              </div>
              <Tree
                treeData={treeData}
                selectedKeys={[activeRoomId]}
                defaultExpandedKeys={['root']}
                onSelect={(keys) => {
                  if (keys.length > 0) setSelectedKey(keys[0]);
                }}
                showLine
              />
            </Card>
          </Col>

          {/* RIGHT DETAILS */}
          <Col xs={24} md={15}>
            <Card bordered style={{ borderRadius: 0, minHeight: 480 }}>
              {selectedRoom ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-2)', paddingBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <Tag color="arcoblue" style={{ marginBottom: 6, borderRadius: 0 }}>
                          {selectedRoom.building} • {selectedRoom.floor}-qavat
                        </Tag>
                        <Title heading={4} style={{ margin: 0 }}>
                          {selectedRoom.number}-xona: {selectedRoom.name}
                        </Title>
                        <Text type="secondary">{selectedRoom.departmentName || 'Bo‘lim belgilanmagan'}</Text>
                      </div>

                      <Space>
                        <Button
                          size="small"
                          type="secondary"
                          icon={<IconEdit />}
                          style={{ borderRadius: 0 }}
                          onClick={() => setEditingRoom(selectedRoom)}
                        >
                          Xonani Tahrirlash
                        </Button>
                      </Space>
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        padding: '12px 16px',
                        background: 'var(--color-fill-1)',
                        borderRadius: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          background: 'rgba(22, 93, 255, 0.1)',
                          color: '#165DFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 0,
                          fontSize: 20,
                        }}
                      >
                        <IconUser />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          Moddiy Javobgar Shaxs (MOL):
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {selectedRoom.responsibleUserName || 'Belgilanmagan'}
                        </div>
                        {selectedRoom.responsibleUserPhone && (
                          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                            Aloqa: {selectedRoom.responsibleUserPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items in this room */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        Xonaga biriktirilgan asosiy vositalar ({roomAssets.length} ta)
                      </span>
                    </div>

                    <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
                      <Table
                        rowKey="id"
                        pagination={false}
                        size="small"
                        data={roomAssets}
                        style={{ borderRadius: 0 }}
                        noDataElement={
                          <div style={{ padding: 32, textAlign: 'center' }}>
                            <Empty description="Bu xonada hozircha asosiy vositalar mavjud emas" />
                          </div>
                        }
                        columns={[
                          {
                            title: 'Asosiy Vosita',
                            render: (_, a) => (
                              <CategoryThumbnail
                                icon={<IconApps />}
                                name={a.itemName}
                                subtitle={`Inv: ${a.inventoryNumber}${a.itemModel ? ` | ${a.itemModel}` : ''}`}
                                tag={a.categoryName || undefined}
                                color="#165DFF"
                                bg="#E8F3FF"
                              />
                            ),
                          },
                          {
                            title: 'Seriya №',
                            dataIndex: 'serialNumber',
                            width: 140,
                            render: (val: string) => val || '—',
                          },
                          {
                            title: 'Xarid Narxi',
                            dataIndex: 'purchasePrice',
                            width: 140,
                            render: (val: number) => (val ? `${val.toLocaleString()} so‘m` : '—'),
                          },
                          {
                            title: 'Holati',
                            dataIndex: 'status',
                            width: 120,
                            render: (st: string) => (
                              <Tag color={st === 'IN_USE' ? 'green' : 'orange'} style={{ borderRadius: 0 }}>
                                {st === 'IN_USE' ? 'Ishlatilmoqda' : st}
                              </Tag>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </div>
                </div>
              ) : (
                <Empty description="Tuzilmadan birorta xonani tanlang" />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* TAB 2: DEPARTMENTS TABLE */}
      {activeTab === 'DEPARTMENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <Space wrap>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Bo‘lim nomi yoki kodi bo‘yicha qidiruv..."
                  style={{ width: 320, borderRadius: 0 }}
                  value={deptSearch}
                  onChange={setDeptSearch}
                  allowClear
                />
                <Select
                  placeholder="Turi bo‘yicha filtr"
                  style={{ width: 240, borderRadius: 0 }}
                  value={deptTypeFilter}
                  onChange={setDeptTypeFilter}
                >
                  <Select.Option value="ALL">Barcha bo‘limlar va turlar</Select.Option>
                  <Select.Option value="RECTORATE">Rektorat va Rahbariyat</Select.Option>
                  <Select.Option value="DIVISION">Boshqarma va Markazlar</Select.Option>
                  <Select.Option value="DEPARTMENT">Bo‘lim va Xizmatlar</Select.Option>
                  <Select.Option value="FACULTY">Fakultetlar</Select.Option>
                  <Select.Option value="CHAIR">Kafedralar</Select.Option>
                  <Select.Option value="LIBRARY">Kutubxona / ARM</Select.Option>
                  <Select.Option value="LAB">Laboratoriyalar</Select.Option>
                </Select>
              </Space>

              <Button
                icon={<IconDownload />}
                style={{ borderRadius: 0 }}
                onClick={handleExportDepartmentsExcel}
              >
                Excelga Eksport
              </Button>
            </div>
          </Card>

          <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              columns={departmentColumns}
              data={filteredDepartments}
              loading={isLoading}
              scroll={{ x: 1050 }}
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
              style={{ borderRadius: 0 }}
              noDataElement={
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Empty description="Bo‘limlar topilmadi" />
                </div>
              }
            />
          </Card>
        </div>
      )}

      {/* TAB 3: ROOMS TABLE */}
      {activeTab === 'ROOMS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card className="uwms-card" bodyStyle={{ padding: '16px 20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <Space wrap>
                <Input
                  prefix={<IconSearch />}
                  placeholder="Xona raqami, nomi, bo‘limi yoki MOL..."
                  style={{ width: 320, borderRadius: 0 }}
                  value={roomSearch}
                  onChange={setRoomSearch}
                  allowClear
                />
                <Select
                  placeholder="Bino bo‘yicha filtr"
                  style={{ width: 220, borderRadius: 0 }}
                  value={roomBuildingFilter}
                  onChange={setRoomBuildingFilter}
                >
                  <Select.Option value="ALL">Barcha binolar</Select.Option>
                  {uniqueBuildings.map((b) => (
                    <Select.Option key={b} value={b}>
                      {b}
                    </Select.Option>
                  ))}
                </Select>
              </Space>

              <Button
                icon={<IconDownload />}
                style={{ borderRadius: 0 }}
                onClick={handleExportRoomsExcel}
              >
                Excelga Eksport
              </Button>
            </div>
          </Card>

          <Card className="uwms-card" style={{ borderRadius: 0 }} bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              columns={roomColumns}
              data={filteredRooms}
              loading={isLoading}
              scroll={{ x: 1050 }}
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
              style={{ borderRadius: 0 }}
              noDataElement={
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Empty description="Auditoriyalar va xonalar topilmadi" />
                </div>
              }
            />
          </Card>
        </div>
      )}

      {/* MODALS */}
      <CreateDepartmentModal
        visible={isCreateDeptOpen}
        onClose={() => setIsCreateDeptOpen(false)}
      />

      <EditDepartmentModal
        visible={!!editingDept}
        department={editingDept}
        onClose={() => setEditingDept(null)}
      />

      <CreateRoomModal
        visible={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
      />

      <EditRoomModal
        visible={!!editingRoom}
        room={editingRoom}
        onClose={() => setEditingRoom(null)}
      />
    </div>
  );
};
