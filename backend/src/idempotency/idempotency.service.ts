import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotency kaliti bo‘yicha avval saqlangan natijani qidirish
   */
  async get(key: string): Promise<{ statusCode: number; data: any } | null> {
    try {
      const record = await this.prisma.idempotencyKey.findUnique({
        where: { key },
      });

      if (!record) return null;

      let parsedData: any;
      try {
        parsedData = JSON.parse(record.responseJson);
      } catch {
        parsedData = record.responseJson;
      }

      return {
        statusCode: record.statusCode,
        data: parsedData,
      };
    } catch (err: any) {
      this.logger.warn(`Idempotency get error for key ${key}: ${err.message}`);
      return null;
    }
  }

  /**
   * Tranzaksiya muvaffaqiyatli yakunlangach javobni saqlash
   */
  async save(
    key: string,
    endpoint: string,
    statusCode: number,
    responseData: any,
  ): Promise<void> {
    try {
      const responseJson =
        typeof responseData === 'string'
          ? responseData
          : JSON.stringify(responseData);

      await this.prisma.idempotencyKey.upsert({
        where: { key },
        update: {
          endpoint,
          statusCode,
          responseJson,
        },
        create: {
          key,
          endpoint,
          statusCode,
          responseJson,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to persist idempotency key ${key}: ${err.message}`);
    }
  }
}
