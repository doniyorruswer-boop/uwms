import type {
  AssetStatus,
  RequestStatus,
  MovementType,
  HandoverStatus,
  HandoverType,
  FundingSource,
  SigningSessionStatusType,
} from '../types';

/**
 * UWMS — Holatlar va Lug‘atlarning Markazlashtirilgan Arxitekturasi
 * Butun tizimdagi barcha sahifalar, jadvallar va modallar uchun yagona haqiqat manbasi (Single Source of Truth)
 */

export interface StatusMeta {
  label: string;
  color: string;
  badgeStatus: 'success' | 'processing' | 'warning' | 'error' | 'default';
  iconName?: 'check' | 'clock' | 'close' | 'exclamation' | 'sync' | 'file' | 'lock' | 'tool' | 'box';
  description?: string;
  stepIndex?: number;
}

export type StatusDomain =
  | 'auto'
  | 'asset'
  | 'request'
  | 'handover'
  | 'handoverType'
  | 'movement'
  | 'funding'
  | 'repair'
  | 'writeOff'
  | 'audit'
  | 'signing'
  | 'general';

// 1. ASSET STATUS CONFIG (Asosiy vositalar)
export const ASSET_STATUS_CONFIG: Record<string, StatusMeta> = {
  NEW: {
    label: 'Yangi (Omborda)',
    color: 'blue',
    badgeStatus: 'processing',
    iconName: 'box',
    description: 'Yangi qabul qilingan va omborda saqlanayotgan ashyo',
  },
  IN_USE: {
    label: 'Foydalanishda',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    description: 'Mas’ul shaxs biriktirilgan va faol foydalanilayotgan aktiv',
  },
  IN_REPAIR: {
    label: 'Ta’mirlashda',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'tool',
    description: 'Texnik nosozlik sababli servis markaziga yo‘naltirilgan',
  },
  WRITTEN_OFF: {
    label: 'Hisobdan chiqarilgan (Spisanie)',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    description: 'Yaroqsiz deb topilib, balansdan chiqarilgan',
  },
  MISSING: {
    label: 'Kamomad (Tekshiruvda)',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'exclamation',
    description: 'Inventarizatsiyada topilmagan yoki kamomad deb belgilangan',
  },
};

// 2. REQUEST STATUS CONFIG (Talabnomalar)
export const REQUEST_STATUS_CONFIG: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Prorektor Vizasi Kutilmoqda',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
    stepIndex: 2,
  },
  SUBMITTED: {
    label: 'Prorektor Vizasi Kutilmoqda',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
    stepIndex: 2,
  },
  APPROVED_BY_PRORECTOR: {
    label: 'Rektor Vizasi Kutilmoqda',
    color: 'purple',
    badgeStatus: 'processing',
    iconName: 'check',
    stepIndex: 3,
    description: 'Prorektor viza bergan, Universitet Rektori tasdig‘i kutilmoqda',
  },
  APPROVED_BY_HEAD: {
    label: 'Prorektor Vizasi Kutilmoqda',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'clock',
    stepIndex: 2,
    description: 'Talabnoma kafedra tomonidan taqdim etilgan, prorektor vizasi kutilmoqda',
  },
  APPROVED_BY_RECTOR: {
    label: 'Moliyalashtirish Kutilmoqda',
    color: 'cyan',
    badgeStatus: 'processing',
    iconName: 'check',
    stepIndex: 4,
    description: 'Rektor tasdiqlagan, bosh hisobchi tomonidan moliyalashtirish kutilmoqda',
  },
  FINANCED_BY_ACCOUNTANT: {
    label: 'Ombor Kirimi (OS-1) Kutilmoqda',
    color: 'blue',
    badgeStatus: 'processing',
    iconName: 'check',
    stepIndex: 5,
    description: 'Mablag‘ ajratilgan, xarid va ombor kirimi kutilmoqda',
  },
  RECEIVED_AT_WAREHOUSE: {
    label: 'Binoga Topshirish (OS-2) Kutilmoqda',
    color: 'gold',
    badgeStatus: 'processing',
    iconName: 'box',
    stepIndex: 6,
    description: 'Tovarlar omborga kirim qilingan, bino komendantiga berilishi kutilmoqda',
  },
  APPROVED_BY_WAREHOUSE: {
    label: 'Binoga Topshirish (OS-2) Kutilmoqda',
    color: 'gold',
    badgeStatus: 'processing',
    iconName: 'box',
    stepIndex: 6,
  },
  HANDED_TO_COMMENDANT: {
    label: 'Xonada Qabul (Akt) Kutilmoqda',
    color: 'cyan',
    badgeStatus: 'warning',
    iconName: 'sync',
    stepIndex: 7,
    description: 'Bino komendanti qabul qilgan, xonada talabgor bilan dalolatnoma imzosi kutilmoqda',
  },
  FULFILLED: {
    label: '7/7: To‘liq Bajarildi (Topshirildi)',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    stepIndex: 7,
  },
  REJECTED: {
    label: 'Rad Etildi',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    stepIndex: -1,
  },
  CANCELLED: {
    label: 'Bekor Qilindi',
    color: 'gray',
    badgeStatus: 'default',
    iconName: 'close',
    stepIndex: -1,
  },
};

