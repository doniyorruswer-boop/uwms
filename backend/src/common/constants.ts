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
    DIGITS: 8,
  },
  INVOICE: {
    PREFIX: 'HF',
    DIGITS: 8,
  },
  INVENTORY: {
    PREFIX: 'INV',
    DIGITS: 8,
  },
  MOVEMENT: {
    PREFIX: 'MOV',
    DIGITS: 8,
  },
  REPAIR: {
    PREFIX: 'REP',
    DIGITS: 8,
  },
  TRANSFER: {
    PREFIX: 'TRF',
    DIGITS: 8,
  },
  DOCUMENTS: {
    OS1: 'OS1',
    OS2: 'OS2',
    OS4: 'OS4',
    INV19: 'INV19',
    DIGITS: 8,
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
  DOCUMENT_REVOKED: 'DOCUMENT_REVOKED',
  BIOMETRIC_SIGNED: 'BIOMETRIC_SIGNED',
  BIOMETRIC_SIGN: 'BIOMETRIC_SIGN',
  REPRINT_LABEL: 'REPRINT_LABEL',
  WORM_STAMP_GENERATE: 'WORM_STAMP_GENERATE',
  QUOTA_OVERRIDE: 'QUOTA_OVERRIDE',
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

export const KNOWN_INSECURE_SECRETS = [
  'uwms_jwt_secret_dev_key_2026_super_secure',
  'your_jwt_secret_key_change_in_production',
  'secret',
  'admin123',
  'change_me',
  'default_secret',
  'UWMS_VERIFY_SALT_2026_GOV_UZ',
  'UWMS_DEV_HMAC_SECRET_NON_PRODUCTION_ONLY_2026',
  'uwms_super_secret_jwt_key_2026',
] as const;

export function validateEnvironmentSecretsOnStartup(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET?.trim();

  if (!jwtSecret) {
    console.error('FATAL ERROR: JWT_SECRET muhit o‘zgaruvchisi aniqlanmagan! Xavfsizlik tufayli backend to‘xtatildi.');
    process.exit(1);
  }

  if (isProduction) {
    if (KNOWN_INSECURE_SECRETS.includes(jwtSecret as any) || jwtSecret.length < 32) {
      console.error(
        'FATAL SECURITY ERROR: Production muhitida standart yoki zaif JWT_SECRET ishlatish qat’iyan taqiqlanadi!\n' +
        'Iltimos, kamida 32 belgidan iborat tasodifiy kriptografik kalit o‘rnating.',
      );
      process.exit(1);
    }

    if (!jwtRefreshSecret || KNOWN_INSECURE_SECRETS.includes(jwtRefreshSecret as any) || jwtRefreshSecret.length < 32) {
      console.error(
        'FATAL SECURITY ERROR: Production muhitida JWT_REFRESH_SECRET o‘rnatilishi va kamida 32 belgidan iborat bo‘lishi shart!',
      );
      process.exit(1);
    }

    if (jwtRefreshSecret === jwtSecret) {
      console.error(
        'FATAL SECURITY ERROR: JWT_REFRESH_SECRET va JWT_SECRET bir xil bo‘lishi mumkin emas!',
      );
      process.exit(1);
    }

    try {
      getDocumentHmacSecret();
    } catch (err: any) {
      console.error(`FATAL SECURITY ERROR: ${err.message}`);
      process.exit(1);
    }
  }
}

export function getDocumentHmacSecret(): string {
  const secret = process.env.DOCUMENT_HMAC_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!secret || KNOWN_INSECURE_SECRETS.includes(secret as any) || secret.length < 32) {
      throw new Error('FATAL: Production muhitida DOCUMENT_HMAC_SECRET yaroqli emas yoki kiritilmagan!');
    }
  }
  return secret || 'UWMS_DEV_HMAC_SECRET_NON_PRODUCTION_ONLY_2026';
}

export function getPublicBaseUrl(): string {
  return process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
}

export const DOCUMENT_VERIFICATION = {
  get PUBLIC_BASE_URL(): string {
    return getPublicBaseUrl();
  },
  get SECRET_SALT(): string {
    return getDocumentHmacSecret();
  },
} as const;



