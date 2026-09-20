import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spin } from '@arco-design/web-react';
import { useAuthStore } from '../store/authStore';
import { NAVIGATION_ITEMS } from '../constants/navigation.constants';
import { ForbiddenView } from '../components/Common/ForbiddenView';
import type { RoleType } from '../types';

export interface ProtectedRouteProps {
  allowedRoles?: RoleType[];
  redirectTo?: string;
  showForbiddenPage?: boolean;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  redirectTo,
  showForbiddenPage = true,
  children,
}) => {
  const { isAuthenticated, token, user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
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
      if (redirectTo) {
        return <Navigate to={redirectTo} replace />;
      }

      if (showForbiddenPage) {
        return <ForbiddenView requiredRoles={roles} />;
      }

      return <Navigate to="/dashboard" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};

export const RoleRoute = ProtectedRoute;
