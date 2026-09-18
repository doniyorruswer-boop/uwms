import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Message, Spin } from '@arco-design/web-react';
import { useAuthStore } from '../store/authStore';
import { NAVIGATION_ITEMS } from '../constants/navigation.constants';
import type { RoleType } from '../types';

export interface ProtectedRouteProps {
  allowedRoles?: RoleType[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, token, user, isLoading } = useAuthStore();
  const location = useLocation();
  const lastWarnedPath = useRef<string | null>(null);

  if (isLoading && !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin dot size={32} tip="Yuklanmoqda..." />
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 1. Check if allowedRoles is explicitly passed as prop
  let roles = allowedRoles;

  // 2. If not passed as prop, dynamically resolve from NAVIGATION_ITEMS based on current path
  if (!roles) {
    const currentSegment = location.pathname.split('/')[1] || '';
    const currentPath = `/${currentSegment}`;
    const navItem = NAVIGATION_ITEMS.find(
      (item) => item.path === currentPath || item.key === currentSegment,
    );
    roles = navItem?.allowedRoles;
  }

  // 3. If route requires specific roles, verify user.role
  if (roles && roles.length > 0) {
    const isAllowed = user?.role ? roles.includes(user.role) : false;
    if (!isAllowed) {
      if (lastWarnedPath.current !== location.pathname) {
        lastWarnedPath.current = location.pathname;
        Message.warning('Ushbu sahifaga kirish uchun sizda yetarli ruxsat mavjud emas!');
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
