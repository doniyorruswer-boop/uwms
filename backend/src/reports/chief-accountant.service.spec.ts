import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { FundingSource, RoleType } from '@prisma/client';
import { StateExportFormat } from './dto/chief-accountant.dto';

describe('ChiefAccountant Reports (Phase L2 Unit Tests)', () => {
  let service: ReportsService;
  let prisma: any;
  let systemAudit: any;

  beforeEach(async () => {
    prisma = {
      request: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      documentStamp: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      itemInstance: {
        findMany: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
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

  describe('getChiefAccountantReceipts (Iz 1: Qancha Kirdi — OS-1)', () => {
    it('should aggregate receipts by fundingSource and subAccount with document stamps', async () => {
      const mockAllRequests = [
        {
          fundingSource: 'BYUDJET',
          subAccountCode: '013',
          allocatedAmount: 5000000,
          items: [{ requestedQty: 2, approvedQty: 2 }],
        },
        {
          fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
          subAccountCode: '060',
          allocatedAmount: 1200000,
          items: [{ requestedQty: 10, approvedQty: 10 }],
        },
      ];

      const mockPaginated = [
        {
          id: 'req-1',
          requestNumber: 'REQ-2026-001',
          purpose: 'Kompyuterlar xaridi',
          fundingSource: 'BYUDJET',
          subAccountCode: '013',
          allocatedAmount: 5000000,
          createdAt: new Date(),
          warehouseReceivedAt: new Date(),
          requester: { id: 'u-1', fullName: 'Omon Toshmatov' },
          department: { name: 'Dasturiy Injiniring' },
          items: [
            {
              approvedQty: 2,
              requestedQty: 2,
              item: { name: 'HP LaserJet', unit: 'DONA' },
            },
          ],
        },
      ];

      const mockStamps = [
        {
          docNumber: 'REQ-2026-001-OS1',
          verificationHash: 'abc123hash',
          signerName: 'Bosh Omborchi',
        },
      ];

      prisma.request.findMany
        .mockResolvedValueOnce(mockAllRequests)
        .mockResolvedValueOnce(mockPaginated);
      prisma.request.count.mockResolvedValueOnce(2);
      prisma.documentStamp.findMany.mockResolvedValueOnce(mockStamps);

      const result = await service.getChiefAccountantReceipts(
        { period: '2026-09', page: 1, limit: 20 },
        { id: 'acc-1', role: RoleType.CHIEF_ACCOUNTANT },
      );

      expect(result.summary.totalReceiptsAmount).toBe(6200000);
      expect(result.summary.totalItemsCount).toBe(12);
      expect(result.summary.byFundingSource['BYUDJET'].amount).toBe(5000000);
      expect(result.summary.byFundingSource['KONTRAKT_RIVOJLANTIRISH'].amount).toBe(1200000);
      expect(result.summary.bySubAccount['013'].amount).toBe(5000000);
      expect(result.summary.bySubAccount['060'].amount).toBe(1200000);
      expect(result.data[0].hasStamp).toBe(true);
      expect(result.data[0].stampHash).toBe('abc123hash');
    });
  });

  describe('getChiefAccountantHandoverBalance (Iz 2: Chiqim va MOL Balansi — OS-2)', () => {
    it('should compute MOL turnover ledger with asset counts and values', async () => {
      const mockMols = [
        {
          id: 'mol-1',
          fullName: 'Kafedra Mudiri Aliyev',
          username: 'kafedra_mudiri',
          role: RoleType.MOL,
          departmentId: 'dept-1',
          department: {
            name: 'Kiberxavfsizlik Kafedrasi',
            rooms: [{ id: 'r-1' }, { id: 'r-2' }],
          },
          responsibleInstances: [
            { id: 'inst-1', purchasePrice: 4000000 },
            { id: 'inst-2', purchasePrice: 3500000 },
          ],
          submittedRequests: [
            {
              id: 'req-1',
              requestNumber: 'REQ-2026-101',
              fulfilledAt: new Date(),
              items: [{ requestedQty: 5, approvedQty: 5 }],
            },
          ],
        },
      ];

      const mockAllInstances = [
        { purchasePrice: 4000000 },
        { purchasePrice: 3500000 },
        { purchasePrice: 10000000 },
      ];

      prisma.user.findMany.mockResolvedValueOnce(mockMols);
      prisma.user.count.mockResolvedValueOnce(1);
      prisma.itemInstance.findMany.mockResolvedValueOnce(mockAllInstances);
      prisma.request.count.mockResolvedValueOnce(1);

      const result = await service.getChiefAccountantHandoverBalance(
        { page: 1, limit: 20 },
        { id: 'acc-1', role: RoleType.CHIEF_ACCOUNTANT },
      );

      expect(result.summary.totalMolsCount).toBe(1);
      expect(result.summary.totalAssignedValue).toBe(17500000);
      expect(result.data[0].fixedAssetsCount).toBe(2);
      expect(result.data[0].fixedAssetsTotalValue).toBe(7500000);
      expect(result.data[0].roomsCount).toBe(2);
      expect(result.data[0].consumablesCount).toBe(5);
      expect(result.data[0].lastOs2DocNumber).toBe('REQ-2026-101-OS2');
    });
  });

  describe('exportChiefAccountantStateReport (Iz 3: Davlat Eksport Markazi)', () => {
    it('should generate 3-sheet Excel workbook for State Report', async () => {
      jest.spyOn(service, 'getChiefAccountantReceipts').mockResolvedValueOnce({
        period: '2026-09',
        summary: {
          totalReceiptsCount: 1,
          totalReceiptsAmount: 5000000,
          totalItemsCount: 2,
          byFundingSource: {},
          bySubAccount: {},
        },
        data: [
          {
            id: 'req-1',
            requestNumber: 'REQ-2026-001',
            os1DocNumber: 'REQ-2026-001-OS1',
            receiptDate: '2026-09-18',
            purpose: 'Printer xaridi',
            fundingSource: 'BYUDJET',
            subAccountCode: '013',
            allocatedAmount: 5000000,
            supplierName: 'Test Ta’minotchi',
            departmentName: 'Dasturiy Injiniring',
            requesterName: 'Mudir Omon',
            itemsCount: 1,
            items: [{ name: 'HP LaserJet', quantity: 2, unit: 'DONA' }],
            hasStamp: true,
            stampHash: 'hash123',
            signedByName: 'Bosh Omborchi',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as any);

      jest.spyOn(service, 'getChiefAccountantHandoverBalance').mockResolvedValueOnce({
        summary: {
          totalMolsCount: 1,
          totalAssignedValue: 5000000,
          totalFixedAssets: 2,
          totalFulfilledTransfers: 1,
        },
        data: [
          {
            userId: 'mol-1',
            fullName: 'Mudir Omon',
            username: 'kafedra_mudiri',
            phone: '+998901234567',
            role: RoleType.MOL,
            departmentName: 'Dasturiy Injiniring',
            fixedAssetsCount: 2,
            fixedAssetsTotalValue: 5000000,
            consumablesCount: 10,
            roomsCount: 3,
            lastHandoverDate: '2026-09-18',
            lastOs2DocNumber: 'REQ-2026-001-OS2',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as any);

      const excelRes = await service.exportChiefAccountantStateReport(
        { period: '2026-09', format: StateExportFormat.EXCEL },
        { id: 'acc-1', role: RoleType.CHIEF_ACCOUNTANT },
        { ip: '127.0.0.1' },
      );

      expect(excelRes.filename).toContain('.xlsx');
      expect(excelRes.contentType).toContain('spreadsheetml');
      expect(excelRes.buffer).toBeDefined();
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CHIEF_ACCOUNTANT_EXPORT' }),
      );
    });

    it('should generate UzASBO Treasury XML file', async () => {
      jest.spyOn(service, 'getChiefAccountantReceipts').mockResolvedValueOnce({
        period: '2026-09',
        summary: { bySubAccount: { '013': { amount: 5000000 } } },
        data: [{ os1DocNumber: 'OS1-01', receiptDate: '2026-09-18', supplierName: 'Sup', fundingSource: 'BYUDJET', subAccountCode: '013', allocatedAmount: 5000000 }],
        total: 1,
      } as any);

      jest.spyOn(service, 'getChiefAccountantHandoverBalance').mockResolvedValueOnce({
        summary: {},
        data: [{ fullName: 'Aliyev', departmentName: 'Kafedra', fixedAssetsCount: 1, fixedAssetsTotalValue: 5000000, consumablesCount: 0, lastOs2DocNumber: 'OS2-01' }],
        total: 1,
      } as any);

      const xmlRes = await service.exportChiefAccountantStateReport(
        { period: '2026-09', format: StateExportFormat.UZASBO },
        { id: 'acc-1', role: RoleType.CHIEF_ACCOUNTANT },
        { ip: '127.0.0.1' },
      );

      expect(xmlRes.filename).toContain('.xml');
      expect(xmlRes.contentType).toBe('application/xml; charset=utf-8');
      const xmlStr = xmlRes.buffer.toString('utf-8');
      expect(xmlStr).toContain('<UzASBODavlatHisoboti');
      expect(xmlStr).toContain('<KirimReestri_OS1');
      expect(xmlStr).toContain('<MOL_AylanmaBalansi');
    });

    it('should generate 1C:Enterprise OTM XML file', async () => {
      jest.spyOn(service, 'getChiefAccountantReceipts').mockResolvedValueOnce({
        period: '2026-09',
        summary: { bySubAccount: {} },
        data: [{ os1DocNumber: 'OS1-01', receiptDate: '2026-09-18', supplierName: 'Sup', fundingSource: 'BYUDJET', subAccountCode: '013', allocatedAmount: 5000000 }],
        total: 1,
      } as any);

      jest.spyOn(service, 'getChiefAccountantHandoverBalance').mockResolvedValueOnce({
        summary: {},
        data: [{ fullName: 'Aliyev', departmentName: 'Kafedra', fixedAssetsCount: 1, fixedAssetsTotalValue: 5000000 }],
        total: 1,
      } as any);

      const oneCRes = await service.exportChiefAccountantStateReport(
        { period: '2026-09', format: StateExportFormat.ONE_C },
        { id: 'acc-1', role: RoleType.CHIEF_ACCOUNTANT },
        { ip: '127.0.0.1' },
      );

      expect(oneCRes.filename).toContain('1C_Korxona');
      const xmlStr = oneCRes.buffer.toString('utf-8');
      expect(xmlStr).toContain('V8Exch:Data');
      expect(xmlStr).toContain('<Receipts_OS1>');
      expect(xmlStr).toContain('<MOL_TurnoverLedger>');
    });
  });
});
