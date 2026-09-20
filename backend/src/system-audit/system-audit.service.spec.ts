import { Test, TestingModule } from '@nestjs/testing';
import { SystemAuditService } from './system-audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SystemAuditService', () => {
  let service: SystemAuditService;
  let prisma: any;

  const mockPrismaService = {
    systemAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemAuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SystemAuditService>(SystemAuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('log', () => {
    it('audit yozuvini parametrlar bilan bazaga yozishi kerak', async () => {
      const mockResult = {
        id: 'audit-1',
        action: 'REPRINT_LABEL',
        entity: 'ItemInstance',
        entityId: 'item-1',
        details: JSON.stringify({ reason: 'Stiker yirtilgan' }),
        userId: 'user-1',
        createdAt: new Date(),
      };
      mockPrismaService.systemAuditLog.create.mockResolvedValue(mockResult);

      const res = await service.log({
        action: 'REPRINT_LABEL',
        entity: 'ItemInstance',
        entityId: 'item-1',
        details: { reason: 'Stiker yirtilgan' },
        userId: 'user-1',
      });

      expect(mockPrismaService.systemAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REPRINT_LABEL',
          entity: 'ItemInstance',
          entityId: 'item-1',
          details: JSON.stringify({ reason: 'Stiker yirtilgan' }),
          userId: 'user-1',
        }),
      });
      expect(res).toEqual(mockResult);
    });

    it('baza xatolik berganda asosiy oqimni to‘xtatmasdan null qaytarishi kerak', async () => {
      mockPrismaService.systemAuditLog.create.mockRejectedValue(new Error('DB Connection Lost'));

      const res = await service.log({
        action: 'LOGIN',
        entity: 'User',
      });

      expect(res).toBeNull();
    });
  });

  describe('findAll', () => {
    it('barcha audit jurnallarini paginatsiya bilan qaytarishi kerak', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'CREATE', entity: 'Asset' },
        { id: 'log-2', action: 'UPDATE', entity: 'Stock' },
      ];
      mockPrismaService.systemAuditLog.count.mockResolvedValue(2);
      mockPrismaService.systemAuditLog.findMany.mockResolvedValue(mockLogs);

      const res = await service.findAll({ page: 1, limit: 10 });

      expect(res.total).toBe(2);
      expect(res.page).toBe(1);
      expect(res.items).toEqual(mockLogs);
    });

    it('BIOMETRIC_SIGN so‘ralganda BIOMETRIC_SIGN va BIOMETRIC_SIGNED harakatlarini birgalikda izlashi kerak', async () => {
      mockPrismaService.systemAuditLog.count.mockResolvedValue(1);
      mockPrismaService.systemAuditLog.findMany.mockResolvedValue([]);

      await service.findAll({ action: 'BIOMETRIC_SIGN' });

      expect(mockPrismaService.systemAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: { in: ['BIOMETRIC_SIGN', 'BIOMETRIC_SIGNED'] },
          }),
        }),
      );
    });

    it('yangi harakatlar (WORM_STAMP_GENERATE, REPRINT_LABEL, QUOTA_OVERRIDE) bo‘yicha to‘g‘ri filter qilishi kerak', async () => {
      mockPrismaService.systemAuditLog.count.mockResolvedValue(1);
      mockPrismaService.systemAuditLog.findMany.mockResolvedValue([]);

      await service.findAll({ action: 'WORM_STAMP_GENERATE', entity: 'DocumentStamp' });

      expect(mockPrismaService.systemAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'WORM_STAMP_GENERATE',
            entity: 'DocumentStamp',
          }),
        }),
      );
    });
  });
});