// 3. HANDOVER STATUS CONFIG (Moddiy javobgarlik topshirish)
export const HANDOVER_STATUS_CONFIG: Record<string, StatusMeta> = {
  DRAFT: {
    label: 'Qoralama',
    color: 'default',
    badgeStatus: 'default',
    iconName: 'file',
    description: 'Ariza hali yuborilmagan qoralama holatida',
  },
  SUBMITTED: {
    label: 'Yuborilgan',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
    description: 'Ko‘rib chiqishga yo‘naltirilgan',
  },
  RECEIVER_REVIEW: {
    label: 'Kutilmoqda (Yangi MOL)',
    color: 'orange',
    badgeStatus: 'processing',
    iconName: 'clock',
    description: 'Qabul qiluvchi yangi mas’ul shaxs imzosi kutilmoqda',
  },
  COMMANDANT_REVIEW: {
    label: 'Kutilmoqda (Komendant)',
    color: 'gold',
    badgeStatus: 'warning',
    iconName: 'clock',
    description: 'Bino komendanti xona butunligi ko‘rigi kutilmoqda',
  },
  ACCOUNTANT_REVIEW: {
    label: 'Kutilmoqda (Buxgalter)',
    color: 'purple',
    badgeStatus: 'warning',
    iconName: 'clock',
    description: 'Moddiy hisob buxgalteriyasi tekshiruvi kutilmoqda',
  },
  PENDING_APPROVAL: {
    label: 'Tasdiqda (Rahbariyat)',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'clock',
    description: 'Prorektor yoki Bosh hisobchi yakuniy tasdig‘i kutilmoqda',
  },
  COMPLETED: {
    label: 'Tasdiqlangan',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    description: 'Barcha tomonlar imzolagan va balans rasman o‘tkazilgan',
  },
  REJECTED: {
    label: 'Rad etilgan',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    description: 'Mas’ullardan biri tomonidan asoslantirilgan holda rad etilgan',
  },
  CANCELLED: {
    label: 'Bekor qilingan',
    color: 'gray',
    badgeStatus: 'default',
    iconName: 'close',
    description: 'Tashabbuskor yoki ma’mur tomonidan bekor qilingan',
  },
};

// 4. HANDOVER TYPE CONFIG (Topshirish yo‘nalishi va turlari)
export const HANDOVER_TYPE_CONFIG: Record<string, StatusMeta> = {
  FULL_TRANSFER: {
    label: 'To‘liq topshirish',
    color: 'blue',
    badgeStatus: 'processing',
    iconName: 'sync',
    description: 'Xodim zimmasidagi barcha ashyolarni yangi shaxsga o‘tkazish',
  },
  PARTIAL_TRANSFER: {
    label: 'Qisman topshirish',
    color: 'cyan',
    badgeStatus: 'processing',
    iconName: 'sync',
    description: 'Faqat tanlangan alohida vositalarni o‘tkazish',
  },
  ROOM_TRANSFER: {
    label: 'Xona topshirish',
    color: 'purple',
    badgeStatus: 'processing',
    iconName: 'box',
    description: 'Auditoriya yoki xonani unga biriktirilgan jihozlar bilan topshirish',
  },
  RETURN_TO_WAREHOUSE: {
    label: 'Omborga qaytarish',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'box',
    description: 'Ashyolarni markaziy omborga qaytarib qabul qildirish',
  },
  FINAL_CLEARANCE: {
    label: 'Aylanma varaqa (Clearance)',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    description: 'Ishdan bo‘shash yoki boshqa lavozimga o‘tish chog‘ida javobgarlikni yopish',
  },
};

// 5. MOVEMENT TYPE CONFIG (Ombor va audit harakatlari)
export const MOVEMENT_TYPE_CONFIG: Record<string, StatusMeta> = {
  INCOMING: {
    label: 'Kirim',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'box',
    description: 'Omborga yangi moddiy vositalar kirimi',
  },
  OUTGOING: {
    label: 'Chiqim',
    color: 'blue',
    badgeStatus: 'processing',
    iconName: 'sync',
    description: 'Ombordan binolarga tarqatilgan chiqim',
  },
  TRANSFER: {
    label: 'Ichki ko‘chirish',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'sync',
    description: 'Xonalar yoki mas’ullar o‘rtasidagi ichki siljish',
  },
  WRITE_OFF: {
    label: 'Hisobdan chiqarish (Spisanie)',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    description: 'Yaroqsiz mulklarni balansdan chiqarish (OS-4)',
  },
  RETURN: {
    label: 'Qaytarish',
    color: 'gold',
    badgeStatus: 'warning',
    iconName: 'sync',
    description: 'Xonadan omborga qaytarib topshirish',
  },
};

