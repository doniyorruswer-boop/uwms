import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@arco-design/web-react';
import {
  IconHome,
  IconClockCircle,
  IconScan,
  IconUser,
} from '@arco-design/web-react/icon';
import { useInboxQuery } from '../../hooks/useInboxQuery';

interface MobileBottomNavProps {
  onOpenProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenProfile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: inbox } = useInboxQuery({ refetchInterval: 60000 });
  const pendingCount = inbox?.summary?.totalPendingCount || 0;

  const pathname = location.pathname;

  const isDashboardActive = pathname === '/' || pathname === '/dashboard';
  const isInboxActive = pathname === '/inbox';
  const isScannerActive = pathname === '/audit';

  const navItems = [
    {
      key: 'dashboard',
      label: 'Asosiy',
      icon: <IconHome style={{ fontSize: 20 }} />,
      active: isDashboardActive,
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'inbox',
      label: 'Vazifalar',
      icon: (
        <Badge count={pendingCount} dot={false} maxCount={99} offset={[4, -2]}>
          <IconClockCircle style={{ fontSize: 20 }} />
        </Badge>
      ),
      active: isInboxActive,
      onClick: () => navigate('/inbox'),
    },
    {
      key: 'scanner',
      label: 'QR Skaner',
      icon: <IconScan style={{ fontSize: 20 }} />,
      active: isScannerActive,
      onClick: () => navigate('/audit'),
    },
    {
      key: 'profile',
      label: 'Profil',
      icon: <IconUser style={{ fontSize: 20 }} />,
      active: false,
      onClick: onOpenProfile,
    },
  ];

  return (
    <div
      className="uwms-mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'var(--color-bg-2, #FFFFFF)',
        borderTop: '1px solid var(--color-border-2, #E5E6EB)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 999,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
      }}
    >
      {navItems.map((item) => {
        const color = item.active ? 'var(--color-primary-6, #165DFF)' : 'var(--color-text-3, #86909C)';
        return (
          <button
            key={item.key}
            onClick={item.onClick}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 0',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              cursor: 'pointer',
              color,
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: item.active ? 600 : 400,
                color,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
