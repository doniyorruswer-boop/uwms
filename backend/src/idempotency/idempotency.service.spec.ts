import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('Idempotency (Unit Tests)', () => {
  let service: IdempotencyService;
  let interceptor: IdempotencyInterceptor;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'key-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        IdempotencyInterceptor,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
  });

  describe('IdempotencyService', () => {
    it('should return null when key does not exist', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeNull();
      expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: 'non-existent-key' },
      });
    });

    it('should return parsed data and statusCode when key exists', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'test-key-123',
        statusCode: 200,
        responseJson: JSON.stringify({ success: true, count: 5 }),
      });

      const result = await service.get('test-key-123');
      expect(result).toEqual({
        statusCode: 200,
        data: { success: true, count: 5 },
      });
    });

    it('should upsert response on save', async () => {
      await service.save('test-key-123', '/api/warehouse/ingest', 200, {
        imported: 10,
      });

      expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith({
        where: { key: 'test-key-123' },
        update: {
          endpoint: '/api/warehouse/ingest',
          statusCode: 200,
          responseJson: JSON.stringify({ imported: 10 }),
        },
        create: {
          key: 'test-key-123',
          endpoint: '/api/warehouse/ingest',
          statusCode: 200,
          responseJson: JSON.stringify({ imported: 10 }),
        },
      });
    });
  });

  describe('IdempotencyInterceptor', () => {
    let mockContext: ExecutionContext;
    let mockNext: CallHandler;
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        url: '/api/warehouse/ingest',
        originalUrl: '/api/warehouse/ingest',
        headers: {},
      };

      mockRes = {
        statusCode: 200,
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      } as any;

      mockNext = {
        handle: jest.fn().mockReturnValue(of({ success: true, message: 'Stock ingested' })),
      };
    });

    it('should pass through when method is GET', (done) => {
      mockReq.method = 'GET';
      mockReq.headers['idempotency-key'] = 'uuid-key-1';

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result).toEqual({ success: true, message: 'Stock ingested' });
        expect(mockNext.handle).toHaveBeenCalled();
        done();
      });
    });

    it('should pass through when no idempotency key is provided', (done) => {
      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result).toEqual({ success: true, message: 'Stock ingested' });
        expect(mockNext.handle).toHaveBeenCalled();
        done();
      });
    });

    it('should execute downstream handler and save key when key is new', (done) => {
      mockReq.headers['idempotency-key'] = 'uuid-new-key-1';

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result).toEqual({ success: true, message: 'Stock ingested' });
        expect(mockNext.handle).toHaveBeenCalled();
        expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { key: 'uuid-new-key-1' },
          }),
        );
        done();
      });
    });

    it('should return cached response and PREVENT calling downstream handler when key is duplicated', (done) => {
      mockReq.headers['idempotency-key'] = 'uuid-duplicate-key-2';
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'uuid-duplicate-key-2',
        statusCode: 200,
        responseJson: JSON.stringify({ cached: true, originalStockId: 'stk-99' }),
      });

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result).toEqual({ cached: true, originalStockId: 'stk-99' });
        expect(mockNext.handle).not.toHaveBeenCalled(); // Business handler NOT executed again!
        expect(mockRes.setHeader).toHaveBeenCalledWith('Idempotent-Replay', 'true');
        expect(mockRes.setHeader).toHaveBeenCalledWith('X-Idempotency-Key', 'uuid-duplicate-key-2');
        done();
      });
    });

    it('should scope idempotency key to user.id when request is authenticated', (done) => {
      mockReq.headers['idempotency-key'] = 'uuid-user-key-3';
      mockReq.user = { id: 'user-special-99' };

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result).toEqual({ success: true, message: 'Stock ingested' });
        expect(mockNext.handle).toHaveBeenCalled();
        expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { key: 'user-special-99:uuid-user-key-3' },
          }),
        );
        done();
      });
    });
  });
});
