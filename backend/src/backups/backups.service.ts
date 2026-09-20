import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { CreateBackupDto, QueryBackupDto } from './dto/backup.dto';
import { BackupType, BackupStatus } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly backupDir = path.resolve(process.cwd(), 'backups');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: SystemAuditService,
  ) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private formatBytes(bytes: number | bigint): string {
    const num = Number(bytes);
    if (num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatItem(item: any) {
    return {
      id: item.id,
      filename: item.filename,
      filePath: item.filePath,
      fileSizeBytes: Number(item.fileSizeBytes),
      fileSizeFormatted: this.formatBytes(item.fileSizeBytes),
      backupType: item.backupType,
      status: item.status,
      checksum: item.checksum,
      notes: item.notes,
      triggeredById: item.triggeredById,
      triggeredBy: item.triggeredBy,
      createdAt: item.createdAt.toISOString(),
      completedAt: item.completedAt ? item.completedAt.toISOString() : undefined,
    };
  }

  async findAll(query: QueryBackupDto) {
    const { page = 1, limit = 20, backupType, status, search } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    if (backupType) where.backupType = backupType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.backupRecord.count({ where }),
      this.prisma.backupRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          triggeredBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take) || 1,
      items: records.map((r) => this.formatItem(r)),
    };
  }

  async getStats() {
    const [allBackups, latest] = await Promise.all([
      this.prisma.backupRecord.findMany({
        select: { backupType: true, fileSizeBytes: true },
      }),
      this.prisma.backupRecord.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    let totalStorageBytes = 0n;
    let automaticCount = 0;
    let manualCount = 0;

    for (const b of allBackups) {
      totalStorageBytes += BigInt(b.fileSizeBytes);
      if (b.backupType === BackupType.AUTOMATIC) automaticCount++;
      else manualCount++;
    }

    return {
      totalCount: allBackups.length,
      automaticCount,
      manualCount,
      totalStorageBytes: Number(totalStorageBytes),
      totalStorageFormatted: this.formatBytes(totalStorageBytes),
      latestBackupDate: latest ? latest.createdAt.toISOString() : null,
      schedulerActive: true,
      schedulerSchedule: 'Har kuni 02:00 da (UTC+5)',
    };
  }

  private getCleanDbConnection(): { cleanUrl: string; env: NodeJS.ProcessEnv } {
    const rawUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/uwms_db';
    try {
      const parsed = new URL(rawUrl);
      parsed.search = ''; // Strip Prisma ?schema=public and other unsupported params
      const cleanUrl = parsed.toString();
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PGPASSWORD: decodeURIComponent(parsed.password),
      };
      return { cleanUrl, env };
    } catch {
      return { cleanUrl: rawUrl.split('?')[0], env: process.env };
    }
  }

  /**
   * Har kuni soat 02:00 da (UTC+5) avtomatik zaxira nusxasi olish (Task 6.3 Cron Scheduler)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleAutomaticDailyBackup() {
    this.logger.log('Rejali avtomatik zaxira nusxasi yaratilishi boshlanmoqda (Cron 02:00)...');
    try {
      await this.createBackup(
        { notes: 'Rejali avtomatik kunlik zaxira nusxasi (Cron 02:00)' },
        undefined,
        BackupType.AUTOMATIC,
      );
      this.logger.log('Rejali avtomatik zaxira nusxasi muvaffaqiyatli yakunlandi.');
    } catch (error: any) {
      this.logger.error(`Rejali avtomatik zaxira nusxasi yaratishda xatolik: ${error.message}`);
    }
  }

  async createBackup(
    dto: CreateBackupDto,
    userId?: string,
    backupType: BackupType = BackupType.MANUAL,
  ) {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '_').slice(0, 19);
    const filename = `uwms_backup_${timestamp}.dump`;
    const filePath = path.join(this.backupDir, filename);

    // Initial record
    const record = await this.prisma.backupRecord.create({
      data: {
        filename,
        filePath,
        backupType,
        status: BackupStatus.IN_PROGRESS,
        notes: dto.notes || (backupType === BackupType.AUTOMATIC ? 'Rejali avtomatik zaxira nusxasi' : 'Foydalanuvchi tomonidan qo‘lda yaratilgan zaxira nusxasi'),
        triggeredById: userId || null,
      },
    });

    try {
      const { cleanUrl, env } = this.getCleanDbConnection();
      
      // Execute genuine pg_dump with custom compressed format (-Fc) using parameterized execFile
      await execFileAsync('pg_dump', ['-Fc', cleanUrl, '-f', filePath], { env });

      if (!fs.existsSync(filePath)) {
        throw new Error('pg_dump yakunlandi, lekin zaxira fayli yaratilmadi!');
      }

      const stat = fs.statSync(filePath);
      if (stat.size === 0) {
        throw new Error('Yaratilgan zaxira fayli bo‘sh (0 bayt)!');
      }

      const fileBuffer = fs.readFileSync(filePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const updated = await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          fileSizeBytes: BigInt(stat.size),
          checksum,
          status: BackupStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          triggeredBy: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true,
            },
          },
        },
      });

      await this.auditService.log({
        action: 'CREATE',
        entity: 'BackupRecord',
        entityId: updated.id,
        details: { filename, size: stat.size, checksum },
        userId,
      });

      return this.formatItem(updated);
    } catch (error: any) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup error
        }
      }

      await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          status: BackupStatus.FAILED,
          completedAt: new Date(),
        },
      });
      this.logger.error(`Backup generation failed: ${error.message}`);
      throw new BadRequestException(`Zaxira nusxasi yaratishda xatolik yuz berdi: ${error.message}`);
    }
  }

  async restoreBackup(id: string, confirmation: string, userId?: string) {
    if (confirmation.trim().toUpperCase() !== 'TIKLASH') {
      await this.auditService.log({
        action: 'RESTORE_REJECTED',
        entity: 'BackupRecord',
        entityId: id,
        details: {
          reason: 'Ikki bosqichli xavfsizlik tasdiq kodi noto‘g‘ri kiritildi',
          enteredCode: confirmation,
          expectedCode: 'TIKLASH',
        },
        userId,
      });
      throw new BadRequestException('Tasdiqlash kodi noto‘g‘ri! Davom etish uchun "TIKLASH" so‘zini kiriting.');
    }

    const backup = await this.prisma.backupRecord.findUnique({
      where: { id },
      include: {
        triggeredBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
      },
    });

    if (!backup) {
      throw new NotFoundException('Ko‘rsatilgan zaxira nusxasi topilmadi!');
    }

    if (!fs.existsSync(backup.filePath)) {
      throw new BadRequestException(`Zaxira nusxasi fayli diskda topilmadi: ${backup.filename}`);
    }

    // Verify integrity before restoring
    const fileBuffer = fs.readFileSync(backup.filePath);
    const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (backup.checksum && backup.checksum !== actualChecksum) {
      throw new BadRequestException('Xavfsizlik xatosi: Zaxira fayli butunligi buzilgan (checksum mos kelmadi)!');
    }

    const { cleanUrl, env } = this.getCleanDbConnection();

    try {
      this.logger.log(`Starting real pg_restore for backup: ${backup.filename}`);
      // --clean: drop database objects prior to recreating them
      // --if-exists: do not report errors if objects do not exist when dropping
      // --no-owner: skip restoration of object ownership
      // --no-privileges: skip restoration of access privileges
      await execFileAsync(
        'pg_restore',
        ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-d', cleanUrl, backup.filePath],
        { env }
      );
      this.logger.log(`pg_restore successfully finished for backup: ${backup.filename}`);
    } catch (restoreError: any) {
      this.logger.error(`pg_restore execution failed: ${restoreError.message}`);
      const stderr = (restoreError.stderr || restoreError.message || '').toString();
      throw new BadRequestException(
        `Ma’lumotlar bazasini tiklashda xatolik yuz berdi: ${stderr.trim() || restoreError.message}`
      );
    }

    await this.auditService.log({
      action: 'RESTORE',
      entity: 'BackupRecord',
      entityId: backup.id,
      details: {
        filename: backup.filename,
        confirmedBy: userId,
        confirmationCode: 'TIKLASH',
        twoFactorConfirmed: true,
        checksum: backup.checksum,
        restoredAt: new Date().toISOString(),
      },
      userId,
    });

    const updated = await this.prisma.backupRecord.update({
      where: { id },
      data: { status: BackupStatus.RESTORED },
      include: {
        triggeredBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
      },
    });

    return {
      message: 'Zaxira nusxasi orqali ma’lumotlar bazasi muvaffaqiyatli tiklandi.',
      backup: this.formatItem(updated),
    };
  }

  async deleteBackup(id: string, userId?: string) {
    const backup = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!backup) {
      throw new NotFoundException('O‘chirilayotgan zaxira nusxasi topilmadi!');
    }

    if (fs.existsSync(backup.filePath)) {
      try {
        fs.unlinkSync(backup.filePath);
      } catch (e) {
        this.logger.warn(`Failed to delete physical file: ${backup.filePath}`);
      }
    }

    await this.prisma.backupRecord.delete({ where: { id } });

    await this.auditService.log({
      action: 'DELETE',
      entity: 'BackupRecord',
      entityId: id,
      details: { filename: backup.filename },
      userId,
    });

    return {
      success: true,
      message: 'Zaxira nusxasi muvaffaqiyatli o‘chirildi.',
    };
  }

  async getBackupFile(id: string) {
    const backup = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!backup) {
      throw new NotFoundException('Zaxira nusxasi topilmadi!');
    }

    if (!fs.existsSync(backup.filePath)) {
      throw new NotFoundException('Zaxira fayli diskdan topilmadi!');
    }

    return {
      filePath: backup.filePath,
      filename: backup.filename,
    };
  }
}
