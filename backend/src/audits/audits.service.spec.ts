import { Test, TestingModule } from '@nestjs/testing';
import { AuditsService } from './audits.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { AuditStatus, AuditRecordStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AuditsService (Unit Tests)', () => {
  let service: AuditsService;
  let prisma: any;
  let systemAudit: any;
  let documentStamps: any;

  beforeEach(async () => {
    prisma = {
      room: {
        findUnique: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'auditor-1', role: 'AUDITOR' }),
      },
      itemInstance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryAudit: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryAuditRecord: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    documentStamps = {
      stampDocument: jest.fn().mockResolvedValue({
        id: 'stamp-1',
        verificationHash: 'HASH123',
        publicUrl: '/verify-doc/INV-19-TEST',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: DocumentStampsService, useValue: documentStamps },
      ],
    }).compile();

    service = module.get<AuditsService>(AuditsService);
  });

  describe('startAudit', () => {
    it('yangi audit sessiyasini IN_PROGRESS holatida boshlashi va log yozishi kerak', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-101', number: '101' });
      prisma.inventoryAudit.create.mockResolvedValue({
        id: 'audit-1',
        auditNumber: 'AUD-2026-TEST0001',
        roomId: 'room-101',
        status: AuditStatus.IN_PROGRESS,
      });

      const res = await service.startAudit('room-101', 'auditor-1');

      expect(res).toBeDefined();
      expect(prisma.inventoryAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roomId: 'room-101',
            status: AuditStatus.IN_PROGRESS,
          }),
        }),
      );
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'InventoryAudit',
        }),
      );
    });
  });

  describe('scanCode', () => {
    it('baza ro‘yxatida bo‘lmagan QR-kod skan qilinganda found: false qaytarishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue(null);

      const res = await service.scanCode('room-101', 'UNKNOWN-QR-CODE');

      expect(res.found).toBe(false);
      expect(prisma.inventoryAuditRecord.create).not.toHaveBeenCalled();
    });

    it('vosita xonaga mos kelganda MATCHED holatida InventoryAuditRecord ga yozishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        qrCode: 'UWMS-QR-1001',
        roomId: 'room-101', // mos xona
        inventoryNumber: 'INV-2026-0001',
        item: { name: 'Monoblok HP 24"' },
        room: { number: '101' },
      });

      prisma.inventoryAudit.findFirst.mockResolvedValue({
        id: 'audit-1',
        roomId: 'room-101',
        status: AuditStatus.IN_PROGRESS,
      });

      prisma.inventoryAuditRecord.findFirst.mockResolvedValue(null); // avval skan qilinmagan
      prisma.inventoryAuditRecord.create.mockResolvedValue({ id: 'rec-1' });

      const res = await service.scanCode('room-101', 'UWMS-QR-1001');

      expect(res.found).toBe(true);
      expect(res.isMatch).toBe(true);
      expect((res as any).status).toBe(AuditRecordStatus.MATCHED);
      expect(prisma.inventoryAuditRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          auditId: 'audit-1',
          itemInstanceId: 'asset-1',
          expectedRoomId: 'room-101',
          foundRoomId: 'room-101',
          status: AuditRecordStatus.MATCHED,
        }),
      });
    });

    it('vosita boshqa xonaga tegishli bo‘lsa RELOCATED holatida InventoryAuditRecord ga yozishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-2',
        qrCode: 'UWMS-QR-2002',
        roomId: 'room-202', // kutilgan xona 202
        inventoryNumber: 'INV-2026-0002',
        item: { name: 'Proyektor Epson' },
        room: { number: '202' },
      });

      prisma.inventoryAudit.findFirst.mockResolvedValue({
        id: 'audit-1',
        roomId: 'room-101', // skan qilinayotgan xona 101
        status: AuditStatus.IN_PROGRESS,
      });

      prisma.inventoryAuditRecord.findFirst.mockResolvedValue(null);
      prisma.inventoryAuditRecord.create.mockResolvedValue({ id: 'rec-2' });

      const res = await service.scanCode('room-101', 'UWMS-QR-2002');

      expect(res.found).toBe(true);
      expect(res.isMatch).toBe(false);
      expect((res as any).status).toBe(AuditRecordStatus.RELOCATED);
      expect(prisma.inventoryAuditRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          auditId: 'audit-1',
          itemInstanceId: 'asset-2',
          expectedRoomId: 'room-202',
          foundRoomId: 'room-101',
          status: AuditRecordStatus.RELOCATED,
        }),
      });
    });

    it('avval skan qilingan aktiv takroran skan qilinganda dublikat record yaratmasligi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        qrCode: 'UWMS-QR-1001',
        roomId: 'room-101',
        item: { name: 'Monoblok HP' },
      });

      prisma.inventoryAudit.findFirst.mockResolvedValue({
        id: 'audit-1',
        roomId: 'room-101',
        status: AuditStatus.IN_PROGRESS,
      });

      // Allaqachon mavjud record
      prisma.inventoryAuditRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        auditId: 'audit-1',
        itemInstanceId: 'asset-1',
      });

      const res = await service.scanCode('room-101', 'UWMS-QR-1001');

      expect(res.found).toBe(true);
      expect(prisma.inventoryAuditRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('completeAudit', () => {
    it('audit topilmasa NotFoundException tashlashi kerak', async () => {
      prisma.inventoryAudit.findUnique.mockResolvedValue(null);

      await expect(
        service.completeAudit('non-existent', 'Audit yakuni', 'auditor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('audit allaqachon yakunlangan bo‘lsa BadRequestException tashlashi kerak', async () => {
      prisma.inventoryAudit.findUnique.mockResolvedValue({
        id: 'audit-1',
        status: AuditStatus.COMPLETED,
      });

      await expect(
        service.completeAudit('audit-1', 'Qayta yakunlash', 'auditor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('muvaffaqiyatli yakunlab statusni COMPLETED qilishi va INV-19 muhrini urishi kerak', async () => {
      prisma.inventoryAudit.findUnique.mockResolvedValue({
        id: 'audit-1',
        auditNumber: 'AUD-2026-001',
        status: AuditStatus.IN_PROGRESS,
        roomId: 'room-101',
        room: { id: 'room-101', number: '101', name: 'Laboratoriya' },
        records: [],
      });

      prisma.itemInstance.findMany.mockResolvedValue([]);
      prisma.inventoryAudit.update.mockResolvedValue({
        id: 'audit-1',
        auditNumber: 'AUD-2026-001',
        status: AuditStatus.COMPLETED,
        actNumber: 'INV-19-AUD-2026-001',
        room: { number: '101' },
        createdBy: { fullName: 'Ali Auditor' },
        records: [],
      });

      const res = await service.completeAudit('audit-1', 'Kamomad yo‘q, barchasi joyida', 'auditor-1');

      expect(prisma.inventoryAudit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'audit-1' },
          data: expect.objectContaining({
            status: AuditStatus.COMPLETED,
            notes: 'Kamomad yo‘q, barchasi joyida',
          }),
        }),
      );
      expect(documentStamps.stampDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          docType: 'INV_19',
          docNumber: 'AUD-2026-001',
        }),
      );
    });
  });
});
