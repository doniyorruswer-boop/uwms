import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SearchService (Unit Tests)', () => {
  let service: SearchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      itemInstance: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      room: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      request: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('search', () => {
    it('should return empty array if query length is less than 2', async () => {
      const results = await service.search({ q: 'a' }, { id: 'u-1' });
      expect(results).toEqual([]);
      expect(prisma.itemInstance.findMany).not.toHaveBeenCalled();
    });

    it('should search across assets, rooms, users, and requests and format results', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          inventoryNumber: 'INV-2026-001',
          status: 'IN_USE',
          fundingSource: 'BYUDJET',
          item: { name: 'Kompyuter Dell' },
          room: { number: '101', name: 'Kafedra', department: { name: 'Dasturiy injiniring' } },
        },
      ]);
      prisma.room.findMany.mockResolvedValue([
        {
          id: 'room-1',
          number: '101',
          name: 'Laboratoriya',
          building: 'Bosh bino',
          floor: 1,
          department: { name: 'Dasturiy injiniring' },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          fullName: 'Aliyev Vali',
          username: 'aliyev',
          role: 'MOL',
          department: { name: 'Dasturiy injiniring' },
        },
      ]);
      prisma.request.findMany.mockResolvedValue([
        {
          id: 'req-1',
          requestNumber: 'REQ-2026-0001',
          purpose: 'Yangi kantselyariya tovarlari',
          status: 'PENDING',
          requester: { fullName: 'Aliyev Vali' },
          department: { name: 'Dasturiy injiniring' },
        },
      ]);

      const results = await service.search({ q: 'Dell' }, { id: 'u-1' });

      expect(results.length).toBe(4);

      const assetRes = results.find((r) => r.type === 'ASSET');
      expect(assetRes).toBeDefined();
      expect(assetRes?.title).toContain('Kompyuter Dell (INV-2026-001)');
      expect(assetRes?.href).toContain('/assets?search=INV-2026-001');

      const roomRes = results.find((r) => r.type === 'ROOM');
      expect(roomRes).toBeDefined();
      expect(roomRes?.title).toContain('101-xona: Laboratoriya');
      expect(roomRes?.href).toContain('/organization?roomId=room-1');

      const userRes = results.find((r) => r.type === 'USER');
      expect(userRes).toBeDefined();
      expect(userRes?.title).toContain('Aliyev Vali (@aliyev)');
      expect(userRes?.href).toContain('/users?search=aliyev');

      const reqRes = results.find((r) => r.type === 'REQUEST');
      expect(reqRes).toBeDefined();
      expect(reqRes?.title).toContain('Talabnoma № REQ-2026-0001');
      expect(reqRes?.href).toContain('/requests?search=REQ-2026-0001');
    });

    it('should respect the limit parameter', async () => {
      prisma.itemInstance.findMany.mockResolvedValue([
        { id: '1', inventoryNumber: 'INV-1', status: 'NEW', fundingSource: 'BYUDJET', item: { name: 'Test 1' } },
        { id: '2', inventoryNumber: 'INV-2', status: 'NEW', fundingSource: 'BYUDJET', item: { name: 'Test 2' } },
        { id: '3', inventoryNumber: 'INV-3', status: 'NEW', fundingSource: 'BYUDJET', item: { name: 'Test 3' } },
      ]);
      prisma.room.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.request.findMany.mockResolvedValue([]);

      const results = await service.search({ q: 'Test', limit: 2 }, { id: 'u-1' });
      expect(results.length).toBe(2);
    });
  });
});
