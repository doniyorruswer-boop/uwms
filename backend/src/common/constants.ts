/**
 * UWMS Backend — Markazlashtirilgan Konstantalar va Biznes Qoidalari
 */

export const BUSINESS_RULES = {
  DEFAULT_MIN_STOCK_LIMIT: 5,
  DEFAULT_PAGE_LIMIT: 50,
  MAX_PAGE_LIMIT: 200,
  MAX_ACTIVE_REQUESTS_PER_DEPT: 20,
} as const;

export const FUNDING_SOURCES = {
  BUDGET: 'BYUDJET',
  CONTRACT: 'KONTRAKT_RIVOJLANTIRISH',
  GRANT: 'GRANT',
} as const;

export type FundingSourceType = typeof FUNDING_SOURCES[keyof typeof FUNDING_SOURCES];

export const DOCUMENT_PREFIXES = {
  TRANSFER_ACCEPTANCE: 'OS1',
  STOCK_OUTGOING: 'OS2',
  WRITE_OFF: 'OS4',
  AUDIT_INV: 'INV19',
} as const;

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Tizimga kirish ruxsati berilmagan yoki sessiya muddati tugagan.',
  FORBIDDEN: 'Ushbu amalni bajarish uchun sizda yetarli ruxsat mavjud emas.',
  STOCK_INSUFFICIENT: 'Omborda so‘ralgan miqdorda mahsulot qoldig‘i mavjud emas!',
  ASSET_NOT_FOUND: 'Qidirilayotgan asosiy vosita topilmadi.',
  ROOM_NOT_FOUND: 'Belgilangan xona tizimda mavjud emas.',
  QR_CODE_NOT_FOUND: 'Bazada mavjud bo‘lmagan noma’lum QR-kod!',
  DUPLICATE_TRANSFER: 'Ushbu uskuna bo‘yicha topshirish arizasi allaqachon mavjud.',
  ALREADY_FULFILLED: 'Ushbu talabnoma allaqachon bajarilgan.',
} as const;

export const CODE_GENERATOR_CONFIG = {
  INN: {
    PREFIX: '30',
    LENGTH: 9,
    BASE_NUM: 300000000,
  },
  CONTRACT: {
    PREFIX: 'SH',
    DIGITS: 4,
  },
  INVOICE: {
    PREFIX: 'HF',
    DIGITS: 4,
  },
  INVENTORY: {
    PREFIX: 'INV',
    DIGITS: 5,
  },
  MOVEMENT: {
    PREFIX: 'MOV',
    DIGITS: 5,
  },
  REPAIR: {
    PREFIX: 'REP',
    DIGITS: 4,
  },
  TRANSFER: {
    PREFIX: 'TRF',
    DIGITS: 4,
  },
  DOCUMENTS: {
    OS1: 'OS1',
    OS2: 'OS2',
    OS4: 'OS4',
    INV19: 'INV19',
    DIGITS: 4,
  },
  QR_PREFIX: 'UWMS:ASSET',
} as const;

export const DEPRECIATION_RATES = {
  // OTM me'yorlari bo'yicha yillik eskirish foizlari
  IT: 0.20, // 20% yillik
  FURNITURE: 0.10, // 10% yillik
  VEHICLE: 0.15, // 15% yillik
  EQUIPMENT: 0.15, // 15% yillik
  OTHER: 0.15, // 15% yillik
} as const;

export const SYSTEM_AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  FULFILL: 'FULFILL',
  TRANSFER: 'TRANSFER',
  RETURN: 'RETURN',
  REPAIR: 'REPAIR',
  WRITE_OFF: 'WRITE_OFF',
  QUOTA_UPDATE: 'QUOTA_UPDATE',
  HEMIS_SYNC: 'HEMIS_SYNC',
  EXPORT: 'EXPORT',
} as const;

export const NOTIFICATION_TYPES = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  REQUEST: 'REQUEST',
  TRANSFER: 'TRANSFER',
  AUDIT: 'AUDIT',
  REPAIR: 'REPAIR',
  WRITE_OFF: 'WRITE_OFF',
  QUOTA: 'QUOTA',
} as const;

export const DOCUMENT_VERIFICATION = {
  PUBLIC_BASE_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SECRET_SALT: 'UWMS_VERIFY_SALT_2026_GOV_UZ',
} as const;

