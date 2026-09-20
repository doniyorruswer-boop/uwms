import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      department: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      room: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      building: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      warehouse: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    audit = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDepartment', () => {
    it('should throw ConflictException if code already exists', async () => {
      prisma.department.findUnique.mockResolvedValueOnce({ id: 'dep-1', code: 'RI-IT' });

      await expect(
        service.createDepartment({ name: 'Fakultet', code: 'RI-IT' }, 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create department and log audit', async () => {
      prisma.department.findUnique.mockResolvedValueOnce(null);
      prisma.department.create.mockResolvedValueOnce({
        id: 'dep-100',
        name: 'Axborot Xavfsizligi Kafedrasi',
        code: 'AX-KAF',
        type: 'CHAIR',
        parentId: null,
      });

      const result = await service.createDepartment(
        { name: 'Axborot Xavfsizligi Kafedrasi', code: 'AX-KAF' },
        'admin-id',
      );

      expect(result.id).toBe('dep-100');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEPARTMENT_CREATED',
          entity: 'Department',
        }),
      );
    });
  });

  describe('deleteDepartment', () => {
    it('should prevent deletion if department has children', async () => {
      prisma.department.findUnique.mockResolvedValueOnce({
        id: 'dep-1',
        name: 'Fakultet',
        _count: { children: 2, rooms: 0, users: 0 },
      });

      await expect(service.deleteDepartment('dep-1', 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deletion if department has rooms', async () => {
      prisma.department.findUnique.mockResolvedValueOnce({
        id: 'dep-1',
        name: 'Kafedra',
        _count: { children: 0, rooms: 3, users: 0 },
      });

      await expect(service.deleteDepartment('dep-1', 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Buildings CRUD', () => {
    it('should create building and log audit', async () => {
      prisma.building.findFirst.mockResolvedValueOnce(null);
      prisma.building.findUnique.mockResolvedValueOnce(null);
      prisma.building.create.mockResolvedValueOnce({
        id: 'b-new',
        name: '3-o‘quv binosi',
        code: 'B3',
        floorsCount: 5,
        commendant: null,
      });

      const res = await service.createBuilding(
        { name: '3-o‘quv binosi', code: 'B3', floorsCount: 5 },
        'admin-id',
      );

      expect(res.id).toBe('b-new');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BUILDING_CREATED',
          entity: 'Building',
        }),
      );
    });

    it('should throw ConflictException if building name already exists', async () => {
      prisma.building.findFirst.mockResolvedValueOnce({ id: 'b-exist', name: 'Bosh bino' });

      await expect(
        service.createBuilding({ name: 'Bosh bino' }, 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent deleting building if active rooms exist', async () => {
      prisma.building.findUnique.mockResolvedValueOnce({
        id: 'b-1',
        name: 'Bosh bino',
        _count: { rooms: 12, warehouses: 0 },
      });

      await expect(service.deleteBuilding('b-1', 'admin-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createRoom', () => {
    it('should throw ConflictException if room number in same building exists', async () => {
      prisma.building.findUnique.mockResolvedValueOnce({
        id: 'b-1',
        name: 'Bosh bino',
        floorsCount: 4,
      });
      prisma.room.findFirst.mockResolvedValueOnce({
        id: 'r-1',
        number: '304',
        buildingId: 'b-1',
      });

      await expect(
        service.createRoom(
          { number: '304', name: 'Lab', floor: 3, buildingId: 'b-1' },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow identical room numbers in different buildings (e.g. 101 in B1 and 101 in B2)', async () => {
      prisma.building.findUnique.mockResolvedValueOnce({
        id: 'b-2',
        name: '2-o‘quv binosi',
        floorsCount: 5,
      });
      // In B2, room 101 does not exist yet even if it exists in B1
      prisma.room.findFirst.mockResolvedValueOnce(null);
      prisma.room.create.mockResolvedValueOnce({
        id: 'r-101-b2',
        number: '101',
        name: 'Auditoriya 101',
        floor: 1,
        buildingId: 'b-2',
        building: '2-o‘quv binosi',
      });

      const res = await service.createRoom(
        { number: '101', name: 'Auditoriya 101', floor: 1, buildingId: 'b-2' },
        'admin-id',
      );

      expect(res.id).toBe('r-101-b2');
      expect(res.number).toBe('101');
      expect(res.buildingId).toBe('b-2');
    });

    it('should create room with building string fallback and log audit', async () => {
      prisma.building.upsert.mockResolvedValueOnce({
        id: 'b-it',
        name: 'IT Korpus',
        floorsCount: 6,
      });
      prisma.room.findFirst.mockResolvedValueOnce(null);
      prisma.room.create.mockResolvedValueOnce({
        id: 'r-999',
        number: '501',
        name: 'Robototexnika Markazi',
        floor: 5,
        buildingId: 'b-it',
        building: 'IT Korpus',
        department: { name: 'IT Fakulteti' },
        responsibleUser: { fullName: 'Alimov Jasur' },
      });

      const result = await service.createRoom(
        { number: '501', name: 'Robototexnika Markazi', floor: 5, building: 'IT Korpus' },
        'admin-id',
      );

      expect(result.id).toBe('r-999');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROOM_CREATED',
          entity: 'Room',
        }),
      );
    });
  });

  describe('deleteRoom', () => {
    it('should prevent deleting room if active item instances exist', async () => {
      prisma.room.findUnique.mockResolvedValueOnce({
        id: 'r-1',
        number: '101',
        _count: { itemInstances: 5 },
      });

      await expect(service.deleteRoom('r-1', 'admin-id')).rejects.toThrow(BadRequestException);
    });

    it('should delete empty room successfully (soft-delete)', async () => {
      prisma.room.findUnique.mockResolvedValueOnce({
        id: 'r-1',
        number: '101',
        name: 'Bo‘sh xona',
        building: 'Bosh bino',
        _count: { itemInstances: 0 },
      });
      prisma.room.update.mockResolvedValueOnce({ id: 'r-1', deletedAt: new Date() });

      const res = await service.deleteRoom('r-1', 'admin-id');
      expect(res.success).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOFT_DELETE',
          entity: 'Room',
        }),
      );
    });

    it('should restore soft-deleted room successfully', async () => {
      prisma.room.findUnique.mockResolvedValueOnce({
        id: 'r-1',
        number: '101',
        name: 'Bo‘sh xona',
        building: 'Bosh bino',
        deletedAt: new Date(),
      });
      prisma.room.update.mockResolvedValueOnce({ id: 'r-1', deletedAt: null });

      const res = await service.restoreRoom('r-1', 'admin-id');
      expect(res).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESTORE',
          entity: 'Room',
        }),
      );
    });
  });
});
