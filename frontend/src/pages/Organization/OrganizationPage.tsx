import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Grid,
  Tree,
  Typography,
  Tag,
  Alert,
  Space,
  Button,
  Input,
  Select,
  Popconfirm,
  Tooltip,
  Empty,
  Radio,
  Switch,
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
  IconDownload,
  IconSwap,
} from '@arco-design/web-react/icon';
import { StandardTable } from '../../components/Common/StandardTable';
import {
  useOrganizationQuery,
  useDeleteDepartmentMutation,
  useDeleteRoomMutation,
  useRestoreDepartmentMutation,
  useRestoreRoomMutation,
  useCreateBuildingMutation,
  useUpdateBuildingMutation,
  useDeleteBuildingMutation,
  useRestoreBuildingMutation,
  type DepartmentItem,
  type RoomItem,
  type BuildingItem,
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
import { TransferRoomModal } from './TransferRoomModal';
import { CreateBuildingModal } from './CreateBuildingModal';
import { EditBuildingModal } from './EditBuildingModal';
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

export const isUnnumberedRoom = (r: { number?: string | null }) => {
  if (!r.number) return true;
  if (r.number.startsWith('RS-')) return true;
  if (r.number.trim().toUpperCase() === 'RAQAMSIZ' || r.number.trim() === '-') return true;
  return false;
};

export const getRoomDisplayName = (r: { number?: string | null; name: string }) => {
  if (isUnnumberedRoom(r)) {
    return r.name;
  }
  return `${r.number}-xona: ${r.name}`;
};

export const getRoomTreeTitle = (r: RoomItem, showBuilding = false) => {
  const molText = r.responsibleUserName || 'MOL belgilanmagan';
  const countText = `${r.itemCount || 0} ta ashyo`;
  const locationText = showBuilding
    ? `${r.building || 'Bosh bino'} • ${r.floor}-qavat`
    : `${r.floor}-qavat`;

  if (isUnnumberedRoom(r)) {
    return `${r.name} (${locationText}) [${molText} • ${countText}]`;
  }
  return `${r.number}-xona (${locationText}): ${r.name} [${molText} • ${countText}]`;
};

export const OrganizationPage: React.FC = () => {
  const [showDeleted, setShowDeleted] = useState(false);
  const { departments, allDepartments, rooms, buildings, isLoading, isError, refetch } = useOrganizationQuery(showDeleted);
  const { assets } = useAssetsQuery();
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canTransferRoom = isSuperAdmin || user?.role === 'COMMENDANT' || user?.role === 'HEAD_WAREHOUSE';

  // Tabs state
  const [activeTab, setActiveTab] = useState<'TREE' | 'BUILDINGS' | 'DEPARTMENTS' | 'ROOMS'>('TREE');
  const [selectedKey, setSelectedKey] = useState<string>('root-university');
  const [treeViewMode, setTreeViewMode] = useState<'BUILDING_FIRST' | 'DEPARTMENT_FIRST'>('BUILDING_FIRST');
  const [accordionMode, setAccordionMode] = useState<boolean>(true);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['root-university']);
  const [presetBuildingId, setPresetBuildingId] = useState<string | undefined>(undefined);
  const [presetDeptId, setPresetDeptId] = useState<string | undefined>(undefined);

  // Modals state
  const [isCreateBuildingOpen, setIsCreateBuildingOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingItem | null>(null);
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [transferringRoom, setTransferringRoom] = useState<RoomItem | null>(null);

  // Filters for Tables
  const [buildingSearch, setBuildingSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [deptTypeFilter, setDeptTypeFilter] = useState('ALL');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomBuildingFilter, setRoomBuildingFilter] = useState('ALL');

  // Mutations
  const deleteBuildingMutation = useDeleteBuildingMutation();
  const restoreBuildingMutation = useRestoreBuildingMutation();
  const deleteDeptMutation = useDeleteDepartmentMutation();
  const deleteRoomMutation = useDeleteRoomMutation();
  const restoreDeptMutation = useRestoreDepartmentMutation();
  const restoreRoomMutation = useRestoreRoomMutation();

  // Multi-entity resolution for Tree view
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedKey) || null;
  }, [rooms, selectedKey]);

  const selectedDepartment = useMemo(() => {
    if (!selectedKey) return null;
    let deptId: string | null = null;
    if (selectedKey.startsWith('dep-')) {
      deptId = selectedKey.replace('dep-', '');
    } else if (selectedKey.includes('__chair-')) {
      deptId = selectedKey.split('__chair-')[1];
    } else if (selectedKey.includes('__dept-')) {
      deptId = selectedKey.split('__dept-')[1].split('__')[0];
    }
    if (!deptId) return null;
    return allDepartments.find((d) => d.id === deptId || d.name === deptId) || null;
  }, [allDepartments, selectedKey]);

  const selectedBuilding = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith('bld-') && !selectedKey.includes('__dept-') && !selectedKey.includes('__unassigned')) {
      const bldId = selectedKey.replace('bld-', '');
      return buildings.find((b) => b.id === bldId) || null;
    }
    return null;
  }, [buildings, selectedKey]);

  const roomAssets = useMemo(() => {
    if (!selectedRoom) return [];
    return assets.filter((a) => a.roomId === selectedRoom.id);
  }, [assets, selectedRoom]);

  const selectedDeptRooms = useMemo(() => {
    if (!selectedDepartment) return [];
    const childIds = new Set((selectedDepartment.children || []).map((c) => c.id));
    childIds.add(selectedDepartment.id);
    return rooms.filter(
      (r) =>
        (r.departmentId && childIds.has(r.departmentId)) ||
        r.departmentName === selectedDepartment.name
    );
  }, [selectedDepartment, rooms]);

  const selectedDeptAssetsCount = useMemo(() => {
    const roomIds = new Set(selectedDeptRooms.map((r) => r.id));
    return assets.filter((a) => a.roomId && roomIds.has(a.roomId)).length;
  }, [assets, selectedDeptRooms]);

  const selectedBuildingRooms = useMemo(() => {
    if (!selectedBuilding) return [];
    return rooms.filter((r) => r.buildingId === selectedBuilding.id || r.building === selectedBuilding.name);
  }, [selectedBuilding, rooms]);

  const selectedBuildingAssetsCount = useMemo(() => {
    const roomIds = new Set(selectedBuildingRooms.map((r) => r.id));
    return assets.filter((a) => a.roomId && roomIds.has(a.roomId)).length;
  }, [assets, selectedBuildingRooms]);

  // Accordion Expand Handler (Supports both +/- icon and clicking on the node title text)
  const handleExpand = (
    keys: string[],
    extra?: { expanded: boolean; node: any }
  ) => {
    if (!accordionMode) {
      setExpandedKeys(keys);
      return;
    }

    // Determine clicked key from extra or from keys diff
    let clickedKey = String(extra?.node?.props?._key || extra?.node?.props?.dataRef?.key || extra?.node?.key || '');
    let isExpanded = extra?.expanded;

    if (!clickedKey) {
      const added = keys.find((k) => !expandedKeys.includes(k));
      const removed = expandedKeys.find((k) => !keys.includes(k));
      clickedKey = added || removed || '';
      isExpanded = Boolean(added);
    }

    if (!clickedKey) {
      setExpandedKeys(keys);
      return;
    }

    if (!isExpanded) {
      // User collapsed a node: remove this node and all its child keys
      setExpandedKeys((prev) =>
        prev.filter((k) => k !== clickedKey && !k.startsWith(clickedKey + '__'))
      );
      return;
    }

    // User expanded a node in accordion mode:
    if (treeViewMode === 'BUILDING_FIRST') {
      // 1. Root University Node
      if (clickedKey === 'root-university') {
        setExpandedKeys((prev) => Array.from(new Set([...prev, 'root-university'])));
        return;
      }

      // 2. Building Node ('bld-...')
      if (clickedKey.startsWith('bld-') && !clickedKey.includes('__dept-') && !clickedKey.includes('__unassigned')) {
        setExpandedKeys((prev) => {
          const nonBuildings = prev.filter((k) => !k.startsWith('bld-'));
          return [...nonBuildings, clickedKey];
        });
        return;
      }

      // 3. Department / Faculty Node ('bld-...__dept-...' without '__chair-' and '__dekanat')
      if (clickedKey.includes('__dept-') && !clickedKey.includes('__chair-') && !clickedKey.includes('__dekanat')) {
        const bldPrefix = clickedKey.split('__dept-')[0]; // 'bld-{bldId}'
        setExpandedKeys((prev) => {
          const filtered = prev.filter((k) => {
            if (k.startsWith(bldPrefix + '__dept-') || k.startsWith(bldPrefix + '__unassigned')) {
              return false;
            }
            return true;
          });
          return [...filtered, clickedKey];
        });
        return;
      }

      // 4. Chair / Sub-unit Node ('...__chair-...' or '...__dekanat')
      if (clickedKey.includes('__chair-') || clickedKey.includes('__dekanat')) {
        const deptPrefix = clickedKey.includes('__chair-')
          ? clickedKey.split('__chair-')[0]
          : clickedKey.split('__dekanat')[0];
        setExpandedKeys((prev) => {
          const filtered = prev.filter((k) => {
            if (k.startsWith(deptPrefix + '__chair-') || k.startsWith(deptPrefix + '__dekanat')) {
              return false;
            }
            return true;
          });
          return [...filtered, clickedKey];
        });
        return;
      }

      setExpandedKeys(keys);
    } else {
      // DEPARTMENT_FIRST mode:
      if (clickedKey === 'root-dept') {
        setExpandedKeys((prev) => Array.from(new Set([...prev, 'root-dept'])));
        return;
      }
      if (clickedKey.startsWith('dep-')) {
        setExpandedKeys((prev) => {
          const nonDepts = prev.filter((k) => !k.startsWith('dep-'));
          return [...nonDepts, clickedKey];
        });
        return;
      }
      setExpandedKeys(keys);
    }
  };

  // Tree data calculation: Default is 4-tier hierarchy: Bino -> Fakultet/Bo'lim -> Kafedra -> Xonalar
  const treeData = useMemo(() => {
    if (treeViewMode === 'DEPARTMENT_FIRST') {
      // Traditional organizational view: Fakultet -> Kafedra -> Xona
      return [
        {
          title: `Universitet Tashkiliy Tuzilmasi (${allDepartments.length} ta bo‘lim va kafedra, ${rooms.length} ta xona)`,
          key: 'root-dept',
          icon: <IconBranch />,
          children: departments.map((dep) => {
            const chairNodes = (dep.children || []).map((chair) => {
              const chRooms = rooms.filter((r) => r.departmentId === chair.id || r.departmentName === chair.name);
              return {
                title: `${chair.name} (${departmentTypeLabels[chair.type] || chair.type}${chRooms.length > 0 ? ` • ${chRooms.length} ta xona` : ''})`,
                key: `dep-${chair.id}`,
                icon: <IconApps />,
                children: chRooms.map((room) => ({
                  title: getRoomTreeTitle(room, true),
                  key: room.id,
                  icon: <IconHome />,
                })),
              };
            });

            const directRoomNodes = rooms
              .filter((r) => r.departmentId === dep.id || r.departmentName === dep.name)
              .map((room) => ({
                title: getRoomTreeTitle(room, true),
                key: room.id,
                icon: <IconHome />,
              }));

            const depTotalRooms = directRoomNodes.length + (dep.children || []).reduce((acc, c) => {
              return acc + rooms.filter((r) => r.departmentId === c.id || r.departmentName === c.name).length;
            }, 0);

            return {
              title: `${dep.name} (${departmentTypeLabels[dep.type] || dep.type || 'Tuzilma'}${depTotalRooms > 0 ? ` • ${depTotalRooms} ta xona` : ''})`,
              key: `dep-${dep.id}`,
              icon: <IconBranch />,
              children: [...chairNodes, ...directRoomNodes],
            };
          }),
        },
      ];
    }

    // Default: BINO -> FAKULTET/BO'LIM/MARKAZ -> KAFEDRA -> XONALAR
    const buildingNodes = buildings.map((bld) => {
      const bldRooms = rooms.filter((r) => r.buildingId === bld.id || r.building === bld.name);
      const bldDepts = allDepartments.filter((d) => d.buildingId === bld.id);

      if (bldRooms.length === 0 && bldDepts.length === 0) {
        return {
          title: `${bld.name} (${bld.floorsCount} qavat) — [Bo‘limlar va xonalar biriktirilmagan]`,
          key: `bld-${bld.id}`,
          icon: <IconHome />,
          children: [],
        };
      }

      // Group rooms and departments in this building by top-level department
      const topDeptMap = new Map<
        string,
        {
          dept: DepartmentItem;
          directRooms: RoomItem[];
          chairs: Map<string, { chair: DepartmentItem; rooms: RoomItem[] }>;
        }
      >();
      const unassignedRooms: RoomItem[] = [];

      // 1. Populate departments explicitly attached to this building
      bldDepts.forEach((dept) => {
        const isChairOrChild = Boolean(
          dept.parentId || dept.type === 'CHAIR' || dept.name.toLowerCase().includes('kafedra')
        );

        if (isChairOrChild) {
          let parentDept = dept.parentId ? allDepartments.find((d) => d.id === dept.parentId) : null;
          if (!parentDept && (dept.type === 'CHAIR' || dept.name.toLowerCase().includes('kafedra'))) {
            parentDept = allDepartments.find((d) => d.type === 'FACULTY') || null;
          }

          const topKey = parentDept ? parentDept.id : dept.id;
          const topDeptObj = parentDept || dept;

          if (!topDeptMap.has(topKey)) {
            topDeptMap.set(topKey, {
              dept: topDeptObj,
              directRooms: [],
              chairs: new Map(),
            });
          }
          const topEntry = topDeptMap.get(topKey)!;

          if (parentDept && parentDept.id !== dept.id) {
            if (!topEntry.chairs.has(dept.id)) {
              topEntry.chairs.set(dept.id, { chair: dept, rooms: [] });
            }
          }
        } else {
          if (!topDeptMap.has(dept.id)) {
            topDeptMap.set(dept.id, {
              dept,
              directRooms: [],
              chairs: new Map(),
            });
          }
        }
      });

      // 2. Distribute rooms in this building
      bldRooms.forEach((room) => {
        if (!room.departmentId && !room.departmentName) {
          unassignedRooms.push(room);
          return;
        }

        const dept = allDepartments.find(
          (d) => d.id === room.departmentId || d.name === room.departmentName
        );

        if (!dept) {
          const fallbackKey = room.departmentName || 'Boshqa bo‘lim';
          if (!topDeptMap.has(fallbackKey)) {
            topDeptMap.set(fallbackKey, {
              dept: { id: fallbackKey, name: fallbackKey, type: 'DEPARTMENT' } as DepartmentItem,
              directRooms: [],
              chairs: new Map(),
            });
          }
          topDeptMap.get(fallbackKey)!.directRooms.push(room);
          return;
        }

        // Check if this department is a CHAIR or has a parent Faculty
        const isChairOrChild = Boolean(
          dept.parentId || dept.type === 'CHAIR' || dept.name.toLowerCase().includes('kafedra')
        );

        if (isChairOrChild) {
          let parentDept = dept.parentId ? allDepartments.find((d) => d.id === dept.parentId) : null;
          if (!parentDept && (dept.type === 'CHAIR' || dept.name.toLowerCase().includes('kafedra'))) {
            parentDept = allDepartments.find((d) => d.type === 'FACULTY') || null;
          }

          const topKey = parentDept ? parentDept.id : dept.id;
          const topDeptObj = parentDept || dept;

          if (!topDeptMap.has(topKey)) {
            topDeptMap.set(topKey, {
              dept: topDeptObj,
              directRooms: [],
              chairs: new Map(),
            });
          }
          const topEntry = topDeptMap.get(topKey)!;

          if (parentDept && parentDept.id !== dept.id) {
            if (!topEntry.chairs.has(dept.id)) {
              topEntry.chairs.set(dept.id, { chair: dept, rooms: [] });
            }
            topEntry.chairs.get(dept.id)!.rooms.push(room);
          } else {
            topEntry.directRooms.push(room);
          }
        } else {
          // Top-level department (FACULTY, RECTORATE, DIVISION, DEPARTMENT, etc.)
          if (!topDeptMap.has(dept.id)) {
            topDeptMap.set(dept.id, {
              dept,
              directRooms: [],
              chairs: new Map(),
            });
          }
          topDeptMap.get(dept.id)!.directRooms.push(room);
        }
      });

      const deptNodes = Array.from(topDeptMap.values()).map(({ dept, directRooms, chairs }) => {
        const chairNodes = Array.from(chairs.values()).map(({ chair, rooms: chairRooms }) => ({
          title: `${chair.name}${chairRooms.length > 0 ? ` (${chairRooms.length} ta xona)` : ''}`,
          key: `bld-${bld.id}__dept-${dept.id}__chair-${chair.id}`,
          icon: <IconApps />,
          children: chairRooms.map((r) => ({
            title: getRoomTreeTitle(r, false),
            key: r.id,
            icon: <IconHome />,
          })),
        }));

        const directRoomNodes = directRooms.map((r) => ({
          title: getRoomTreeTitle(r, false),
          key: r.id,
          icon: <IconHome />,
        }));

        const totalDeptRooms =
          directRooms.length +
          Array.from(chairs.values()).reduce((sum, c) => sum + c.rooms.length, 0);

        let childNodes = [];
        if (chairs.size > 0) {
          if (directRooms.length > 0) {
            childNodes = [
              {
                title: `Fakultet Dekanati va Xizmat Xonalari (${directRooms.length} ta xona)`,
                key: `bld-${bld.id}__dept-${dept.id}__dekanat`,
                icon: <IconApps />,
                children: directRoomNodes,
              },
              ...chairNodes,
            ];
          } else {
            childNodes = chairNodes;
          }
        } else {
          childNodes = directRoomNodes;
        }

        const roomCountSuffix = totalDeptRooms > 0 ? ` • ${totalDeptRooms} ta xona` : '';
        return {
          title: `${dept.name} (${departmentTypeLabels[dept.type] || dept.type}${roomCountSuffix})`,
          key: `bld-${bld.id}__dept-${dept.id}`,
          icon: <IconBranch />,
          children: childNodes,
        };
      });

      const unassignedNode =
        unassignedRooms.length > 0
          ? [
              {
                title: `Bo‘lim biriktirilmagan xonalar (${unassignedRooms.length} ta)`,
                key: `bld-${bld.id}__unassigned`,
                icon: <IconBranch />,
                children: unassignedRooms.map((r) => ({
                  title: getRoomTreeTitle(r, false),
                  key: r.id,
                  icon: <IconHome />,
                })),
              },
            ]
          : [];

      const parts: string[] = [`${bld.floorsCount} qavat`];
      if (bldDepts.length > 0) parts.push(`${bldDepts.length} ta bo‘lim`);
      if (bldRooms.length > 0) parts.push(`${bldRooms.length} ta xona`);
      if (bld.commendant) parts.push(`Komendant: ${bld.commendant.fullName}`);

      return {
        title: `${bld.name} (${parts.join(' • ')})`,
        key: `bld-${bld.id}`,
        icon: <IconHome />,
        children: [...deptNodes, ...unassignedNode],
      };
    });

    return [
      {
        title: `Universitet Iyerarxiyasi (Bino ➔ Fakultet/Bo‘lim ➔ Kafedra ➔ Xonalar) — ${buildings.length} ta bino, ${rooms.length} ta auditoriya`,
        key: 'root-university',
        icon: <IconHome />,
        children: buildingNodes,
      },
    ];
  }, [treeViewMode, buildings, allDepartments, rooms, departments]);

  // Statistics calculation
  const facultiesCount = allDepartments.filter((d) => d.type === 'FACULTY').length;
  const chairsCount = allDepartments.filter((d) => d.type === 'CHAIR' || d.type === 'LAB').length;
  const totalRoomsCount = rooms.length;
  const roomsWithMolCount = rooms.filter((r) => r.responsibleUserId).length;

  // Filtered Buildings Table
  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      if (!buildingSearch.trim()) return true;
      const q = buildingSearch.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.address && b.address.toLowerCase().includes(q)) ||
        (b.commendant?.fullName && b.commendant.fullName.toLowerCase().includes(q))
      );
    });
  }, [buildings, buildingSearch]);

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

  const buildingColumns = [
    {
      title: 'Bino Nomi va Kodi',
      dataIndex: 'name',
      key: 'name',
      minWidth: 240,
      render: (_: any, record: BuildingItem) => (
        <CategoryThumbnail
          icon={<IconHome />}
          name={record.name}
          tag={`${record.floorsCount} qavatli bino`}
          color="#00B42A"
          bg="#E8FFEA"
        />
      ),
    },
    {
      title: 'Manzili va Izoh',
      key: 'address',
      minWidth: 200,
      render: (_: any, record: BuildingItem) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-1)' }}>
            {record.address || '—'}
          </span>
          {record.description && (
            <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              {record.description}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Bino Komendanti',
      key: 'commendant',
      minWidth: 200,
      render: (_: any, record: BuildingItem) => (
        record.commendant ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{record.commendant.fullName}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              {record.commendant.phone || record.commendant.username || record.commendant.position}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-4)', fontSize: 13 }}>Tayinlanmagan</span>
        )
      ),
    },
    {
      title: 'Fakultet va Bo‘limlar',
      key: 'departments',
      minWidth: 240,
      render: (_: any, record: BuildingItem) => {
        const depts = allDepartments.filter((d) => d.buildingId === record.id);
        if (depts.length === 0) {
          return <span style={{ color: 'var(--color-text-4)', fontSize: 12 }}>Biriktirilmagan</span>;
        }
        return (
          <Space wrap size={[4, 4]}>
            {depts.slice(0, 3).map((d) => (
              <Tag key={d.id} size="small" color={departmentTypeColors[d.type] || 'arcoblue'} style={{ borderRadius: 0 }}>
                {d.name}
              </Tag>
            ))}
            {depts.length > 3 && (
              <Tag size="small" style={{ borderRadius: 0 }}>
                +{depts.length - 3} ta yana
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Xonalar Soni',
      key: 'roomsCount',
      width: 140,
      render: (_: any, record: BuildingItem) => (
        <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 600 }}>
          {record._count?.rooms ?? 0} ta xona
        </Tag>
      ),
    },
    {
      title: 'Omborlar Soni',
      key: 'warehousesCount',
      width: 140,
      render: (_: any, record: BuildingItem) => (
        <Tag color="cyan" style={{ borderRadius: 0, fontWeight: 600 }}>
          {record._count?.warehouses ?? 0} ta ombor
        </Tag>
      ),
    },
    {
      title: 'Holati',
      key: 'status',
      width: 110,
      render: (_: any, record: BuildingItem) => (
        record.deletedAt ? (
          <Tag color="red" style={{ borderRadius: 0 }}>O‘chirilgan</Tag>
        ) : (
          <Tag color="green" style={{ borderRadius: 0 }}>Faol</Tag>
        )
      ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: BuildingItem) => {
        if (record.deletedAt) {
          return (
            <Popconfirm
              title={`'${record.name}' binosini qayta tiklashni (Restore) tasdiqlaysizmi?`}
              disabled={!isSuperAdmin}
              onOk={() => restoreBuildingMutation.mutate(record.id)}
            >
              <Tooltip content={!isSuperAdmin ? 'Faqat Super Admin tiklay oladi' : undefined}>
                <Button
                  size="small"
                  type="primary"
                  status="success"
                  icon={<IconRefresh />}
                  disabled={!isSuperAdmin}
                  style={{ borderRadius: 0 }}
                >
                  Tiklash
                </Button>
              </Tooltip>
            </Popconfirm>
          );
        }
        return (
          <TableActions
            onDelete={isSuperAdmin ? () => deleteBuildingMutation.mutate(record.id) : undefined}
            deleteConfirmTitle={`'${record.name}' binosini o‘chirishni tasdiqlaysizmi? (Eslatma: Ichida xonalar yoki omborlar bo‘lgan binoni o‘chirish taqiqlanadi)`}
            deleteOkText="Ha, o‘chirish"
            deleteCancelText="Yo‘q"
            deleteTooltip={isSuperAdmin ? 'O‘chirish' : 'O‘chirish faqat Super Admin uchun'}
            rightPadding={16}
          >
            <Tooltip content={isSuperAdmin ? 'Binoni tahrirlash' : 'Tahrirlash faqat Super Admin uchun'}>
              <Button
                size="small"
                type="secondary"
                icon={<IconEdit />}
                style={{ borderRadius: 0 }}
                disabled={!isSuperAdmin}
                onClick={() => setEditingBuilding(record)}
              />
            </Tooltip>
          </TableActions>
        );
      },
    },
  ];

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
          tag={departmentTypeLabels[record.type] || record.type}
          color="#165DFF"
          bg="#E8F3FF"
        />
      ),
    },
    {
      title: 'Joylashgan Bino',
      key: 'building',
      minWidth: 180,
      render: (_: any, record: DepartmentItem) => {
        const b = record.building || (record.buildingId ? buildings.find((x) => x.id === record.buildingId) : null);
        return b ? (
          <Tag color="green" style={{ borderRadius: 0 }}>
            <IconHome style={{ marginRight: 4 }} />
            {b.name}
          </Tag>
        ) : (
          <span style={{ color: 'var(--color-text-4)', fontSize: 12 }}>Biriktirilmagan</span>
        );
      },
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
      render: (_: any, record: DepartmentItem) => {
        if (record.deletedAt) {
          return (
            <Popconfirm
              title={`'${record.name}' bo‘limini qayta tiklashni (Restore) tasdiqlaysizmi?`}
              disabled={!isSuperAdmin}
              onOk={() => restoreDeptMutation.mutate(record.id)}
            >
              <Tooltip content={!isSuperAdmin ? 'Faqat Super Admin tiklay oladi' : undefined}>
                <Button
                  size="small"
                  type="primary"
                  status="success"
                  icon={<IconRefresh />}
                  disabled={!isSuperAdmin}
                  style={{ borderRadius: 0 }}
                >
                  Tiklash
                </Button>
              </Tooltip>
            </Popconfirm>
          );
        }
        return (
          <TableActions
            onDelete={isSuperAdmin ? () => deleteDeptMutation.mutate(record.id) : undefined}
            deleteConfirmTitle={`'${record.name}' bo‘limini o‘chirishni tasdiqlaysizmi?`}
            deleteOkText="Ha, o‘chirish"
            deleteCancelText="Yo‘q"
            deleteTooltip={isSuperAdmin ? 'O‘chirish' : 'O‘chirish faqat Super Admin uchun'}
            rightPadding={16}
          >
            <Tooltip content={isSuperAdmin ? 'Tahrirlash' : 'Tahrirlash faqat Super Admin uchun'}>
              <Button
                size="small"
                type="secondary"
                icon={<IconEdit />}
                style={{ borderRadius: 0 }}
                disabled={!isSuperAdmin}
                onClick={() => setEditingDept(record)}
              />
            </Tooltip>
          </TableActions>
        );
      },
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
          name={getRoomDisplayName(record)}
          subtitle={`${record.building}, ${record.floor}-qavat`}
          tag={isUnnumberedRoom(record) ? 'Raqamsiz xona' : (record.departmentName || undefined)}
          color="#00B42A"
          bg="#E8FFEA"
        />
      ),
    },
    {
      title: 'Biriktirilgan Bo‘lim / Kafedra',
      dataIndex: 'departmentName',
      key: 'departmentName',
      minWidth: 190,
      render: (val: string) => (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {val || '— (Biriktirilmagan)'}
        </span>
      ),
    },
    {
      title: 'Mas’ul Shaxs (MOL)',
      key: 'responsibleUser',
      minWidth: 220,
      render: (_: any, record: RoomItem) => (
        <div>
          {record.responsibleUserName ? (
            <Space direction="vertical" size={2}>
              <Space size="mini">
                <IconUser style={{ color: '#165DFF' }} />
                <Text bold style={{ fontSize: 13 }}>{record.responsibleUserName}</Text>
              </Space>
              {record.responsibleUserPhone ? (
                <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                  {record.responsibleUserPhone}
                </div>
              ) : (
                <Tag size="small" color="arcoblue" style={{ borderRadius: 0, fontSize: 11 }}>
                  MOL biriktirilgan
                </Tag>
              )}
            </Space>
          ) : (
            <Tag color="red" size="small" style={{ borderRadius: 0, fontWeight: 500 }}>
              MOL Biriktirilmagan
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Jihozlar Balansi',
      key: 'itemCount',
      width: 170,
      render: (_: any, record: RoomItem) => (
        <Button
          size="mini"
          type={record.itemCount && record.itemCount > 0 ? 'primary' : 'outline'}
          status={record.itemCount && record.itemCount > 0 ? 'success' : 'default'}
          icon={<IconApps />}
          style={{ borderRadius: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedKey(record.id);
            setActiveTab('TREE');
          }}
        >
          {record.itemCount || 0} ta aktiv
        </Button>
      ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: RoomItem) => {
        if (record.deletedAt) {
          return (
            <Popconfirm
              title={isUnnumberedRoom(record) ? `'${record.name}' xonasini qayta tiklashni (Restore) tasdiqlaysizmi?` : `'${record.number}-xona'ni qayta tiklashni (Restore) tasdiqlaysizmi?`}
              disabled={!isSuperAdmin}
              onOk={() => restoreRoomMutation.mutate(record.id)}
            >
              <Tooltip content={!isSuperAdmin ? 'Faqat Super Admin tiklay oladi' : undefined}>
                <Button
                  size="small"
                  type="primary"
                  status="success"
                  icon={<IconRefresh />}
                  disabled={!isSuperAdmin}
                  style={{ borderRadius: 0 }}
                >
                  Tiklash
                </Button>
              </Tooltip>
            </Popconfirm>
          );
        }
        const hasAssets = (record.itemCount || 0) > 0;
        return (
          <TableActions
            onDelete={isSuperAdmin && !hasAssets ? () => deleteRoomMutation.mutate(record.id) : undefined}
            deleteConfirmTitle={isUnnumberedRoom(record) ? `'${record.name}' xonasini o‘chirishni tasdiqlaysizmi?` : `'${record.number}-xona (${record.name})'ni o‘chirishni tasdiqlaysizmi?`}
            deleteOkText="Ha, o‘chirish"
            deleteCancelText="Yo‘q"
            deleteTooltip={isSuperAdmin ? 'O‘chirish' : 'O‘chirish faqat Super Admin uchun'}
            rightPadding={16}
          >
            <Tooltip content={canTransferRoom ? 'Xona va jihozlar javobgarligini topshirish (OS-1)' : 'Topshirish faqat Komendant yoki Super Admin uchun'}>
              <Button
                size="small"
                type="outline"
                icon={<IconSwap />}
                style={{ borderRadius: 0 }}
                disabled={!canTransferRoom}
                onClick={() => setTransferringRoom(record)}
              />
            </Tooltip>
            <Tooltip content={isSuperAdmin ? 'Xonani tahrirlash' : 'Tahrirlash faqat Super Admin uchun'}>
              <Button
                size="small"
                type="secondary"
                icon={<IconEdit />}
                style={{ borderRadius: 0 }}
                disabled={!isSuperAdmin}
                onClick={() => setEditingRoom(record)}
              />
            </Tooltip>
            {hasAssets && (
              <Tooltip content={`Xonada ${record.itemCount} ta ashyo mavjud! Avval ashyolarni ko‘chiring`}>
                <Button
                  size="small"
                  status="danger"
                  icon={<IconDelete />}
                  disabled
                  style={{ borderRadius: 0 }}
                />
              </Tooltip>
            )}
          </TableActions>
        );
      },
    },
  ];

  const roomAssetColumns = [
    {
      title: 'Asosiy Vosita',
      render: (_: any, a: any) => (
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
            { key: 'BUILDINGS', title: 'Binolar va Korpuslar', count: buildings.length },
            { key: 'DEPARTMENTS', title: 'Bo‘limlar, Fakultet va Kafedralar', count: allDepartments.length },
            { key: 'ROOMS', title: 'Auditoriyalar va Xizmat Xonalari', count: rooms.length },
          ]}
        />

        <Space wrap>
          {isSuperAdmin && (
            <Button
              type={showDeleted ? 'primary' : 'outline'}
              status={showDeleted ? 'danger' : 'default'}
              icon={<IconDelete />}
              style={{ borderRadius: 0 }}
              onClick={() => setShowDeleted(!showDeleted)}
            >
              {showDeleted ? 'Faol Yozuvlar' : 'O‘chirilganlar'}
            </Button>
          )}

          <Button
            type="outline"
            icon={<IconRefresh />}
            style={{ borderRadius: 0 }}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Yangilash
          </Button>

          <Tooltip content={!isSuperAdmin ? 'Faqat Tizim Bosh Administratori bino qo‘sha oladi' : undefined}>
            <Button
              type="secondary"
              icon={<IconHome />}
              style={{ borderRadius: 0 }}
              disabled={!isSuperAdmin}
              onClick={() => setIsCreateBuildingOpen(true)}
            >
              Yangi Bino Qo‘shish
            </Button>
          </Tooltip>

          <Tooltip content={!isSuperAdmin ? 'Faqat Tizim Bosh Administratori (SUPER_ADMIN) bo‘lim qo‘sha oladi' : undefined}>
            <Button
              type="secondary"
              icon={<IconBranch />}
              style={{ borderRadius: 0 }}
              disabled={!isSuperAdmin}
              onClick={() => setIsCreateDeptOpen(true)}
            >
              Yangi Bo‘lim Qo‘shish
            </Button>
          </Tooltip>

          <Tooltip content={!isSuperAdmin ? 'Faqat Tizim Bosh Administratori (SUPER_ADMIN) xona qo‘sha oladi' : undefined}>
            <Button
              type="primary"
              icon={<IconPlus />}
              style={{ borderRadius: 0 }}
              disabled={!isSuperAdmin}
              onClick={() => setIsCreateRoomOpen(true)}
            >
              Yangi Xona Qo‘shish
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Informative Banner for non-admin roles (Read-only State) */}
      {!isSuperAdmin && (
        <Alert
          type="info"
          showIcon
          title="Tashkiliy Tuzilma (Ko‘rish Rejimi)"
          content="Universitet tashkiliy tuzilmasi, bo‘limlar va auditoriyalarni o‘zgartirish huquqi faqat Tizim Super Adminida mavjud. Siz ushbu sahifadan ma’lumotlarni ko‘rish va monitoring qilish rejimida foydalanmoqdasiz."
        />
      )}

      {/* Error Alert State */}
      {isError && (
        <Alert
          type="error"
          showIcon
          title="Xatolik yuz berdi"
          content="Tashkiliy tuzilma ma’lumotlarini yuklashda server bilan bog‘lanishda xatolik yuz berdi."
          action={
            <Button size="mini" type="primary" status="danger" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          }
        />
      )}

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
                  <span style={{ fontWeight: 600 }}>Universitet Iyerarxiyasi</span>
                </Space>
              }
            >
              {/* Controls Toolbar inside Card Body */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Radio.Group
                    type="button"
                    size="mini"
                    value={treeViewMode}
                    onChange={(val) => {
                      setTreeViewMode(val);
                      setExpandedKeys(val === 'BUILDING_FIRST' ? ['root-university'] : ['root-dept']);
                      setSelectedKey(val === 'BUILDING_FIRST' ? 'root-university' : 'root-dept');
                    }}
                    options={[
                      { label: 'Bino ➔ Xonalar', value: 'BUILDING_FIRST' },
                      { label: 'Fakultet ➔ Kafedra', value: 'DEPARTMENT_FIRST' },
                    ]}
                  />

                  <Space size="small">
                    <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      Akkordeon:
                    </span>
                    <Switch
                      size="small"
                      checked={accordionMode}
                      onChange={(val) => setAccordionMode(val)}
                    />
                  </Space>
                </div>

                <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                  {treeViewMode === 'BUILDING_FIRST'
                    ? 'Tartib: Bino ➔ Fakultet / Bo‘lim ➔ Kafedra ➔ Xona'
                    : 'Tartib: Fakultet ➔ Kafedra ➔ Xonalar'}
                  {accordionMode && ' • Ixcham rejim faol'}
                </div>
              </div>

              <Tree
                treeData={treeData}
                selectedKeys={selectedKey ? [selectedKey] : []}
                expandedKeys={expandedKeys}
                onExpand={handleExpand}
                actionOnClick={['select', 'expand']}
                blockNode
                onSelect={(keys) => {
                  if (keys && keys.length > 0) {
                    setSelectedKey(keys[0]);
                  }
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
                        <Space wrap style={{ marginBottom: 6 }}>
                          <Tag color="arcoblue" style={{ borderRadius: 0 }}>
                            {selectedRoom.building} • {selectedRoom.floor}-qavat
                          </Tag>
                          {isUnnumberedRoom(selectedRoom) && (
                            <Tag color="gold" style={{ borderRadius: 0, fontWeight: 600 }}>
                              Raqamsiz Auditoriya/Xona
                            </Tag>
                          )}
                          {selectedRoom.departmentName && (
                            <Tag color="green" style={{ borderRadius: 0 }}>
                              {selectedRoom.departmentName}
                            </Tag>
                          )}
                        </Space>
                        <Title heading={4} style={{ margin: 0 }}>
                          {getRoomDisplayName(selectedRoom)}
                        </Title>
                      </div>

                      <Space wrap>
                        <Tooltip content={canTransferRoom ? 'Xona va jihozlar javobgarligini topshirish (OS-1)' : 'Faqat Komendant yoki Super Admin uchun'}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<IconSwap />}
                            style={{ borderRadius: 0 }}
                            disabled={!canTransferRoom}
                            onClick={() => setTransferringRoom(selectedRoom)}
                          >
                            Xona javobgarligini topshirish
                          </Button>
                        </Tooltip>
                        <Tooltip content={isSuperAdmin ? 'Xonani tahrirlash' : 'Tahrirlash faqat Super Admin uchun'}>
                          <Button
                            size="small"
                            type="secondary"
                            icon={<IconEdit />}
                            style={{ borderRadius: 0 }}
                            disabled={!isSuperAdmin}
                            onClick={() => setEditingRoom(selectedRoom)}
                          >
                            Tahrirlash
                          </Button>
                        </Tooltip>
                        {roomAssets.length > 0 ? (
                          <Tooltip content={`Xonada ${roomAssets.length} ta ashyo mavjud! Avval ashyolarni boshqa xonaga ko‘chiring`}>
                            <Button
                              size="small"
                              status="danger"
                              icon={<IconDelete />}
                              disabled
                              style={{ borderRadius: 0 }}
                            >
                              O‘chirish
                            </Button>
                          </Tooltip>
                        ) : (
                          <Popconfirm
                            title={
                              isUnnumberedRoom(selectedRoom)
                                ? `'${selectedRoom.name}' xonasini o‘chirishni tasdiqlaysizmi?`
                                : `'${selectedRoom.number}-xona (${selectedRoom.name})'ni o‘chirishni tasdiqlaysizmi?`
                            }
                            okText="Ha, o‘chirilsin"
                            cancelText="Bekor qilish"
                            disabled={!isSuperAdmin}
                            onOk={() => {
                              deleteRoomMutation.mutate(selectedRoom.id, {
                                onSuccess: () => {
                                  setSelectedKey('root-university');
                                },
                              });
                            }}
                          >
                            <Tooltip content={isSuperAdmin ? 'Xonani o‘chirish' : 'O‘chirish faqat Super Admin uchun'}>
                              <Button
                                size="small"
                                status="danger"
                                icon={<IconDelete />}
                                style={{ borderRadius: 0 }}
                                disabled={!isSuperAdmin}
                              >
                                O‘chirish
                              </Button>
                            </Tooltip>
                          </Popconfirm>
                        )}
                      </Space>
                    </div>

                    {/* Room Quick Stats Grid */}
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={[12, 12]}>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Joriy Mas’ul Shaxs (MOL)
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: selectedRoom.responsibleUserName ? '#165DFF' : '#F53F3F' }}>
                              {selectedRoom.responsibleUserName || 'Biriktirilmagan'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                              {selectedRoom.responsibleUserPhone ? `Tel: ${selectedRoom.responsibleUserPhone}` : 'Aloqa ma’lumoti yo‘q'}
                            </div>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Xonadagi Jihozlar
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#00B42A' }}>
                              {roomAssets.length} ta aktiv
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                              {roomAssets.filter((a) => a.status === 'IN_USE').length} ta foydalanishda
                            </div>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Joylashuv & Bo‘lim
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#FF7D00' }}>
                              {selectedRoom.building} • {selectedRoom.floor}-qavat
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                              {selectedRoom.departmentName || 'Kafedra biriktirilmagan'}
                            </div>
                          </Card>
                        </Col>
                      </Row>
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

                    <StandardTable
                      rowKey="id"
                      pagination={false}
                      data={roomAssets}
                      columns={roomAssetColumns}
                      scrollX={600}
                      emptyText="Bu xonada hozircha asosiy vositalar mavjud emas"
                    />
                  </div>
                </div>
              ) : selectedDepartment ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-2)', paddingBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <Space wrap style={{ marginBottom: 6 }}>
                          <Tag
                            color={departmentTypeColors[selectedDepartment.type] || 'arcoblue'}
                            style={{ borderRadius: 0, fontWeight: 600 }}
                          >
                            {departmentTypeLabels[selectedDepartment.type] || selectedDepartment.type}
                          </Tag>
                          {selectedDepartment.parent && (
                            <Tag color="purple" style={{ borderRadius: 0 }}>
                              Yuqori bo‘lim: {selectedDepartment.parent.name}
                            </Tag>
                          )}
                        </Space>
                        <Title heading={4} style={{ margin: 0 }}>
                          {selectedDepartment.name}
                        </Title>
                      </div>

                      <Space wrap>
                        <Tooltip content={isSuperAdmin ? 'Bo‘limni tahrirlash' : 'Tahrirlash faqat Super Admin uchun'}>
                          <Button
                            size="small"
                            type="secondary"
                            icon={<IconEdit />}
                            style={{ borderRadius: 0 }}
                            disabled={!isSuperAdmin}
                            onClick={() => setEditingDept(selectedDepartment)}
                          >
                            Tahrirlash
                          </Button>
                        </Tooltip>
                        {isSuperAdmin && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<IconPlus />}
                            style={{ borderRadius: 0 }}
                            onClick={() => {
                              setPresetDeptId(selectedDepartment.id);
                              setIsCreateRoomOpen(true);
                            }}
                          >
                            Xona Biriktirish
                          </Button>
                        )}
                      </Space>
                    </div>

                    {/* Department Quick Stats Grid */}
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={[12, 12]}>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Biriktirilgan Xonalar
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>
                              {selectedDeptRooms.length} ta
                            </div>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Xodimlar Soni
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#00B42A' }}>
                              {selectedDepartment._count?.users || 0} nafar
                            </div>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Asosiy Vositalar
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#FF7D00' }}>
                              {selectedDeptAssetsCount} ta
                            </div>
                          </Card>
                        </Col>
                      </Row>
                    </div>
                  </div>

                  {/* Rooms list or Empty State */}
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
                        Bo‘limga biriktirilgan auditoriya va xizmat xonalari ({selectedDeptRooms.length} ta)
                      </span>
                    </div>

                    {selectedDeptRooms.length > 0 ? (
                      <StandardTable
                        rowKey="id"
                        pagination={{ pageSize: 8 }}
                        data={selectedDeptRooms}
                        columns={[
                          {
                            title: 'Xona / Auditoriya',
                            render: (_: any, r: RoomItem) => (
                              <CategoryThumbnail
                                icon={<IconHome />}
                                name={getRoomDisplayName(r)}
                                subtitle={`${r.building || 'Bosh bino'} • ${r.floor}-qavat`}
                                tag={isUnnumberedRoom(r) ? 'Raqamsiz' : undefined}
                                color="#165DFF"
                                bg="#E8F3FF"
                              />
                            ),
                          },
                          {
                            title: 'Mas’ul Shaxs (MOL)',
                            render: (_: any, r: RoomItem) => (
                              <span style={{ fontSize: 13, fontWeight: 500 }}>
                                {r.responsibleUserName || (
                                  <Tag size="small" color="red" style={{ borderRadius: 0 }}>
                                    MOL belgilanmagan
                                  </Tag>
                                )}
                              </span>
                            ),
                          },
                          {
                            title: 'Ashyolar',
                            render: (_: any, r: RoomItem) => (
                              <Tag color="cyan" style={{ borderRadius: 0, fontWeight: 600 }}>
                                {r.itemCount || 0} ta aktiv
                              </Tag>
                            ),
                          },
                          {
                            title: 'Amallar',
                            width: 150,
                            render: (_: any, r: RoomItem) => (
                              <Space size={6}>
                                <Tooltip content="Xona ma’lumotlari va ashyolarini ko‘rish">
                                  <Button
                                    size="mini"
                                    type="primary"
                                    style={{ borderRadius: 0 }}
                                    onClick={() => setSelectedKey(r.id)}
                                  >
                                    Ko‘rish
                                  </Button>
                                </Tooltip>
                                <Tooltip content={canTransferRoom ? 'Xona va jihozlar javobgarligini topshirish (OS-1)' : 'Faqat Komendant yoki Super Admin uchun'}>
                                  <Button
                                    size="mini"
                                    type="outline"
                                    icon={<IconSwap />}
                                    style={{ borderRadius: 0 }}
                                    disabled={!canTransferRoom}
                                    onClick={() => setTransferringRoom(r)}
                                  />
                                </Tooltip>
                                {(r.itemCount || 0) > 0 ? (
                                  <Tooltip content={`Xonada ${r.itemCount} ta ashyo bor! Avval ashyolarni ko‘chiring`}>
                                    <Button
                                      size="mini"
                                      status="danger"
                                      icon={<IconDelete />}
                                      disabled
                                      style={{ borderRadius: 0 }}
                                    />
                                  </Tooltip>
                                ) : (
                                  <Popconfirm
                                    title={
                                      isUnnumberedRoom(r)
                                        ? `'${r.name}' xonasini o‘chirishni tasdiqlaysizmi?`
                                        : `'${r.number}-xona'ni o‘chirishni tasdiqlaysizmi?`
                                    }
                                    okText="Ha"
                                    cancelText="Yo‘q"
                                    disabled={!isSuperAdmin}
                                    onOk={() => deleteRoomMutation.mutate(r.id)}
                                  >
                                    <Tooltip content={isSuperAdmin ? 'O‘chirish' : 'Faqat Super Admin uchun'}>
                                      <Button
                                        size="mini"
                                        status="danger"
                                        icon={<IconDelete />}
                                        style={{ borderRadius: 0 }}
                                        disabled={!isSuperAdmin}
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                )}
                              </Space>
                            ),
                          },
                        ]}
                        scrollX={600}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                        <Empty
                          description={`Ushbu bo‘limga (${selectedDepartment.name}) hozircha xonalar biriktirilmagan`}
                        />
                        {isSuperAdmin && (
                          <Button
                            type="primary"
                            icon={<IconPlus />}
                            style={{ borderRadius: 0, marginTop: 12 }}
                            onClick={() => {
                              setPresetDeptId(selectedDepartment.id);
                              setIsCreateRoomOpen(true);
                            }}
                          >
                            Ushbu bo‘limga yangi xona qo‘shish
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedBuilding ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-2)', paddingBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <Space wrap style={{ marginBottom: 6 }}>
                          <Tag color="green" style={{ borderRadius: 0, fontWeight: 600 }}>
                            {selectedBuilding.floorsCount} qavatli bino
                          </Tag>
                        </Space>
                        <Title heading={4} style={{ margin: 0 }}>
                          {selectedBuilding.name}
                        </Title>
                        <Text type="secondary">{selectedBuilding.address || 'Manzil ko‘rsatilmagan'}</Text>
                      </div>

                      <Space wrap>
                        <Tooltip content={isSuperAdmin ? 'Binoni tahrirlash' : 'Tahrirlash faqat Super Admin uchun'}>
                          <Button
                            size="small"
                            type="secondary"
                            icon={<IconEdit />}
                            style={{ borderRadius: 0 }}
                            disabled={!isSuperAdmin}
                            onClick={() => setEditingBuilding(selectedBuilding)}
                          >
                            Binoni Tahrirlash
                          </Button>
                        </Tooltip>
                        {isSuperAdmin && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<IconPlus />}
                            style={{ borderRadius: 0 }}
                            onClick={() => {
                              setPresetBuildingId(selectedBuilding.id);
                              setIsCreateRoomOpen(true);
                            }}
                          >
                            Xona Qo‘shish
                          </Button>
                        )}
                      </Space>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <CategoryThumbnail
                        icon={<IconUser />}
                        name={selectedBuilding.commendant?.fullName || 'Komendant Tayinlanmagan'}
                        subtitle={
                          selectedBuilding.commendant
                            ? `Aloqa: ${selectedBuilding.commendant.phone || selectedBuilding.commendant.username || '—'} | ${selectedBuilding.commendant.position || 'Komendant'}`
                            : 'Ushbu binoga mas’ul komendant biriktirilmagan'
                        }
                        tag="Bino Komendanti"
                        color={selectedBuilding.commendant ? '#00B42A' : '#86909C'}
                        bg={selectedBuilding.commendant ? '#E8FFEA' : '#F2F3F5'}
                      />
                    </div>

                    {/* Building Quick Stats Grid */}
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={[12, 12]}>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Jami Auditoriyalar
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>
                              {selectedBuildingRooms.length} ta
                            </div>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Omborlar Soni
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#00B42A' }}>
                              {selectedBuilding._count?.warehouses || 0} ta
                            </div>
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                              Asosiy Vositalar
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#FF7D00' }}>
                              {selectedBuildingAssetsCount} ta
                            </div>
                          </Card>
                        </Col>
                      </Row>
                    </div>

                    {/* Attached Departments and Faculties Section */}
                    {(() => {
                      const buildingDepts = allDepartments.filter((d) => d.buildingId === selectedBuilding.id);
                      return (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                              Binoda Joylashgan Fakultet va Bo‘limlar ({buildingDepts.length} ta):
                            </span>
                            {isSuperAdmin && (
                              <Button
                                size="mini"
                                type="text"
                                icon={<IconEdit />}
                                style={{ borderRadius: 0, padding: 0 }}
                                onClick={() => setEditingBuilding(selectedBuilding)}
                              >
                                Fakultet/Bo‘limlarni biriktirish
                              </Button>
                            )}
                          </div>
                          {buildingDepts.length > 0 ? (
                            <Space wrap size={[8, 8]}>
                              {buildingDepts.map((d) => (
                                <Tag
                                  key={d.id}
                                  color={departmentTypeColors[d.type] || 'arcoblue'}
                                  style={{ borderRadius: 0, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                                  onClick={() => setSelectedKey(`dep-${d.id}`)}
                                >
                                  <IconBranch style={{ marginRight: 4 }} />
                                  {d.name} ({departmentTypeLabels[d.type] || d.type})
                                </Tag>
                              ))}
                            </Space>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Hozircha ushbu binoga alohida fakultet yoki bo‘lim biriktirilmagan. "Binoni Tahrirlash" orqali biriktirishingiz mumkin.
                            </Text>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Rooms list or Empty */}
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
                        Binodagi barcha xonalar va auditoriyalar ({selectedBuildingRooms.length} ta)
                      </span>
                    </div>

                    {selectedBuildingRooms.length > 0 ? (
                      <StandardTable
                        rowKey="id"
                        pagination={{ pageSize: 8 }}
                        data={selectedBuildingRooms}
                        columns={[
                          {
                            title: 'Xona / Auditoriya',
                            render: (_: any, r: RoomItem) => (
                              <CategoryThumbnail
                                icon={<IconHome />}
                                name={getRoomDisplayName(r)}
                                subtitle={`${r.floor}-qavat • ${r.departmentName || 'Bo‘lim belgilanmagan'}`}
                                tag={isUnnumberedRoom(r) ? 'Raqamsiz' : undefined}
                                color="#00B42A"
                                bg="#E8FFEA"
                              />
                            ),
                          },
                          {
                            title: 'Mas’ul Shaxs (MOL)',
                            render: (_: any, r: RoomItem) => (
                              <span style={{ fontSize: 13, fontWeight: 500 }}>
                                {r.responsibleUserName || (
                                  <Tag size="small" color="red" style={{ borderRadius: 0 }}>
                                    MOL belgilanmagan
                                  </Tag>
                                )}
                              </span>
                            ),
                          },
                          {
                            title: 'Ashyolar',
                            render: (_: any, r: RoomItem) => (
                              <Tag color="arcoblue" style={{ borderRadius: 0, fontWeight: 600 }}>
                                {r.itemCount || 0} ta aktiv
                              </Tag>
                            ),
                          },
                          {
                            title: 'Amallar',
                            width: 150,
                            render: (_: any, r: RoomItem) => (
                              <Space size={6}>
                                <Tooltip content="Xona ma’lumotlari va ashyolarini ko‘rish">
                                  <Button
                                    size="mini"
                                    type="primary"
                                    style={{ borderRadius: 0 }}
                                    onClick={() => setSelectedKey(r.id)}
                                  >
                                    Ko‘rish
                                  </Button>
                                </Tooltip>
                                <Tooltip content={canTransferRoom ? 'Xona va jihozlar javobgarligini topshirish (OS-1)' : 'Faqat Komendant yoki Super Admin uchun'}>
                                  <Button
                                    size="mini"
                                    type="outline"
                                    icon={<IconSwap />}
                                    style={{ borderRadius: 0 }}
                                    disabled={!canTransferRoom}
                                    onClick={() => setTransferringRoom(r)}
                                  />
                                </Tooltip>
                                {(r.itemCount || 0) > 0 ? (
                                  <Tooltip content={`Xonada ${r.itemCount} ta ashyo bor! Avval ashyolarni ko‘chiring`}>
                                    <Button
                                      size="mini"
                                      status="danger"
                                      icon={<IconDelete />}
                                      disabled
                                      style={{ borderRadius: 0 }}
                                    />
                                  </Tooltip>
                                ) : (
                                  <Popconfirm
                                    title={
                                      isUnnumberedRoom(r)
                                        ? `'${r.name}' xonasini o‘chirishni tasdiqlaysizmi?`
                                        : `'${r.number}-xona'ni o‘chirishni tasdiqlaysizmi?`
                                    }
                                    okText="Ha"
                                    cancelText="Yo‘q"
                                    disabled={!isSuperAdmin}
                                    onOk={() => deleteRoomMutation.mutate(r.id)}
                                  >
                                    <Tooltip content={isSuperAdmin ? 'O‘chirish' : 'Faqat Super Admin uchun'}>
                                      <Button
                                        size="mini"
                                        status="danger"
                                        icon={<IconDelete />}
                                        style={{ borderRadius: 0 }}
                                        disabled={!isSuperAdmin}
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                )}
                              </Space>
                            ),
                          },
                        ]}
                        scrollX={600}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                        <Empty
                          description={`Ushbu binoda (${selectedBuilding.name}) hozircha xonalar mavjud emas`}
                        />
                        {isSuperAdmin && (
                          <Button
                            type="primary"
                            icon={<IconPlus />}
                            style={{ borderRadius: 0, marginTop: 12 }}
                            onClick={() => {
                              setPresetBuildingId(selectedBuilding.id);
                              setIsCreateRoomOpen(true);
                            }}
                          >
                            Ushbu binoga yangi xona qo‘shish
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-2)', paddingBottom: 16 }}>
                    <Title heading={4} style={{ margin: 0 }}>
                      Universitet Tashkiliy Iyerarxiyasi va Hududiy Boshqaruv
                    </Title>
                  </div>

                  {/* University Statistics */}
                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 14 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                          Jami Binolar va Korpuslar
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#00B42A' }}>
                          {buildings.length} ta bino
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                          Hududiy o‘quv va ma’muriy binolar
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 14 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                          Fakultet va Bo‘limlar
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#165DFF' }}>
                          {allDepartments.length} ta
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                          {facultiesCount} ta fakultet, {chairsCount} ta kafedra va bo‘limlar
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 14 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                          Jami Auditoriyalar va Xonalar
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#722ED1' }}>
                          {totalRoomsCount} ta
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                          Shundan {roomsWithMolCount} tasida MOL tayinlangan
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card style={{ background: 'var(--color-fill-2)', borderRadius: 0, padding: 14 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                          Biriktirilgan Asosiy Vositalar
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#FF7D00' }}>
                          {assets.length} ta aktiv
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                          Universitet balansidagi barcha inventarlar
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* TAB 2: BUILDINGS TABLE */}
      {activeTab === 'BUILDINGS' && (
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
                  placeholder="Bino nomi, kodi, manzili yoki komendant..."
                  style={{ width: 340, borderRadius: 0 }}
                  value={buildingSearch}
                  onChange={setBuildingSearch}
                  allowClear
                />
              </Space>

              <Button
                icon={<IconDownload />}
                style={{ borderRadius: 0 }}
                onClick={() => {
                  const data = filteredBuildings.map((b) => ({
                    'Bino Nomi': b.name,
                    'Bino Kodi': b.code || '-',
                    'Qavatlar Soni': b.floorsCount,
                    'Manzili': b.address || '-',
                    'Komendant': b.commendant?.fullName || 'Tayinlanmagan',
                    'Komendant Aloqa': b.commendant?.phone || '-',
                    'Xonalar Soni': b._count?.rooms || 0,
                    'Omborlar Soni': b._count?.warehouses || 0,
                  }));
                  exportToExcel(data, 'Universitet_Binolari_Reestri');
                }}
              >
                Excelga Eksport
              </Button>
            </div>
          </Card>

          <StandardTable<BuildingItem>
            rowKey="id"
            columns={buildingColumns}
            data={filteredBuildings}
            loading={isLoading}
            scrollX={1100}
            emptyText={
              buildingSearch
                ? 'Qidiruv bo‘yicha bino topilmadi'
                : 'Binolar ro‘yxati bo‘sh. Yangi bino qo‘shishingiz mumkin.'
            }
            pagination={{
              pageSize: 10,
            }}
          />
        </div>
      )}

      {/* TAB 3: DEPARTMENTS TABLE */}
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

          <StandardTable<DepartmentItem>
            rowKey="id"
            columns={departmentColumns}
            data={filteredDepartments}
            loading={isLoading}
            scrollX={1050}
            emptyText={
              deptSearch || deptTypeFilter !== 'ALL'
                ? 'Tanlangan parametrlar bo‘yicha bo‘limlar topilmadi'
                : 'Bo‘limlar va kafedralar ro‘yxati bo‘sh'
            }
            pagination={{
              pageSize: 10,
            }}
          />
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

          <StandardTable<RoomItem>
            rowKey="id"
            columns={roomColumns}
            data={filteredRooms}
            loading={isLoading}
            scrollX={1150}
            onRowClick={(record) => {
              setSelectedKey(record.id);
              setActiveTab('TREE');
            }}
            emptyText={
              roomSearch || roomBuildingFilter !== 'ALL'
                ? 'Tanlangan parametrlar bo‘yicha auditoriyalar topilmadi'
                : 'Auditoriyalar va xonalar ro‘yxati bo‘sh'
            }
            pagination={{
              pageSize: 10,
            }}
          />
        </div>
      )}

      {/* MODALS */}
      <CreateBuildingModal
        visible={isCreateBuildingOpen}
        onClose={() => setIsCreateBuildingOpen(false)}
      />

      <EditBuildingModal
        visible={!!editingBuilding}
        building={editingBuilding}
        onClose={() => setEditingBuilding(null)}
      />

      <CreateDepartmentModal
        visible={isCreateDeptOpen}
        onClose={() => {
          setIsCreateDeptOpen(false);
          setPresetBuildingId(undefined);
          setPresetDeptId(undefined);
        }}
        defaultBuildingId={presetBuildingId}
        defaultParentId={presetDeptId}
      />

      <EditDepartmentModal
        visible={!!editingDept}
        department={editingDept}
        onClose={() => setEditingDept(null)}
      />

      <CreateRoomModal
        visible={isCreateRoomOpen}
        onClose={() => {
          setIsCreateRoomOpen(false);
          setPresetBuildingId(undefined);
          setPresetDeptId(undefined);
        }}
        defaultBuildingId={presetBuildingId}
        defaultDepartmentId={presetDeptId}
      />

      <EditRoomModal
        visible={!!editingRoom}
        room={editingRoom}
        onClose={() => setEditingRoom(null)}
      />

      <TransferRoomModal
        visible={!!transferringRoom}
        room={transferringRoom}
        onClose={() => setTransferringRoom(null)}
      />
    </div>
  );
};
