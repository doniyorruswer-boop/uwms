import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { FundingSource, RoleType } from '@prisma/client';

describe('ReportsService (Unit Tests)', () => {
  let service: ReportsService;
  let prisma: any;
  let systemAudit: any;

  beforeEach(async () => {
    prisma = {
      itemInstance: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      responsibilityHandover: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      handoverItemAction: {
        count: jest.fn(),
      },
      room: {
        count: jest.fn(),
      },
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: systemAudit },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('getFundingSummary', () => {
    it('should aggregate assets and movements by fundingSource, category, and department', async () => {
      const mockInstances = [
        {
          id: 'inst-1',
          inventoryNumber: 'INV-001',
          fundingSource: FundingSource.BYUDJET,
          purchasePrice: 10000000,
          currentBookValue: 8000000,
          status: 'IN_USE',
          createdAt: new Date(),
          item: {
            name: 'Kompyuter Monoblok',
            itemType: 'FIXED_ASSET',
            category: { id: 'cat-1', name: 'Kompyuter va IT' },
          },
          room: {
            id: 'room-1',
            number: '101',
            name: 'Kafedra xonasi',
            department: { id: 'dept-1', name: 'Axborot texnologiyalari' },
          },
        },
        {
          id: 'inst-2',
          inventoryNumber: 'INV-002',
          fundingSource: FundingSource.KONTRAKT_RIVOJLANTIRISH,
          purchasePrice: 5000000,
          currentBookValue: 5000000,
          status: 'NEW',
          createdAt: new Date(),
          item: {
            name: 'Proyektor Epson',
            itemType: 'FIXED_ASSET',
            category: { id: 'cat-2', name: 'Multimedia' },
          },
          room: {
            id: 'room-2',
            number: '102',
            name: 'Auditoriya',
            department: { id: 'dept-1', name: 'Axborot texnologiyalari' },
          },
        },
      ];

      prisma.itemInstance.findMany.mockResolvedValue(mockInstances);
      prisma.stockMovement.count.mockResolvedValue(5);
      prisma.stockMovement.groupBy.mockResolvedValue([
        { fundingSource: FundingSource.BYUDJET, _count: { id: 3 } },
        { fundingSource: FundingSource.KONTRAKT_RIVOJLANTIRISH, _count: { id: 2 } },
      ]);

      const adminUser = { id: 'admin-1', role: RoleType.SUPER_ADMIN };
      const res = await service.getFundingSummary({}, adminUser);

      expect(res.totals.totalAssetsCount).toBe(2);
      expect(res.totals.totalPurchaseValue).toBe(15000000);
      expect(res.totals.totalCurrentBookValue).toBe(13000000);
      expect(res.totals.totalMovementsCount).toBe(5);

      const byudjetStat = res.byFundingSource.find((s) => s.source === FundingSource.BYUDJET);
      expect(byudjetStat).toBeDefined();
      expect(byudjetStat?.assetsCount).toBe(1);
      expect(byudjetStat?.totalValue).toBe(8000000);
      expect(byudjetStat?.movementsCount).toBe(3);

      const kontraktStat = res.byFundingSource.find((s) => s.source === FundingSource.KONTRAKT_RIVOJLANTIRISH);
      expect(kontraktStat).toBeDefined();
      expect(kontraktStat?.assetsCount).toBe(1);
      expect(kontraktStat?.totalValue).toBe(5000000);
      expect(kontraktStat?.movementsCount).toBe(2);

      expect(res.byCategory.length).toBe(2);
      expect(res.byDepartment.length).toBe(1);
      expect(res.byDepartment[0].departmentName).toBe('Axborot texnologiyalari');
    });

    it('should strictly isolate MOL user to their own department', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);
      prisma.stockMovement.groupBy.mockResolvedValue([]);

      const molUser = { id: 'mol-1', role: RoleType.MOL, departmentId: 'dept-mol' };
      // Attempting to query another department
      await service.getFundingSummary({ departmentId: 'other-dept' }, molUser);

      expect(prisma.itemInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            room: { departmentId: 'dept-mol' },
          }),
        }),
      );
    });
  });

  describe('getFundingMovements', () => {
    it('should return paginated movements matching filters', async () => {
      const mockMovements = [
        {
          id: 'mov-1',
          movementNumber: 'MOV-2026-0001',
          movementType: 'INCOMING',
          fundingSource: FundingSource.BYUDJET,
          createdAt: new Date(),
          executedBy: { id: 'u-1', fullName: 'Aliyev Vali', role: 'SUPER_ADMIN' },
          fromRoom: null,
          toRoom: { department: { id: 'd-1', name: 'Fizika' } },
          items: [],
        },
      ];

      prisma.stockMovement.findMany.mockResolvedValue(mockMovements);
      prisma.stockMovement.count.mockResolvedValue(1);

      const res = await service.getFundingMovements({ page: 1, limit: 10 }, { role: RoleType.SUPER_ADMIN });

      expect(res.items.length).toBe(1);
      expect(res.total).toBe(1);
      expect(res.page).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });

  describe('exportFundingReport', () => {
    it('should generate an XLSX export buffer and log REPORT_EXPORT audit log', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          inventoryNumber: 'INV-001',
          serialNumber: 'SN-1234',
          fundingSource: FundingSource.BYUDJET,
          purchasePrice: 12000000,
          currentBookValue: 10000000,
          status: 'IN_USE',
          createdAt: new Date('2026-01-15'),
          item: {
            name: 'Monoblok HP 24',
            model: 'ProOne 440',
            unit: 'dona',
            category: { name: 'Kompyuterlar' },
          },
          room: {
            name: 'Laboratoriya',
            number: '204',
            department: { name: 'Dasturiy injiniring' },
          },
        },
      ]);

      const user = { id: 'user-admin', role: RoleType.SUPER_ADMIN };
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'Jest-Test' } };

      const result = await service.exportFundingReport(
        { type: 'assets', format: 'xlsx' },
        user,
        req,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPORT_EXPORT',
          entity: 'FundingReport',
          userId: 'user-admin',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('should generate a CSV export with UTF-8 BOM when format is csv', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([]);

      const user = { id: 'user-admin', role: RoleType.SUPER_ADMIN };
      const result = await service.exportFundingReport(
        { type: 'assets', format: 'csv' },
        user,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/\.csv$/);
      expect(result.contentType).toBe('text/csv; charset=utf-8');
      // Starts with UTF-8 BOM
      expect(result.buffer.toString('utf-8').charCodeAt(0)).toBe(0xfeff);
    });
  });

  describe('generateClearanceCertificate', () => {
    it('should generate official clearance certificate HTML and verify clearance passed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Eshmat Toshmatov',
        role: RoleType.MOL,
        position: 'Katta o‘qituvchi',
        department: { name: 'Dasturiy Injiniring Kafedrasi' },
      });
      prisma.itemInstance.count.mockResolvedValue(0);
      prisma.responsibilityHandover.count.mockResolvedValue(0);
      prisma.handoverItemAction.count.mockResolvedValue(0);
      prisma.room.count.mockResolvedValue(0);
      prisma.responsibilityHandover.findMany.mockResolvedValue([
        {
          id: 'h-1',
          handoverNumber: 'AKT-2026-0001',
          type: 'FULL_TRANSFER',
          createdAt: new Date(),
          updatedAt: new Date(),
          targetUser: { fullName: 'Salim Qosimov' },
          targetWarehouse: null,
          _count: { items: 5 },
        },
      ]);

      const result = await service.generateClearanceCertificate('user-1');

      expect(result.certificateNumber).toMatch(/^AV-2026-/);
      expect(result.isCleared).toBe(true);
      expect(result.activeAssets).toBe(0);
      expect(result.contentHtml).toContain('Elektron Aylanma Varaqa');
      expect(result.contentHtml).toContain('Eshmat Toshmatov');
      expect(result.contentHtml).toContain('AKT-2026-0001');
      expect(result.verificationHash).toBeDefined();
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VIEW',
          entity: 'CLEARANCE_CERTIFICATE',
        }),
      );
    });

    it('should show warning in certificate if user still has active assets', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        fullName: 'Vali Aliyev',
        role: RoleType.MOL,
        department: { name: 'Kafedra' },
      });
      prisma.itemInstance.count.mockResolvedValue(3);
      prisma.responsibilityHandover.count.mockResolvedValue(0);
      prisma.handoverItemAction.count.mockResolvedValue(0);
      prisma.room.count.mockResolvedValue(1);
      prisma.responsibilityHandover.findMany.mockResolvedValue([]);

      const result = await service.generateClearanceCertificate('user-2');

      expect(result.isCleared).toBe(false);
      expect(result.activeAssets).toBe(3);
      expect(result.contentHtml).toContain('DIQQAT: JAVOBGARLIK TO‘LIQ TOPSHIRILMAGAN');
    });
  });
});
