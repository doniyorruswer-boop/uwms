import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotasService } from '../quotas/quotas.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { RequestStatus, RoleType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RequestsService (Unit Tests)', () => {
  let service: RequestsService;
  let prisma: any;
  let notifications: any;
  let quotas: any;
  let systemAudit: any;
  let documentStamps: any;

  beforeEach(async () => {
    prisma = {
      request: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      item: {
        findUnique: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      stock: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      stockMovementItem: {
        create: jest.fn(),
      },
      requestItem: {
        create: jest.fn(),
        update: jest.fn(),
      },
      departmentQuota: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    notifications = {
      create: jest.fn().mockResolvedValue(null),
      notifyRole: jest.fn().mockResolvedValue(null),
    };

    quotas = {
      checkQuota: jest.fn().mockResolvedValue({ allowed: true }),
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    documentStamps = {
      stampDocument: jest.fn().mockResolvedValue({ id: 'stamp-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: QuotasService, useValue: quotas },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: DocumentStampsService, useValue: documentStamps },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  describe('getAllRequests', () => {
    it('barcha talabnomalarni paginatsiya bilan to‘g‘ri qaytarishi kerak', async () => {
      prisma.request.findMany.mockResolvedValue([
        {
          id: 'req-1',
          requestNumber: 'REQ-2026-001',
          purpose: 'Kafedra uchun qog‘oz',
          status: RequestStatus.PENDING,
          isOverQuota: false,
          specialApprovalNeeded: false,
          requesterId: 'user-1',
          requester: { fullName: 'Alimov Jasur' },
          department: { name: 'Dasturiy injiniring' },
          approvalNote: null,
          createdAt: new Date('2026-09-15T10:00:00.000Z'),
          items: [
            {
              id: 'ri-1',
              itemId: 'item-1',
              requestedQty: 5,
              approvedQty: null,
              item: { name: 'A4 Qog‘oz', unit: 'PACHKA' },
            },
          ],
        },
      ]);
      prisma.request.count.mockResolvedValue(1);

      const result = (await service.getAllRequests({ page: 1, limit: 10 })) as any;

      expect(result.data).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.data[0].requestNumber).toBe('REQ-2026-001');
    });
  });

  describe('createRequest', () => {
    it('mavjud katalogdagi tovar bilan talabnomani muvaffaqiyatli yaratishi kerak', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', departmentId: 'dept-1' });
      prisma.item.findUnique.mockResolvedValue({
        id: 'item-1',
        name: 'A4 Qog‘oz',
        unit: 'PACHKA',
      });
      prisma.departmentQuota.findUnique.mockResolvedValue(null);
      prisma.request.create.mockResolvedValue({
        id: 'req-new',
        requestNumber: 'REQ-2026-ABCDEF12',
        purpose: 'Imtihonlar uchun',
        status: RequestStatus.PENDING,
      });

      const res = await service.createRequest({
        purpose: 'Imtihonlar uchun',
        requesterId: 'user-1',
        items: [{ itemId: 'item-1', quantity: 3 }],
      });

      expect(res).toBeDefined();
      expect(prisma.request.create).toHaveBeenCalled();
      expect(notifications.notifyRole).toHaveBeenCalledWith(
        RoleType.HEAD_WAREHOUSE,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '/requests',
      );
    });

    it('tovar katalogda topilmasa BadRequestException tashlashi kerak', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(
        service.createRequest({
          purpose: 'Yangi narsa',
          requesterId: 'user-1',
          items: [{ itemId: 'not-exist', quantity: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus (FULFILLED)', () => {
    it('omborda qoldiq yetarli bo‘lmaganda BadRequestException tashlashi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'Qog‘oz',
        requesterId: 'user-1',
        items: [
          {
            id: 'ri-1',
            itemId: 'item-1',
            requestedQty: 10,
            item: { name: 'A4 Qog‘oz', unit: 'PACHKA', minStockLimit: 5 },
          },
        ],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-main' });
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'stock-1',
          quantity: 3, // yetarli emas
        },
      ]);

      await expect(
        service.updateStatus('req-1', RequestStatus.FULFILLED, { approvedById: 'wh-user' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('qoldiq yetarli bo‘lganda muvaffaqiyatli kamaytirishi va FULFILLED qilishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'Qog‘oz',
        requesterId: 'user-1',
        items: [
          {
            id: 'ri-1',
            itemId: 'item-1',
            requestedQty: 5,
            item: { name: 'A4 Qog‘oz', unit: 'PACHKA', minStockLimit: 5 },
          },
        ],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-main' });
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'stock-1',
          quantity: 20, // yetarli
        },
      ]);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-1', movementNumber: 'MOV-1' });
      prisma.request.update.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.FULFILLED,
        requestNumber: 'REQ-2026-001',
        purpose: 'Qog‘oz',
        requesterId: 'user-1',
        items: [{ item: { name: 'A4 Qog‘oz', unit: 'PACHKA' } }],
      });

      const res = await service.updateStatus('req-1', RequestStatus.FULFILLED, {
        approvedById: 'wh-user',
      });

      expect(res.status).toBe(RequestStatus.FULFILLED);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.stockMovement.create).toHaveBeenCalled();
    });

    it('parallel tranzaksiya oqibatida atomik kamaytirish muvaffaqiyatsiz bo‘lsa (affectedRows = 0) xato tashlashi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'Qog‘oz',
        requesterId: 'user-1',
        items: [
          {
            id: 'ri-1',
            itemId: 'item-1',
            requestedQty: 5,
            item: { name: 'A4 Qog‘oz', unit: 'PACHKA', minStockLimit: 5 },
          },
        ],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-main' });
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'stock-1',
          quantity: 5,
        },
      ]);
      prisma.$executeRaw.mockResolvedValue(0); // parallel o'zgarish sababli update bo'lmadi

      await expect(
        service.updateStatus('req-1', RequestStatus.FULFILLED, { approvedById: 'wh-user' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
