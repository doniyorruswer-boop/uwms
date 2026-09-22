import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotasService } from '../quotas/quotas.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { SequenceService } from '../common/services/sequence.service';
import { RequestStatus, RoleType } from '@prisma/client';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

import { WarehouseService } from '../warehouse/warehouse.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { EventsGateway } from '../events/events.gateway';

describe('RequestsService (Unit Tests)', () => {
  let service: RequestsService;
  let prisma: any;
  let notifications: any;
  let systemAudit: any;
  let documentStamps: any;
  let sequenceService: any;
  let eventsGateway: any;

  beforeEach(async () => {
    prisma = {
      request: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
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
        upsert: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
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

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    documentStamps = {
      stampDocument: jest.fn().mockResolvedValue({ id: 'stamp-1' }),
    };

    sequenceService = {
      nextRequestNumber: jest.fn().mockResolvedValue('REQ-2026-0001'),
      nextMovementNumber: jest.fn().mockResolvedValue('MOV-2026-0001'),
      nextDocNumber: jest.fn().mockResolvedValue('OS1-2026-0001'),
    };

    eventsGateway = {
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
      broadcast: jest.fn(),
      emitToRoom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        WarehouseService,
        CodeGeneratorService,
        QuotasService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: DocumentStampsService, useValue: documentStamps },
        { provide: SequenceService, useValue: sequenceService },
        { provide: EventsGateway, useValue: eventsGateway },
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

    it('kafedra oylik kvotasidan ortiqcha miqdor so‘ralganda isOverQuota va specialApprovalNeeded ni true qilishi kerak', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', departmentId: 'dept-1' });
      prisma.item.findUnique.mockResolvedValue({
        id: 'item-1',
        name: 'A4 Qog‘oz',
        unit: 'PACHKA',
      });
      prisma.departmentQuota.findUnique.mockResolvedValue({
        id: 'quota-1',
        departmentId: 'dept-1',
        itemId: 'item-1',
        monthlyLimit: 10,
        usedQuantity: 8,
      });
      prisma.request.create.mockImplementation(({ data }) => Promise.resolve({ id: 'req-overquota', ...data }));

      const res = await service.createRequest({
        purpose: 'Katta anjuman uchun ko‘p qog‘oz',
        requesterId: 'user-1',
        departmentId: 'dept-1',
        items: [{ itemId: 'item-1', quantity: 5 }], // 8 + 5 = 13 > 10 limit
      });

      expect(res).toBeDefined();
      expect(prisma.request.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOverQuota: true,
            specialApprovalNeeded: true,
            notes: expect.stringContaining('Kafedra oylik kvotasi oshirilgan'),
          }),
        }),
      );
    });

    it('yangi talabnoma kiritilganda Prorektor, Rektor va Omborchiga REQUEST_CREATED hamda tizimga REQUEST_UPDATED emit qilishi kerak', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', fullName: 'Ali Valiyev', departmentId: 'dept-1' });
      prisma.item.findUnique.mockResolvedValue({ id: 'item-1', name: 'A4 Qog‘oz', unit: 'PACHKA' });
      prisma.request.create.mockResolvedValue({
        id: 'req-realtime',
        requestNumber: 'REQ-2026-0001',
        purpose: 'Imtihon qog‘ozlari',
        status: RequestStatus.SUBMITTED,
        requesterId: 'user-1',
        departmentId: 'dept-1',
        isOverQuota: false,
        createdAt: new Date(),
      });

      await service.createRequest({
        purpose: 'Imtihon qog‘ozlari',
        requesterId: 'user-1',
        departmentId: 'dept-1',
        items: [{ itemId: 'item-1', quantity: 2 }],
      });

      expect(eventsGateway.emitToRole).toHaveBeenCalledWith(
        'VICE_RECTOR_FINANCE',
        'REQUEST_CREATED',
        expect.objectContaining({ requestNumber: 'REQ-2026-0001' }),
      );
      expect(eventsGateway.emitToRole).toHaveBeenCalledWith(
        'RECTOR',
        'REQUEST_CREATED',
        expect.objectContaining({ requestNumber: 'REQ-2026-0001' }),
      );
      expect(eventsGateway.broadcast).toHaveBeenCalledWith(
        'REQUEST_UPDATED',
        expect.objectContaining({ requestNumber: 'REQ-2026-0001' }),
      );
    });
  });

  describe('updateStatus (FULFILLED)', () => {
    it('omborda qoldiq yetarli bo‘lmaganda BadRequestException tashlashi va stockni o‘zgartirmasligi kerak', async () => {
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
          quantity: 3, // yetarli emas (3 < 10)
        },
      ]);

      await expect(
        service.updateStatus('req-1', RequestStatus.FULFILLED, { approvedById: 'wh-user' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
      expect(prisma.stockMovementItem.create).not.toHaveBeenCalled();
      expect(prisma.request.update).not.toHaveBeenCalled();
    });

    it('qoldiq yetarli bo‘lganda muvaffaqiyatli kamaytirishi, StockMovement yaratishi va statusni FULFILLED qilishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.HANDED_TO_COMMENDANT,
        requestNumber: 'REQ-2026-001',
        purpose: 'Qog‘oz',
        requesterId: 'user-1',
        departmentId: 'dept-1',
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
      prisma.departmentQuota.findUnique.mockResolvedValue({ id: 'dq-1', usedQuantity: 2 });
      prisma.departmentQuota.update.mockResolvedValue({ id: 'dq-1', usedQuantity: 7 });
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
      expect(prisma.stockMovementItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementId: 'mov-1',
            itemId: 'item-1',
            quantity: 5,
          }),
        }),
      );
      expect(prisma.departmentQuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dq-1' },
          data: {
            usedQuantity: {
              increment: 5,
            },
          },
        }),
      );
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

  describe('advanceWorkflowStage (7-Step Purchase Chain)', () => {
    it('Moliya prorektori bo‘lmagan foydalanuvchi APPROVED_BY_PRORECTOR qilmoqchi bo‘lsa ForbiddenException berishi kerak', async () => {
      await expect(
        service.advanceWorkflowStage(
          'req-1',
          RequestStatus.APPROVED_BY_PRORECTOR,
          { id: 'user-emp', fullName: 'O‘qituvchi', role: RoleType.EMPLOYEE },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Moliya prorektori muvaffaqiyatli viza bera olishi va rektorga bildirishnoma yuborishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'HP Kompyuterlar',
        status: RequestStatus.SUBMITTED,
        requesterId: 'user-mol',
        items: [],
      });
      prisma.request.update.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'HP Kompyuterlar',
        status: RequestStatus.APPROVED_BY_PRORECTOR,
        requesterId: 'user-mol',
        items: [],
      });

      const res = await service.advanceWorkflowStage(
        'req-1',
        RequestStatus.APPROVED_BY_PRORECTOR,
        { id: 'prorektor-1', fullName: 'Prof. Mahmudov Elyor', role: RoleType.VICE_RECTOR_FINANCE },
        { note: 'Smeta tasdiqlandi' },
      );

      expect(res.status).toBe(RequestStatus.APPROVED_BY_PRORECTOR);
      expect(notifications.notifyRole).toHaveBeenCalledWith(
        RoleType.RECTOR,
        expect.stringContaining('Rektor Vizasi Kutilmoqda'),
        expect.any(String),
        expect.any(String),
        '/requests',
      );
    });

    it('Bosh hisobchi moliyalashtirishi va sub-hisob biriktira olishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'HP Kompyuterlar',
        status: RequestStatus.APPROVED_BY_RECTOR,
        requesterId: 'user-mol',
        items: [],
      });
      prisma.request.update.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'HP Kompyuterlar',
        status: RequestStatus.FINANCED_BY_ACCOUNTANT,
        fundingSource: 'BYUDJET',
        subAccountCode: '013',
        allocatedAmount: 15000000,
        requesterId: 'user-mol',
        items: [],
      });

      const res = await service.advanceWorkflowStage(
        'req-1',
        RequestStatus.FINANCED_BY_ACCOUNTANT,
        { id: 'acc-1', fullName: 'Nazarova Munira', role: RoleType.CHIEF_ACCOUNTANT },
        { fundingSource: 'BYUDJET', subAccountCode: '013', allocatedAmount: 15000000 },
      );

      expect(res.status).toBe(RequestStatus.FINANCED_BY_ACCOUNTANT);
      expect(notifications.notifyRole).toHaveBeenCalledWith(
        RoleType.HEAD_WAREHOUSE,
        expect.stringContaining('Xarid va Omborga Kirim'),
        expect.any(String),
        expect.any(String),
        '/requests',
      );
    });

    it('Ombor kirimi (RECEIVED_AT_WAREHOUSE) da avtomatik OS-1 Kirim Dalolatnomasi muhrlanishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'HP Kompyuterlar',
        status: RequestStatus.FINANCED_BY_ACCOUNTANT,
        requesterId: 'user-mol',
        items: [],
      });
      prisma.request.update.mockResolvedValue({
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'HP Kompyuterlar',
        status: RequestStatus.RECEIVED_AT_WAREHOUSE,
        requesterId: 'user-mol',
        items: [],
      });

      const res = await service.advanceWorkflowStage(
        'req-1',
        RequestStatus.RECEIVED_AT_WAREHOUSE,
        { id: 'wh-1', fullName: 'Toshmatov Omon', role: RoleType.HEAD_WAREHOUSE },
      );

      expect(res.status).toBe(RequestStatus.RECEIVED_AT_WAREHOUSE);
      expect(documentStamps.stampDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          docType: 'OS_1',
          docNumber: 'REQ-2026-001-OS1',
        }),
      );
    });

    it('Kafedra kvotasi oshirilgan bo‘lsa (isOverQuota: true), rektorat tasdig‘isiz FULFILLED qilib bo‘lmasligi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-overquota',
        requestNumber: 'REQ-2026-0099',
        status: RequestStatus.HANDED_TO_COMMENDANT,
        isOverQuota: true,
        rectorApprovedAt: null,
        rectorApprovedById: null,
        requesterId: 'user-mol',
        items: [{ id: 'ri-1', itemId: 'item-1', requestedQty: 50, item: { name: 'A4 Qog‘oz', unit: 'quti' } }],
      });

      await expect(
        service.updateStatus('req-overquota', RequestStatus.FULFILLED, {
          approvedById: 'user-mol',
          currentUser: { id: 'user-mol', role: RoleType.MOL },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Kafedra kvotasi oshirilgan bo‘lsa ham, rektorat tasdig‘i (rectorApprovedAt) mavjud bo‘lsa muvaffaqiyatli FULFILLED bo‘lishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-overquota-approved',
        requestNumber: 'REQ-2026-0100',
        status: RequestStatus.HANDED_TO_COMMENDANT,
        isOverQuota: true,
        rectorApprovedAt: new Date(),
        rectorApprovedById: 'rector-1',
        requesterId: 'user-mol',
        departmentId: 'dept-1',
        items: [{ id: 'ri-1', itemId: 'item-1', requestedQty: 5, item: { name: 'A4 Qog‘oz', unit: 'quti', minStockLimit: 2 } }],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-main', name: 'Markaziy ombor' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'stock-1', quantity: 10 }]);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-1', movementNumber: 'MOV-2026-0001' });
      prisma.request.update.mockResolvedValue({
        id: 'req-overquota-approved',
        status: RequestStatus.FULFILLED,
        fulfilledAt: new Date(),
      });

      const res = await service.updateStatus('req-overquota-approved', RequestStatus.FULFILLED, {
        approvedById: 'user-mol',
        currentUser: { id: 'user-mol', role: RoleType.MOL },
      });

      expect(res.status).toBe(RequestStatus.FULFILLED);
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'OUTGOING',
          }),
        }),
      );
    });

    it('RECEIVED_AT_WAREHOUSE da omborga tovarlar atomik upsert qilinishi va INCOMING StockMovement yaratilishi kerak', async () => {
      prisma.request.findUnique.mockResolvedValue({
        id: 'req-procurement-1',
        requestNumber: 'REQ-2026-0050',
        purpose: 'Yangi noutbuklar xaridi',
        status: RequestStatus.FINANCED_BY_ACCOUNTANT,
        requesterId: 'user-mol',
        fundingSource: 'BYUDJET',
        items: [
          { id: 'ri-1', itemId: 'item-laptop', requestedQty: 10, approvedQty: 10, item: { name: 'Noutbuk', unit: 'dona' } },
        ],
      });
      prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-main', name: 'Bosh ombor' });
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-in-1', movementNumber: 'MOV-2026-0002' });
      prisma.request.update.mockResolvedValue({
        id: 'req-procurement-1',
        status: RequestStatus.RECEIVED_AT_WAREHOUSE,
        warehouseReceivedAt: new Date(),
      });

      const res = await service.updateStatus('req-procurement-1', RequestStatus.RECEIVED_AT_WAREHOUSE, {
        approvedById: 'wh-head-1',
        currentUser: { id: 'wh-head-1', role: RoleType.HEAD_WAREHOUSE },
      });

      expect(res.status).toBe(RequestStatus.RECEIVED_AT_WAREHOUSE);
      expect(prisma.stock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId_itemId_fundingSource: expect.objectContaining({
              warehouseId: 'wh-main',
              itemId: 'item-laptop',
              fundingSource: 'BYUDJET',
            }),
          }),
          update: { quantity: { increment: 10 } },
          create: expect.objectContaining({ quantity: 10 }),
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'INCOMING',
            toWarehouseId: 'wh-main',
          }),
        }),
      );
    });
  });
});
