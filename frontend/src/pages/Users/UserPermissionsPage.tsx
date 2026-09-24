import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Input,
  Tag,
  Switch,
  Grid,
  Typography,
  Divider,
  Alert,
  Spin,
  Progress,
  Modal,
  Select,
  Tooltip,
  Badge,
  Result,
  Message,
} from '@arco-design/web-react';
import {
  IconArrowLeft,
  IconSave,
  IconRefresh,
  IconSearch,
  IconCopy,
  IconCheck,
  IconClose,
  IconSafe,
  IconApps,
  IconDesktop,
  IconArchive,
  IconIdcard,
  IconSwap,
  IconFile,
  IconTool,
  IconDelete,
  IconCompass,
  IconBook,
  IconScan,
  IconCalendar,
  IconBranch,
  IconTags,
  IconUserGroup,
  IconClockCircle,
  IconDashboard,
  IconCloudDownload,
  IconSettings,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import {
  useUserPermissionsQuery,
  useUpdateUserPermissionsMutation,
} from '../../hooks/useUserPermissionsQuery';
import { useUsersQuery } from '../../hooks/useUsersQuery';
import { RoleType, type PermissionModule, type PermissionItem, type UserPermissionsData } from '../../types';
import { ForbiddenView } from '../../components/Common/ForbiddenView';
import { apiClient } from '../../api/client';
import { API_ENDPOINTS } from '../../constants';

const { Row, Col } = Grid;
const { Title, Text, Paragraph } = Typography;

const roleTagColors: Record<RoleType, string> = {
  [RoleType.SUPER_ADMIN]: 'red',
  [RoleType.HEAD_WAREHOUSE]: 'blue',
  [RoleType.MOL]: 'gold',
  [RoleType.AUDITOR]: 'purple',
  [RoleType.EMPLOYEE]: 'gray',
  [RoleType.CHIEF_ACCOUNTANT]: 'cyan',
  [RoleType.COMMENDANT]: 'orange',
  [RoleType.RECTOR]: 'magenta',
  [RoleType.VICE_RECTOR_FINANCE]: 'arcoblue',
};

const roleLabels: Record<RoleType, string> = {
  [RoleType.SUPER_ADMIN]: 'Bosh Administrator',
  [RoleType.HEAD_WAREHOUSE]: 'Bosh Ombor Mudiri',
  [RoleType.MOL]: 'Moddiy Javobgar Shaxs (MOL)',
  [RoleType.AUDITOR]: 'Ichki Auditor',
  [RoleType.EMPLOYEE]: 'Xodim / O‘qituvchi',
  [RoleType.CHIEF_ACCOUNTANT]: 'Bosh Hisobchi',
  [RoleType.COMMENDANT]: 'Bino Komendanti',
  [RoleType.RECTOR]: 'Universitet Rektori',
  [RoleType.VICE_RECTOR_FINANCE]: 'Moliya Prorektori',
};

const moduleIcons: Record<string, React.ReactNode> = {
  dashboard: <IconDashboard style={{ color: '#165DFF' }} />,
  inbox: <IconClockCircle style={{ color: '#722ED1' }} />,
  assets: <IconDesktop style={{ color: '#00B42A' }} />,
  warehouse: <IconArchive style={{ color: '#FF7D00' }} />,
  suppliers: <IconIdcard style={{ color: '#0FC6C2' }} />,
  movements: <IconSwap style={{ color: '#165DFF' }} />,
  requests: <IconFile style={{ color: '#F7BA1E' }} />,
  repairs: <IconTool style={{ color: '#F53F3F' }} />,
  write_offs: <IconDelete style={{ color: '#F53F3F' }} />,
  depreciation: <IconCompass style={{ color: '#722ED1' }} />,
  reports: <IconBook style={{ color: '#00B42A' }} />,
  audit: <IconScan style={{ color: '#165DFF' }} />,
  organization: <IconBranch style={{ color: '#0FC6C2' }} />,
  quotas: <IconTags style={{ color: '#FF7D00' }} />,
  users: <IconUserGroup style={{ color: '#722ED1' }} />,
  system_audit: <IconSafe style={{ color: '#F53F3F' }} />,
  integrations: <IconApps style={{ color: '#165DFF' }} />,
  backups: <IconCloudDownload style={{ color: '#00B42A' }} />,
};

export const UserPermissionsPage: React.FC = () => {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  // Queries & Mutations
  const {
    data: permissionsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useUserPermissionsQuery(userId);

  const updateMutation = useUpdateUserPermissionsMutation(userId || '');

  // Query for cloning permissions from other users
  const { data: otherUsersData } = useUsersQuery({
    pageSize: 100,
    isActive: true,
  });

  // Selected permissions state
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Clone from user modal state
  const [cloneModalVisible, setCloneModalVisible] = useState(false);
  const [selectedSourceUserId, setSelectedSourceUserId] = useState<string>('');
  const [isCloning, setIsCloning] = useState(false);

  // Derived data from permissionsData (safe fallbacks when loading/error)
  const user = permissionsData?.user;
  const catalog = useMemo(() => permissionsData?.catalog || [], [permissionsData]);
  const defaultRolePermissions = useMemo(
    () => permissionsData?.defaultRolePermissions || [],
    [permissionsData],
  );

  // Initialize selected permissions from query data
  useEffect(() => {
    if (permissionsData) {
      const initial = new Set(permissionsData.effectivePermissions || []);
      setSelectedCodes(initial);
      setHasChanges(false);
    }
  }, [permissionsData]);

  // Calculate all available codes
  const allAvailableCodes = useMemo(() => {
    return catalog.flatMap((mod) => mod.permissions.map((p) => p.code));
  }, [catalog]);

  // Filter modules based on search query
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog;
    const q = searchQuery.toLowerCase().trim();

    return catalog
      .map((mod) => {
        const moduleMatches =
          mod.name.toLowerCase().includes(q) ||
          mod.description.toLowerCase().includes(q);

        const matchingPerms = mod.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q),
        );

        if (moduleMatches) {
          return mod;
        }

        if (matchingPerms.length > 0) {
          return {
            ...mod,
            permissions: matchingPerms,
          };
        }

        return null;
      })
      .filter(Boolean) as PermissionModule[];
  }, [catalog, searchQuery]);

  // Handler: Toggle single permission
  // Handler: Toggle single permission code
  const handleToggleCode = (code: string, mod: PermissionModule, forceState?: boolean) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(code);
      const shouldSelect = forceState !== undefined ? forceState : !isCurrentlySelected;

      if (shouldSelect) {
        next.add(code);
        if (mod.pageCode && !next.has(mod.pageCode)) {
          next.add(mod.pageCode);
        }
      } else {
        next.delete(code);
        if (code === mod.pageCode) {
          mod.permissions.forEach((p) => next.delete(p.code));
        }
      }

      setHasChanges(true);
      return next;
    });
  };

  // Handler: Master toggle for a whole module
  const handleToggleModule = (mod: PermissionModule, forceState?: boolean) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const modCodes = mod.permissions.map((p) => p.code);
      const allSelected = modCodes.length > 0 && modCodes.every((c) => next.has(c));
      const shouldSelectAll = forceState !== undefined ? forceState : !allSelected;

      if (shouldSelectAll) {
        modCodes.forEach((c) => next.add(c));
        if (mod.pageCode) {
          next.add(mod.pageCode);
        }
      } else {
        modCodes.forEach((c) => next.delete(c));
      }

      setHasChanges(true);
      return next;
    });
  };

  // Handler: Select All
  const handleSelectAll = () => {
    setSelectedCodes(new Set(allAvailableCodes));
    setHasChanges(true);
  };

  // Handler: Deselect All
  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
    setHasChanges(true);
  };

  // Handler: Reset to User's Role Default Presets
  const handleResetToRoleDefault = () => {
    if (!user) return;
    const roleName = roleLabels[user.role] || user.role;
    Modal.confirm({
      title: 'Standart rolga qaytarish',
      content: `'${user.fullName}' uchun '${roleName}' rolining barcha standart tavsiya etilgan huquqlarini tiklamoqchimisiz?`,
      okText: 'Ha, tiklash',
      cancelText: 'Bekor qilish',
      onOk: () => {
        setSelectedCodes(new Set(defaultRolePermissions || []));
        setHasChanges(true);
        Message.success(`'${roleName}' rolining standart huquqlari tiklandi`);
      },
    });
  };

  // Handler: Apply specific Role Template Preset
  const handleApplyPreset = (presetRole: RoleType) => {
    Modal.confirm({
      title: 'Rol shablonini qo‘llash',
      content: `'${roleLabels[presetRole]}' roli uchun tavsiya etilgan barcha huquqlar belgilansinmi? Hozirgi tanlovlar yangilanadi.`,
      okText: 'Qo‘llash',
      cancelText: 'Bekor qilish',
      onOk: () => {
        setSelectedCodes(new Set(defaultRolePermissions));
        setHasChanges(true);
      },
    });
  };

  // Handler: Clone permissions from another selected user
  const handleCloneFromUser = async () => {
    if (!selectedSourceUserId) {
      Message.warning('Iltimos, manba xodimni tanlang!');
      return;
    }
    try {
      setIsCloning(true);
      const res = await apiClient.get<UserPermissionsData>(
        API_ENDPOINTS.USERS.PERMISSIONS(selectedSourceUserId),
      );
      const perms = res.data?.effectivePermissions || [];
      setSelectedCodes(new Set(perms));
      setHasChanges(true);
      setCloneModalVisible(false);
      const sourceUser = otherUsersData?.items.find((u) => u.id === selectedSourceUserId);
      Message.success(
        `'${sourceUser?.fullName || 'Xodim'}' huquqlari muvaffaqiyatli nusxalandi (${perms.length} ta ruxsat)!`,
      );
    } catch (err: any) {
      Message.error(
        err.response?.data?.message || 'Xodim huquqlarini nusxalashda xatolik yuz berdi!',
      );
    } finally {
      setIsCloning(false);
    }
  };

  // Handler: Save Permissions to Server
  const handleSave = () => {
    const isMatchingDefault =
      selectedCodes.size === defaultRolePermissions.length &&
      defaultRolePermissions.every((c) => selectedCodes.has(c));

    const permsArray = isMatchingDefault ? [] : Array.from(selectedCodes);
    updateMutation.mutate(permsArray, {
      onSuccess: () => {
        setHasChanges(false);
      },
    });
  };

  // Keyboard shortcut Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCodes, hasChanges, updateMutation.isPending]);

  // RBAC protection: Only SUPER_ADMIN can configure permissions
  if (currentUser?.role !== RoleType.SUPER_ADMIN) {
    return <ForbiddenView requiredRoles={[RoleType.SUPER_ADMIN]} />;
  }

  // 1. LOADING STATE
  if (isLoading) {
    return (
      <Card style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Space direction="vertical" align="center" size="large">
          <Spin dot size={20} />
          <Text style={{ fontSize: 16, color: 'var(--color-text-2)' }}>
            Foydalanuvchi huquqlari va ruxsatlar katalogi yuklanmoqda...
          </Text>
        </Space>
      </Card>
    );
  }

  // 2. ERROR STATE
  if (isError || !permissionsData || !user) {
    return (
      <Card style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="error"
          title="Ma’lumotlarni yuklab bo‘lmadi"
          subTitle={(error as any)?.message || 'Server bilan bog‘lanishda xatolik yuz berdi.'}
          extra={[
            <Button key="back" onClick={() => navigate('/users')}>
              Xodimlar ro‘yxatiga qaytish
            </Button>,
            <Button key="retry" type="primary" icon={<IconRefresh />} onClick={() => refetch()}>
              Qayta urinish
            </Button>,
          ]}
        />
      </Card>
    );
  }

  // Calculate stats
  const totalCount = allAvailableCodes.length;
  const selectedCount = selectedCodes.size;
  const percentage = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      {/* 1. TOP NAVIGATION & USER HEADER CARD */}
      <Card
        style={{
          marginBottom: 16,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          borderRadius: 8,
        }}
      >
        <Space direction="vertical" size="medium" style={{ width: '100%' }}>
          {/* Top Row: Back Button & Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <Space size="medium">
              <Button
                icon={<IconArrowLeft />}
                onClick={() => navigate('/users')}
                style={{ borderRadius: 6 }}
              >
                Xodimlar ro‘yxati
              </Button>
              <Divider type="vertical" />
              <Title heading={5} style={{ margin: 0 }}>
                Foydalanuvchi Ruxsatlarini Boshqarish (Permissions)
              </Title>
            </Space>

            {/* Actions: Save & Presets */}
            <Space size="small">
              <Button
                icon={<IconCopy />}
                onClick={() => setCloneModalVisible(true)}
                style={{ borderRadius: 6 }}
              >
                Boshqa xodimdan nusxalash
              </Button>

              <Button
                icon={<IconRefresh />}
                onClick={handleResetToRoleDefault}
                style={{ borderRadius: 6 }}
              >
                Standart rolga qaytarish
              </Button>

              <Button
                type="primary"
                icon={<IconSave />}
                loading={updateMutation.isPending}
                disabled={!hasChanges && !updateMutation.isPending}
                onClick={handleSave}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  boxShadow: hasChanges ? '0 2px 8px rgba(22, 93, 255, 0.35)' : undefined,
                }}
              >
                Saqlash (Ctrl+S)
              </Button>
            </Space>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* User Profile Details Row */}
          <Row gutter={[16, 16]} align="center">
            <Col xs={24} sm={12} md={14}>
              <Space size="large" align="center">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--color-primary-light-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    color: 'var(--color-primary-6)',
                  }}
                >
                  <IconSafe />
                </div>
                <div>
                  <Space size="small">
                    <Title heading={6} style={{ margin: 0 }}>
                      {user.fullName}
                    </Title>
                    <Tag color={roleTagColors[user.role]} size="small" style={{ fontWeight: 600 }}>
                      {roleLabels[user.role] || user.role}
                    </Tag>
                    {permissionsData.isCustom ? (
                      <Badge status="processing" text="Maxsus ruxsatlar biriktirilgan" />
                    ) : (
                      <Badge status="default" text="Standart rol huquqlarida" />
                    )}
                  </Space>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, color: 'var(--color-text-3)', fontSize: 13 }}>
                    <span>Foydalanuvchi: <strong>@{user.username}</strong></span>
                    {user.departmentName && <span>Bo‘lim: <strong>{user.departmentName}</strong></span>}
                    {user.position && <span>Lavozim: <strong>{user.position}</strong></span>}
                  </div>
                </div>
              </Space>
            </Col>

            {/* Permissions Counter & Progress */}
            <Col xs={24} sm={12} md={10}>
              <div
                style={{
                  background: 'var(--color-fill-2)',
                  padding: '10px 16px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <Text style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    Faol Ruxsatlar Ko‘rsatkichi:
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary-6)' }}>
                    {selectedCount} / {totalCount}{' '}
                    <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-2)' }}>
                      ({percentage}%)
                    </span>
                  </div>
                </div>
                <div style={{ width: 140 }}>
                  <Progress percent={percentage} status={percentage === 100 ? 'success' : 'normal'} />
                </div>
              </div>
            </Col>
          </Row>

          {hasChanges && (
            <Alert
              type="warning"
              content="Siz ruxsatlarda o‘zgarishlar kiritdingiz. O‘zgarishlar kuchga kirishi uchun 'Saqlash' tugmasini bosing."
              style={{ marginTop: 4 }}
            />
          )}
        </Space>
      </Card>

      {/* 2. TOOLBAR: SEARCH & MASTER CONTROLS */}
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 8,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
        }}
        bodyStyle={{ padding: '12px 20px' }}
      >
        <Row justify="space-between" align="center" gutter={[16, 12]}>
          <Col xs={24} md={10}>
            <Input
              prefix={<IconSearch />}
              placeholder="Modul yoki ruxsat nomini qidirish (masalan: o‘chirish, eksport, kirim)..."
              value={searchQuery}
              onChange={setSearchQuery}
              allowClear
              style={{ borderRadius: 6 }}
            />
          </Col>

          <Col xs={24} md={14} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <Button
              size="small"
              icon={<IconCheck />}
              onClick={handleSelectAll}
              style={{ borderRadius: 4 }}
            >
              Hammasini belgilash
            </Button>
            <Button
              size="small"
              icon={<IconClose />}
              onClick={handleDeselectAll}
              style={{ borderRadius: 4 }}
            >
              Hammasini tozalash
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 3. PERMISSION MODULES LIST */}
      {filteredCatalog.length === 0 ? (
        <Card style={{ minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Space direction="vertical" align="center">
            <IconSearch style={{ fontSize: 32, color: 'var(--color-text-4)' }} />
            <Text type="secondary">'{searchQuery}' so‘rovi bo‘yicha hech qanday ruxsat topilmadi</Text>
            <Button size="small" onClick={() => setSearchQuery('')}>Qidiruvni tozalash</Button>
          </Space>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredCatalog.map((mod) => {
            const pagePerm = mod.permissions.find((p) => p.isPage);
            const isPageActive = pagePerm ? selectedCodes.has(pagePerm.code) : true;
            const actionPerms = mod.permissions.filter((p) => !p.isPage);

            const modCodes = mod.permissions.map((p) => p.code);
            const activeCountInMod = modCodes.filter((c) => selectedCodes.has(c)).length;
            const isModFullySelected = activeCountInMod === modCodes.length && modCodes.length > 0;
            const isModIndeterminate = activeCountInMod > 0 && activeCountInMod < modCodes.length;

            return (
              <Col xs={24} lg={12} key={mod.id}>
                <Card
                  bordered
                  style={{
                    height: '100%',
                    borderRadius: 8,
                    border: isPageActive ? '1px solid var(--color-border-2)' : '1px solid var(--color-border-1)',
                    background: 'var(--color-bg-2)',
                    boxShadow: isPageActive ? '0 1px 4px rgba(0, 0, 0, 0.03)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  headerStyle={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border-1)',
                    background: isPageActive ? 'var(--color-fill-1)' : 'var(--color-fill-2)',
                  }}
                  bodyStyle={{
                    padding: '14px 16px',
                  }}
                  title={
                    <Space size="small" align="center">
                      <span style={{ fontSize: 16, color: isPageActive ? 'var(--color-primary-6)' : 'var(--color-text-3)', display: 'inline-flex' }}>
                        {moduleIcons[mod.id] || <IconApps />}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{mod.name}</span>
                      <Tag size="small" color={activeCountInMod > 0 ? 'arcoblue' : 'gray'} style={{ borderRadius: 4, fontWeight: 600 }}>
                        {activeCountInMod}/{modCodes.length}
                      </Tag>
                    </Space>
                  }
                  extra={
                    <Space size="small" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <span
                        style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500, cursor: 'pointer' }}
                        onClick={() => handleToggleModule(mod, !isModFullySelected)}
                      >
                        To‘liq ruxsat
                      </span>
                      <Switch
                        size="small"
                        checked={isModFullySelected}
                        onChange={(checked) => handleToggleModule(mod, checked)}
                      />
                    </Space>
                  }
                >
                  {/* 1. Page Access Master Toggle */}
                  {pagePerm && (
                    <div
                      style={{
                        padding: '9px 12px',
                        background: isPageActive ? 'var(--color-primary-light-1)' : 'var(--color-fill-2)',
                        borderRadius: 6,
                        marginBottom: actionPerms.length > 0 ? 12 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => handleToggleCode(pagePerm.code, mod, !isPageActive)}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13, color: isPageActive ? 'var(--color-primary-6)' : 'var(--color-text-2)' }}>
                        Sahifaga kirish
                      </span>
                      <Switch
                        size="small"
                        checked={isPageActive}
                        onChange={(checked, e) => {
                          e?.stopPropagation?.();
                          handleToggleCode(pagePerm.code, mod, checked);
                        }}
                      />
                    </div>
                  )}

                  {/* 2. Granular Action Perms */}
                  {actionPerms.length > 0 && (
                    <Row gutter={[8, 8]}>
                      {actionPerms.map((perm) => {
                        const isChecked = selectedCodes.has(perm.code);
                        const isDisabled = !isPageActive;

                        return (
                          <Col xs={24} sm={12} key={perm.code}>
                            <Tooltip
                              content={perm.description || perm.name}
                              position="top"
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  padding: '7px 10px',
                                  borderRadius: 6,
                                  background: isChecked ? 'var(--color-fill-2)' : 'var(--color-fill-1)',
                                  border: `1px solid ${isChecked ? 'var(--color-primary-light-2)' : 'var(--color-border-1)'}`,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isDisabled ? 0.45 : 1,
                                  height: 38,
                                  transition: 'all 0.15s ease',
                                }}
                                onClick={() => {
                                  if (!isDisabled) {
                                    handleToggleCode(perm.code, mod, !isChecked);
                                  }
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isChecked ? 500 : 400,
                                    color: isChecked ? 'var(--color-text-1)' : 'var(--color-text-2)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {perm.name}
                                </span>
                                <Switch
                                  size="small"
                                  disabled={isDisabled}
                                  checked={isChecked}
                                  onChange={(checked, e) => {
                                    e?.stopPropagation?.();
                                    handleToggleCode(perm.code, mod, checked);
                                  }}
                                />
                              </div>
                            </Tooltip>
                          </Col>
                        );
                      })}
                    </Row>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 4. MODAL: CLONE FROM ANOTHER USER */}
      <Modal
        title="Boshqa Xodimdan Huquqlarni Nusxalash"
        visible={cloneModalVisible}
        onOk={handleCloneFromUser}
        onCancel={() => setCloneModalVisible(false)}
        okText="Nusxalash va Qo‘llash"
        cancelText="Bekor qilish"
        confirmLoading={isCloning}
        okButtonProps={{ disabled: !selectedSourceUserId, loading: isCloning }}
      >
        <Space direction="vertical" size="medium" style={{ width: '100%' }}>
          <Alert
            type="info"
            content="Tanlangan xodimning barcha ruxsatlari hozirgi foydalanuvchiga to‘liq nusxalab beriladi. O‘zgarishlar yakunlangach, 'Saqlash' tugmasi orqali tasdiqlash lozim."
          />
          <div>
            <Text style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
              Manba xodimni tanlang:
            </Text>
            <Select
              showSearch
              placeholder="Xodimni qidirish..."
              value={selectedSourceUserId}
              onChange={(val) => setSelectedSourceUserId(val)}
              style={{ width: '100%' }}
              filterOption={(inputValue, option) =>
                option.props.children
                  ? option.props.children.toString().toLowerCase().includes(inputValue.toLowerCase())
                  : false
              }
            >
              {otherUsersData?.items
                .filter((u) => u.id !== userId)
                .map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username}) — {roleLabels[u.role] || u.role}
                  </Select.Option>
                ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};
