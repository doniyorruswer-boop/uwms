import type { AssetStatus, RequestStatus, MovementType } from '../types';

/**
 * UWMS — Holatlar va Tranzaksiya Turlarining Markazlashtirilgan Lug‘ati
 */

export const ASSET_STATUS_CONFIG: Record<AssetStatus, { label: string; color: string; tagStatus: 'success' | 'warning' | 'danger' | 'default' }> = {
  NEW: {
    label: 'Yangi (Kirim)',
    color: 'blue',
    tagStatus: 'default',
  },
  IN_USE: {
    label: 'Foydalanishda',
    color: 'green',
    tagStatus: 'success',
  },
  IN_REPAIR: {
    label: 'Ta’mirlashda',
    color: 'orange',
    tagStatus: 'warning',
  },
  WRITTEN_OFF: {
    label: 'Hisobdan Chiqarilgan',
    color: 'red',
    tagStatus: 'danger',
  },
};

export const REQUEST_STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; stepIndex: number }> = {
  SUBMITTED: {
    label: '1/7: Xodim Talabnomasi',
    color: 'orange',
    stepIndex: 1,
  },
  PENDING: {
    label: 'Kutilmoqda (Yangi)',
    color: 'orange',
    stepIndex: 1,
  },
  APPROVED_BY_PRORECTOR: {
    label: '2/7: Prorektor Vizasi',
    color: 'arcoblue',
    stepIndex: 2,
  },
  APPROVED_BY_HEAD: {
    label: 'Mudir Tasdiqladi',
    color: 'blue',
    stepIndex: 2,
  },
  APPROVED_BY_RECTOR: {
    label: '3/7: Rektor Vizasi',
    color: 'purple',
    stepIndex: 3,
  },
  FINANCED_BY_ACCOUNTANT: {
    label: '4/7: Bosh Hisobchi Moliyalash',
    color: 'cyan',
    stepIndex: 4,
  },
  RECEIVED_AT_WAREHOUSE: {
    label: '5/7: Ombor Kirimi (OS-1)',
    color: 'blue',
    stepIndex: 5,
  },
  APPROVED_BY_WAREHOUSE: {
    label: 'Omborchi Tasdiqladi',
    color: 'arcoblue',
    stepIndex: 5,
  },
  HANDED_TO_COMMENDANT: {
    label: '6/7: Komendant Qabuli (OS-2)',
    color: 'gold',
    stepIndex: 6,
  },
  FULFILLED: {
    label: '7/7: To‘liq Bajarildi (Topshirildi)',
    color: 'green',
    stepIndex: 7,
  },
  REJECTED: {
    label: 'Rad Etildi',
    color: 'red',
    stepIndex: -1,
  },
  CANCELLED: {
    label: 'Bekor Qilindi',
    color: 'gray',
    stepIndex: -1,
  },
};

export const MOVEMENT_TYPE_CONFIG: Record<MovementType, { label: string; color: string; isCredit: boolean }> = {
  INCOMING: {
    label: 'Omborga Kirim',
    color: 'green',
    isCredit: true,
  },
  OUTGOING: {
    label: 'Chiqim (Tarqatildi)',
    color: 'blue',
    isCredit: false,
  },
  TRANSFER: {
    label: 'Ichki Ko‘chirish',
    color: 'purple',
    isCredit: false,
  },
  WRITE_OFF: {
    label: 'Hisobdan Chiqarish (Spisanie)',
    color: 'red',
    isCredit: false,
  },
  RETURN: {
    label: 'Omborga Qaytarish',
    color: 'cyan',
    isCredit: true,
  },
};

export const AUDIT_RECORD_STATUS = {
  MATCHED: {
    label: 'Mavjud (Topildi)',
    color: 'green',
    badgeStatus: 'success',
  },
  MISSING: {
    label: 'Kamomad (Topilmadi)',
    color: 'red',
    badgeStatus: 'error',
  },
  RELOCATED: {
    label: 'Begona Xonadan Topildi',
    color: 'gold',
    badgeStatus: 'warning',
  },
} as const;
