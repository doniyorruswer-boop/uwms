import { CODE_GENERATOR_CONFIG } from '../constants/generator.constants';

/**
 * UWMS — Frontend Unikal Kodlar Generatsiya Yordamchisi
 */

export function generateINN(seq: number): string {
  const num = CODE_GENERATOR_CONFIG.INN.BASE_NUM + seq;
  return num.toString().padStart(CODE_GENERATOR_CONFIG.INN.LENGTH, '0');
}

export function generateContractNumber(seq: number, year: number = new Date().getFullYear()): string {
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.CONTRACT.DIGITS, '0');
  return `${CODE_GENERATOR_CONFIG.CONTRACT.PREFIX}-${year}-${padded}`;
}

export function generateInvoiceNumber(seq: number, year: number = new Date().getFullYear()): string {
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.INVOICE.DIGITS, '0');
  return `${CODE_GENERATOR_CONFIG.INVOICE.PREFIX}-${year}-${padded}`;
}

export function generateInventoryNumber(seq: number, year: number = new Date().getFullYear()): string {
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.INVENTORY.DIGITS, '0');
  return `${CODE_GENERATOR_CONFIG.INVENTORY.PREFIX}-${year}-${padded}`;
}

export function generateMovementNumber(seq: number, year: number = new Date().getFullYear()): string {
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.MOVEMENT.DIGITS, '0');
  return `${CODE_GENERATOR_CONFIG.MOVEMENT.PREFIX}-${year}-${padded}`;
}

export function generateRepairNumber(seq: number, year: number = new Date().getFullYear()): string {
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.REPAIR.DIGITS, '0');
  return `${CODE_GENERATOR_CONFIG.REPAIR.PREFIX}-${year}-${padded}`;
}

export function generateTransferNumber(seq: number, year: number = new Date().getFullYear()): string {
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.TRANSFER.DIGITS, '0');
  return `${CODE_GENERATOR_CONFIG.TRANSFER.PREFIX}-${year}-${padded}`;
}

export function generateDocNumber(
  type: 'OS1' | 'OS2' | 'OS4' | 'INV19',
  seq: number,
  year: number = new Date().getFullYear(),
): string {
  const prefix = CODE_GENERATOR_CONFIG.DOCUMENTS[type] || type;
  const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.DOCUMENTS.DIGITS, '0');
  return `${prefix}-${year}-${padded}`;
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
