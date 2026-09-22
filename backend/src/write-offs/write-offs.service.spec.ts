import { Test, TestingModule } from '@nestjs/testing';
import { WriteOffsService } from './write-offs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { EventsGateway } from '../events/events.gateway';
import { AssetStatus, WriteOffStatus, VoteStatus, MovementType } from '@prisma/client';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('WriteOffsService (Unit Tests)', () => {
  let service: WriteOffsService;
  let prisma: any;
  let codeGen: any;
  let eventsGateway: any;

  beforeEach(async () => {
    eventsGateway = {
      server: {
        emit: jest.fn(),
      },
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
    };
    prisma = {
      writeOffRequest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      writeOffMemberVote: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      itemInstance: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'mov-1', movementNumber: 'MOV-2026-0001' }),
      },
      stockMovementItem: {
        create: jest.fn().mockResolvedValue({ id: 'smi-1' }),
      },
      assetHistory: {
        create: jest.fn().mockResolvedValue({ id: 'ah-1' }),
      },
      user: {
        findMany: jest.fn(),
      },
      documentStamp: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };

    codeGen = {
      calculateDepreciation: jest.fn().mockReturnValue({
        currentValue: 2000000,
        depreciatedAmount: 8000000,
        ratePercent: 20,
        ageInMonths: 48,
        residualPercent: 20,
      }),
      generateActNumber: jest.fn().mockReturnValue('ACT-OS4-2026-0001'),
      generateDocNumber: jest.fn().mockReturnValue('ACT-OS4-2026-0001'),
      generateMovementNumber: jest.fn().mockReturnValue('MOV-2026-0001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteOffsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: codeGen },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<WriteOffsService>(WriteOffsService);
  });

  describe('createWriteOff', () => {
    it('asosiy vosita topilmasa NotFoundException tashlashi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.createWriteOff(
          {
            assetId: 'non-existent',
            reason: 'Eskirgan va yaroqsiz',
            members: [{ userId: 'user-1', roleName: 'Komissiya a’zosi' }],
          },
          'creator-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('vosita allaqachon WRITTEN_OFF bo‘lsa BadRequestException tashlashi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        status: AssetStatus.WRITTEN_OFF,
        item: { category: { name: 'IT' } },
      });

      await expect(
        service.createWriteOff(
          {
            assetId: 'asset-1',
            reason: 'Test',
            members: [{ userId: 'user-1', roleName: 'Komissiya a’zosi' }],
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('muvaffaqiyatli ariza yaratib, komissiya a’zolarini tayinlashi va vositani IN_REPAIR qilishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        status: AssetStatus.IN_USE,
        room: { number: '101' },
        item: { category: { name: 'Kompyuterlar' } },
      });

      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', role: 'SUPER_ADMIN' },
        { id: 'user-2', role: 'AUDITOR' },
      ]);

      prisma.writeOffRequest.create.mockResolvedValue({
        id: 'wo-1',
        actNumber: 'ACT-OS4-2026-0001',
        status: WriteOffStatus.IN_REVIEW,
        assetId: 'asset-1',
      });

      const res = await service.createWriteOff(
        {
          assetId: 'asset-1',
          reason: 'Ona plata kuygan, tuzatish iqtisodiy samarasiz',
          members: [
            { userId: 'user-1', roleName: 'Komissiya raisi' },
            { userId: 'user-2', roleName: 'Bosh buxgalter' },
          ],
        },
        'creator-1',
      );

      expect(res).toBeDefined();
      expect(prisma.writeOffRequest.create).toHaveBeenCalled();
      expect(prisma.itemInstance.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { status: AssetStatus.IN_REPAIR },
      });
      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            action: 'SPISANIE_TALABNOMASI_OCHILDI',
          }),
        }),
      );
    });
  });

  describe('voteWriteOff', () => {
    it('komissiya a’zolari ro‘yxatida bo‘lmagan foydalanuvchiga ForbiddenException tashlashi kerak', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue(null);

      await expect(
        service.voteWriteOff('wo-1', 'intruder-user', {
          vote: VoteStatus.APPROVED,
          comment: 'Ruxsat beraman',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allaqachon ovoz berib bo‘lgan a’zo qayta ovoz berganda BadRequestException tashlashi kerak', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue({
        id: 'vote-1',
        writeOffId: 'wo-1',
        userId: 'user-1',
        vote: VoteStatus.APPROVED, // allaqachon ovoz bergan
        writeOffRequest: { id: 'wo-1', asset: { item: {} } },
      });

      await expect(
        service.voteWriteOff('wo-1', 'user-1', {
          vote: VoteStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('oraliq tasdiqlash ovozida (boshqalar hali PENDING) ariza statusi o‘zgarmasligi kerak', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue({
        id: 'vote-1',
        writeOffId: 'wo-1',
        userId: 'user-1',
        vote: VoteStatus.PENDING,
        writeOffRequest: {
          id: 'wo-1',
          actNumber: 'ACT-OS4-2026-0001',
          assetId: 'asset-1',
          asset: {
            id: 'asset-1',
            itemId: 'item-1',
            purchasePrice: 5000000,
            item: { category: { name: 'Mebel' } },
          },
        },
      });

      // 2 ta a'zodan biri tasdiqladi, ikkinchisi PENDING
      prisma.writeOffMemberVote.findMany.mockResolvedValue([
        { id: 'vote-1', vote: VoteStatus.APPROVED },
        { id: 'vote-2', vote: VoteStatus.PENDING },
      ]);

      // Mock getWriteOffById
      prisma.writeOffRequest.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: WriteOffStatus.IN_REVIEW,
        asset: {
          purchasePrice: 5000000,
          createdAt: new Date(),
          item: { category: { name: 'Mebel' } },
        },
      });

      const res = await service.voteWriteOff('wo-1', 'user-1', {
        vote: VoteStatus.APPROVED,
        comment: 'Roziman',
      });

      expect(prisma.writeOffMemberVote.update).toHaveBeenCalledWith({
        where: { id: 'vote-1' },
        data: expect.objectContaining({ vote: VoteStatus.APPROVED }),
      });
      // writeOffRequest statusi APPROVED ga o'zgarmaydi, chunki hamma a'zolar ovoz berib bo'lmadi
      expect(prisma.writeOffRequest.update).not.toHaveBeenCalled();
      expect(prisma.itemInstance.update).not.toHaveBeenCalled();
    });

    it('oxirgi a’zo ham APPROVED ovoz berganda ariza APPROVED bo‘lishi, vosita WRITTEN_OFF qilinishi va chiqim harakati yaratilishi kerak', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue({
        id: 'vote-2',
        writeOffId: 'wo-1',
        userId: 'user-2',
        vote: VoteStatus.PENDING,
        writeOffRequest: {
          id: 'wo-1',
          actNumber: 'ACT-OS4-2026-0001',
          reason: 'Foydalanishga yaroqsiz',
          assetId: 'asset-1',
          asset: {
            id: 'asset-1',
            itemId: 'item-1',
            fundingSource: 'BYUDJET',
            purchasePrice: 5000000,
            item: { category: { name: 'Mebel' } },
          },
        },
      });

      // Hamma a'zolar APPROVED
      prisma.writeOffMemberVote.findMany.mockResolvedValue([
        { id: 'vote-1', vote: VoteStatus.APPROVED },
        { id: 'vote-2', vote: VoteStatus.APPROVED },
      ]);

      prisma.writeOffRequest.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: WriteOffStatus.APPROVED,
        asset: {
          purchasePrice: 5000000,
          createdAt: new Date(),
          item: { category: { name: 'Mebel' } },
        },
      });

      const res = await service.voteWriteOff('wo-1', 'user-2', {
        vote: VoteStatus.APPROVED,
        comment: 'Tasdiqlayman',
      });

      expect(prisma.writeOffRequest.update).toHaveBeenCalledWith({
        where: { id: 'wo-1' },
        data: expect.objectContaining({
          status: WriteOffStatus.APPROVED,
        }),
      });

      expect(prisma.itemInstance.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: {
          status: AssetStatus.WRITTEN_OFF,
          roomId: null,
          responsibleUserId: null,
        },
      });

      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: MovementType.WRITE_OFF,
            referenceDoc: 'ACT-OS4-2026-0001',
          }),
        }),
      );

      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            action: 'HISOBDAN_CHIQARILDI_OS4',
          }),
        }),
      );
    });

    it('biror komissiya a’zosi REJECTED ovoz berganda ariza darhol REJECTED bo‘lishi kerak', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue({
        id: 'vote-1',
        writeOffId: 'wo-1',
        userId: 'user-1',
        vote: VoteStatus.PENDING,
        writeOffRequest: {
          id: 'wo-1',
          actNumber: 'ACT-OS4-2026-0001',
          assetId: 'asset-1',
          asset: {
            id: 'asset-1',
            itemId: 'item-1',
            purchasePrice: 5000000,
            item: { category: { name: 'Mebel' } },
          },
        },
      });

      prisma.writeOffMemberVote.findMany.mockResolvedValue([
        { id: 'vote-1', vote: VoteStatus.REJECTED },
        { id: 'vote-2', vote: VoteStatus.PENDING },
      ]);

      prisma.writeOffRequest.findUnique.mockResolvedValue({
        id: 'wo-1',
        status: WriteOffStatus.REJECTED,
        asset: {
          purchasePrice: 5000000,
          createdAt: new Date(),
          item: { category: { name: 'Mebel' } },
        },
      });

      await service.voteWriteOff('wo-1', 'user-1', {
        vote: VoteStatus.REJECTED,
        comment: 'Hali ta’mirlash mumkin',
      });

      expect(prisma.writeOffRequest.update).toHaveBeenCalledWith({
        where: { id: 'wo-1' },
        data: { status: WriteOffStatus.REJECTED },
      });

      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            action: 'SPISANIE_RAD_ETILDI',
          }),
        }),
      );
    });

    it('oraliq ovoz berilganda writeoff:quorum_updated soket hodisasini emit qilishi kerak (masalan 4/5)', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue({
        id: 'vote-4',
        writeOffId: 'wo-quorum',
        userId: 'user-4',
        vote: VoteStatus.PENDING,
        writeOffRequest: {
          id: 'wo-quorum',
          actNumber: 'OS4-2026-004',
          assetId: 'asset-4',
          reason: 'Kompyuter protsessori kuygan',
          asset: {
            item: { name: 'Kompyuter Core i7' },
            inventoryNumber: 'INV-PC-004',
          },
        },
      });

      prisma.writeOffMemberVote.findMany.mockResolvedValue([
        { id: 'vote-1', vote: VoteStatus.APPROVED },
        { id: 'vote-2', vote: VoteStatus.APPROVED },
        { id: 'vote-3', vote: VoteStatus.APPROVED },
        { id: 'vote-4', vote: VoteStatus.APPROVED },
        { id: 'vote-5', vote: VoteStatus.PENDING },
      ]);

      prisma.writeOffRequest.findUnique.mockResolvedValue({
        id: 'wo-quorum',
        actNumber: 'OS4-2026-004',
        status: WriteOffStatus.IN_REVIEW,
        members: [
          { id: 'vote-1', vote: VoteStatus.APPROVED },
          { id: 'vote-2', vote: VoteStatus.APPROVED },
          { id: 'vote-3', vote: VoteStatus.APPROVED },
          { id: 'vote-4', vote: VoteStatus.APPROVED },
          { id: 'vote-5', vote: VoteStatus.PENDING },
        ],
        asset: {
          item: { name: 'Kompyuter Core i7', category: { name: 'IT' } },
          inventoryNumber: 'INV-PC-004',
          purchasePrice: 6000000,
          createdAt: new Date(),
        },
      });

      await service.voteWriteOff('wo-quorum', 'user-4', {
        vote: VoteStatus.APPROVED,
      });

      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'writeoff:quorum_updated',
        expect.objectContaining({
          writeOffId: 'wo-quorum',
          actNumber: 'OS4-2026-004',
          votedCount: 4,
          totalCount: 5,
          percentage: 80,
          vote: VoteStatus.APPROVED,
        }),
      );
    });

    it('5-a’zo ovoz berishi bilan writeoff:finalized va stock:updated emit qilishi kerak', async () => {
      prisma.writeOffMemberVote.findUnique.mockResolvedValue({
        id: 'vote-5',
        writeOffId: 'wo-final',
        userId: 'user-5',
        vote: VoteStatus.PENDING,
        writeOffRequest: {
          id: 'wo-final',
          actNumber: 'OS4-2026-005',
          assetId: 'asset-5',
          reason: 'Eskirgan printer',
          asset: {
            item: { name: 'HP LaserJet M1132' },
            inventoryNumber: 'INV-PRN-005',
          },
        },
      });

      prisma.writeOffMemberVote.findMany.mockResolvedValue([
        { id: 'vote-1', vote: VoteStatus.APPROVED },
        { id: 'vote-2', vote: VoteStatus.APPROVED },
        { id: 'vote-3', vote: VoteStatus.APPROVED },
        { id: 'vote-4', vote: VoteStatus.APPROVED },
        { id: 'vote-5', vote: VoteStatus.APPROVED },
      ]);

      prisma.writeOffRequest.findUnique.mockResolvedValue({
        id: 'wo-final',
        actNumber: 'OS4-2026-005',
        assetId: 'asset-5',
        status: WriteOffStatus.APPROVED,
        hasWormStamp: true,
        members: [
          { id: 'vote-1', vote: VoteStatus.APPROVED },
          { id: 'vote-2', vote: VoteStatus.APPROVED },
          { id: 'vote-3', vote: VoteStatus.APPROVED },
          { id: 'vote-4', vote: VoteStatus.APPROVED },
          { id: 'vote-5', vote: VoteStatus.APPROVED },
        ],
        asset: {
          item: { name: 'HP LaserJet M1132', category: { name: 'Orgtexnika' } },
          inventoryNumber: 'INV-PRN-005',
          purchasePrice: 2000000,
          createdAt: new Date(),
        },
      });

      await service.voteWriteOff('wo-final', 'user-5', {
        vote: VoteStatus.APPROVED,
      });

      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'writeoff:quorum_updated',
        expect.objectContaining({
          writeOffId: 'wo-final',
          votedCount: 5,
          totalCount: 5,
          percentage: 100,
          allApproved: true,
        }),
      );

      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'writeoff:finalized',
        expect.objectContaining({
          writeOffId: 'wo-final',
          actNumber: 'OS4-2026-005',
          status: 'APPROVED',
        }),
      );

      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'stock:updated',
        expect.objectContaining({
          action: 'WRITE_OFF',
          assetId: 'asset-5',
        }),
      );
    });
  });
});

