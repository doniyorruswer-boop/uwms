/**
 * UWMS — Markazlashtirilgan Backend API Yo‘llari (Endpoints)
 * apiClient baseURL (/api) ga nisbatan barcha URLlar bitta joydan olinadi.
 */

export const API_ENDPOINTS = {
  // Autentifikatsiya va Profil
  AUTH: {
    LOGIN: '/auth/login',
    PROFILE: '/auth/profile',
    REFRESH: '/auth/refresh',
  },

  // Boshqaruv Tahlili (Dashboard Analytics)
  DASHBOARD: {
    ANALYTICS: '/dashboard/analytics',
  },

  // Foydalanuvchilar
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    STATUS: (id: string) => `/users/${id}/status`,
    RESET_PASSWORD: (id: string) => `/users/${id}/reset-password`,
    ASSETS: (id: string) => `/users/${id}/assets`,
  },

  // Tashkiliy tuzilma (Fakultetlar, Kafedralar, Xonalar)
  ORGANIZATION: {
    TREE: '/organization/tree',
    DEPARTMENTS: '/organization/departments',
    DEPARTMENT_BY_ID: (id: string) => `/organization/departments/${id}`,
    ROOMS: '/organization/rooms',
    ROOM_BY_ID: (id: string) => `/organization/rooms/${id}`,
  },

  // Nomenklatura va Katalog
  ITEMS: {
    BASE: '/items',
    CATEGORIES: '/items/categories',
    BY_ID: (id: string) => `/items/${id}`,
  },

  // Asosiy vositalar (Inventar)
  ASSETS: {
    BASE: '/assets',
    BY_ID: (id: string) => `/assets/${id}`,
    BATCH: '/assets/batch',
    BATCH_TRANSFER: '/assets/batch-transfer',
    IMPORT_EXCEL: '/assets/import-excel',
    HISTORY: (id: string) => `/assets/${id}/history`,
    TRANSFER: (id: string) => `/assets/${id}/transfer`,
    WRITE_OFF: (id: string) => `/assets/${id}/write-off`,
    TRANSFERS: '/assets/transfers',
    TRANSFERS_PENDING: '/assets/transfers/pending',
    TRANSFER_ACCEPT: (id: string) => `/assets/transfers/${id}/accept`,
    TRANSFER_REJECT: (id: string) => `/assets/transfers/${id}/reject`,
    TRANSFER_RESPOND: (id: string) => `/assets/transfers/${id}/respond`,
    RETURN: '/assets/return',
    MASS_MOL_HANDOFF: '/assets/mass-mol-handoff',
  },

  // Talabnomalar (Zayavkalar)
  REQUESTS: {
    BASE: '/requests',
    BY_ID: (id: string) => `/requests/${id}`,
    STATUS: (id: string) => `/requests/${id}/status`,
    APPROVE: (id: string) => `/requests/${id}/approve`,
    FULFILL: (id: string) => `/requests/${id}/fulfill`,
    REJECT: (id: string) => `/requests/${id}/reject`,
  },

  // Ombor va Sarflanuvchi materiallar
  WAREHOUSE: {
    STOCKS: '/warehouse/stocks',
    INGEST: '/warehouse/ingest',
    TRANSFER: '/warehouse/transfer',
    REPLENISH: (id: string) => `/warehouse/stocks/${id}/replenish`,
    MOVEMENTS: '/warehouse/movements',
    WAREHOUSES: '/organization/warehouses',
    USERS: '/organization/users',
  },

  // Ta'mirlash va Servis Jurnali
  REPAIRS: {
    BASE: '/repairs',
    BY_ID: (id: string) => `/repairs/${id}`,
    STATUS: (id: string) => `/repairs/${id}/status`,
  },

  // Hisobdan Chiqarish Komissiyasi (OS-4)
  WRITE_OFFS: {
    BASE: '/write-offs',
    BY_ID: (id: string) => `/write-offs/${id}`,
    VOTE: (id: string) => `/write-offs/${id}/vote`,
  },

  // QR Inventarizatsiya va Audit
  AUDITS: {
    BASE: '/audits',
    BY_ID: (id: string) => `/audits/${id}`,
    START: '/audits/start',
    SCAN: '/audits/scan',
  },

  // Ta'minotchilar
  SUPPLIERS: {
    BASE: '/suppliers',
    STATS: '/suppliers/stats',
    BY_ID: (id: string) => `/suppliers/${id}`,
    INVOICES: (id: string) => `/suppliers/${id}/invoices`,
    NEXT_CODES: '/suppliers/next-codes',
  },

  // Bildirishnomalar (Notifications)
  NOTIFICATIONS: {
    BASE: '/notifications',
    READ_ALL: '/notifications/read-all',
    READ_BY_ID: (id: string) => `/notifications/${id}/read`,
  },

  // Kafedralar Kvotasi (Quotas)
  QUOTAS: {
    BASE: '/quotas',
    CHECK: '/quotas/check',
    BY_ID: (id: string) => `/quotas/${id}`,
  },

  // Tizim Xavfsizlik Audit Jurnali
  SYSTEM_AUDIT: {
    BASE: '/system-audit',
  },

  // Hujjatlar Raqamli Muhr & Public Verifikatsiya
  DOCUMENT_STAMPS: {
    BASE: '/document-stamps',
    PUBLIC_VERIFY: (docNumber: string) => `/public/verify-doc/${encodeURIComponent(docNumber)}`,
  },

  // HEMIS va 1C / UzASBO Integratsiyalari
  INTEGRATIONS: {
    HEMIS_STATUS: '/integrations/hemis/status',
    HEMIS_SYNC: '/integrations/hemis/sync',
    UZASBO_EXPORT: '/integrations/uzasbo/export',
  },

  // Zaxira Nusxalari (Backups)
  BACKUPS: {
    BASE: '/backups',
    STATS: '/backups/stats',
    BY_ID: (id: string) => `/backups/${id}`,
    RESTORE: (id: string) => `/backups/${id}/restore`,
    DOWNLOAD: (id: string) => `/backups/${id}/download`,
  },
} as const;