// 6. FUNDING SOURCE CONFIG (Moliyalashtirish manbalari)
export const FUNDING_SOURCE_CONFIG: Record<string, StatusMeta> = {
  BYUDJET: {
    label: 'Davlat Byudjeti',
    color: 'blue',
    badgeStatus: 'processing',
    iconName: 'check',
    description: 'Davlat byudjeti mablag‘lari hisobidan moliyalashtirilgan',
  },
  KONTRAKT_RIVOJLANTIRISH: {
    label: 'To‘lov-Kontrakt (Rivojlantirish)',
    color: 'purple',
    badgeStatus: 'processing',
    iconName: 'check',
    description: 'Universitet rivojlantirish jamg‘armasi va to‘lov-kontrakt mablag‘lari',
  },
  GRANT: {
    label: 'Ilmiy Grant Mablag‘lari',
    color: 'cyan',
    badgeStatus: 'processing',
    iconName: 'check',
    description: 'Ilmiy tadqiqot va xalqaro grant mablag‘lari hisobidan olingan',
  },
};

// 7. REPAIR STATUS CONFIG (Ta’mirlash jarayoni)
export const REPAIR_STATUS_CONFIG: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Kutilmoqda',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
    description: 'Ta’mirlash talabnomasi ro‘yxatga olingan',
  },
  IN_REPAIR: {
    label: 'Ta’mir jarayonida',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'tool',
    description: 'Hozirda mutaxassis tomonidan ta’mirlanmoqda',
  },
  IN_PROGRESS: {
    label: 'Ta’mir jarayonida',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'tool',
    description: 'Hozirda mutaxassis tomonidan ta’mirlanmoqda',
  },
  COMPLETED: {
    label: 'Yakunlangan (Soz)',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    description: 'Ta’mirlash muvaffaqiyatli yakunlanib, foydalanishga topshirildi',
  },
  UNREPAIRABLE: {
    label: 'Yaroqsiz (Spisaniega)',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    description: 'Qayta tiklab bo‘lmaydigan darajada shikastlangan',
  },
  CANNOT_BE_REPAIRED: {
    label: 'Yaroqsiz (Spisaniega)',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    description: 'Qayta tiklab bo‘lmaydigan darajada shikastlangan',
  },
};

// 8. WRITE-OFF STATUS CONFIG (Spisanie komissiyasi)
export const WRITE_OFF_STATUS_CONFIG: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Komissiya ko‘rigida',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
    description: 'Hisobdan chiqarish arizasi komissiya ovoz berish jarayonida',
  },
  IN_REVIEW: {
    label: 'Komissiya ko‘rigida',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
    description: 'Ovoz berish davom etmoqda',
  },
  APPROVED: {
    label: 'Tasdiqlangan (OS-4)',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    description: '100% kvorum to‘plandi va OS-4 rasmiylashtirildi',
  },
  REJECTED: {
    label: 'Rad etilgan',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
    description: 'Komissiya a’zolari tomonidan hisobdan chiqarish rad etildi',
  },
  COMPLETED: {
    label: 'Balansdan chiqarilgan',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
    description: 'Mulk rasman hisobdan chiqarildi',
  },
};

