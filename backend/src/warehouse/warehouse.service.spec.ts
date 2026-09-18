import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from './warehouse.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('WarehouseService (Unit Tests)', () => {
  let service: WarehouseService;
  let prisma: any;
  let codeGen: any;

  beforeEach(async () => {
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
});
