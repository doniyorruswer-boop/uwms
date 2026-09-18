import type { RoleType } from '../types';

/**
 * UWMS — Navigatsiya va Menyu Boshqaruvi
 */

export interface NavItem {
  key: string;
  path: string;
  label: string;
  pageTitle: string;
  allowedRoles?: RoleType[];
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    label: 'Bosh Panel',
    pageTitle: 'Dashboard — Umumiy Tahlil va Ko‘rsatkichlar',
  },
  {
    key: 'assets',
    path: '/assets',
    label: 'Asosiy Vositalar',
    pageTitle: 'Asosiy Vositalar va Reestr Boshqaruvi',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'AUDITOR'],
  },
  {
    key: 'warehouse',
    path: '/warehouse',
    label: 'Ombor Qoldiqlari',
    pageTitle: 'Sarflanuvchi Materiallar Ombori',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE'],
  },
  {
    key: 'movements',
    path: '/movements',
    label: 'Harakatlar Tarixi',
    pageTitle: 'Tranzaksiyalar va Harakatlar Jurnali',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'AUDITOR'],
  },
  {
    key: 'requests',
    path: '/requests',
    label: 'Talabnomalar',
    pageTitle: 'Talabnomalar va Ehtiyojlar Oqimi',
  },
  {
    key: 'repairs',
    path: '/repairs',
    label: 'Ta’mirlash & Servis',
    pageTitle: 'Ta’mirlash va Texnik Servis Jurnali',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL'],
  },
  {
    key: 'write-offs',
    path: '/write-offs',
    label: 'Spisanie (OS-4)',
    pageTitle: 'Hisobdan Chiqarish Komissiyasi (OS-4 Spisanie)',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'AUDITOR'],
  },
  {
    key: 'audit',
    path: '/audit',
    label: 'Audit & Skaner',
    pageTitle: 'QR-Kod orqali Tezkor Inventarizatsiya',
    allowedRoles: ['SUPER_ADMIN', 'AUDITOR'],
  },
  {
    key: 'organization',
    path: '/organization',
    label: 'Tashkiliy Tuzilma',
    pageTitle: 'Tashkiliy Tuzilma: Fakultetlar, Kafedralar va Xonalar',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'AUDITOR'],
  },
  {
    key: 'quotas',
    path: '/quotas',
    label: 'Kafedralar Kvotasi',
    pageTitle: 'Kafedralar Oylik Kantselyariya va Material Limitlari',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE'],
  },
  {
    key: 'systemAudit',
    path: '/system-audit',
    label: 'Tizim Auditi',
    pageTitle: 'Tizim Xavfsizlik va Amallar Audit Jurnali',
    allowedRoles: ['SUPER_ADMIN', 'AUDITOR'],
  },
  {
    key: 'integrations',
    path: '/integrations',
    label: 'Integratsiyalar',
    pageTitle: 'HEMIS va 1C / UzASBO Integratsiya Shlyuzi',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'AUDITOR'],
  },
  {
    key: 'suppliers',
    path: '/suppliers',
    label: 'Ta’minotchilar',
    pageTitle: 'Ta’minotchilar va Kontragentlar Shartnomalari',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'AUDITOR'],
  },
  {
    key: 'users',
    path: '/users',
    label: 'Foydalanuvchilar',
    pageTitle: 'Foydalanuvchilar va Kirish Huquqlari Boshqaruvi',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    key: 'backups',
    path: '/backups',
    label: 'Zaxira Nusxalari (Backup)',
    pageTitle: 'Ma’lumotlar Bazasi Zaxira Nusxalari va Qayta Tiklash (Disaster Recovery)',
    allowedRoles: ['SUPER_ADMIN'],
  },
];

export const getPageTitleByPath = (pathname: string): string => {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const found = NAVIGATION_ITEMS.find((item) => item.path === cleanPath);
  return found ? found.pageTitle : 'UWMS Boshqaruv Tizimi';
};
