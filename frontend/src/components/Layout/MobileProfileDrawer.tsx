import React from 'react';
import { Drawer, Avatar, Typography, Button, Space, Divider, Tag, Popconfirm } from '@arco-design/web-react';
import {
  IconUser,
  IconPoweroff,
  IconSun,
  IconMoon,
  IconExclamationCircleFill,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '../../store/authStore';
import { formatRoleName } from '../../constants/roles.constants';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

interface MobileProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  visible,
  onClose,
}) => {
  const { user, isDarkMode, toggleDarkMode, logout } = useAuthStore();
  const { t } = useTranslation();

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <Drawer
      title="Foydalanuvchi Profili"
      visible={visible}
      placement="bottom"
      height="auto"
      onOk={onClose}
      onCancel={onClose}
      footer={null}
      style={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxWidth: 500,
        margin: '0 auto',
      }}
    >
      <div style={{ padding: '8px 4px 20px 4px' }}>
        {/* User Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 16,
            backgroundColor: 'var(--color-fill-2)',
            borderRadius: 8,
          }}
        >
          <Avatar
            size={56}
            style={{
              backgroundColor: '#165DFF',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            <IconUser />
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <Title
              heading={5}
              style={{
                margin: '0 0 4px 0',
                fontSize: 16,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.fullName || 'Foydalanuvchi'}
            </Title>
            <div style={{ marginBottom: 4 }}>
              <Tag color="blue" size="small">
                {formatRoleName(user?.role)}
              </Tag>
            </div>
            <Text
              type="secondary"
              style={{
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.departmentName || 'Universitet Markaziy Bo‘limi'}
            </Text>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* Quick Preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Theme Switcher */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isDarkMode ? <IconMoon style={{ fontSize: 18 }} /> : <IconSun style={{ fontSize: 18 }} />}
              <Text bold style={{ fontSize: 14 }}>
                Mavzu (Tungi rejim)
              </Text>
            </div>
            <Button
              size="small"
              type="secondary"
              onClick={toggleDarkMode}
              style={{ borderRadius: 6 }}
            >
              {isDarkMode ? 'Yorug‘ rejim' : 'Tungi rejim'}
            </Button>
          </div>

          {/* Language */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 4px',
            }}
          >
            <Text bold style={{ fontSize: 14 }}>
              Tizim tili
            </Text>
            <LanguageSwitcher />
          </div>
        </div>

        <Divider style={{ margin: '20px 0 16px 0' }} />

        {/* Big Exit / Logout Button */}
        <Popconfirm
          title="Tizimdan chiqish"
          content="Haqiqatan ham o‘z hisobingizdan chiqmoqchimisiz?"
          position="top"
          icon={<IconExclamationCircleFill style={{ color: '#F53F3F', fontSize: 16 }} />}
          onOk={handleLogout}
          okText="Ha, chiqish"
          cancelText="Bekor qilish"
          okButtonProps={{ status: 'danger', type: 'primary', style: { borderRadius: 6 } }}
          cancelButtonProps={{ style: { borderRadius: 6 } }}
        >
          <Button
            type="primary"
            status="danger"
            long
            size="large"
            icon={<IconPoweroff />}
            style={{
              height: 48,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Tizimdan Chiqish (Chiqish)
          </Button>
        </Popconfirm>
      </div>
    </Drawer>
  );
};
