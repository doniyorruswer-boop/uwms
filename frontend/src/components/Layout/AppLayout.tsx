import React, { useState } from 'react';
import { Layout, Menu, Button, Tag, Avatar, Tooltip, Space, Popconfirm, Input, Dropdown } from '@arco-design/web-react';
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
  IconCloud,
  IconStorage,
  IconCloudDownload,
  IconUserGroup,
  IconIdcard,
  IconSearch,
  IconPlus,
  IconExclamationCircleFill,
} from '@arco-design/web-react/icon';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { RoleType } from '../../types';
import { AppLogo } from '../Common/AppLogo';
import { APP_CONFIG, ROLE_CONFIG, getPageTitleByPath, DESIGN_TOKENS } from '../../constants';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const MenuItem = Menu.Item;
const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isDarkMode, toggleDarkMode, logout } = useAuthStore();
  const { t } = useTranslation();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const currentTab = location.pathname.replace('/', '') || 'dashboard';

  const getTranslatedTitle = (pathname: string) => {
    const clean = pathname.replace('/', '');
    switch (clean) {
      case 'dashboard':
        return t('menu.dashboard');
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
      case 'backups':
        return t('menu.backups');
      case 'users':
        return t('menu.users');
      default:
        return getPageTitleByPath(pathname);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* SIDER */}
      <Sider
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsible
        trigger={null}
        breakpoint="xl"
        width={250}
        style={{
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

        <Menu
          selectedKeys={[currentTab]}
          onClickMenuItem={(key) => navigate(`/${key}`)}
          style={{ width: '100%', marginTop: '12px' }}
        >
          <MenuItem key="dashboard">
            <IconDashboard />
            {t('menu.dashboard')}
          </MenuItem>
          <MenuItem key="assets">
            <IconDesktop />
            {t('menu.assets')}
          </MenuItem>
          <MenuItem key="warehouse">
            <IconArchive />
            {t('menu.warehouse')}
          </MenuItem>
          <MenuItem key="suppliers">
            <IconIdcard />
            {t('menu.suppliers')}
          </MenuItem>
          <MenuItem key="movements">
            <IconSwap />
            {t('menu.movements')}
          </MenuItem>
          <MenuItem key="requests">
            <IconFile />
            {t('menu.requests')}
          </MenuItem>
          <MenuItem key="repairs">
            <IconTool />
            {t('menu.repairs')}
          </MenuItem>
          <MenuItem key="write-offs">
            <IconDelete />
            {t('menu.writeOffs')}
          </MenuItem>
          <MenuItem key="organization">
            <IconBranch />
            {t('menu.organization')}
          </MenuItem>
          <MenuItem key="quotas">
            <IconStorage />
            {t('menu.quotas')}
          </MenuItem>
          <MenuItem key="system-audit">
            <IconSafe />
            {t('menu.audit')}
          </MenuItem>
          <MenuItem key="integrations">
            <IconCloud />
            {t('menu.integrations')}
          </MenuItem>
          <MenuItem key="audit">
            <IconScan />
            {t('menu.scanner')}
          </MenuItem>
          {user?.role === 'SUPER_ADMIN' && (
            <MenuItem key="users">
              <IconUserGroup />
              {t('menu.users')}
            </MenuItem>
          )}
          {user?.role === 'SUPER_ADMIN' && (
            <MenuItem key="backups">
              <IconCloudDownload />
              {t('menu.backups')}
            </MenuItem>
          )}
        </Menu>
      </Sider>

      {/* MAIN CONTAINER */}
      <Layout style={{ minWidth: 0, overflow: 'hidden' }}>
        {/* HEADER */}
        <Header
          className="uwms-header"
          style={{
            height: '64px',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
          <Space size="medium" style={{ flex: 1, maxWidth: 520, margin: '0 24px' }}>
            <Input.Search
              placeholder="Inventar № yoki QR kod... (Enter)"
              allowClear
              searchButton={false}
              prefix={<IconSearch style={{ color: 'var(--color-text-3)' }} />}
              onSearch={(value) => {
                const trimmed = value?.trim();
                if (trimmed) {
                  navigate(`/assets?search=${encodeURIComponent(trimmed)}`);
                }
              }}
              onPressEnter={(e: any) => {
                const val = e.target.value?.trim();
                if (val) {
                  navigate(`/assets?search=${encodeURIComponent(val)}`);
                }
              }}
              style={{ width: '100%', borderRadius: 0 }}
            />

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

          <Space size="medium" style={{ flexShrink: 0 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
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
            padding: '24px',
            backgroundColor: 'var(--bg-color)',
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth: 0,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

