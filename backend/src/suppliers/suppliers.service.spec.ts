import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: any;
  let codeGen: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      supplier: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      invoice: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    codeGen = {
      generateINN: jest.fn().mockReturnValue('300000001'),
      generateContractNumber: jest.fn().mockReturnValue('SH-2026-0001'),
      generateInvoiceNumber: jest.fn().mockReturnValue('HF-2026-0001'),
    };

    audit = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: codeGen },
        { provide: SystemAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllSuppliers', () => {
    it('should return suppliers array', async () => {
      const mockSuppliers = [
        { id: '1', name: 'Texno MCHJ', inn: '300000001', _count: { invoices: 2 } },
      ];
      prisma.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.getAllSuppliers();
      expect(result).toEqual(mockSuppliers);
      expect(prisma.supplier.findMany).toHaveBeenCalled();
    });
  });

  describe('getSupplierStats', () => {
    it('should compute aggregated supplier statistics', async () => {
      prisma.supplier.count
        .mockResolvedValueOnce(5) // totalSuppliers
        .mockResolvedValueOnce(4); // activeContractsCount
      prisma.invoice.count.mockResolvedValue(10);
      prisma.invoice.findMany.mockResolvedValue([
        { totalAmount: '50000000' },
        { totalAmount: '25000000' },
      ]);

      const stats = await service.getSupplierStats();
      expect(stats.totalSuppliers).toBe(5);
      expect(stats.totalInvoices).toBe(10);
      expect(stats.totalInvoiceAmount).toBe(75000000);
      expect(stats.activeContractsCount).toBe(4);
    });
  });

  describe('deleteSupplier', () => {
    it('should block deletion if supplier has linked items or invoices', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 'supp-1',
        name: 'Texno MCHJ',
        _count: {
          itemInstances: 5,
          movements: 2,
          invoices: 1,
        },
      });

      await expect(service.deleteSupplier('supp-1')).rejects.toThrow(BadRequestException);
    });

    it('should allow deletion if supplier has zero linked relations', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 'supp-clean',
        name: 'Bo‘sh Ta’minotchi',
        _count: {
          itemInstances: 0,
          movements: 0,
          invoices: 0,
        },
      });
      prisma.supplier.delete.mockResolvedValue({ id: 'supp-clean' });

      const res = await service.deleteSupplier('supp-clean', 'admin-id');
      expect(res.success).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPLIER_DELETED',
          entityId: 'supp-clean',
        }),
      );
    });
  });
});
