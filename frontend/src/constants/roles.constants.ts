import type { RoleType } from '../types';

/**
 * UWMS — Markazlashtirilgan Rollar va Huquqlar Konfiguratsiyasi (RBAC Matrix)
 */

export interface RoleMeta {
  code: RoleType;
  label: string;
  description: string;
  color: string;
  allowedRoutes: string[];
}

export const ROLE_CONFIG: Record<RoleType, RoleMeta> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Tizim to‘liq ma’muri va barcha modullarni nazorat qiluvchi',
    color: 'red',
    allowedRoutes: ['/dashboard', '/assets', '/warehouse', '/movements', '/requests', '/organization', '/audit'],
  },
  HEAD_WAREHOUSE: {
    code: 'HEAD_WAREHOUSE',
    label: 'Bosh Omborchi',
    description: 'Universitet markaziy ombori, tovar harakati va talabnomalar ijrochisi',
    color: 'arcoblue',
    allowedRoutes: ['/dashboard', '/assets', '/warehouse', '/movements', '/requests', '/organization'],
  },
  MOL: {
    code: 'MOL',
    label: 'MOL (Moddiy Javobgar Shaxs)',
    description: 'Kafedra mudiri yoki laboratoriya mas’ul xodimi',
    color: 'green',
    allowedRoutes: ['/dashboard', '/assets', '/requests', '/organization'],
  },
  AUDITOR: {
    code: 'AUDITOR',
    label: 'Ichki Auditor',
    description: 'Inventarizatsiya nazorati va solishtirma aktlar komissiyasi a’zosi',
    color: 'gold',
    allowedRoutes: ['/dashboard', '/assets', '/audit', '/movements', '/organization'],
  },
  EMPLOYEE: {
    code: 'EMPLOYEE',
    label: 'Xodim / O‘qituvchi',
    description: 'Kafedra xodimi, kantselyariya va jihoz talabnoma beruvchisi',
    color: 'purple',
    allowedRoutes: ['/dashboard', '/requests'],
  },
  CHIEF_ACCOUNTANT: {
    code: 'CHIEF_ACCOUNTANT',
    label: 'Bosh Hisobchi',
    description: 'Moliyalashtirish, manba va sub-hisoblar nazorati',
    color: 'magenta',
    allowedRoutes: ['/dashboard', '/requests', '/assets', '/warehouse', '/reports', '/organization'],
  },
  COMMENDANT: {
    code: 'COMMENDANT',
    label: 'Bino Komendanti',
    description: 'Bino bo‘yicha ashyolar qabuli va xonalarga taqsimoti',
    color: 'orange',
    allowedRoutes: ['/dashboard', '/requests', '/assets', '/organization'],
  },
  RECTOR: {
    code: 'RECTOR',
    label: 'Universitet Rektori',
    description: 'Xaridlar va yirik moddiy qarorlarga yakuniy viza beruvchi',
    color: 'red',
    allowedRoutes: ['/dashboard', '/requests', '/assets', '/audit', '/reports', '/organization'],
  },
  VICE_RECTOR_FINANCE: {
    code: 'VICE_RECTOR_FINANCE',
    label: 'Moliya Prorektori',
    description: 'Moliya-iqtisodiyot va smeta nazorati bo‘yicha 1-viza',
    color: 'cyan',
    allowedRoutes: ['/dashboard', '/requests', '/assets', '/reports', '/organization'],
  },
};

/**
 * Foydalanuvchi berilgan yo'nalishga kirish huquqiga egaligini tekshirish
 */
export const hasRoutePermission = (role: RoleType | undefined, path: string): boolean => {
  if (!role) return false;
  const config = ROLE_CONFIG[role];
  if (!config) return false;
  // Exact match or prefix match
  return config.allowedRoutes.some((route) => path === route || path.startsWith(`${route}/`));
};
