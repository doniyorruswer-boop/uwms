import { Test, TestingModule } from '@nestjs/testing';
import { BackupsService } from './backups.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BackupType } from '@prisma/client';

describe('BackupsService (Unit Tests)', () => {
  let service: BackupsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      backupRecord: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyRole: jest.fn() } },
      ],
    }).compile();

    service = module.get<BackupsService>(BackupsService);
  });

  describe('formatBytes helper', () => {
    it('baytlarni to‘g‘ri formatlashi kerak (0 B, KB, MB, GB)', () => {
      expect((service as any).formatBytes(0)).toBe('0 B');
      expect((service as any).formatBytes(1024)).toBe('1 KB');
      expect((service as any).formatBytes(1048576)).toBe('1 MB');
      expect((service as any).formatBytes(1073741824)).toBe('1 GB');
      expect((service as any).formatBytes(78631)).toBe('76.79 KB');
    });
  });

  describe('getStats', () => {
    it('zaxiralar statistikasi va agregatsiyasini to‘g‘ri hisoblashi kerak', async () => {
      prisma.backupRecord.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // automatic
        .mockResolvedValueOnce(2); // manual

      prisma.backupRecord.findFirst.mockResolvedValue({
        createdAt: new Date('2026-09-13T04:22:33.000Z'),
      });

      prisma.backupRecord.findMany.mockResolvedValue([
        { fileSizeBytes: BigInt(1048576), backupType: BackupType.AUTOMATIC },
        { fileSizeBytes: BigInt(1048576), backupType: BackupType.AUTOMATIC },
        { fileSizeBytes: BigInt(524288), backupType: BackupType.AUTOMATIC },
        { fileSizeBytes: BigInt(262144), backupType: BackupType.MANUAL },
        { fileSizeBytes: BigInt(262144), backupType: BackupType.MANUAL },
      ]);

      const stats = await service.getStats();

      expect(stats.totalCount).toBe(5);
      expect(stats.automaticCount).toBe(3);
      expect(stats.manualCount).toBe(2);
      expect(stats.totalStorageBytes).toBe(3145728);
      expect(stats.totalStorageFormatted).toBe('3 MB');
      expect(stats.schedulerActive).toBe(true);
    });
  });

  describe('restoreBackup', () => {
    it('noto‘g‘ri tasdiq kodi kiritilganda RESTORE_REJECTED audit yozib BadRequestException tashlashi kerak', async () => {
      await expect(
        service.restoreBackup('backup-1', 'NOTO_G_RI', 'admin-user'),
      ).rejects.toThrow('Tasdiqlash kodi noto‘g‘ri!');

      expect((service as any).auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESTORE_REJECTED',
          entity: 'BackupRecord',
          entityId: 'backup-1',
          details: expect.objectContaining({
            reason: expect.stringContaining('noto‘g‘ri kiritildi'),
            enteredCode: 'NOTO_G_RI',
            expectedCode: 'TIKLASH',
          }),
          userId: 'admin-user',
        }),
      );
    });

    it('zaxira nusxasi bazadan topilmasa NotFoundException tashlashi kerak', async () => {
      prisma.backupRecord.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.restoreBackup('non-existent', 'TIKLASH', 'admin-user'),
      ).rejects.toThrow('Ko‘rsatilgan zaxira nusxasi topilmadi!');
    });
  });
});
