import { Test, TestingModule } from '@nestjs/testing';
import { DepreciationService } from './depreciation.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('DepreciationService (Unit Tests)', () => {
  let service: DepreciationService;
  let prisma: any;
  let codeGen: any;
  let systemAudit: any;

  beforeEach(async () => {
    prisma = {
      itemInstance: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      depreciationRun: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      depreciationRecord: {
        findMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => {
        if (Array.isArray(callback)) {
          return Promise.all(callback);
        }
        return callback(prisma);
      }),
    };

    codeGen = {
      generateDepreciationBatchNumber: jest.fn((period, seq) => `DEP-${period}-00${seq}`),
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepreciationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: codeGen },
        { provide: SystemAuditService, useValue: systemAudit },
      ],
    }).compile();

    service = module.get<DepreciationService>(DepreciationService);
  });

  describe('previewDepreciation', () => {
    it('oylik amortizatsiya prognozini to‘g‘ri hisoblashi kerak', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          inventoryNumber: 'INV-2026-001',
          purchasePrice: new Prisma.Decimal(12000000), // 12 mln
          currentBookValue: new Prisma.Decimal(12000000),
          accumulatedDepreciation: new Prisma.Decimal(0),
          depreciationRate: 20.0, // 20% yillik -> 1.667% oylik -> 200,000 so'm/oy
          fundingSource: 'BYUDJET',
          item: { name: 'Kompyuter Dell', category: { name: 'IT uskunalari' } },
        },
      ]);
      prisma.depreciationRecord.findMany.mockResolvedValue([]);

      const res = await service.previewDepreciation({ period: '2026-09' });

      expect(res.totalAssetsCount).toBe(1);
      expect(res.newlyEligibleCount).toBe(1);
      expect(res.alreadyDepreciatedCount).toBe(0);
      expect(res.totalInitialCost).toBe(12000000);
      expect(res.totalProjectedDepreciation).toBe(200000); // 12,000,000 * 0.20 / 12 = 200,000
      expect(res.totalProjectedBookValue).toBe(11800000); // 12,000,000 - 200,000 = 11,800,000
    });

    it('balansi 0 bo‘lgan aktivni to‘liq eskirgan deb belgilashi va 0 eskirish hisoblashi kerak', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-2',
          inventoryNumber: 'INV-2026-002',
          purchasePrice: new Prisma.Decimal(5000000),
          currentBookValue: new Prisma.Decimal(0), // to'liq eskirgan
          accumulatedDepreciation: new Prisma.Decimal(5000000),
          depreciationRate: 20.0,
          fundingSource: 'BYUDJET',
          item: { name: 'Eski printer', category: { name: 'IT uskunalari' } },
        },
      ]);
      prisma.depreciationRecord.findMany.mockResolvedValue([]);

      const res = await service.previewDepreciation({ period: '2026-09' });

      expect(res.fullyDepreciatedCount).toBe(1);
      expect(res.totalProjectedDepreciation).toBe(0);
      expect(res.items[0].isFullyDepreciated).toBe(true);
    });
  });

  describe('runDepreciation', () => {
    it('asosiy vositalar amortizatsiyasini tranzaksiyada muvaffaqiyatli hisoblab bazani yangilashi kerak', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          inventoryNumber: 'INV-2026-001',
          purchasePrice: new Prisma.Decimal(6000000),
          currentBookValue: new Prisma.Decimal(6000000),
          accumulatedDepreciation: new Prisma.Decimal(0),
          depreciationRate: 20.0, // 20% -> 100,000 so'm/oy
          item: { name: 'Monoblok', category: { name: 'IT uskunalari' } },
        },
      ]);
      prisma.depreciationRecord.findMany.mockResolvedValue([]);
      prisma.depreciationRun.count.mockResolvedValue(0);
      prisma.depreciationRun.create.mockResolvedValue({
        id: 'run-1',
        batchNumber: 'DEP-2026-09-001',
        period: '2026-09',
      });
      prisma.itemInstance.update.mockResolvedValue({});
      prisma.depreciationRecord.createMany.mockResolvedValue({ count: 1 });
      prisma.depreciationRun.update.mockResolvedValue({
        id: 'run-1',
        batchNumber: 'DEP-2026-09-001',
        period: '2026-09',
        totalAssetsCount: 1,
        totalDepreciationAmount: new Prisma.Decimal(100000),
        totalBookValue: new Prisma.Decimal(5900000),
        createdAt: new Date(),
      });

      const res = (await service.runDepreciation({ period: '2026-09' }, 'user-admin')) as any;

      expect(res.success).toBe(true);
      expect(res.run.totalDepreciationAmount).toBe(100000);
      expect(res.run.totalBookValue).toBe(5900000);
      expect(prisma.itemInstance.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: expect.objectContaining({
          currentBookValue: expect.any(Prisma.Decimal),
          accumulatedDepreciation: expect.any(Prisma.Decimal),
          lastDepreciatedAt: expect.any(Date),
        }),
      });
      expect(prisma.depreciationRecord.createMany).toHaveBeenCalled();
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEPRECIATION_RUN',
        }),
      );
    });

    it('ushbu davr uchun barcha aktivlar avval hisoblangan bo‘lsa xato berishi kerak (takrorlanishdan himoya)', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          item: { name: 'Monitor' },
        },
      ]);
      // Allaqachon mavjud
      prisma.depreciationRecord.findMany.mockResolvedValue([{ assetId: 'asset-1' }]);

      await expect(
        service.runDepreciation({ period: '2026-09' }, 'user-admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRuns', () => {
    it('o‘tkazilgan partiyalarni paginatsiya bilan qaytarishi kerak', async () => {
      prisma.depreciationRun.findMany.mockResolvedValue([
        {
          id: 'run-1',
          batchNumber: 'DEP-2026-09-001',
          period: '2026-09',
          totalAssetsCount: 10,
          totalDepreciationAmount: new Prisma.Decimal(2500000),
          totalBookValue: new Prisma.Decimal(80000000),
          status: 'COMPLETED',
          executedBy: { fullName: 'Bosh Hisobchi', role: 'HEAD_WAREHOUSE' },
          createdAt: new Date(),
        },
      ]);
      prisma.depreciationRun.count.mockResolvedValue(1);

      const res = await service.getRuns({ page: 1, limit: 10 });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].batchNumber).toBe('DEP-2026-09-001');
      expect(res.total).toBe(1);
    });
  });

  describe('getRunDetails', () => {
    it('partiya mavjud bo‘lmasa NotFoundException tashlashi kerak', async () => {
      prisma.depreciationRun.findUnique.mockResolvedValue(null);

      await expect(service.getRunDetails('run-unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAssetDepreciationHistory', () => {
    it('aktiv topilmasa NotFoundException tashlashi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue(null);

      await expect(service.getAssetDepreciationHistory('asset-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('aktiv topilsa uning oylar kesimidagi amortizatsiya daftarchasini qaytarishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        inventoryNumber: 'INV-2026-001',
        purchasePrice: new Prisma.Decimal(12000000),
        currentBookValue: new Prisma.Decimal(11800000),
        accumulatedDepreciation: new Prisma.Decimal(200000),
        depreciationRate: 20.0,
        item: { name: 'Kompyuter', category: { name: 'IT' } },
        room: null,
        responsibleUser: null,
      });
      prisma.depreciationRecord.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          period: '2026-09',
          initialCost: new Prisma.Decimal(12000000),
          openingBookValue: new Prisma.Decimal(12000000),
          depreciationAmount: new Prisma.Decimal(200000),
          closingBookValue: new Prisma.Decimal(11800000),
          accumulatedTotal: new Prisma.Decimal(200000),
          calculatedAt: new Date(),
          run: { batchNumber: 'DEP-2026-09-001', createdAt: new Date() },
        },
      ]);

      const res = await service.getAssetDepreciationHistory('asset-1');

      expect(res.asset.inventoryNumber).toBe('INV-2026-001');
      expect(res.history).toHaveLength(1);
      expect(res.history[0].depreciationAmount).toBe(200000);
    });
  });

  describe('getOfficialStatement', () => {
    it('belgilangan davr uchun rasmiy qaydnomani kategoriyalar va moliyalashtirish bo‘yicha guruhlab qaytarishi kerak', async () => {
      prisma.depreciationRecord.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          period: '2026-09',
          annualRate: 20.0,
          initialCost: new Prisma.Decimal(10000000),
          openingBookValue: new Prisma.Decimal(10000000),
          depreciationAmount: new Prisma.Decimal(166667),
          closingBookValue: new Prisma.Decimal(9833333),
          accumulatedTotal: new Prisma.Decimal(166667),
          asset: {
            fundingSource: 'BYUDJET',
            item: { category: { name: 'Kompyuterlar' } },
          },
        },
      ]);

      const res = await service.getOfficialStatement('2026-09');

      expect(res.documentName).toBeDefined();
      expect(res.totals.totalAssets).toBe(1);
      expect(res.categorySummary).toHaveLength(1);
      expect(res.categorySummary[0].categoryName).toBe('Kompyuterlar');
      expect(res.fundingSummary).toHaveLength(1);
      expect(res.fundingSummary[0].fundingSource).toBe('BYUDJET');
    });
  });
});
