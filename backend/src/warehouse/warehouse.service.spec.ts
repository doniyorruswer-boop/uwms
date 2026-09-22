import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from './warehouse.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { EventsGateway } from '../events/events.gateway';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

describe('WarehouseService (Unit Tests)', () => {
  let service: WarehouseService;
  let prisma: any;
  let codeGen: any;
  let eventsGateway: any;

  beforeEach(async () => {
    eventsGateway = {
      server: {
        emit: jest.fn(),
      },
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
    };

    prisma = {
      stock: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      stockMovementItem: {
        create: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      building: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      item: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => {
        if (Array.isArray(callback)) {
          return Promise.all(callback);
        }
        return callback(prisma);
      }),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    codeGen = {
      generateMovementNumber: jest.fn().mockReturnValue('MOV-2026-0001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: codeGen },
        { provide: SystemAuditService, useValue: { log: jest.fn() } },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
  });

  describe('getStocks', () => {
    it('sarf tovarlari qoldiqlarini to‘g‘ri hisoblab qaytarishi kerak', async () => {
      prisma.stock.findMany.mockResolvedValue([
        {
          id: 'st-1',
          warehouseId: 'wh-1',
          warehouse: { name: 'Asosiy Omborxona' },
          itemId: 'it-1',
          item: {
            name: 'Koptokli ruchka',
            model: '0.7mm',
            unit: 'DONA',
            minStockLimit: 10,
            category: { name: 'Kanselyariya' },
          },
          quantity: 25,
          fundingSource: 'BYUDJET',
        },
      ]);
      prisma.stock.count.mockResolvedValue(1);

      const res = (await service.getStocks({ page: 1, limit: 10 })) as any;

      expect(res.data).toBeDefined();
      expect(res.data[0].itemName).toBe('Koptokli ruchka');
      expect(res.data[0].status).toBe('NORMAL');
    });

    it('qoldiq minimal me’yordan past bo‘lganda LOW statusini ko‘rsatishi kerak', async () => {
      prisma.stock.findMany.mockResolvedValue([
        {
          id: 'st-2',
          warehouseId: 'wh-1',
          warehouse: { name: 'Asosiy Omborxona' },
          itemId: 'it-2',
          item: {
            name: 'Toner HP 85A',
            model: 'CE285A',
            unit: 'DONA',
            minStockLimit: 5,
            category: { name: 'Kanselyariya' },
          },
          quantity: 2, // kam qolgan
          fundingSource: 'BYUDJET',
        },
      ]);
      prisma.stock.count.mockResolvedValue(1);

      const res = (await service.getStocks({ page: 1, limit: 10 })) as any;

      expect(res.data[0].status).toBe('LOW');
    });
  });

  describe('getLowStockItems', () => {
    it('faqat minimal qoldiqdan kam qolgan tovarlarni qaytarishi, kamomad va tavsiya miqdorini hisoblashi kerak', async () => {
      prisma.stock.findMany.mockResolvedValue([
        {
          id: 'st-low',
          warehouseId: 'wh-1',
          warehouse: { name: 'Markaziy Ombor' },
          itemId: 'it-1',
          item: {
            name: 'A4 Qog‘oz',
            model: 'SvetoCopy A4',
            unit: 'PACHKA',
            minStockLimit: 20,
            category: { name: 'Kanselyariya' },
          },
          quantity: 5, // 5 <= 20
          fundingSource: 'BYUDJET',
        },
        {
          id: 'st-ok',
          warehouseId: 'wh-1',
          warehouse: { name: 'Markaziy Ombor' },
          itemId: 'it-2',
          item: {
            name: 'Koptokli ruchka',
            model: '0.7mm',
            unit: 'DONA',
            minStockLimit: 10,
            category: { name: 'Kanselyariya' },
          },
          quantity: 50, // 50 > 10 (normal, low-stock ga kirmaydi)
          fundingSource: 'BYUDJET',
        },
      ]);

      const res = await service.getLowStockItems();

      expect(res).toHaveLength(1);
      expect(res[0].itemName).toBe('A4 Qog‘oz');
      expect(res[0].quantity).toBe(5);
      expect(res[0].minStockLimit).toBe(20);
      expect(res[0].deficit).toBe(15); // 20 - 5
      expect(res[0].recommendedOrderQty).toBe(35); // 20*2 - 5 = 35
      expect(res[0].status).toBe('LOW');
    });
  });

  describe('replenishStock', () => {
    it('mavjud tovar qoldig‘ini muvaffaqiyatli oshirishi va StockMovement yozishi kerak', async () => {
      prisma.stock.findUnique.mockResolvedValue({
        id: 'st-1',
        warehouseId: 'wh-1',
        itemId: 'it-1',
        quantity: 10,
        item: { name: 'Ruchka', unit: 'DONA', minStockLimit: 5 },
      });
      prisma.stock.update.mockResolvedValue({
        id: 'st-1',
        quantity: 30,
      });
      prisma.stockMovement.count.mockResolvedValue(0);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-1' });

      const res = await service.replenishStock('st-1', 20, 'user-admin');

      expect(res).toBeDefined();
      expect(res.quantity).toBe(30);
      expect(prisma.stock.update).toHaveBeenCalled();
      expect(prisma.stockMovement.create).toHaveBeenCalled();
    });

    it('mavjud bo‘lmagan stock ID berilganda NotFoundException tashlashi kerak', async () => {
      prisma.stock.findUnique.mockResolvedValue(null);

      await expect(service.replenishStock('st-unknown', 10, 'user-admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('transferBetweenWarehouses', () => {
    it('bir xil ombor tanlanganda BadRequestException tashlashi kerak', async () => {
      await expect(
        service.transferBetweenWarehouses(
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-1',
            itemId: 'it-1',
            quantity: 5,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('jo‘natuvchi omborda qoldiq yetarli bo‘lmaganda BadRequestException tashlashi kerak', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'st-1',
          quantity: 2,
          fundingSource: 'BYUDJET',
          warehouseName: 'Asosiy Ombor',
          itemName: 'Ruchka',
          itemUnit: 'DONA',
        },
      ]);

      await expect(
        service.transferBetweenWarehouses(
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            itemId: 'it-1',
            quantity: 10,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('qabul qiluvchi omborxona topilmasa NotFoundException tashlashi kerak', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'st-1',
          quantity: 20,
          fundingSource: 'BYUDJET',
          warehouseName: 'Asosiy Ombor',
          itemName: 'Ruchka',
          itemUnit: 'DONA',
        },
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.transferBetweenWarehouses(
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-not-found',
            itemId: 'it-1',
            quantity: 5,
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('qoldiq yetarli bo‘lsa atomik ravishda ko‘chirishi va muvaffaqiyatli yakunlashi kerak', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'st-1',
          quantity: 20,
          fundingSource: 'BYUDJET',
          warehouseName: 'Asosiy Ombor',
          itemName: 'Ruchka',
          itemUnit: 'DONA',
        },
      ]);
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-2', name: 'Filial Ombor' });
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.stock.upsert.mockResolvedValue({ id: 'st-2', quantity: 5 });
      prisma.stockMovement.count.mockResolvedValue(5);
      prisma.stockMovement.create.mockResolvedValue({
        id: 'mov-1',
        movementNumber: 'MOV-2026-0006',
      });
      prisma.stockMovementItem.create.mockResolvedValue({ id: 'mvi-1' });

      const result = await service.transferBetweenWarehouses(
        {
          fromWarehouseId: 'wh-1',
          toWarehouseId: 'wh-2',
          itemId: 'it-1',
          quantity: 5,
        },
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.quantity).toBe(5);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.stock.upsert).toHaveBeenCalled();
    });

    it('parallel o‘zgarish tufayli atomik kamaytirish muvaffaqiyatsiz bo‘lsa (affectedRows = 0) xato tashlashi kerak', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'st-1',
          quantity: 10,
          fundingSource: 'BYUDJET',
          warehouseName: 'Asosiy Ombor',
          itemName: 'Ruchka',
          itemUnit: 'DONA',
        },
      ]);
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-2', name: 'Filial Ombor' });
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(
        service.transferBetweenWarehouses(
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            itemId: 'it-1',
            quantity: 5,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Warehouse Management (CRUD)', () => {
    it('should create warehouse successfully and log audit', async () => {
      prisma.warehouse.findFirst.mockResolvedValueOnce(null);
      prisma.warehouse.findUnique.mockResolvedValueOnce(null);
      prisma.warehouse.create.mockResolvedValueOnce({
        id: 'wh-new',
        name: 'IT Jihozlar Ombori',
        code: 'WH-IT',
        location: 'IT Bino podval',
        isMain: false,
      });

      const res = await service.createWarehouse(
        { name: 'IT Jihozlar Ombori', code: 'WH-IT', location: 'IT Bino podval' },
        'admin-id',
      );

      expect(res.id).toBe('wh-new');
      expect(res.name).toBe('IT Jihozlar Ombori');
    });

    it('should throw ConflictException if warehouse name exists', async () => {
      prisma.warehouse.findFirst.mockResolvedValueOnce({ id: 'wh-1', name: 'Asosiy Ombor' });

      await expect(
        service.createWarehouse({ name: 'Asosiy Ombor' }, 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent deleting warehouse if active stock quantity exists', async () => {
      prisma.warehouse.findUnique.mockResolvedValueOnce({
        id: 'wh-1',
        name: 'Asosiy Ombor',
        stocks: [{ id: 'st-1', quantity: 15 }],
      });

      await expect(service.deleteWarehouse('wh-1', 'admin-id')).rejects.toThrow(BadRequestException);
    });

    it('should soft delete warehouse if stocks are empty', async () => {
      prisma.warehouse.findUnique.mockResolvedValueOnce({
        id: 'wh-empty',
        name: 'Bo‘sh Ombor',
        stocks: [],
      });
      prisma.warehouse.update.mockResolvedValueOnce({ id: 'wh-empty', deletedAt: new Date() });

      const res = await service.deleteWarehouse('wh-empty', 'admin-id');
      expect(res.success).toBe(true);
    });
  });

  describe('Real-Time Stock Synchronization & Low Stock Alerts', () => {
    it('replenishStock tovar qoldig‘i to‘ldirilganda stock:updated emit qilishi kerak', async () => {
      prisma.stock.findUnique.mockResolvedValueOnce({
        id: 'st-rep',
        warehouseId: 'wh-1',
        itemId: 'it-rep',
        quantity: 10,
        fundingSource: 'BYUDJET',
        item: { name: 'A4 Qog‘oz', unit: 'PACHKA', minStockLimit: 5 },
      });
      prisma.stock.update.mockResolvedValueOnce({
        id: 'st-rep',
        warehouseId: 'wh-1',
        itemId: 'it-rep',
        quantity: 30,
        fundingSource: 'BYUDJET',
      });
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'wh-manager' });
      prisma.stockMovement.count.mockResolvedValueOnce(0);
      prisma.stockMovement.create.mockResolvedValueOnce({ id: 'mov-1', movementNumber: 'MOV-001' });

      await service.replenishStock('st-rep', 20, 'wh-manager');

      expect(eventsGateway.server.emit).toHaveBeenCalledWith('stock:updated', expect.objectContaining({
        action: 'REPLENISH',
        stockId: 'st-rep',
        quantity: 30,
      }));
    });

    it('deductStockForRequest kritik zaxiraga tushganda stock:low_alert va stock:updated emit qilishi kerak', async () => {
      prisma.warehouse.findFirst.mockResolvedValueOnce({ id: 'wh-main', isMain: true, name: 'Bosh ombor' });
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'st-low', quantity: 5 }]);
      prisma.$executeRaw.mockResolvedValueOnce(1);
      prisma.stockMovement.count.mockResolvedValueOnce(0);
      prisma.stockMovement.create.mockResolvedValueOnce({ id: 'mov-out', movementNumber: 'MOV-OUT-001' });

      const requestMock = {
        id: 'req-1',
        requestNumber: 'REQ-2026-001',
        purpose: 'Kafedra uchun qog‘oz',
        requesterId: 'user-1',
        items: [
          {
            id: 'ri-1',
            itemId: 'it-paper',
            requestedQty: 3,
            item: { name: 'A4 Qog‘oz', unit: 'pachka', minStockLimit: 5 },
          },
        ],
      };

      const result = await service.deductStockForRequest(requestMock as any, 'exec-1');

      expect(result.lowStockAlerts).toHaveLength(1);
      expect(result.lowStockAlerts[0].remainingQty).toBe(2);

      // Verify stock:updated emitted
      expect(eventsGateway.server.emit).toHaveBeenCalledWith('stock:updated', expect.objectContaining({
        action: 'DEDUCT',
        requestNumber: 'REQ-2026-001',
      }));

      // Verify stock:low_alert emitted to roles and broadcasted
      expect(eventsGateway.emitToRole).toHaveBeenCalledWith(
        'HEAD_WAREHOUSE',
        'stock:low_alert',
        expect.objectContaining({
          itemName: 'A4 Qog‘oz',
          remainingQty: 2,
          message: expect.stringContaining('🚨 A4 Qog‘oz kritik darajaga tushdi (2 pachka qoldi)!'),
        }),
      );
      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'stock:low_alert',
        expect.objectContaining({
          itemName: 'A4 Qog‘oz',
          remainingQty: 2,
        }),
      );
    });
  });
});

