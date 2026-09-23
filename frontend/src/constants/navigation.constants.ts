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
    key: 'inbox',
    path: '/inbox',
    label: 'Vazifalarim',
    pageTitle: 'Mening Vazifalarim (Action Center)',
  },
  {
    key: 'assets',
    path: '/assets',
    label: 'Asosiy Vositalar',
    pageTitle: 'Asosiy Vositalar va Reestr Boshqaruvi',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'AUDITOR', 'CHIEF_ACCOUNTANT', 'COMMENDANT', 'RECTOR', 'VICE_RECTOR_FINANCE'],
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
    key: 'depreciation',
    path: '/depreciation',
    label: 'Amortizatsiya',
    pageTitle: 'Amortizatsiya va Qoldiq Qiymat Dvigateli (Depreciation Engine)',
    allowedRoles: ['SUPER_ADMIN', 'CHIEF_ACCOUNTANT', 'VICE_RECTOR_FINANCE', 'AUDITOR'],
  },
  {
    key: 'chiefAccountantLedger',
    path: '/reports/chief-accountant',
    label: 'Bosh Hisobchi Daftari',
    pageTitle: 'Bosh Hisobchi Davlat Hisobotlari va Reestrlari (OS-1, OS-2, UzASBO, 1C)',
    allowedRoles: ['SUPER_ADMIN', 'CHIEF_ACCOUNTANT', 'VICE_RECTOR_FINANCE', 'RECTOR', 'HEAD_WAREHOUSE'],
  },
  {
    key: 'fundingReports',
    path: '/reports/funding',
    label: 'Manbalar Hisoboti',
    pageTitle: 'Moliyalashtirish Manbalari Kesimidagi Hisobotlar',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'CHIEF_ACCOUNTANT', 'VICE_RECTOR_FINANCE', 'RECTOR'],
  },
  {
    key: 'audit',
    path: '/audit',
    label: 'Audit & Skaner',
    pageTitle: 'QR-Kod orqali Tezkor Inventarizatsiya',
    allowedRoles: ['AUDITOR', 'SUPER_ADMIN', 'HEAD_WAREHOUSE', 'RECTOR', 'VICE_RECTOR_FINANCE'],
  },
  {
    key: 'auditCampaigns',
    path: '/audit-campaigns',
    label: 'Audit Rejalari',
    pageTitle: 'Rejali Inventarizatsiya Kampaniyalari',
    allowedRoles: ['AUDITOR', 'SUPER_ADMIN', 'HEAD_WAREHOUSE', 'RECTOR', 'VICE_RECTOR_FINANCE', 'CHIEF_ACCOUNTANT'],
  },
  {
    key: 'organization',
    path: '/organization',
    label: 'Tashkiliy Tuzilma',
    pageTitle: 'Tashkiliy Tuzilma: Fakultetlar, Kafedralar va Xonalar',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'MOL', 'AUDITOR', 'CHIEF_ACCOUNTANT', 'COMMENDANT', 'RECTOR', 'VICE_RECTOR_FINANCE'],
  },
  {
    key: 'quotas',
    path: '/quotas',
    label: 'Kafedralar va Bo‘limlar Kvotasi',
    pageTitle: 'Kafedralar va Bo‘limlar Oylik Sarf Kvotalari Nazorati',
    allowedRoles: ['VICE_RECTOR_FINANCE', 'SUPER_ADMIN'],
  },
  {
    key: 'systemAudit',
    path: '/system-audit',
    label: 'Tizim Auditi',
    pageTitle: 'Tizim Xavfsizlik va Amallar Audit Jurnali',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    key: 'integrations',
    path: '/integrations',
    label: 'Integratsiyalar',
    pageTitle: 'HEMIS va 1C / UzASBO Integratsiya Shlyuzi',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    key: 'suppliers',
    path: '/suppliers',
    label: 'Ta’minotchilar',
    pageTitle: 'Ta’minotchilar va Kontragentlar Shartnomalari',
    allowedRoles: ['SUPER_ADMIN', 'HEAD_WAREHOUSE', 'CHIEF_ACCOUNTANT', 'AUDITOR'],
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
