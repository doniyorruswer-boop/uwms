import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SigningSessionsService } from './signing-sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { SYSTEM_AUDIT_ACTIONS } from '../common/constants';

describe('SigningSessionsService', () => {
  let service: SigningSessionsService;
  let prisma: any;
  let stampsService: any;

  const mockSession = {
    id: 'session-uuid-1',
    sessionToken: 'mock_token_64_characters_long_abcdef1234567890abcdef1234567890abcdef',
    docNumber: 'OS1-2026-0042',
    docType: 'OS_1',
    title: 'Kirim Dalolatnomasi OS-1',
    departmentName: 'Dasturiy injiniring',
    roomName: '404-xona',
    itemSummary: '10 dona HP ProDesk kompyuter',
    metadataJson: JSON.stringify({ items: [{ name: 'HP ProDesk', qty: 10 }] }),
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 50 * 1000), // 50 seconds remaining
    signedAt: null,
    signerName: null,
    signerRole: null,
    biometricType: null,
    deviceInfo: null,
    stampId: null,
    createdById: 'user-admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    stamp: null,
  };

  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    signingSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    documentStamp: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    systemAuditLog: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    responsibilityHandover: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStampsService = {
    generateHash: jest.fn().mockReturnValue('mock_verification_hash_12345'),
    sanitizePublicMetadata: jest.fn((meta) => meta),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SigningSessionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DocumentStampsService, useValue: mockStampsService },
      ],
    }).compile();

    service = module.get<SigningSessionsService>(SigningSessionsService);
    prisma = module.get<PrismaService>(PrismaService);
    stampsService = module.get<DocumentStampsService>(DocumentStampsService);
  });

  describe('initSession', () => {
    it('should initialize a 60-second dynamic signing session with a secure token and QR URL', async () => {
      mockPrisma.signingSession.create.mockResolvedValue(mockSession);

      const result = await service.initSession(
        {
          docNumber: 'OS1-2026-0042',
          docType: 'OS_1',
          title: 'Kirim Dalolatnomasi OS-1',
          departmentName: 'Dasturiy injiniring',
          roomName: '404-xona',
          itemSummary: '10 dona HP ProDesk kompyuter',
          metadata: { items: [{ name: 'HP ProDesk', qty: 10 }] },
        },
        'user-admin-1',
      );

      expect(result.sessionId).toBe('session-uuid-1');
      expect(result.qrUrl).toContain('/mobile/sign/');
      expect(result.remainingSeconds).toBe(60);
      expect(mockPrisma.signingSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            docNumber: 'OS1-2026-0042',
            docType: 'OS_1',
            status: 'PENDING',
            createdById: 'user-admin-1',
          }),
        }),
      );
    });
  });

  describe('getSessionPublic', () => {
    it('should advance status from PENDING to SCANNED when opened on mobile', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 45 * 1000),
      });
      mockPrisma.signingSession.update.mockResolvedValue({
        ...mockSession,
        status: 'SCANNED',
      });

      const res = await service.getSessionPublic('mock_token_123');

      expect(res.status).toBe('SCANNED');
      expect(mockPrisma.signingSession.update).toHaveBeenCalledWith({
        where: { id: 'session-uuid-1' },
        data: { status: 'SCANNED' },
      });
      expect(res.remainingSeconds).toBeGreaterThan(0);
    });

    it('should mark session as EXPIRED if 60s life expired', async () => {
      const expiredDate = new Date(Date.now() - 5000); // 5 seconds ago
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'PENDING',
        expiresAt: expiredDate,
      });

      const res = await service.getSessionPublic('mock_token_123');

      expect(res.status).toBe('EXPIRED');
      expect(res.remainingSeconds).toBe(0);
      expect(mockPrisma.signingSession.update).toHaveBeenCalledWith({
        where: { id: 'session-uuid-1' },
        data: { status: 'EXPIRED' },
      });
    });

    it('should throw NotFoundException if token is invalid', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue(null);

      await expect(service.getSessionPublic('invalid_token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmBiometricSign', () => {
    it('should confirm biometric sign, generate permanent stamp, and mark session SIGNED', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'SCANNED',
        expiresAt: new Date(Date.now() + 30 * 1000),
      });

      const createdStamp = {
        id: 'stamp-uuid-1',
        docNumber: 'OS1-2026-0042',
        verificationHash: 'mock_verification_hash_12345',
        isValid: true,
      };
      mockPrisma.documentStamp.findUnique.mockResolvedValue(null);
      mockPrisma.documentStamp.create.mockResolvedValue(createdStamp);

      mockPrisma.signingSession.update.mockResolvedValue({
        ...mockSession,
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: 'Valijon Aliyev',
        signerRole: 'Kafedra mudiri',
        biometricType: 'TOUCH_ID',
        stamp: createdStamp,
      });

      const res = await service.confirmBiometricSign(
        'mock_token_123',
        {
          signerName: 'Valijon Aliyev',
          signerRole: 'Kafedra mudiri',
          biometricType: 'TOUCH_ID',
          deviceInfo: 'iPhone 14 Safari',
        },
        '192.168.1.100',
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('SIGNED');
      expect(res.signerName).toBe('Valijon Aliyev');
      expect(res.stamp).toBeDefined();

      expect(mockPrisma.systemAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SYSTEM_AUDIT_ACTIONS.BIOMETRIC_SIGNED,
            entity: 'SigningSession',
          }),
        }),
      );
    });

    it('should throw BadRequestException if session is already signed', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'SIGNED',
      });

      await expect(
        service.confirmBiometricSign('mock_token_123', {
          signerName: 'Valijon Aliyev',
          signerRole: 'Kafedra mudiri',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if session has expired', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'SCANNED',
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(
        service.confirmBiometricSign('mock_token_123', {
          signerName: 'Valijon Aliyev',
          signerRole: 'Kafedra mudiri',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should strictly reject signature spoofing when assigned signerName does not match', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        signerName: 'Haqiqiy Mas’ul Xodim',
        signerRole: 'Kafedra mudiri',
        status: 'SCANNED',
      });

      await expect(
        service.confirmBiometricSign('mock_token_123', {
          signerName: 'Soxta Foydalanuvchi',
          signerRole: 'Kafedra mudiri',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSessionStatus & cancelSession', () => {
    it('should return session status and remaining seconds for desktop polling', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'SCANNED',
        expiresAt: new Date(Date.now() + 25 * 1000),
      });

      const status = await service.getSessionStatus('session-uuid-1');

      expect(status.status).toBe('SCANNED');
      expect(status.remainingSeconds).toBeGreaterThanOrEqual(20);
      expect(status.docNumber).toBe('OS1-2026-0042');
    });

    it('should cancel an active session when desktop user closes modal', async () => {
      mockPrisma.signingSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.signingSession.update.mockResolvedValue({
        ...mockSession,
        status: 'CANCELLED',
      });

      const res = await service.cancelSession('session-uuid-1');
      expect(res.status).toBe('CANCELLED');
    });
  });

  describe('initHandoverSession (Phase 3 Tests)', () => {
    const mockHandover = {
      id: 'handover-123',
      handoverNumber: 'AKT-2026-0099',
      type: 'ROOM_TRANSFER',
      status: 'PENDING_SIGNATURES',
      departingUser: { id: 'user-1', fullName: 'Aliyev Anvar', position: 'Laborant' },
      targetUser: { id: 'user-2', fullName: 'Karimov Jasur', position: 'Kafedra mudiri' },
      commandantUser: { id: 'user-3', fullName: 'Rahimov Akmal', position: 'Bino komendanti' },
      accountantUser: { id: 'user-4', fullName: 'Turg‘unov Omon', position: 'Buxgalter' },
      building: { name: 'Bosh bino' },
      room: { number: '204', name: 'IT Laboratoriya' },
      items: [
        {
          id: 'item-act-1',
          actionType: 'TRANSFER_TO_MOL',
          itemInstance: { inventoryNumber: 'INV-001', item: { name: 'HP Kompyuter' } },
        },
      ],
    };

    it('bino komendanti uchun maxsus 60s li handover QR sessiyasini ochishi kerak', async () => {
      mockPrisma.responsibilityHandover.findFirst.mockResolvedValue(mockHandover);
      mockPrisma.signingSession.create.mockResolvedValue({
        id: 'session-handover-1',
        sessionToken: 'token-handover-xyz',
        docNumber: 'AKT-2026-0099',
        docType: 'HANDOVER_ACT',
        title: 'Moddiy Javobgarlikni Topshirish Dalolatnomasi (AKT-2026-0099)',
        signerName: 'Rahimov Akmal',
        signerRole: 'Bino komendanti',
        expiresAt: new Date(Date.now() + 60000),
        itemSummary: '1 ta aktiv: HP Kompyuter',
      });

      const res = await service.initHandoverSession(
        {
          handoverId: 'handover-123',
          signatoryRole: 'COMMANDANT',
        },
        'user-1',
      );

      expect(res.docType).toBe('HANDOVER_ACT');
      expect(res.expectedSignerName).toBe('Rahimov Akmal');
      expect(res.qrUrl).toContain('/mobile/sign/');
      expect(res.docNumber).toBe('AKT-2026-0099');
    });

    it('allaqachon yakunlangan topshirish uchun sessiya ochishga yo‘l qo‘ymasligi kerak', async () => {
      mockPrisma.responsibilityHandover.findFirst.mockResolvedValue({
        ...mockHandover,
        status: 'COMPLETED',
      });

      await expect(
        service.initHandoverSession(
          {
            handoverId: 'handover-123',
            signatoryRole: 'COMMANDANT',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
