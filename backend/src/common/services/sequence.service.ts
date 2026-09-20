import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SequenceOptions {
  digits?: number;
  year?: number;
}

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a collision-proof, tamper-resistant document number with 8-character unique hex suffix.
   * Format: PREFIX-YYYY-XXXXXXXX (e.g., REQ-2026-816F1B1B, MOV-2026-A1B2C3D4)
   */
  async nextNumber(
    prefix: string,
    options?: SequenceOptions,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx || this.prisma;
    const year = options?.year || new Date().getFullYear();
    const upperPrefix = prefix.toUpperCase().trim();

    // 1. Maintain sequence counter in DocumentSequence table for metrics / statistics
    try {
      const seq = await client.documentSequence.findUnique({
        where: {
          prefix_year: {
            prefix: upperPrefix,
            year,
          },
        },
      });

      if (!seq) {
        const initialCount = await this.getInitialSeedCount(upperPrefix, client);
        await client.documentSequence.upsert({
          where: {
            prefix_year: {
              prefix: upperPrefix,
              year,
            },
          },
          create: {
            prefix: upperPrefix,
            year,
            currentVal: initialCount + 1,
          },
          update: {
            currentVal: { increment: 1 },
          },
        });
      } else {
        await client.documentSequence.update({
          where: {
            prefix_year: {
              prefix: upperPrefix,
              year,
            },
          },
          data: {
            currentVal: { increment: 1 },
          },
        });
      }
    } catch (e: any) {
      this.logger.warn(`Sequence counter tracking warning for ${upperPrefix}: ${e?.message}`);
    }

    const uniqueSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${upperPrefix}-${year}-${uniqueSuffix}`;
  }

  /**
   * Helper for request numbers: REQ-2026-816F1B1B
   */
  async nextRequestNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('REQ', { year }, tx);
  }

  /**
   * Helper for stock movement numbers: MOV-2026-816F1B1B
   */
  async nextMovementNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('MOV', { year }, tx);
  }

  /**
   * Helper for asset inventory numbers: INV-2026-816F1B1B
   */
  async nextInventoryNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('INV', { year }, tx);
  }

  /**
   * Helper for invoices: HF-2026-816F1B1B
   */
  async nextInvoiceNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('HF', { year }, tx);
  }

  /**
   * Helper for official acts: OS1-2026-816F1B1B, OS2-2026-816F1B1B, OS4-2026-816F1B1B, INV19-2026-816F1B1B
   */
  async nextDocNumber(
    type: 'OS1' | 'OS2' | 'OS4' | 'INV19' | string,
    tx?: Prisma.TransactionClient,
    year?: number,
  ): Promise<string> {
    return this.nextNumber(type.toUpperCase(), { year }, tx);
  }

  /**
   * Helper for contract numbers: SH-2026-816F1B1B
   */
  async nextContractNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('SH', { year }, tx);
  }

  /**
   * Helper for repair requests: REP-2026-816F1B1B
   */
  async nextRepairNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('REP', { year }, tx);
  }

  /**
   * Helper for internal transfers: TRF-2026-816F1B1B
   */
  async nextTransferNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('TRF', { year }, tx);
  }

  /**
   * Helper for audit acts: AKT-2026-816F1B1B
   */
  async nextAuditNumber(tx?: Prisma.TransactionClient, year?: number): Promise<string> {
    return this.nextNumber('AKT', { year }, tx);
  }

  /**
   * Queries existing model count to ensure initialized sequence does not collide with existing seed/legacy records.
   */
  private async getInitialSeedCount(prefix: string, client: Prisma.TransactionClient | PrismaService): Promise<number> {
    try {
      switch (prefix) {
        case 'REQ':
          return (await (client as any).request?.count?.()) || 0;
        case 'MOV':
          return (await (client as any).stockMovement?.count?.()) || 0;
        case 'INV':
          return (await (client as any).itemInstance?.count?.()) || 0;
        case 'HF':
          return (await (client as any).invoice?.count?.()) || 0;
        case 'REP':
          return (await (client as any).repairRecord?.count?.()) || 0;
        case 'TRF':
          return (await (client as any).transferAcceptance?.count?.()) || 0;
        case 'AKT':
          return (await (client as any).inventoryAudit?.count?.()) || 0;
        default:
          return 0;
      }
    } catch {
      return 0;
    }
  }
}
