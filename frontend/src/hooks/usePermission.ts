import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { RoleType } from '../types';

export const usePermission = () => {
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === RoleType.SUPER_ADMIN;

  const permissionsSet = useMemo(() => {
    return new Set(user?.permissions || []);
  }, [user?.permissions]);

  const hasCustomPermissions = Boolean(user?.permissions && user.permissions.length > 0);

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (hasCustomPermissions) {
      return permissionsSet.has(code);
    }
    // Agar foydalanuvchida shaxsiy ruxsatlar o'rnatilmagan bo'lsa, rol bo'yicha ruxsat beriladi
    return true;
  };

  const hasAnyPermission = (codes: string[]): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (hasCustomPermissions) {
      return codes.some((code) => permissionsSet.has(code));
    }
    return true;
  };

  const hasAllPermissions = (codes: string[]): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (hasCustomPermissions) {
      return codes.every((code) => permissionsSet.has(code));
    }
    return true;
  };

  const canAccessPage = (pageCode: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const formattedCode = pageCode.startsWith('page:') ? pageCode : `page:${pageCode}`;
    if (hasCustomPermissions) {
      return permissionsSet.has(formattedCode);
    }
    return true;
  };

  return {
    isSuperAdmin,
    hasCustomPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessPage,
  };
};
