import { CODE_GENERATOR_CONFIG } from '../constants/generator.constants';

/**
 * UWMS — Frontend Unikal Kodlar Generatsiya Yordamchisi
 */

export function generateUniqueSuffix(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(4);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0').toUpperCase();
}

export function generateINN(seq: number): string {
  const num = CODE_GENERATOR_CONFIG.INN.BASE_NUM + seq;
  return num.toString().padStart(CODE_GENERATOR_CONFIG.INN.LENGTH, '0');
}

export function generateContractNumber(_seq?: number, year: number = new Date().getFullYear()): string {
  return `${CODE_GENERATOR_CONFIG.CONTRACT.PREFIX}-${year}-${generateUniqueSuffix()}`;
}

export function generateInvoiceNumber(_seq?: number, year: number = new Date().getFullYear()): string {
  return `${CODE_GENERATOR_CONFIG.INVOICE.PREFIX}-${year}-${generateUniqueSuffix()}`;
}

export function generateInventoryNumber(_seq?: number, year: number = new Date().getFullYear()): string {
  return `${CODE_GENERATOR_CONFIG.INVENTORY.PREFIX}-${year}-${generateUniqueSuffix()}`;
}

export function generateMovementNumber(_seq?: number, year: number = new Date().getFullYear()): string {
  return `${CODE_GENERATOR_CONFIG.MOVEMENT.PREFIX}-${year}-${generateUniqueSuffix()}`;
}

export function generateRepairNumber(_seq?: number, year: number = new Date().getFullYear()): string {
  return `${CODE_GENERATOR_CONFIG.REPAIR.PREFIX}-${year}-${generateUniqueSuffix()}`;
}

export function generateTransferNumber(_seq?: number, year: number = new Date().getFullYear()): string {
  return `${CODE_GENERATOR_CONFIG.TRANSFER.PREFIX}-${year}-${generateUniqueSuffix()}`;
}

export function generateDocNumber(
  type: 'OS1' | 'OS2' | 'OS4' | 'INV19' | string,
  _seq?: number,
  year: number = new Date().getFullYear(),
): string {
  const prefix = (CODE_GENERATOR_CONFIG.DOCUMENTS as any)[type] || type;
  return `${prefix}-${year}-${generateUniqueSuffix()}`;
}

export function generateQRCode(inventoryNumber: string): string {
  return `${CODE_GENERATOR_CONFIG.QR_PREFIX}:${inventoryNumber}`;
}

export function calculateDepreciation(
  purchasePrice: number,
  purchaseDate: Date | string,
  categoryName?: string,
): {
  annualRate: number;
  ageYears: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
} {
  const pDate = new Date(purchaseDate || Date.now());
  const now = new Date();
  const ageMs = Math.max(0, now.getTime() - pDate.getTime());
  const ageYears = Number((ageMs / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));

  let annualRate = 0.15;
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('kompyuter') || cat.includes('it') || cat.includes('elektron')) {
    annualRate = 0.20;
  } else if (cat.includes('mebel') || cat.includes('stol') || cat.includes('shkaf')) {
    annualRate = 0.10;
  } else if (cat.includes('transport') || cat.includes('avto')) {
    annualRate = 0.15;
  }

  const accumulatedRatio = Math.min(1.0, ageYears * annualRate);
  const accumulatedDepreciation = Math.round(purchasePrice * accumulatedRatio);
  const currentBookValue = Math.max(0, purchasePrice - accumulatedDepreciation);

  return {
    annualRate,
    ageYears,
    accumulatedDepreciation,
    currentBookValue,
  };
}
