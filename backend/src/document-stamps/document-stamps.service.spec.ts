import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { DocumentStampsService } from './document-stamps.service';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_VERIFICATION, SYSTEM_AUDIT_ACTIONS } from '../common/constants';

describe('DocumentStampsService', () => {
  let service: DocumentStampsService;
  let prisma: any;

  const mockPrismaService = {
    documentStamp: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    systemAuditLog: {
      create: jest.fn(),
    },
    request: {
      findFirst: jest.fn(),
    },
    writeOffRequest: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentStampsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DocumentStampsService>(DocumentStampsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('generateHash & HMAC Secret', () => {
    it('should generate valid HMAC-SHA256 hash using server environment secret', () => {
      const now = new Date('2026-09-19T00:00:00.000Z');
      const hash1 = service.generateHash('DOC-2026-001', 'OS_1', 'Valijon Aliyev', now);
      const hash2 = service.generateHash('DOC-2026-001', 'OS_1', 'Valijon Aliyev', now);

      expect(hash1).toBeDefined();
      expect(hash1).toHaveLength(64); // SHA-256 hex length
      expect(hash1).toBe(hash2); // Deterministic with same inputs

      // Altering any input must produce a completely different hash
      const hash3 = service.generateHash('DOC-2026-002', 'OS_1', 'Valijon Aliyev', now);
      expect(hash1).not.toBe(hash3);
    });

    it('should cryptographically seal document payload so changing items, quantities or prices invalidates the stamp hash', () => {
      const now = new Date('2026-09-19T00:00:00.000Z');
      const metaOriginal = {
        department: 'Axborot texnologiyalari',
        items: [
          { name: 'Monoblok HP 24', qty: 10, price: 8500000 },
          { name: 'Printer HP LaserJet', qty: 2, price: 3200000 },
        ],
      };

      const originalHash = service.generateHash('DOC-2026-001', 'OS_1', 'Valijon Aliyev', now, metaOriginal);

      // 1. Changing item quantity from 10 -> 11 MUST produce a different hash
      const metaTamperedQty = {
        department: 'Axborot texnologiyalari',
        items: [
          { name: 'Monoblok HP 24', qty: 11, price: 8500000 },
          { name: 'Printer HP LaserJet', qty: 2, price: 3200000 },
        ],
      };
      const tamperedQtyHash = service.generateHash('DOC-2026-001', 'OS_1', 'Valijon Aliyev', now, metaTamperedQty);
      expect(originalHash).not.toBe(tamperedQtyHash);

      // 2. Changing price MUST produce a different hash
      const metaTamperedPrice = {
        department: 'Axborot texnologiyalari',
        items: [
          { name: 'Monoblok HP 24', qty: 10, price: 9000000 },
          { name: 'Printer HP LaserJet', qty: 2, price: 3200000 },
        ],
      };
      const tamperedPriceHash = service.generateHash('DOC-2026-001', 'OS_1', 'Valijon Aliyev', now, metaTamperedPrice);
      expect(originalHash).not.toBe(tamperedPriceHash);

      // 3. Deterministic canonical representation: identical data with reversed keys MUST produce the EXACT same hash
      const metaReorderedKeys = {
        items: [
          { price: 8500000, name: 'Monoblok HP 24', qty: 10 },
          { qty: 2, name: 'Printer HP LaserJet', price: 3200000 },
        ],
        department: 'Axborot texnologiyalari',
      };
      const reorderedHash = service.generateHash('DOC-2026-001', 'OS_1', 'Valijon Aliyev', now, metaReorderedKeys);
      expect(originalHash).toBe(reorderedHash);
    });
  });

  describe('Write-Once (WORM) Policy on stampDocument', () => {
    it('should stamp a document when it does not already exist', async () => {
      prisma.documentStamp.findUnique.mockResolvedValue(null);
      const createdStamp = {
        id: 'stamp-1',
        docType: 'OS_1',
        docNumber: 'OS1-2026-0001',
        verificationHash: 'hash123',
        title: 'Kirim Akti OS-1',
        signerName: 'Karimov Omon',
        signerRole: 'Ombor mudiri',
        metadataJson: JSON.stringify({ itemsCount: 5 }),
        isValid: true,
        createdAt: new Date(),
      };
      prisma.documentStamp.create.mockResolvedValue(createdStamp);

      const result = await service.stampDocument({
        docType: 'OS_1',
        docNumber: 'OS1-2026-0001',
        title: 'Kirim Akti OS-1',
        signerName: 'Karimov Omon',
        signerRole: 'Ombor mudiri',
        metadata: { itemsCount: 5 },
      });

      expect(result.docNumber).toBe('OS1-2026-0001');
      expect(result.verificationUrl).toContain('/verify-doc/OS1-2026-0001');
      expect(prisma.documentStamp.create).toHaveBeenCalledTimes(1);
    });

    it('should strictly reject overwriting an existing stamped document with ConflictException (Write-Once rule)', async () => {
      prisma.documentStamp.findUnique.mockResolvedValue({
        id: 'stamp-existing',
        docNumber: 'OS1-2026-0001',
        isValid: true,
      });

      await expect(
        service.stampDocument({
          docType: 'OS_1',
          docNumber: 'OS1-2026-0001',
          title: 'Tampered Title',
          signerName: 'Attacker',
          signerRole: 'None',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.documentStamp.create).not.toHaveBeenCalled();
    });

    it('should strictly throw error if deleteStamp is invoked', async () => {
      await expect(service.deleteStamp()).rejects.toThrow(BadRequestException);
    });
  });

  describe('Write-Once Revocation Act (revokeStamp)', () => {
    it('should successfully revoke a valid stamp and record an audit log', async () => {
      const existingStamp = {
        id: 'stamp-1',
        docNumber: 'OS2-2026-0012',
        docType: 'OS_2',
        isValid: true,
        revokedAt: null,
        revokedReason: null,
      };
      prisma.documentStamp.findUnique.mockResolvedValue(existingStamp);
      prisma.documentStamp.update.mockResolvedValue({
        ...existingStamp,
        isValid: false,
        revokedAt: new Date(),
        revokedReason: 'Noto‘g‘ri kafedra biriktirilgan',
      });
      prisma.systemAuditLog.create.mockResolvedValue({ id: 'log-1' });

      const res = await service.revokeStamp(
        {
          docNumber: 'OS2-2026-0012',
          reason: 'Noto‘g‘ri kafedra biriktirilgan',
        },
        'user-admin-1',
      );

      expect(res.isValid).toBe(false);
      expect(prisma.documentStamp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { docNumber: 'OS2-2026-0012' },
          data: expect.objectContaining({
            isValid: false,
            revokedReason: 'Noto‘g‘ri kafedra biriktirilgan',
            revokedById: 'user-admin-1',
          }),
        }),
      );
      expect(prisma.systemAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SYSTEM_AUDIT_ACTIONS.DOCUMENT_REVOKED,
            entity: 'DocumentStamp',
            userId: 'user-admin-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException when revoking non-existent stamp', async () => {
      prisma.documentStamp.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeStamp({
          docNumber: 'UNKNOWN-999',
          reason: 'Test reason',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when revoking an already revoked stamp', async () => {
      prisma.documentStamp.findUnique.mockResolvedValue({
        id: 'stamp-1',
        docNumber: 'OS2-2026-0012',
        isValid: false,
        revokedAt: new Date(),
      });

      await expect(
        service.revokeStamp({
          docNumber: 'OS2-2026-0012',
          reason: 'Duplicate revocation',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when revocation reason is empty', async () => {
      await expect(
        service.revokeStamp({
          docNumber: 'OS2-2026-0012',
          reason: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Zero JShShIR Leakage & Public Verification', () => {
    it('should strictly scrub JShShIR, PINFL, passport, and phone numbers from public metadata', () => {
      const sensitiveMetadata = {
        department: 'Axborot xavfsizligi',
        room: '304-xona',
        jshshir: '12345678901234',
        pinfl: '98765432109876',
        passport: 'AA1234567',
        passportNumber: '7654321',
        phone: '+998901234567',
        items: [
          {
            name: 'Kompyuter Monoblok HP',
            qty: 5,
            unit: 'dona',
            userPinfl: '32101234567890', // Nested sensitive key
          },
        ],
      };

      const sanitized = service.sanitizePublicMetadata(sensitiveMetadata);

      expect(sanitized.department).toBe('Axborot xavfsizligi');
      expect(sanitized.room).toBe('304-xona');
      expect(sanitized.jshshir).toBeUndefined();
      expect(sanitized.pinfl).toBeUndefined();
      expect(sanitized.passport).toBeUndefined();
      expect(sanitized.passportNumber).toBeUndefined();
      expect(sanitized.phone).toBeUndefined();
      expect(sanitized.items[0].name).toBe('Kompyuter Monoblok HP');
      expect(sanitized.items[0].userPinfl).toBeUndefined();
    });

    it('should return sanitized verify result with legal security notice for valid stamp', async () => {
      prisma.documentStamp.findUnique.mockResolvedValue({
        id: 'stamp-1',
        docNumber: 'OS1-2026-0042',
        docType: 'OS_1',
        title: 'Kirim Akti OS-1',
        signerName: 'Valijon Aliyev',
        signerRole: 'Kafedra mudiri',
        verificationHash: 'hmac_sha256_hash_value',
        metadataJson: JSON.stringify({
          jshshir: '31234567890123',
          items: [{ name: 'Monitor Dell', qty: 2 }],
        }),
        isValid: true,
        createdAt: new Date('2026-09-19T00:00:00.000Z'),
        revokedAt: null,
        revokedReason: null,
      });

      const res = await service.verifyPublic('OS1-2026-0042');

      expect(res.isValid).toBe(true);
      expect(res.status).toBe('VERIFIED');
      expect(res.docNumber).toBe('OS1-2026-0042');
      expect(res.signerName).toBe('Valijon Aliyev');
      expect(res.metadata.jshshir).toBeUndefined();
      expect(res.metadata.items[0].name).toBe('Monitor Dell');
      expect(res.securityNotice).toContain('JShShIR, PINFL va pasport ma’lumotlari ochiq reyestrda ko‘rsatilmaydi');
    });

    it('should return REVOKED status with revocation reason and timestamp when document is revoked', async () => {
      const revokedDate = new Date('2026-09-19T00:30:00.000Z');
      prisma.documentStamp.findUnique.mockResolvedValue({
        id: 'stamp-revoked',
        docNumber: 'OS1-2026-0099',
        docType: 'OS_1',
        title: 'Bekor qilingan dalolatnoma',
        signerName: 'Valijon Aliyev',
        signerRole: 'Kafedra mudiri',
        verificationHash: 'hmac_revoked_hash',
        metadataJson: JSON.stringify({ items: [] }),
        isValid: false,
        createdAt: new Date('2026-09-18T10:00:00.000Z'),
        revokedAt: revokedDate,
        revokedReason: 'Rektorat farmoyishiga asosan bekor qilindi',
      });

      const res = await service.verifyPublic('OS1-2026-0099');

      expect(res.isValid).toBe(false);
      expect(res.status).toBe('REVOKED');
      expect(res.revokedReason).toBe('Rektorat farmoyishiga asosan bekor qilindi');
      expect(res.revokedAt).toEqual(revokedDate);
    });
  });
});
