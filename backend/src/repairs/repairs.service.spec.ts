import { Test, TestingModule } from '@nestjs/testing';
import { RepairsService } from './repairs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { AssetStatus, RepairStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RepairsService (Unit Tests)', () => {
  let service: RepairsService;
  let prisma: any;
  let codeGen: any;

  beforeEach(async () => {
    prisma = {
      repairRecord: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      itemInstance: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      assetHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };

    codeGen = {
      generateRepairNumber: jest.fn((seq) => `REP-2026-${String(seq).padStart(4, '0')}`),
      calculateDepreciation: jest.fn().mockReturnValue({ currentBookValue: 5000000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: codeGen },
      ],
    }).compile();

    service = module.get<RepairsService>(RepairsService);
  });

  describe('createRepair', () => {
    it('aktiv topilmasa NotFoundException tashlashi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue(null);
      await expect(
        service.createRepair({ assetId: 'not-found', issueDescription: 'Kuler ishlamayapti' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('aktiv allaqachon hisobdan chiqarilgan bo‘lsa BadRequestException tashlashi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        status: AssetStatus.WRITTEN_OFF,
      });

      await expect(
        service.createRepair({ assetId: 'asset-1', issueDescription: 'Kuler ishlamayapti' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('muvaffaqiyatli ta’mirlash talabnomasini yaratib, aktiv holatini IN_REPAIR ga o‘tkazishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        status: AssetStatus.IN_USE,
        roomId: 'room-1',
        room: { number: '101', name: 'Lab 1' },
      });
      prisma.repairRecord.create.mockResolvedValue({
        id: 'rep-1',
        repairNumber: 'REP-2026-0001',
        assetId: 'asset-1',
        status: RepairStatus.IN_REPAIR,
        cost: 150000,
      });

      const res = await service.createRepair(
        { assetId: 'asset-1', issueDescription: 'Ekran singan', cost: 150000 },
        'user-1',
      );

      expect(res.repairNumber).toBe('REP-2026-0001');
      expect(prisma.itemInstance.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { status: AssetStatus.IN_REPAIR },
      });
      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TA‘MIRLASHGA_YUBORILDI',
          }),
        }),
      );
    });
  });

  describe('updateRepairStatus', () => {
    it('COMPLETED bo‘lganda aktivni IN_USE holatiga qaytarishi kerak', async () => {
      prisma.repairRecord.findUnique.mockResolvedValue({
        id: 'rep-1',
        assetId: 'asset-1',
        serviceProvider: 'IT Ustaxona',
        repairNumber: 'REP-2026-0001',
        asset: {
          room: { number: '101', name: 'Lab 1' },
        },
      });
      prisma.repairRecord.update.mockResolvedValue({
        id: 'rep-1',
        status: RepairStatus.COMPLETED,
        serviceProvider: 'IT Ustaxona',
        repairNumber: 'REP-2026-0001',
        cost: 200000,
      });

      const res = await service.updateRepairStatus(
        'rep-1',
        { status: RepairStatus.COMPLETED, notes: 'Plata almashtirildi' },
        'approver-1',
      );

      expect(res.status).toBe(RepairStatus.COMPLETED);
      expect(prisma.itemInstance.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { status: AssetStatus.IN_USE },
      });
      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TA‘MIRDAN_QAYTARILDI',
          }),
        }),
      );
    });
  });
});
