import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from './warehouse.service';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../common/services/sequence.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Transaction Integrity & Negative Stock Rollback Tests', () => {
  let warehouseService: WarehouseService;
  let prisma: any;

  const mockWarehouse = { id: 'wh-main', name: 'Bosh Ombor', isMain: true };

  const sampleRequest = {
    id: 'req-100',
    requestNumber: 'REQ-2026-0099',
    purpose: 'Auditoriya jihozlari',
    requesterId: 'user-mudir',
    fundingSource: 'BYUDJET',
    items: [
      {
        id: 'ri-1',
        itemId: 'item-mouse',
        requestedQty: 10,
        approvedQty: 10,
        item: { name: 'Optik Sichqoncha', unit: 'dona', minStockLimit: 5 },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue(mockWarehouse),
        findUnique: jest.fn().mockResolvedValue(mockWarehouse),
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
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn((callback) => (typeof callback === 'function' ? callback(prisma) : Promise.all(callback))),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        CodeGeneratorService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: SequenceService,
          useValue: {
            nextMovementNumber: jest.fn().mockResolvedValue('MOV-2026-0001'),
            nextInvoiceNumber: jest.fn().mockResolvedValue('INV-2026-0001'),
          },
        },
      ],
    }).compile();

    warehouseService = module.get<WarehouseService>(WarehouseService);
  });

  describe('Negative stock prevention & transaction rollback', () => {
    it('should throw BadRequestException and abort transaction when stock is insufficient (stock.quantity < requestedQty)', async () => {
      // Scenario: Available in warehouse: 4, Requested: 10
      prisma.$queryRaw.mockResolvedValue([{ id: 'stock-mouse', quantity: 4 }]);

      await expect(
        warehouseService.deductStockForRequest(sampleRequest, 'user-wh', prisma),
      ).rejects.toThrow(BadRequestException);

      // Verify that no movement or update was performed
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.stockMovementItem.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException and abort when stock record does not exist in warehouse', async () => {
      // Scenario: Stock row doesn't exist (returns empty array)
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        warehouseService.deductStockForRequest(sampleRequest, 'user-wh', prisma),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when concurrent race condition occurs (atomic update affected 0 rows)', async () => {
      // Scenario: Initially row lock showed 10 items, but concurrent transaction deducted them first
      prisma.$queryRaw.mockResolvedValue([{ id: 'stock-mouse', quantity: 10 }]);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-out-1', movementNumber: 'MOV-2026-0001' });
      // Database atomic UPDATE ... WHERE quantity >= 10 matches 0 rows
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(
        warehouseService.deductStockForRequest(sampleRequest, 'user-wh', prisma),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.stockMovementItem.create).not.toHaveBeenCalled();
    });

    it('should successfully complete atomic deduction with row-lock and generate OUTGOING StockMovement when stock is sufficient', async () => {
      // Scenario: Available: 20, Requested: 10 -> Remaining: 10
      prisma.$queryRaw.mockResolvedValue([{ id: 'stock-mouse', quantity: 20 }]);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-out-1', movementNumber: 'MOV-2026-0001' });
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.stockMovementItem.create.mockResolvedValue({ id: 'smi-1' });

      const result = await warehouseService.deductStockForRequest(sampleRequest, 'user-wh', prisma);

      expect(result.movement).toBeDefined();
      expect(result.movement.id).toBe('mov-out-1');
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.stockMovementItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementId: 'mov-out-1',
            quantity: 10,
          }),
        }),
      );
    });

    it('should generate lowStockAlert when remaining quantity drops below minStockLimit', async () => {
      // Scenario: Available: 10, Requested: 10 -> Remaining: 0 (minStockLimit: 5)
      prisma.$queryRaw.mockResolvedValue([{ id: 'stock-mouse', quantity: 10 }]);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-out-2', movementNumber: 'MOV-2026-0002' });
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.stockMovementItem.create.mockResolvedValue({ id: 'smi-2' });

      const result = await warehouseService.deductStockForRequest(sampleRequest, 'user-wh', prisma);

      expect(result.lowStockAlerts).toHaveLength(1);
      expect(result.lowStockAlerts[0]).toEqual({
        name: 'Optik Sichqoncha',
        remainingQty: 0,
        minLimit: 5,
        unit: 'dona',
      });
    });
  });
});
