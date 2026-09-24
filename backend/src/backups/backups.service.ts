import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { CreateBackupDto, QueryBackupDto } from './dto/backup.dto';
import { S3StorageService } from './s3-storage.service';
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
    private readonly s3Service: S3StorageService,
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
      storageLocation: item.storageLocation || 'LOCAL',
      s3Key: item.s3Key || undefined,
      s3Bucket: item.s3Bucket || undefined,
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

  private getPostgresBinary(binaryName: 'pg_dump' | 'pg_restore'): string {
    const envKey = binaryName === 'pg_dump' ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH';
    if (process.env[envKey] && fs.existsSync(process.env[envKey]!)) {
      return process.env[envKey]!;
    }

    const winPaths = [
      `C:\\Program Files\\PostgreSQL\\18\\bin\\${binaryName}.exe`,
      `C:\\Program Files\\PostgreSQL\\17\\bin\\${binaryName}.exe`,
      `C:\\Program Files\\PostgreSQL\\16\\bin\\${binaryName}.exe`,
      `C:\\Program Files\\PostgreSQL\\15\\bin\\${binaryName}.exe`,
      `C:\\Program Files (x86)\\PostgreSQL\\18\\bin\\${binaryName}.exe`,
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }

    return binaryName;
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
      const pgDumpBin = this.getPostgresBinary('pg_dump');
      
      // Execute genuine pg_dump with custom compressed format (-Fc) using parameterized execFile
      await execFileAsync(pgDumpBin, ['-Fc', cleanUrl, '-f', filePath], { env });

      if (!fs.existsSync(filePath)) {
        throw new Error('pg_dump yakunlandi, lekin zaxira fayli yaratilmadi!');
      }

      const stat = fs.statSync(filePath);
      if (stat.size === 0) {
        throw new Error('Yaratilgan zaxira fayli bo‘sh (0 bayt)!');
      }

      const fileBuffer = fs.readFileSync(filePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // S3 / MinIO Cloud Replication check
      const shouldUploadToS3 = dto.uploadToS3 !== undefined
        ? Boolean(dto.uploadToS3)
        : (this.s3Service.isConfigured() || backupType === BackupType.AUTOMATIC);

      let s3UploadInfo: { bucket: string; key: string; checksum: string } | null = null;
      if (shouldUploadToS3) {
        this.logger.log(`Zaxira nusxasini tashqi S3/MinIO saqlagichiga shifrlangan holda yuklash boshlanmoqda: ${filename}`);
        try {
          s3UploadInfo = await this.s3Service.uploadBackup(filename, fileBuffer, {
            backupId: record.id,
            backupType,
            checksum,
            createdAt: new Date().toISOString(),
          });
          this.logger.log(`S3/MinIO ga muvaffaqiyatli yuklandi. Bucket: ${s3UploadInfo.bucket}, Key: ${s3UploadInfo.key}`);
        } catch (s3Err: any) {
          this.logger.error(`S3/MinIO saqlagichiga nusxalashda xatolik yuz berdi: ${s3Err.message}`);
          if (dto.uploadToS3 === true && this.s3Service.isConfigured()) {
            throw new BadRequestException(`S3 saqlagichiga nusxalash amalga oshmadi: ${s3Err.message}`);
          }
        }
      }

      const storageLocation = s3UploadInfo ? 'BOTH' : 'LOCAL';

      const updated = await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          fileSizeBytes: BigInt(stat.size),
          checksum,
          storageLocation,
          s3Key: s3UploadInfo?.key || null,
          s3Bucket: s3UploadInfo?.bucket || null,
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
        details: {
          filename,
          size: stat.size,
          checksum,
          storageLocation,
          s3Key: s3UploadInfo?.key,
          s3Bucket: s3UploadInfo?.bucket,
        },
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
      if (backup.s3Key) {
        this.logger.log(`Tiklash uchun lokal fayl topilmadi. S3/MinIO dan yuklab olinmoqda va tiklanmoqda... (Key: ${backup.s3Key})`);
        try {
          const downloadedBuffer = await this.s3Service.downloadBackup(backup.s3Key);
          fs.writeFileSync(backup.filePath, downloadedBuffer);
          this.logger.log(`S3/MinIO dan tiklangan fayl lokal diskka yozildi: ${backup.filePath}`);
        } catch (downloadErr: any) {
          throw new BadRequestException(`S3/MinIO dan zaxira nusxasini yuklab olishda xatolik: ${downloadErr.message}`);
        }
      } else {
        throw new BadRequestException(`Zaxira nusxasi fayli diskda topilmadi: ${backup.filename}`);
      }
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
      const pgRestoreBin = this.getPostgresBinary('pg_restore');
      await execFileAsync(
        pgRestoreBin,
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

    if (backup.s3Key) {
      try {
        await this.s3Service.deleteBackup(backup.s3Key);
        this.logger.log(`S3/MinIO dagi zaxira fayli o‘chirildi: ${backup.s3Key}`);
      } catch (s3DelErr: any) {
        this.logger.warn(`S3/MinIO dan o‘chirishda ogohlantirish: ${s3DelErr.message}`);
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
      if (backup.s3Key) {
        this.logger.log(`Lokal fayl diskda yo‘q. S3/MinIO dan yuklab olinmoqda va tiklanmoqda: ${backup.filename}`);
        try {
          const downloadedBuffer = await this.s3Service.downloadBackup(backup.s3Key);
          fs.writeFileSync(backup.filePath, downloadedBuffer);
        } catch (err: any) {
          this.logger.error(`S3 dan yuklab olishda xatolik: ${err.message}`);
          throw new NotFoundException(`Zaxira fayli na lokal diskda, na S3 da mavjud emas: ${err.message}`);
        }
      } else {
        throw new NotFoundException('Zaxira fayli diskdan topilmadi!');
      }
    }

    return {
      filePath: backup.filePath,
      filename: backup.filename,
    };
  }
}
