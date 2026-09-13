import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      itemInstance: {
        findMany: jest.fn(),
      },
      stock: {
        findMany: jest.fn(),
      },
      request: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      supplier: {
        count: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
      },
      transferAcceptance: {
        count: jest.fn(),
      },
      repairRecord: {
        count: jest.fn(),
      },
      writeOffRequest: {
        count: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAnalytics', () => {
    it('should compute complete dashboard summary and funding sources', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          purchasePrice: '10000000',
          purchaseDate: new Date('2025-01-01'),
          depreciationRate: 20.0,
          status: 'IN_USE',
          fundingSource: 'BYUDJET',
          createdAt: new Date('2025-01-01'),
          item: { name: 'Kompyuter', category: { name: 'IT' } },
          room: { department: { name: 'Kafedra' } },
        },
        {
          id: 'asset-2',
          purchasePrice: '5000000',
          purchaseDate: new Date('2026-01-01'),
          depreciationRate: 10.0,
          status: 'NEW',
          fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
          createdAt: new Date('2026-01-01'),
          item: { name: 'Stol', category: { name: 'Mebel' } },
          room: { department: { name: 'Kafedra' } },
        },
      ]);
      prisma.stock.findMany.mockResolvedValue([
        { id: 'stock-1', quantity: 50, item: { name: 'Qog‘oz', minStockLimit: 10 } },
      ]);
      prisma.request.count.mockResolvedValue(2);
      prisma.supplier.count.mockResolvedValue(3);
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.request.findMany.mockResolvedValue([]);
      prisma.transferAcceptance.count.mockResolvedValue(1);
      prisma.repairRecord.count.mockResolvedValue(0);
      prisma.writeOffRequest.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(4);

      const result = await service.getAnalytics();

      expect(result.summary.totalAssets).toBe(2);
      expect(result.summary.totalInitialCost).toBe(15000000);
      expect(result.summary.totalStockUnits).toBe(50);
      expect(result.summary.pendingTransfersCount).toBe(1);
      expect(result.summary.molsCount).toBe(4);
      expect(result.needsAttention).toBeDefined();
      expect(result.needsAttention.totalAttentionItems).toBe(3); // 2 requests + 1 transfer
      expect(result.fundingSources.length).toBe(3);
      expect(result.categories.length).toBe(2);
    });
  });
});
