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
  PENDING: {
    label: 'Kutilmoqda (Yangi)',
    color: 'orange',
    stepIndex: 0,
  },
  APPROVED_BY_HEAD: {
    label: 'Mudir Tasdiqladi',
    color: 'blue',
    stepIndex: 1,
  },
  APPROVED_BY_WAREHOUSE: {
    label: 'Omborchi Tasdiqladi',
    color: 'arcoblue',
    stepIndex: 2,
  },
  FULFILLED: {
    label: 'Bajarildi (Berildi)',
    color: 'green',
    stepIndex: 3,
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
