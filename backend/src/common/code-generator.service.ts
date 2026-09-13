import { Injectable } from '@nestjs/common';
import { CODE_GENERATOR_CONFIG } from './constants';

/**
 * UWMS — Tartibli va To‘qnashuvsiz (Collision-Proof) Unikal Kodlar Generatori
 */
@Injectable()
export class CodeGeneratorService {
  /**
   * O‘zbekiston soliq to‘lovchilarining 9 xonali rasmiy STIR/INN raqamini tartibli generatsiya qilish
   * @param seq Ketma-ketlik raqami (masalan 1, 2, 3...)
   * @returns 9 xonali string: "300000001", "300000002"...
   */
  generateINN(seq: number): string {
    const num = CODE_GENERATOR_CONFIG.INN.BASE_NUM + seq;
    return num.toString().padStart(CODE_GENERATOR_CONFIG.INN.LENGTH, '0');
  }

  /**
   * Rasmiy shartnoma raqami (SH-2026-0001)
   */
  generateContractNumber(seq: number, year: number = new Date().getFullYear()): string {
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.CONTRACT.DIGITS, '0');
    return `${CODE_GENERATOR_CONFIG.CONTRACT.PREFIX}-${year}-${padded}`;
  }

  /**
   * Rasmiy hisob-faktura raqami (HF-2026-0001)
   */
  generateInvoiceNumber(seq: number, year: number = new Date().getFullYear()): string {
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.INVOICE.DIGITS, '0');
    return `${CODE_GENERATOR_CONFIG.INVOICE.PREFIX}-${year}-${padded}`;
  }

  /**
   * Asosiy vosita inventar raqami (INV-2026-00001)
   */
  generateInventoryNumber(seq: number, year: number = new Date().getFullYear()): string {
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.INVENTORY.DIGITS, '0');
    return `${CODE_GENERATOR_CONFIG.INVENTORY.PREFIX}-${year}-${padded}`;
  }

  /**
   * Ombor kirim/chiqim harakat raqami (MOV-2026-00001)
   */
  generateMovementNumber(seq: number, year: number = new Date().getFullYear()): string {
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.MOVEMENT.DIGITS, '0');
    return `${CODE_GENERATOR_CONFIG.MOVEMENT.PREFIX}-${year}-${padded}`;
  }

  /**
   * Rasmiy davlat dalolatnomasi raqami (OS1-2026-0001, OS2-2026-0001...)
   */
  generateDocNumber(
    type: 'OS1' | 'OS2' | 'OS4' | 'INV19',
    seq: number,
    year: number = new Date().getFullYear(),
  ): string {
    const prefix = CODE_GENERATOR_CONFIG.DOCUMENTS[type] || type;
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.DOCUMENTS.DIGITS, '0');
    return `${prefix}-${year}-${padded}`;
  }

  /**
   * Ta'mirlash talabnomasi raqami (REP-2026-0001)
   */
  generateRepairNumber(seq: number, year: number = new Date().getFullYear()): string {
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.REPAIR.DIGITS, '0');
    return `${CODE_GENERATOR_CONFIG.REPAIR.PREFIX}-${year}-${padded}`;
  }

  /**
   * Ko'chirish arizasi raqami (TRF-2026-0001)
   */
  generateTransferNumber(seq: number, year: number = new Date().getFullYear()): string {
    const padded = String(seq).padStart(CODE_GENERATOR_CONFIG.TRANSFER.DIGITS, '0');
    return `${CODE_GENERATOR_CONFIG.TRANSFER.PREFIX}-${year}-${padded}`;
  }

  /**
   * Standart QR-kod matni
   */
  generateQRCode(inventoryNumber: string): string {
    return `${CODE_GENERATOR_CONFIG.QR_PREFIX}:${inventoryNumber}`;
  }

  /**
   * Asosiy vosita amortizatsiyasini hisoblash (OTM davlat standarti)
   */
  calculateDepreciation(
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
    const ageYears = Number((ageMs / (1000 * 60 * 60 * 24 * 365.25)).toFixed(2));

    let annualRate = 0.15; // default 15%
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('kompyuter') || cat.includes('it') || cat.includes('elektron')) {
      annualRate = 0.20; // 20%
    } else if (cat.includes('mebel') || cat.includes('stol') || cat.includes('shkaf')) {
      annualRate = 0.10; // 10%
    } else if (cat.includes('transport') || cat.includes('avto')) {
      annualRate = 0.15; // 15%
    }

    const maxDepreciationRatio = 1.0; // max 100%
    const accumulatedRatio = Math.min(maxDepreciationRatio, ageYears * annualRate);
    const accumulatedDepreciation = Math.round(purchasePrice * accumulatedRatio);
    const currentBookValue = Math.max(0, purchasePrice - accumulatedDepreciation);

    return {
      annualRate,
      ageYears,
      accumulatedDepreciation,
      currentBookValue,
    };
  }
}
