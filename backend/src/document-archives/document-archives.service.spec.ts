import { Test, TestingModule } from '@nestjs/testing';
import { DocumentArchivesService } from './document-archives.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

describe('DocumentArchivesService', () => {
  let service: DocumentArchivesService;
  let prisma: any;

  const mockArchive = {
    id: 'archive-uuid-1',
    docType: 'OS_2',
    entityId: 'req-123',
    docNumber: 'OS2-2026-001',
    title: 'OS-2 Chiqim Yuk Xati',
    version: 1,
    status: 'SIGNED',
    pdfPath: 'uploads/documents/OS_2/OS2-2026-001_v1.html',
    fileSize: 1024,
    checksum: 'mock-sha256-checksum',
    metadata: { items: [] },
    stampId: 'stamp-uuid-1',
    signedById: 'user-uuid-1',
    signedAt: new Date(),
    cancelledById: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn((callback) => callback(mockPrisma)),
      documentArchive: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      documentStamp: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      systemAuditLog: {
        create: jest.fn(),
      },
      responsibilityHandover: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentArchivesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DocumentArchivesService>(DocumentArchivesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAndArchive', () => {
    it('should archive a document as version 1 if no previous version exists', async () => {
      prisma.documentArchive.findFirst.mockResolvedValue(null);
      prisma.documentStamp.findUnique.mockResolvedValue(null);
      prisma.documentStamp.create.mockResolvedValue({ id: 'stamp-uuid-1' });
      prisma.documentArchive.create.mockResolvedValue(mockArchive);
      prisma.systemAuditLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.generateAndArchive(
        {
          docType: 'OS_2',
          entityId: 'req-123',
          docNumber: 'OS2-2026-001',
          title: 'OS-2 Chiqim Yuk Xati',
          metadata: { items: [] },
        },
        'user-uuid-1',
      );

      expect(prisma.documentArchive.findFirst).toHaveBeenCalledWith({
        where: { entityId: 'req-123', docType: 'OS_2' },
        orderBy: { version: 'desc' },
      });
      expect(prisma.documentArchive.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 1,
            status: 'SIGNED',
            entityId: 'req-123',
            docNumber: 'OS2-2026-001',
          }),
        }),
      );
      expect(prisma.systemAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DOCUMENT_ARCHIVED',
            entity: 'DocumentArchive',
          }),
        }),
      );
      expect(result).toEqual(mockArchive);
    });

    it('should increment version to 2 if version 1 already exists', async () => {
      prisma.documentArchive.findFirst.mockResolvedValue({ version: 1 });
      prisma.documentStamp.findUnique.mockResolvedValue({ id: 'stamp-uuid-1' });
      prisma.documentArchive.create.mockResolvedValue({ ...mockArchive, version: 2 });
      prisma.systemAuditLog.create.mockResolvedValue({ id: 'log-2' });

      const result = await service.generateAndArchive(
        {
          docType: 'OS_2',
          entityId: 'req-123',
          docNumber: 'OS2-2026-001',
          title: 'OS-2 Chiqim Yuk Xati',
        },
        'user-uuid-1',
      );

      expect(prisma.documentArchive.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
          }),
        }),
      );
      expect(result.version).toBe(2);
    });
  });

  describe('cancel', () => {
    it('should mark document as CANCELLED, set reason and invalidate stamp', async () => {
      prisma.documentArchive.findUnique.mockResolvedValue({
        ...mockArchive,
        status: 'SIGNED',
        stampId: 'stamp-uuid-1',
      });
      prisma.documentArchive.update.mockResolvedValue({
        ...mockArchive,
        status: 'CANCELLED',
        cancelReason: 'Bekor qilish talab etildi',
      });
      prisma.documentStamp.update.mockResolvedValue({ id: 'stamp-uuid-1', isValid: false });
      prisma.systemAuditLog.create.mockResolvedValue({ id: 'log-cancel' });

      const result = await service.cancel('archive-uuid-1', 'Bekor qilish talab etildi', 'user-uuid-1');

      expect(prisma.documentArchive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'archive-uuid-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelReason: 'Bekor qilish talab etildi',
          }),
        }),
      );
      expect(prisma.documentStamp.update).toHaveBeenCalledWith({
        where: { id: 'stamp-uuid-1' },
        data: expect.objectContaining({
          isValid: false,
          revokedAt: expect.any(Date),
          revokedReason: 'Bekor qilish talab etildi',
          revokedById: 'user-uuid-1',
        }),
      });
      expect(prisma.systemAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DOCUMENT_CANCELLED',
            entity: 'DocumentArchive',
          }),
        }),
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw BadRequestException if already cancelled', async () => {
      prisma.documentArchive.findUnique.mockResolvedValue({
        ...mockArchive,
        status: 'CANCELLED',
      });

      await expect(
        service.cancel('archive-uuid-1', 'Yana bekor qilish', 'user-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if document archive does not exist', async () => {
      prisma.documentArchive.findUnique.mockResolvedValue(null);

      await expect(
        service.cancel('non-existent-id', 'Bekor sababi', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('should query archives sorted by version desc', async () => {
      prisma.documentArchive.findMany.mockResolvedValue([mockArchive]);

      const history = await service.getHistory({ entityId: 'req-123' });

      expect(prisma.documentArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityId: 'req-123' },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        }),
      );
      expect(history).toHaveLength(1);
    });
  });

  describe('deleteArchive', () => {
    it('should strictly reject deleting archives under Write-Once policy', async () => {
      await expect(service.deleteArchive()).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateHandoverAct & getHandoverDocument (Phase 3 Tests)', () => {
    const mockHandover = {
      id: 'handover-456',
      handoverNumber: 'AKT-2026-0042',
      type: 'ROOM_TRANSFER',
      status: 'PENDING_SIGNATURES',
      createdAt: new Date(),
      departingUser: { id: 'user-1', fullName: 'Aliyev Anvar', position: 'Laborant' },
      targetUser: { id: 'user-2', fullName: 'Karimov Jasur', position: 'Kafedra mudiri' },
      commandantUser: { id: 'user-3', fullName: 'Rahimov Akmal', position: 'Bino komendanti' },
      accountantUser: { id: 'user-4', fullName: 'Turg‘unov Omon', position: 'Buxgalter' },
      building: { name: 'Bosh bino' },
      room: { number: '204', name: 'IT Laboratoriya' },
      items: [
        {
          id: 'act-item-1',
          actionType: 'TRANSFER_TO_MOL',
          itemInstance: {
            inventoryNumber: 'INV-001',
            serialNumber: 'SN123',
            initialCost: 5000000,
            item: { name: 'HP Kompyuter' },
          },
        },
      ],
      docArchive: null,
    };

    it('should generate official OS-1 HTML act and archive with version 1', async () => {
      prisma.responsibilityHandover.findFirst.mockResolvedValue(mockHandover);
      prisma.documentArchive.findFirst.mockResolvedValue(null);
      prisma.documentStamp.findUnique.mockResolvedValue(null);
      prisma.documentStamp.create.mockResolvedValue({ id: 'stamp-1' });
      prisma.documentArchive.create.mockResolvedValue({
        id: 'archive-handover-1',
        docType: 'OS_1',
        docNumber: 'AKT-2026-0042',
        version: 1,
        status: 'SIGNED',
      });
      prisma.responsibilityHandover.update.mockResolvedValue({ id: 'handover-456' });

      const res = await service.generateHandoverAct('handover-456', 'user-admin');

      expect(res.archive.docType).toBe('OS_1');
      expect(res.archive.version).toBe(1);
      expect(res.htmlContent).toContain('MODDIY JAVOBGARLIKNI TOPSHIRISH-QABUL QILISH DALOLATNOMASI (OS-1)');
      expect(res.htmlContent).toContain('Aliyev Anvar');
      expect(res.htmlContent).toContain('Karimov Jasur');
      expect(res.htmlContent).toContain('HP Kompyuter');
    });

    it('should throw NotFoundException if handover record does not exist', async () => {
      prisma.responsibilityHandover.findFirst.mockResolvedValue(null);

      await expect(service.generateHandoverAct('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
