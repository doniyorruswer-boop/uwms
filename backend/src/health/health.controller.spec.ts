import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { HttpStatus } from '@nestjs/common';

describe('HealthController (Unit Tests)', () => {
  let controller: HealthController;
  let prisma: any;
  let mockResponse: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      backupRecord: {
        findFirst: jest.fn().mockResolvedValue({
          completedAt: new Date('2026-09-18T10:00:00.000Z'),
        }),
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return 200 OK with db ok when database query succeeds', async () => {
    await controller.checkHealth(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        db: 'ok',
        lastBackupAt: '2026-09-18T10:00:00.000Z',
        version: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it('should return 503 SERVICE_UNAVAILABLE with db fail when database query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Database connection refused'));

    await controller.checkHealth(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        db: 'fail',
      }),
    );
  });
});
