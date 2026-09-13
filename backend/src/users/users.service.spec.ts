import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let audit: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SystemAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<SystemAuditService>(SystemAuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if username already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(
        service.create(
          {
            fullName: 'Test User',
            username: 'existing_user',
            password: 'password123',
            role: RoleType.EMPLOYEE,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a user, hash password and write audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // username check
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        fullName: 'Aliyev Vali',
        username: 'v_aliyev',
        password: 'hashed-password',
        role: RoleType.EMPLOYEE,
        isActive: true,
        department: null,
      });

      const result = await service.create(
        {
          fullName: 'Aliyev Vali',
          username: 'v_aliyev',
          password: 'plainPassword123',
          role: RoleType.EMPLOYEE,
        },
        'admin-id',
      );

      expect(result.id).toBe('new-user-id');
      expect((result as any).password).toBeUndefined();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED' }),
      );
    });
  });

  describe('toggleStatus', () => {
    it('should prevent deactivating the last active SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'super-admin-id',
        role: RoleType.SUPER_ADMIN,
        isActive: true,
      });
      mockPrisma.user.count.mockResolvedValueOnce(1); // only 1 active super admin

      await expect(
        service.toggleStatus('super-admin-id', false, 'executor-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
