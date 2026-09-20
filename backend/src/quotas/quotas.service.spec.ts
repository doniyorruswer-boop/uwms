import { Test, TestingModule } from '@nestjs/testing';
import { QuotasService } from './quotas.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('QuotasService (Unit Tests)', () => {
  let service: QuotasService;
  let prisma: any;
  let systemAudit: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      departmentQuota: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(true),
    };

    notifications = {
      create: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotasService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<QuotasService>(QuotasService);
  });

  describe('checkQuota', () => {
    it('limit belgilanmagan bo‘lsa hasLimit=false va isExceeded=false qaytarishi kerak', async () => {
      prisma.departmentQuota.findUnique.mockResolvedValue(null);

      const result = await service.checkQuota({
        departmentId: 'dept-1',
        itemId: 'item-1',
        requestedQty: 10,
        period: '2026-09',
      });

      expect(result.hasLimit).toBe(false);
      expect(result.isExceeded).toBe(false);
      expect(result.monthlyLimit).toBeNull();
    });

    it('limitdan oshmagan bo‘lsa isExceeded=false va qoldiqni to‘g‘ri hisoblashi kerak', async () => {
      prisma.departmentQuota.findUnique.mockResolvedValue({
        id: 'q-1',
        monthlyLimit: 20,
        usedQuantity: 5,
        department: { name: 'Kafedra' },
        item: { name: 'Qog‘oz' },
      });

      const result = await service.checkQuota({
        departmentId: 'dept-1',
        itemId: 'item-1',
        requestedQty: 10,
        period: '2026-09',
      });

      expect(result.hasLimit).toBe(true);
      expect(result.isExceeded).toBe(false);
      expect(result.remaining).toBe(15);
    });

    it('so‘ralgan miqdor limitdan oshganda isExceeded=true qaytarishi kerak', async () => {
      prisma.departmentQuota.findUnique.mockResolvedValue({
        id: 'q-1',
        monthlyLimit: 10,
        usedQuantity: 8,
        department: { name: 'Kafedra' },
        item: { name: 'Qog‘oz' },
      });

      const result = await service.checkQuota({
        departmentId: 'dept-1',
        itemId: 'item-1',
        requestedQty: 5, // 8 + 5 = 13 > 10
        period: '2026-09',
      });

      expect(result.hasLimit).toBe(true);
      expect(result.isExceeded).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('mavjud kvotaning ishlatilgan miqdorini atomik oshirishi kerak', async () => {
      prisma.departmentQuota.findUnique.mockResolvedValue({
        id: 'q-1',
        usedQuantity: 2,
      });

      await service.recordUsage('dept-1', 'item-1', 4, '2026-09');

      expect(prisma.departmentQuota.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: {
          usedQuantity: { increment: 4 },
        },
      });
    });
  });

  describe('setQuota', () => {
    it('kafedra kvotasini upsert qilishi va audit log yozishi kerak', async () => {
      prisma.departmentQuota.upsert.mockResolvedValue({
        id: 'q-1',
        monthlyLimit: 30,
        department: { name: 'Informatika' },
        item: { name: 'Qalam' },
      });

      const result = await service.setQuota(
        { departmentId: 'dept-1', itemId: 'item-1', monthlyLimit: 30, period: '2026-09' },
        'admin-user',
      );

      expect(result.monthlyLimit).toBe(30);
      expect(prisma.departmentQuota.upsert).toHaveBeenCalled();
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUOTA_UPDATE',
          entity: 'DepartmentQuota',
        }),
      );
    });
  });
});
