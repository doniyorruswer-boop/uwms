import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CODE_GENERATOR_CONFIG } from './constants';

/**
 * UWMS — Tartibli va To‘qnashuvsiz (Collision-Proof) Unikal Kodlar Generatori
 */
@Injectable()
export class CodeGeneratorService {
  /**
   * 8 xonali to'qnashuvsiz kriptografik unikal prefiks (masalan: 816F1B1B)
   */
  generateUniqueSuffix(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

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
   * Rasmiy shartnoma raqami (SH-2026-816F1B1B)
   */
  generateContractNumber(_seq?: number, year: number = new Date().getFullYear()): string {
    return `${CODE_GENERATOR_CONFIG.CONTRACT.PREFIX}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Rasmiy hisob-faktura raqami (HF-2026-816F1B1B)
   */
  generateInvoiceNumber(_seq?: number, year: number = new Date().getFullYear()): string {
    return `${CODE_GENERATOR_CONFIG.INVOICE.PREFIX}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Asosiy vosita inventar raqami (INV-2026-816F1B1B)
   */
  generateInventoryNumber(_seq?: number, year: number = new Date().getFullYear()): string {
    return `${CODE_GENERATOR_CONFIG.INVENTORY.PREFIX}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Ombor kirim/chiqim harakat raqami (MOV-2026-816F1B1B)
   */
  generateMovementNumber(_seq?: number, year: number = new Date().getFullYear()): string {
    return `${CODE_GENERATOR_CONFIG.MOVEMENT.PREFIX}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Rasmiy davlat dalolatnomasi raqami (OS1-2026-816F1B1B, OS2-2026-816F1B1B...)
   */
  generateDocNumber(
    type: 'OS1' | 'OS2' | 'OS4' | 'INV19' | string,
    _seq?: number,
    year: number = new Date().getFullYear(),
  ): string {
    const prefix = (CODE_GENERATOR_CONFIG.DOCUMENTS as any)[type] || type;
    return `${prefix}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Ta'mirlash talabnomasi raqami (REP-2026-816F1B1B)
   */
  generateRepairNumber(_seq?: number, year: number = new Date().getFullYear()): string {
    return `${CODE_GENERATOR_CONFIG.REPAIR.PREFIX}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Ko'chirish arizasi raqami (TRF-2026-816F1B1B)
   */
  generateTransferNumber(_seq?: number, year: number = new Date().getFullYear()): string {
    return `${CODE_GENERATOR_CONFIG.TRANSFER.PREFIX}-${year}-${this.generateUniqueSuffix()}`;
  }

  /**
   * Standart QR-kod matni
   */
  generateQRCode(inventoryNumber: string): string {
    return `${CODE_GENERATOR_CONFIG.QR_PREFIX}:${inventoryNumber}`;
  }

  /**
   * Amortizatsiya partiya raqami (DEP-2026-09-001)
   */
  generateDepreciationBatchNumber(period: string, seq: number): string {
    const cleanPeriod = (period || new Date().toISOString().substring(0, 7)).replace(/[^0-9-]/g, '');
    const padded = String(seq).padStart(3, '0');
    return `DEP-${cleanPeriod}-${padded}`;
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
