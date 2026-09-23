import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();

    // 1. Stock quantity constraint
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

    // 2. User.permissions column
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
      `);
      this.logger.log('Verified database schema: "User"."permissions" column exists.');
    } catch (err: any) {
      this.logger.warn(`Could not verify "User"."permissions" column: ${err?.message || err}`);
    }

    // 3. Department.buildingId column
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "buildingId" TEXT;
      `);
      this.logger.log('Verified database schema: "departments"."buildingId" column exists.');
    } catch (err: any) {
      this.logger.warn(`Could not verify "departments"."buildingId" column: ${err?.message || err}`);
    }

    // 4. Bootstrap: Agar hech qanday foydalanuvchi yo'q bo'lsa, asosiy admin yaratish
    await this.bootstrapAdminIfEmpty();
  }

  private async bootstrapAdminIfEmpty() {
    try {
      const userCount = await (this as any).user.count();
      if (userCount > 0) {
        this.logger.log(`Bootstrap skipped: ${userCount} user(s) already exist in database.`);
        return;
      }

      this.logger.warn('No users found in database. Creating bootstrap admin user...');

      // Department yaratish (yo'q bo'lsa)
      const dept = await (this as any).department.upsert({
        where: { code: 'ATM_CENTER' },
        update: {},
        create: {
          name: 'Axborot Texnologiyalari Markazi',
          code: 'ATM_CENTER',
          type: 'DIVISION',
        },
      });

      // Default parol: env'dan yoki 'Admin123!@#'
      const defaultPass = process.env.SYSTEM_DEFAULT_PASSWORD || 'Admin123!@#';
      const passwordHash = await bcrypt.hash(defaultPass, 10);

      await (this as any).user.create({
        data: {
          fullName: 'Bosh Administrator',
          username: 'admin',
          email: 'admin@university.uz',
          password: passwordHash,
          role: 'SUPER_ADMIN',
          departmentId: dept.id,
          isActive: true,
          mustChangePassword: true,
          permissions: [],
        },
      });

      this.logger.log(`Bootstrap admin user created. Username: admin, Password: ${defaultPass}`);
    } catch (err: any) {
      this.logger.error(`Bootstrap admin creation failed: ${err?.message || err}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
