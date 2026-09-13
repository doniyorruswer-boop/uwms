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

  describe('createRoom', () => {
    it('should throw ConflictException if room number in same building exists', async () => {
      prisma.room.findFirst.mockResolvedValueOnce({
        id: 'r-1',
        number: '304',
        building: 'Bosh bino',
      });

      await expect(
        service.createRoom(
          { number: '304', name: 'Lab', floor: 3, building: 'Bosh bino' },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create room and log audit', async () => {
      prisma.room.findFirst.mockResolvedValueOnce(null);
      prisma.room.create.mockResolvedValueOnce({
        id: 'r-999',
        number: '501',
        name: 'Robototexnika Markazi',
        floor: 5,
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

    it('should delete empty room successfully', async () => {
      prisma.room.findUnique.mockResolvedValueOnce({
        id: 'r-1',
        number: '101',
        name: 'Bo‘sh xona',
        building: 'Bosh bino',
        _count: { itemInstances: 0 },
      });
      prisma.room.delete.mockResolvedValueOnce({ id: 'r-1' });

      const res = await service.deleteRoom('r-1', 'admin-id');
      expect(res.success).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROOM_DELETED',
          entity: 'Room',
        }),
      );
    });
  });
});
