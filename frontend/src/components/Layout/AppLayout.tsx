import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Tag, Avatar, Tooltip, Space, Popconfirm, Input, Dropdown, Badge } from '@arco-design/web-react';
import {
  IconDashboard,
  IconDesktop,
  IconArchive,
  IconSwap,
  IconFile,
  IconScan,
  IconBranch,
  IconMoon,
  IconSun,
  IconUser,
  IconMenuFold,
  IconMenuUnfold,
  IconPoweroff,
  IconTool,
  IconDelete,
  IconSafe,
  IconBook,
  IconTags,
  IconCloud,
  IconStorage,
  IconCloudDownload,
  IconUserGroup,
  IconIdcard,
  IconSearch,
  IconPlus,
  IconExclamationCircleFill,
  IconCalendar,
  IconCompass,
  IconClockCircle,
} from '@arco-design/web-react/icon';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useInboxQuery } from '../../hooks/useInboxQuery';
import type { RoleType } from '../../types';
import { AppLogo } from '../Common/AppLogo';
import { APP_CONFIG, ROLE_CONFIG, getPageTitleByPath, DESIGN_TOKENS, NAVIGATION_ITEMS } from '../../constants';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ForcePasswordChangeModal } from '../Auth/ForcePasswordChangeModal';
import { GlobalSearchModal } from '../Search/GlobalSearchModal';
import { useTranslation } from 'react-i18next';

