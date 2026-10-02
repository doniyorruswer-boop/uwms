import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  NAMDTU_FACULTIES,
  NAMDTU_CHAIRS,
  NAMDTU_CENTERS,
  NAMDTU_ADMIN_DEPARTMENTS,
} from './namdtu-structure';

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
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
      `);
      this.logger.log('Verified database schema: "users"."permissions" column exists.');
    } catch (err: any) {
      this.logger.warn(`Could not verify "users"."permissions" column: ${err?.message || err}`);
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

    // 4. BackupRecord S3 storage columns
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "backup_records" ADD COLUMN IF NOT EXISTS "storageLocation" TEXT DEFAULT 'LOCAL';
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "backup_records" ADD COLUMN IF NOT EXISTS "s3Key" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "backup_records" ADD COLUMN IF NOT EXISTS "s3Bucket" TEXT;
      `);
      this.logger.log('Verified database schema: "backup_records" S3 columns exist.');
    } catch (err: any) {
      this.logger.warn(`Could not verify "backup_records" S3 columns: ${err?.message || err}`);
    }

    // 5. Bootstrap: NamDTU rasmiy tashkiliy tuzilmasini (8 ta fakultet, 36 ta kafedra, 4 ta markaz, 21 ta bo'lim) avtomatik sinxronlashtirish
    await this.bootstrapNamDTUStructure();

    // 6. Bootstrap: Agar hech qanday foydalanuvchi yo'q bo'lsa, asosiy admin yaratish
    await this.bootstrapAdminIfEmpty();
  }

  private async bootstrapNamDTUStructure() {
    try {
      // 1. Fakultetlar (8 ta)
      const facultyMap = new Map<string, string>(); // code -> id
      for (const fac of NAMDTU_FACULTIES) {
        const record = await (this as any).department.upsert({
          where: { code: fac.code },
          update: { name: fac.name, type: 'FACULTY' },
          create: {
            code: fac.code,
            name: fac.name,
            type: 'FACULTY',
          },
        });
        facultyMap.set(fac.code, record.id);
      }

      // 2. Kafedralar (36 ta)
      for (const chair of NAMDTU_CHAIRS) {
        const parentFacultyId = facultyMap.get(chair.facultyCode) || null;
        await (this as any).department.upsert({
          where: { code: chair.code },
          update: {
            name: chair.name,
            type: 'CHAIR',
            parentId: parentFacultyId,
          },
          create: {
            code: chair.code,
            name: chair.name,
            type: 'CHAIR',
            parentId: parentFacultyId,
          },
        });
      }

      // 3. Markazlar (4 ta)
      for (const center of NAMDTU_CENTERS) {
        await (this as any).department.upsert({
          where: { code: center.code },
          update: { name: center.name, type: center.type },
          create: {
            code: center.code,
            name: center.name,
            type: center.type,
          },
        });
      }

      // 4. Ma'muriy bo'limlar (21 ta)
      for (const adm of NAMDTU_ADMIN_DEPARTMENTS) {
        await (this as any).department.upsert({
          where: { code: adm.code },
          update: { name: adm.name, type: adm.type },
          create: {
            code: adm.code,
            name: adm.name,
            type: adm.type,
          },
        });
      }

      this.logger.log('NamDTU organizational hierarchy bootstrap verified: 69 departments in sync.');
    } catch (err: any) {
      this.logger.warn(`NamDTU structure bootstrap warning: ${err?.message || err}`);
    }
  }

  private async bootstrapAdminIfEmpty() {
    try {
      const userCount = await (this as any).user.count();
      if (userCount > 0) {
        this.logger.log(`Bootstrap skipped: ${userCount} user(s) already exist in database.`);
        return;
      }

      this.logger.warn('No users found in database. Creating bootstrap admin user...');

      // Department: Raqamli ta'lim texnologiyalari markazi (yoki ATM)
      const dept = await (this as any).department.upsert({
        where: { code: 'MARKAZ_RAQAMLI_TALIM_TEXNOLOGIYALARI' },
        update: {},
        create: {
          name: "Raqamli ta'lim texnologiyalari markazi",
          code: 'MARKAZ_RAQAMLI_TALIM_TEXNOLOGIYALARI',
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
