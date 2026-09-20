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
    itemInstance: {
      count: jest.fn().mockResolvedValue(0),
    },
    responsibilityHandover: {
      count: jest.fn().mockResolvedValue(0),
    },
    handoverItemAction: {
      count: jest.fn().mockResolvedValue(0),
    },
    room: {
      count: jest.fn().mockResolvedValue(0),
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

  describe('remove (soft-delete)', () => {
    it('should prevent user from deleting themselves', async () => {
      await expect(service.remove('admin-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if user is already deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-2',
        username: 'user2',
        deletedAt: new Date(),
      });

      await expect(service.remove('user-2', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should soft-delete user and record audit log', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-3',
          username: 'user3',
          fullName: 'User Three',
          role: RoleType.EMPLOYEE,
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'user-3',
          fullName: 'User Three',
          role: RoleType.EMPLOYEE,
          isActive: true,
        });
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'user-3',
        username: 'user3',
        fullName: 'User Three',
        role: RoleType.EMPLOYEE,
        deletedAt: new Date(),
        isActive: false,
      });

      const res = await service.remove('user-3', 'admin-1');
      expect(res.id).toBe('user-3');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOFT_DELETE',
          entity: 'User',
          entityId: 'user-3',
        }),
      );
    });
  });

  describe('restore', () => {
    it('should throw if user is not deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-active',
        deletedAt: null,
      });

      await expect(service.restore('user-active', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should restore user and record audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-deleted',
        username: 'userdel',
        fullName: 'Deleted User',
        role: RoleType.EMPLOYEE,
        deletedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'user-deleted',
        username: 'userdel',
        fullName: 'Deleted User',
        role: RoleType.EMPLOYEE,
        deletedAt: null,
        isActive: true,
      });

      const res = await service.restore('user-deleted', 'admin-1');
      expect(res.id).toBe('user-deleted');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESTORE',
          entity: 'User',
          entityId: 'user-deleted',
        }),
      );
    });
  });

  describe('Clearance Eligibility & Deactivation Guards (Phase 2 Tests)', () => {
    it('barcha majburiyatlar 0 bo‘lganda canDeactivate: true qaytarishi kerak', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-clean',
        fullName: 'Toza Xodim',
        role: RoleType.EMPLOYEE,
        isActive: true,
      });
      mockPrisma.itemInstance.count.mockResolvedValueOnce(0);
      mockPrisma.responsibilityHandover.count.mockResolvedValueOnce(0);
      mockPrisma.handoverItemAction.count.mockResolvedValueOnce(0);
      mockPrisma.room.count.mockResolvedValueOnce(0);

      const status = await service.checkUserClearanceEligibility('user-clean');
      expect(status.canDeactivate).toBe(true);
      expect(status.activeAssets).toBe(0);
      expect(status.pendingHandovers).toBe(0);
    });

    it('faol aktivlari bor xodimni o‘chirishga (remove) uringanda BadRequestException berishi kerak', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-mol', deletedAt: null, fullName: 'MOL Xodim' }) // in remove()
        .mockResolvedValueOnce({ id: 'user-mol', fullName: 'MOL Xodim', role: RoleType.MOL }); // in checkUserClearanceEligibility()

      mockPrisma.itemInstance.count.mockResolvedValueOnce(5); // 5 ta faol aktiv
      mockPrisma.responsibilityHandover.count.mockResolvedValueOnce(0);
      mockPrisma.handoverItemAction.count.mockResolvedValueOnce(0);
      mockPrisma.room.count.mockResolvedValueOnce(0);

      await expect(service.remove('user-mol', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('kutilayotgan topshirish arizasi (pending handover) bor xodimni nofaol qilishga uringanda bloklashi kerak (Poyga holati himoyasi)', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-pending', role: RoleType.MOL, fullName: 'Pending User' }) // in toggleStatus()
        .mockResolvedValueOnce({ id: 'user-pending', fullName: 'Pending User', role: RoleType.MOL }); // in checkUserClearanceEligibility()

      mockPrisma.itemInstance.count.mockResolvedValueOnce(0);
      mockPrisma.responsibilityHandover.count.mockResolvedValueOnce(2); // 2 ta ochiq ariza
      mockPrisma.handoverItemAction.count.mockResolvedValueOnce(0);
      mockPrisma.room.count.mockResolvedValueOnce(0);

      await expect(service.toggleStatus('user-pending', false, 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });
});
