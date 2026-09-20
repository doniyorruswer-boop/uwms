import { Test, TestingModule } from '@nestjs/testing';
import { WriteOffsService } from './write-offs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AssetStatus, WriteOffStatus, VoteStatus, MovementType } from '@prisma/client';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('WriteOffsService (Unit Tests)', () => {
  let service: WriteOffsService;
  let prisma: any;
  let codeGen: any;

  beforeEach(async () => {
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
  });
});
