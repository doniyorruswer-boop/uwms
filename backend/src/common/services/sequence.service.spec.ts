import { Test, TestingModule } from '@nestjs/testing';
import { SequenceService } from './sequence.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SequenceService (Unit Tests)', () => {
  let service: SequenceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      documentSequence: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      request: { count: jest.fn().mockResolvedValue(0) },
      stockMovement: { count: jest.fn().mockResolvedValue(0) },
      itemInstance: { count: jest.fn().mockResolvedValue(0) },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      repairRecord: { count: jest.fn().mockResolvedValue(0) },
      transferAcceptance: { count: jest.fn().mockResolvedValue(0) },
      inventoryAudit: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SequenceService>(SequenceService);
  });

  it('should initialize and return REQ-2026-XXXXXXXX (8-character hex) when sequence does not exist', async () => {
    prisma.documentSequence.findUnique.mockResolvedValue(null);
    prisma.documentSequence.upsert.mockResolvedValue({
      id: 'seq-1',
      prefix: 'REQ',
      year: 2026,
      currentVal: 1,
    });

    const result = await service.nextRequestNumber(undefined, 2026);
    expect(result).toMatch(/^REQ-2026-[0-9A-F]{8}$/);
    expect(prisma.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prefix_year: { prefix: 'REQ', year: 2026 } },
        create: expect.objectContaining({ prefix: 'REQ', year: 2026, currentVal: 1 }),
      }),
    );
  });

  it('should increment existing sequence atomically and return unique 8-character hex code', async () => {
    prisma.documentSequence.findUnique.mockResolvedValue({
      id: 'seq-1',
      prefix: 'REQ',
      year: 2026,
      currentVal: 41,
    });
    prisma.documentSequence.update.mockResolvedValue({
      id: 'seq-1',
      prefix: 'REQ',
      year: 2026,
      currentVal: 42,
    });

    const result = await service.nextRequestNumber(undefined, 2026);
    expect(result).toMatch(/^REQ-2026-[0-9A-F]{8}$/);
    expect(prisma.documentSequence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prefix_year: { prefix: 'REQ', year: 2026 } },
        data: { currentVal: { increment: 1 } },
      }),
    );
  });

  it('should seed from existing table count to avoid collision with legacy data', async () => {
    prisma.documentSequence.findUnique.mockResolvedValue(null);
    prisma.request.count.mockResolvedValue(105);
    prisma.documentSequence.upsert.mockResolvedValue({
      id: 'seq-1',
      prefix: 'REQ',
      year: 2026,
      currentVal: 106,
    });

    const result = await service.nextRequestNumber(undefined, 2026);
    expect(result).toMatch(/^REQ-2026-[0-9A-F]{8}$/);
    expect(prisma.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currentVal: 106 }),
      }),
    );
  });

  it('should format movement number as MOV-2026-XXXXXXXX (8-character hex)', async () => {
    prisma.documentSequence.findUnique.mockResolvedValue(null);
    prisma.documentSequence.upsert.mockResolvedValue({
      id: 'seq-2',
      prefix: 'MOV',
      year: 2026,
      currentVal: 1,
    });

    const result = await service.nextMovementNumber(undefined, 2026);
    expect(result).toMatch(/^MOV-2026-[0-9A-F]{8}$/);
  });

  it('should format inventory number as INV-2026-XXXXXXXX (8-character hex)', async () => {
    prisma.documentSequence.findUnique.mockResolvedValue(null);
    prisma.documentSequence.upsert.mockResolvedValue({
      id: 'seq-3',
      prefix: 'INV',
      year: 2026,
      currentVal: 7,
    });

    const result = await service.nextInventoryNumber(undefined, 2026);
    expect(result).toMatch(/^INV-2026-[0-9A-F]{8}$/);
  });

  it('should format official acts OS1, OS2, OS4, INV19 as OS1-2026-XXXXXXXX (8-character hex)', async () => {
    prisma.documentSequence.findUnique.mockResolvedValue(null);
    prisma.documentSequence.upsert.mockResolvedValue({
      id: 'seq-4',
      prefix: 'OS1',
      year: 2026,
      currentVal: 3,
    });

    const result = await service.nextDocNumber('OS1', undefined, 2026);
    expect(result).toMatch(/^OS1-2026-[0-9A-F]{8}$/);
  });
});
