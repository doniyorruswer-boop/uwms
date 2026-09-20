import { Test, TestingModule } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

describe('AssetsService - Import Template & Dry-Run Preview (Unit Tests)', () => {
  let service: AssetsService;
  let prisma: any;
  let codeGen: any;
  let systemAudit: any;

  beforeEach(async () => {
    prisma = {
      room: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'room-101', number: '101', name: 'Kompyuter xonasi', responsibleUserId: 'user-mol' },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-101',
          number: '101',
          name: 'Kompyuter xonasi',
          responsibleUserId: 'user-mol',
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user-mol', username: 'mol_user', fullName: 'Omon Toshmatov', role: 'MOL' },
        ]),
      },
      itemInstance: {
        count: jest.fn().mockResolvedValue(100),
        findMany: jest.fn().mockResolvedValue([
          { inventoryNumber: 'INV-2026-EXISTING' },
        ]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-inst-1', ...data })),
      },
      category: {
        upsert: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Kompyuter va IT uskunalari' }),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'item-1', name: 'Lenovo ThinkCentre' }),
      },
      assetHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    codeGen = {
      generateInventoryNumber: jest.fn((seq) => `INV-2026-${String(seq).padStart(5, '0')}`),
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: codeGen },
        { provide: NotificationsService, useValue: { sendNotification: jest.fn() } },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: DocumentStampsService, useValue: { createStamp: jest.fn() } },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  describe('generateImportTemplate', () => {
    it('should generate a valid XLSX workbook with template data and instructions', async () => {
      const template = await service.generateImportTemplate();

      expect(template).toBeDefined();
      expect(template.filename).toBe('UWMS_Aktivlar_Import_Shablon.xlsx');
      expect(template.contentType).toContain('spreadsheetml');
      expect(template.buffer).toBeDefined();

      // Read back with SheetJS to verify sheets
      const wb = XLSX.read(template.buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Aktivlar Shablon');
      expect(wb.SheetNames).toContain('Qoidalar va Yo‘riqnoma');

      const sheetData = XLSX.utils.sheet_to_json(wb.Sheets['Aktivlar Shablon']);
      expect(sheetData.length).toBe(3);
    });
  });

  describe('previewImportExcelAssets (Dry-Run)', () => {
    it('should throw BadRequestException if rows array is empty', async () => {
      await expect(service.previewImportExcelAssets({ rows: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect missing required itemName', async () => {
      const result = await service.previewImportExcelAssets({
        rows: [
          {
            itemName: '',
            categoryName: 'Mebel',
          },
        ],
      });

      expect(result.validCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 1,
            field: 'itemName',
            message: 'Aktiv nomi kiritilishi shart!',
          }),
        ]),
      );
    });

    it('should detect duplicate inventory numbers within the same file', async () => {
      const result = await service.previewImportExcelAssets({
        rows: [
          {
            itemName: 'Kompyuter A',
            inventoryNumber: 'INV-DUP-1',
          },
          {
            itemName: 'Kompyuter B',
            inventoryNumber: 'INV-DUP-1', // same inventory number in file
          },
        ],
      });

      expect(result.errorCount).toBe(2);
      expect(result.errors.filter((e) => e.field === 'inventoryNumber').length).toBe(2);
      expect(result.errors[0].message).toContain('takrorlangan (dublikat)');
    });

    it('should detect duplicate inventory number that already exists in DB', async () => {
      const result = await service.previewImportExcelAssets({
        rows: [
          {
            itemName: 'Kompyuter C',
            inventoryNumber: 'INV-2026-EXISTING', // already in prisma mock
          },
        ],
      });

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].field).toBe('inventoryNumber');
      expect(result.errors[0].message).toContain('bazada allaqachon mavjud');
    });

    it('should detect invalid fundingSource', async () => {
      const result = await service.previewImportExcelAssets({
        rows: [
          {
            itemName: 'Kompyuter D',
            fundingSource: 'INVALID_SOURCE' as any,
          },
        ],
      });

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].field).toBe('fundingSource');
      expect(result.errors[0].message).toContain('Moliyalashtirish manbasi noto‘g‘ri');
    });

    it('should correctly mark valid rows and resolve room & user', async () => {
      const result = await service.previewImportExcelAssets({
        rows: [
          {
            itemName: 'Lenovo ThinkCentre',
            inventoryNumber: 'INV-NEW-99',
            roomNumber: '101',
            responsibleUsername: 'mol_user',
            fundingSource: 'BYUDJET',
            purchasePrice: 8000000,
          },
        ],
      });

      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.previewData[0].isValid).toBe(true);
      expect(result.previewData[0].resolvedRoom?.id).toBe('room-101');
      expect(result.previewData[0].resolvedUser?.username).toBe('mol_user');
    });
  });

  describe('importExcelAssets', () => {
    it('should throw BadRequestException if all rows are invalid', async () => {
      await expect(
        service.importExcelAssets({
          rows: [
            {
              itemName: '', // invalid
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should import valid rows inside transaction, log system audit, and return partial success report', async () => {
      const response = await service.importExcelAssets(
        {
          rows: [
            {
              itemName: 'Valid Kompyuter',
              inventoryNumber: 'INV-VALID-01',
              fundingSource: 'BYUDJET',
              roomNumber: '101',
            },
            {
              itemName: '', // invalid item name
              inventoryNumber: 'INV-INVALID-02',
            },
          ],
        },
        'user-admin',
      );

      expect(response.success).toBe(true);
      expect(response.totalProcessed).toBe(2);
      expect(response.importedCount).toBe(1);
      expect(response.failedCount).toBe(1);
      expect(response.items.length).toBe(1);
      expect(response.items[0].inventoryNumber).toBe('INV-VALID-01');
      expect(response.errors.length).toBe(1);

      // Verify transaction & audit log was called
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EXCEL_IMPORT',
          entity: 'ItemInstance',
          userId: 'user-admin',
          details: expect.objectContaining({
            totalRows: 2,
            importedCount: 1,
            failedCount: 1,
          }),
        }),
      );
    });
  });
});