const MenuItem = Menu.Item;
const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 992 : false,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isDarkMode, toggleDarkMode, logout } = useAuthStore();
  const { t } = useTranslation();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const { data: inbox } = useInboxQuery({ refetchInterval: 60000 });
  const pendingTasksCount = inbox?.summary?.totalPendingCount || 0;

  // Auto-collapse sidebar on resize for tablets & mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 992) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchModalVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentTab = location.pathname.replace('/', '') || 'dashboard';

  const hasRoleAccess = (keyOrPath: string) => {
    const item = NAVIGATION_ITEMS.find(
      (n) => n.key === keyOrPath || n.path === `/${keyOrPath}`,
    );
    if (!item || !item.allowedRoles || item.allowedRoles.length === 0) return true;
    return user?.role ? item.allowedRoles.includes(user.role) : false;
  };

  const getTranslatedTitle = (pathname: string) => {
    const clean = pathname.replace('/', '');
    switch (clean) {
      case 'dashboard':
        return t('menu.dashboard');
      case 'inbox':
        return t('menu.inbox', 'Vazifalarim');
      case 'assets':
        return t('menu.assets');
      case 'warehouse':
        return t('menu.warehouse');
      case 'suppliers':
        return t('menu.suppliers');
      case 'movements':
        return t('menu.movements');
      case 'requests':
        return t('menu.requests');
      case 'repairs':
        return t('menu.repairs');
      case 'write-offs':
        return t('menu.writeOffs');
      case 'depreciation':
        return t('menu.depreciation', 'Amortizatsiya');
      case 'reports/chief-accountant':
        return t('menu.chiefAccountantLedger', 'Bosh Hisobchi Daftari');
      case 'reports/funding':
        return t('menu.fundingReports', 'Manbalar Hisoboti');
      case 'organization':
        return t('menu.organization');
      case 'quotas':
        return t('menu.quotas');
      case 'system-audit':
        return t('menu.audit');
      case 'integrations':
        return t('menu.integrations');
      case 'audit':
        return t('menu.scanner');
      case 'audit-campaigns':
        return t('menu.auditCampaigns');
      case 'backups':
        return t('menu.backups');
      case 'users':
        return t('menu.users');
      default:
        return getPageTitleByPath(pathname);
    }
  };

  return (
    <Layout style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* SIDER */}
      <Sider
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsible
        trigger={null}
        breakpoint="xl"
        width={250}
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 8px 0 rgba(29,33,41,0.05)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: '1px solid var(--color-border-1)',
            cursor: 'pointer',
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'all 0.2s cubic-bezier(0.34, 0.69, 0.1, 1)',
          }}
          onClick={() => navigate('/dashboard')}
        >
          <AppLogo
            size={32}
            showText={!collapsed}
            textTitle="UWMS Tizimi"
            subtitle="Universitet Ombori"
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Menu
            selectedKeys={[currentTab]}
            onClickMenuItem={(key) => navigate(`/${key}`)}
            style={{ width: '100%', marginTop: '12px' }}
          >
          {hasRoleAccess('dashboard') && (
            <MenuItem key="dashboard">
              <IconDashboard />
              {t('menu.dashboard')}
            </MenuItem>
          )}
          <MenuItem key="inbox">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconClockCircle />
                {t('menu.inbox', 'Vazifalarim')}
              </span>
              {pendingTasksCount > 0 && (
                <Badge count={pendingTasksCount} maxCount={99} />
              )}
            </div>
          </MenuItem>
          {hasRoleAccess('assets') && (
            <MenuItem key="assets">
              <IconDesktop />
              {t('menu.assets')}
            </MenuItem>
          )}
          {hasRoleAccess('warehouse') && (
            <MenuItem key="warehouse">
              <IconArchive />
              {t('menu.warehouse')}
            </MenuItem>
          )}
          {hasRoleAccess('suppliers') && (
            <MenuItem key="suppliers">
              <IconIdcard />
              {t('menu.suppliers')}
            </MenuItem>
          )}
          {hasRoleAccess('movements') && (
            <MenuItem key="movements">
              <IconSwap />
              {t('menu.movements')}
            </MenuItem>
          )}
          {hasRoleAccess('requests') && (
            <MenuItem key="requests">
              <IconFile />
              {t('menu.requests')}
            </MenuItem>
          )}
          {hasRoleAccess('repairs') && (
            <MenuItem key="repairs">
              <IconTool />
              {t('menu.repairs')}
            </MenuItem>
          )}
          {hasRoleAccess('write-offs') && (
            <MenuItem key="write-offs">
              <IconDelete />
              {t('menu.writeOffs')}
            </MenuItem>
          )}
          {hasRoleAccess('depreciation') && (
            <MenuItem key="depreciation">
              <IconCompass />
              {t('menu.depreciation', 'Amortizatsiya')}
            </MenuItem>
          )}
          {hasRoleAccess('chiefAccountantLedger') && (
            <MenuItem key="reports/chief-accountant">
              <IconBook />
              {t('menu.chiefAccountantLedger', 'Bosh Hisobchi Daftari')}
            </MenuItem>
          )}
          {hasRoleAccess('fundingReports') && (
            <MenuItem key="reports/funding">
              <IconTags />
              {t('menu.fundingReports', 'Manbalar Hisoboti')}
            </MenuItem>
          )}
          {hasRoleAccess('organization') && (
            <MenuItem key="organization">
              <IconBranch />
              {t('menu.organization')}
            </MenuItem>
          )}
          {hasRoleAccess('quotas') && (
            <MenuItem key="quotas">
              <IconStorage />
              {t('menu.quotas')}
            </MenuItem>
          )}
          {hasRoleAccess('systemAudit') && (
            <MenuItem key="system-audit">
              <IconSafe />
              {t('menu.audit')}
            </MenuItem>
          )}
          {hasRoleAccess('integrations') && (
            <MenuItem key="integrations">
              <IconCloud />
              {t('menu.integrations')}
            </MenuItem>
          )}
          {hasRoleAccess('audit') && (
            <MenuItem key="audit">
              <IconScan />
              {t('menu.scanner')}
            </MenuItem>
          )}
          {hasRoleAccess('auditCampaigns') && (
            <MenuItem key="audit-campaigns">
              <IconCalendar />
              {t('menu.auditCampaigns')}
            </MenuItem>
          )}
          {hasRoleAccess('users') && (
            <MenuItem key="users">
              <IconUserGroup />
              {t('menu.users')}
            </MenuItem>
          )}
          {hasRoleAccess('backups') && (
            <MenuItem key="backups">
              <IconCloudDownload />
              {t('menu.backups')}
            </MenuItem>
          )}
        </Menu>
        </div>
      </Sider>

      {/* MAIN CONTAINER */}
      <Layout style={{ minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* HEADER */}
        <Header
          className="uwms-header"
          style={{
            height: '64px',
            flexShrink: 0,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 9,
          }}
        >
          <Space size="large" style={{ flexShrink: 0 }}>
            <Button
              type="text"
              icon={collapsed ? <IconMenuUnfold /> : <IconMenuFold />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '18px' }}
            />
            <div style={{ fontWeight: 600, fontSize: '16px' }}>
              {getTranslatedTitle(location.pathname)}
            </div>
          </Space>

          {/* Universal Quick Search & Quick Action Menu (Snipe-IT Pattern) */}
          <Space size="medium" className="uwms-header-search" style={{ flex: 1, maxWidth: 520, margin: '0 24px' }}>
            <div
              onClick={() => setSearchModalVisible(true)}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              <Input
                placeholder="Qidirish... (Inventar №, xona, foydalanuvchi)"
                prefix={<IconSearch style={{ color: 'var(--color-text-3)' }} />}
                suffix={
                  <Tag size="small" style={{ backgroundColor: 'var(--color-fill-3)', cursor: 'pointer' }}>
                    Ctrl + K
                  </Tag>
                }
                readOnly
                style={{ width: '100%', cursor: 'pointer', borderRadius: 0 }}
              />
            </div>

            {(user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE' || user?.role === 'MOL' || user?.role === 'EMPLOYEE') && (
              <Dropdown
                trigger="click"
                position="br"
                droplist={
                  <Menu style={{ borderRadius: 0, minWidth: 210 }}>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE') && (
                      <Menu.Item key="new-asset" onClick={() => navigate('/assets?action=create')}>
                        <Space><IconDesktop /> Yangi Asosiy Vosita</Space>
                      </Menu.Item>
                    )}
                    <Menu.Item key="new-request" onClick={() => navigate('/requests?action=create')}>
                      <Space><IconFile /> Yangi Talabnoma</Space>
                    </Menu.Item>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE') && (
                      <Menu.Item key="new-incoming" onClick={() => navigate('/warehouse?action=incoming')}>
                        <Space><IconArchive /> Ombor Kirim Hujjati</Space>
                      </Menu.Item>
                    )}
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'HEAD_WAREHOUSE') && (
                      <Menu.Item key="new-supplier" onClick={() => navigate('/suppliers?action=create')}>
                        <Space><IconIdcard /> Yangi Ta’minotchi</Space>
                      </Menu.Item>
                    )}
                    {user?.role === 'SUPER_ADMIN' && (
                      <Menu.Item key="new-room" onClick={() => navigate('/organization?action=room')}>
                        <Space><IconBranch /> Yangi Xona / Auditoriya</Space>
                      </Menu.Item>
                    )}
                  </Menu>
                }
              >
                <Button
                  type="primary"
                  icon={<IconPlus />}
                  style={{ borderRadius: 0, whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  Yangi
                </Button>
              </Dropdown>
            )}
          </Space>

          <Space size="medium" className="uwms-header-actions" style={{ flexShrink: 0 }}>
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Dark mode switch */}
            <Tooltip content={isDarkMode ? t('header.lightMode') : t('header.darkMode')}>
              <Button
                shape="circle"
                type="secondary"
                icon={isDarkMode ? <IconSun /> : <IconMoon />}
                onClick={toggleDarkMode}
              />
            </Tooltip>

            {/* Notification Center Popover */}
            <NotificationPopover />

            <div style={{ width: 1, height: 20, backgroundColor: 'var(--color-border-2)', margin: '0 4px' }} />

            {/* User profile */}
            <Space size="small">
              <Avatar size={34} style={{ backgroundColor: '#165DFF', borderRadius: 0 }}>
                <IconUser />
              </Avatar>
              <div className="uwms-header-user-info" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{user?.fullName || 'Foydalanuvchi'}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                  {user?.departmentName || 'Markaziy Bo‘lim'}
                </span>
              </div>
            </Space>

            {/* Logout button */}
            <Tooltip
              content={logoutConfirmOpen ? null : 'Tizimdan chiqish (Logout)'}
              popupVisible={logoutConfirmOpen ? false : undefined}
            >
              <Popconfirm
                popupVisible={logoutConfirmOpen}
                onVisibleChange={setLogoutConfirmOpen}
                title={<span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)' }}>Tizimdan chiqish</span>}
                content={
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>
                    Haqiqatan ham o‘z hisobingizdan chiqmoqchimisiz?
                  </div>
                }
                position="br"
                icon={<IconExclamationCircleFill style={{ color: '#F53F3F', fontSize: 16 }} />}
                onOk={logout}
                okText="Ha, chiqish"
                cancelText="Bekor qilish"
                okButtonProps={{ status: 'danger', type: 'primary', style: { borderRadius: 0 } }}
                cancelButtonProps={{ style: { borderRadius: 0 } }}
                style={{ width: 280, borderRadius: 0 }}
              >
                <Button shape="circle" status="danger" type="secondary" icon={<IconPoweroff />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        </Header>

        {/* CONTENT */}
        <Content
          style={{
            flex: 1,
            padding: '24px',
            backgroundColor: 'var(--bg-color)',
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* Majburiy Parol O‘zgartirish Modali (Xavfsizlik talabi) */}
      <ForcePasswordChangeModal visible={!!user?.mustChangePassword} />

      {/* Global Command Palette Search Modal (Ctrl + K) */}
      <GlobalSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
      />
    </Layout>
  );
};