// 9. AUDIT STATUS CONFIG (Inventarizatsiya)
export const AUDIT_STATUS_CONFIG: Record<string, StatusMeta> = {
  PLANNED: {
    label: 'Rejalashtirilgan',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'clock',
  },
  IN_PROGRESS: {
    label: 'Jarayonda',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'sync',
  },
  COMPLETED: {
    label: 'Yakunlangan',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  CANCELLED: {
    label: 'Bekor qilingan',
    color: 'gray',
    badgeStatus: 'default',
    iconName: 'close',
  },
  MATCHED: {
    label: 'Mavjud (Topildi)',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  MISSING: {
    label: 'Kamomad (Topilmadi)',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
  },
  RELOCATED: {
    label: 'Begona xonadan topildi',
    color: 'gold',
    badgeStatus: 'warning',
    iconName: 'exclamation',
  },
};

// 10. SIGNING SESSION STATUS CONFIG
export const SIGNING_SESSION_STATUS_CONFIG: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Kutilmoqda',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
  },
  SCANNED: {
    label: 'QR Skannerlandi',
    color: 'arcoblue',
    badgeStatus: 'processing',
    iconName: 'sync',
  },
  SIGNED: {
    label: 'Imzolangan',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  EXPIRED: {
    label: 'Muddati o‘tgan',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'clock',
  },
  CANCELLED: {
    label: 'Bekor qilingan',
    color: 'gray',
    badgeStatus: 'default',
    iconName: 'close',
  },
};

// 11. GENERAL STATUS CONFIG (Umumiy / Fallback)
export const GENERAL_STATUS_CONFIG: Record<string, StatusMeta> = {
  ACTIVE: {
    label: 'Faol',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  INACTIVE: {
    label: 'Nofaol',
    color: 'gray',
    badgeStatus: 'default',
    iconName: 'close',
  },
  PENDING: {
    label: 'Kutilmoqda',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'clock',
  },
  ACCEPTED: {
    label: 'Qabul qilindi',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  APPROVED: {
    label: 'Tasdiqlangan',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  REJECTED: {
    label: 'Rad etilgan',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
  },
  CANCELLED: {
    label: 'Bekor qilingan',
    color: 'gray',
    badgeStatus: 'default',
    iconName: 'close',
  },
  COMPLETED: {
    label: 'Yakunlangan',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  SUCCESS: {
    label: 'Muvaffaqiyatli',
    color: 'green',
    badgeStatus: 'success',
    iconName: 'check',
  },
  ERROR: {
    label: 'Xatolik',
    color: 'red',
    badgeStatus: 'error',
    iconName: 'close',
  },
  WARNING: {
    label: 'Ogohlantirish',
    color: 'orange',
    badgeStatus: 'warning',
    iconName: 'exclamation',
  },
  DRAFT: {
    label: 'Qoralama',
    color: 'default',
    badgeStatus: 'default',
    iconName: 'file',
  },
};

// Domenlar xaritasi
const DOMAIN_MAP: Record<Exclude<StatusDomain, 'auto'>, Record<string, StatusMeta>> = {
  asset: ASSET_STATUS_CONFIG,
  request: REQUEST_STATUS_CONFIG,
  handover: HANDOVER_STATUS_CONFIG,
  handoverType: HANDOVER_TYPE_CONFIG,
  movement: MOVEMENT_TYPE_CONFIG,
  funding: FUNDING_SOURCE_CONFIG,
  repair: REPAIR_STATUS_CONFIG,
  writeOff: WRITE_OFF_STATUS_CONFIG,
  audit: AUDIT_STATUS_CONFIG,
  signing: SIGNING_SESSION_STATUS_CONFIG,
  general: GENERAL_STATUS_CONFIG,
};

/**
 * Har qanday status stringi uchun metadatani aniqlash (Universal Resolver)
 */
export function getStatusMeta(
  status: string | undefined | null,
  domain: StatusDomain = 'auto',
): StatusMeta {
  if (!status) {
    return {
      label: '—',
      color: 'default',
      badgeStatus: 'default',
    };
  }

  const cleanKey = status.trim().toUpperCase();

  // Agar aniq domen ko‘rsatilgan bo‘lsa
  if (domain !== 'auto' && DOMAIN_MAP[domain]) {
    const found = DOMAIN_MAP[domain][cleanKey];
    if (found) return found;
  }

  // Auto rejimi: barcha domenlarni qidirib chiqish
  for (const map of Object.values(DOMAIN_MAP)) {
    if (map[cleanKey]) {
      return map[cleanKey];
    }
  }

  // Standart formatlash agar topilmasa (Humanize snake_case)
  const fallbackLabel = cleanKey
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  return {
    label: fallbackLabel,
    color: 'default',
    badgeStatus: 'default',
  };
}

/**
 * Status nomini olish (Human readable label)
 */
export function getStatusLabel(status: string | undefined | null, domain?: StatusDomain): string {
  return getStatusMeta(status, domain).label;
}

/**
 * Status rangini olish (Arco Design color)
 */
export function getStatusColor(status: string | undefined | null, domain?: StatusDomain): string {
  return getStatusMeta(status, domain).color;
}

/**
 * Dropdown (<Select>) filtrlari uchun variantlar ro‘yxatini olish
 */
export function getStatusSelectOptions(
  domain: Exclude<StatusDomain, 'auto'>,
  includeAll = true,
  allLabel = 'Barchasi',
): Array<{ label: string; value: string }> {
  const map = DOMAIN_MAP[domain];
  if (!map) return [];

  const options = Object.entries(map).map(([key, meta]) => ({
    label: meta.label,
    value: key,
  }));

  if (includeAll) {
    return [{ label: allLabel, value: 'ALL' }, ...options];
  }

  return options;
}
