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
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
  },

  // Boshqaruv Tahlili (Dashboard Analytics)
  DASHBOARD: {
    ANALYTICS: '/dashboard/analytics',
  },

  // Foydalanuvchilar
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    RESTORE: (id: string) => `/users/${id}/restore`,
    STATUS: (id: string) => `/users/${id}/status`,
    RESET_PASSWORD: (id: string) => `/users/${id}/reset-password`,
    ASSETS: (id: string) => `/users/${id}/assets`,
    CLEARANCE_STATUS: (id: string) => `/users/${id}/clearance-status`,
    PERMISSIONS_CATALOG: '/users/permissions/catalog',
    PERMISSIONS: (id: string) => `/users/${id}/permissions`,
  },

  // Tashkiliy tuzilma (Binolar, Fakultetlar, Kafedralar, Xonalar)
  ORGANIZATION: {
    BUILDINGS: '/organization/buildings',
    BUILDING_BY_ID: (id: string) => `/organization/buildings/${id}`,
    BUILDING_RESTORE: (id: string) => `/organization/buildings/${id}/restore`,
    TREE: '/organization/tree',
    DEPARTMENTS: '/organization/departments',
    DEPARTMENT_BY_ID: (id: string) => `/organization/departments/${id}`,
    DEPARTMENT_RESTORE: (id: string) => `/organization/departments/${id}/restore`,
    ROOMS: '/organization/rooms',
    ROOM_BY_ID: (id: string) => `/organization/rooms/${id}`,
    ROOM_RESTORE: (id: string) => `/organization/rooms/${id}/restore`,
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
    CATEGORIES: '/assets/categories',
    BY_ID: (id: string) => `/assets/${id}`,
    BATCH: '/assets/batch',
    BATCH_TRANSFER: '/assets/batch-transfer',
    IMPORT_EXCEL: '/assets/import-excel',
    IMPORT: '/assets/import',
    IMPORT_TEMPLATE: '/assets/import-template',
    IMPORT_PREVIEW: '/assets/import-preview',
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
    REPRINT_QR: (id: string) => `/assets/${id}/reprint-qr`,
  },

  // Moddiy Javobgarlikni Topshirish (Responsibility Handover & Offboarding)
  HANDOVERS: {
    BASE: '/transfers/handovers',
    BY_ID: (id: string) => `/transfers/handovers/${id}`,
    DOCUMENT: (id: string) => `/transfers/handovers/${id}/document`,
    AUDIT: (id: string) => `/transfers/handovers/${id}/audit`,
    INITIATE_SIGNING: (id: string) => `/transfers/handovers/${id}/initiate-signing`,
    SIGN: (id: string) => `/transfers/handovers/${id}/sign`,
    REJECT: (id: string) => `/transfers/handovers/${id}/reject`,
    SUBMIT: (id: string) => `/transfers/handovers/${id}/submit`,
    CANCEL: (id: string) => `/transfers/handovers/${id}/cancel`,
  },

  // Talabnomalar (Zayavkalar)
  REQUESTS: {
    BASE: '/requests',
    BY_ID: (id: string) => `/requests/${id}`,
    STATUS: (id: string) => `/requests/${id}/status`,
    APPROVE: (id: string) => `/requests/${id}/approve`,
    FULFILL: (id: string) => `/requests/${id}/fulfill`,
    REJECT: (id: string) => `/requests/${id}/reject`,
    WORKFLOW_ADVANCE: (id: string) => `/requests/${id}/workflow-advance`,
    FINANCE: (id: string) => `/requests/${id}/finance`,
    HANDOVER: (id: string) => `/requests/${id}/handover-commendant`,
    FULFILL_ROOM: (id: string) => `/requests/${id}/fulfill-room`,
  },

  // Ombor va Sarflanuvchi materiallar
  WAREHOUSE: {
    STOCKS: '/warehouse/stocks',
    LOW_STOCK: '/warehouse/low-stock',
    INGEST: '/warehouse/ingest',
    TRANSFER: '/warehouse/transfer',
    REPLENISH: (id: string) => `/warehouse/stocks/${id}/replenish`,
    MOVEMENTS: '/warehouse/movements',
    WAREHOUSES: '/organization/warehouses',
    LIST: '/warehouse/list',
    CREATE: '/warehouse',
    UPDATE: (id: string) => `/warehouse/${id}`,
    DELETE: (id: string) => `/warehouse/${id}`,
    RESTORE: (id: string) => `/warehouse/${id}/restore`,
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
    BATCH_SCAN: '/audits/batch-scan',
    COMPLETE: (id: string) => `/audits/${id}/complete`,
    CAMPAIGNS: {
      BASE: '/audits/campaigns',
      BY_ID: (id: string) => `/audits/campaigns/${id}`,
      START: (id: string) => `/audits/campaigns/${id}/start`,
      COMPLETE: (id: string) => `/audits/campaigns/${id}/complete`,
      CANCEL: (id: string) => `/audits/campaigns/${id}/cancel`,
      PROGRESS: (id: string) => `/audits/campaigns/${id}/progress`,
      MISSING_REPORT: (id: string) => `/audits/campaigns/${id}/missing-report`,
      EXPORT_EXCEL: (id: string) => `/audits/campaigns/${id}/export/excel`,
    },
  },

  // Ta'minotchilar
  SUPPLIERS: {
    BASE: '/suppliers',
    STATS: '/suppliers/stats',
    BY_ID: (id: string) => `/suppliers/${id}`,
    RESTORE: (id: string) => `/suppliers/${id}/restore`,
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
    PUBLIC_DOWNLOAD_PDF: (docNumber: string) => `/public/verify-doc/${encodeURIComponent(docNumber)}/download`,
  },

  // 60s Dinamik QR-Pairing va Mobil Biometrik Imzo
  SIGNING_SESSIONS: {
    INIT: '/signing-sessions/init',
    HANDOVER_INIT: '/signing-sessions/handover-init',
    STATUS: (sessionId: string) => `/signing-sessions/${sessionId}/status`,
    CANCEL: (sessionId: string) => `/signing-sessions/${sessionId}/cancel`,
    PUBLIC_GET: (token: string) => `/public/signing-sessions/${encodeURIComponent(token)}`,
    PUBLIC_CONFIRM: (token: string) => `/public/signing-sessions/${encodeURIComponent(token)}/confirm`,
  },


  // HEMIS va 1C / UzASBO Integratsiyalari
  INTEGRATIONS: {
    HEMIS_STATUS: '/integrations/hemis/status',
    HEMIS_TEST_CONNECTION: '/integrations/hemis/test-connection',
    HEMIS_SYNC: '/integrations/hemis/sync',
    HEMIS_LOGS: '/integrations/hemis/logs',
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

  // Amortizatsiya va Qoldiq Qiymat (Depreciation Engine)
  DEPRECIATION: {
    BASE: '/depreciation',
    PREVIEW: '/depreciation/preview',
    RUN: '/depreciation/run',
    RUNS: '/depreciation/runs',
    RUN_BY_ID: (id: string) => `/depreciation/runs/${id}`,
    ASSET_HISTORY: (id: string) => `/depreciation/asset/${id}`,
    STATEMENT: (period: string) => `/depreciation/statement/${period}`,
  },

  // Hisobotlar (Reports & Analytics)
  REPORTS: {
    FUNDING_SUMMARY: '/reports/funding-summary',
    FUNDING_MOVEMENTS: '/reports/funding-movements',
    FUNDING_EXPORT: '/reports/funding-export',
    CHIEF_ACCOUNTANT_RECEIPTS: '/reports/chief-accountant/receipts',
    CHIEF_ACCOUNTANT_HANDOVER_BALANCE: '/reports/chief-accountant/handover-balance',
    CHIEF_ACCOUNTANT_MOL_DETAILS: (userId: string) => `/reports/chief-accountant/mol-details/${userId}`,
    CHIEF_ACCOUNTANT_EXPORT: '/reports/chief-accountant/export',
    CLEARANCE_CERTIFICATE: (userId: string) => `/reports/clearance-certificate/${userId}`,
    CLEARANCE_CERTIFICATE_DOWNLOAD: (userId: string) => `/reports/clearance-certificate/${userId}/download`,
  },

  // Vazifalar Inbox (Action Center)
  INBOX: {
    BASE: '/inbox',
  },

  // Global Qidiruv
  SEARCH: {
    BASE: '/search',
  },
} as const;

