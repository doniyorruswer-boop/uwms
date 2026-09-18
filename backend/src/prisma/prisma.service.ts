import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'check_stock_quantity_non_negative'
          ) THEN
            ALTER TABLE stocks ADD CONSTRAINT check_stock_quantity_non_negative CHECK (quantity >= 0);
          END IF;
        END $$;
      `);
    } catch (err: any) {
      this.logger.warn(`Could not verify check_stock_quantity_non_negative constraint: ${err?.message || err}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
