import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
            phone: '+998901234567',
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
        phone: '+998901234567',
        role: RoleType.EMPLOYEE,
        isActive: true,
        department: null,
      });

      const result = await service.create(
        {
          fullName: 'Aliyev Vali',
          username: 'v_aliyev',
          password: 'plainPassword123',
          phone: '+998901234567',
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

  describe('ADMIN Hierarchy Protection (Enterprise Security)', () => {
    const adminExecutor = { id: 'admin-user-id', role: RoleType.ADMIN };

    it('ADMIN executor cannot create a user with SUPER_ADMIN role', async () => {
      await expect(
        service.create(
          {
            fullName: 'Fake Super Admin',
            username: 'fake_sa',
            password: 'password123',
            phone: '+998901234567',
            role: RoleType.SUPER_ADMIN,
          },
          adminExecutor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN executor cannot update a user who has SUPER_ADMIN role', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'real-sa-id',
        role: RoleType.SUPER_ADMIN,
        username: 'superadmin',
      });

      await expect(
        service.update('real-sa-id', { fullName: 'Hacked Super Admin' }, adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN executor cannot elevate an existing user to SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'employee-id',
        role: RoleType.EMPLOYEE,
        username: 'normal_emp',
      });

      await expect(
        service.update('employee-id', { role: RoleType.SUPER_ADMIN }, adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN executor cannot toggle status of a SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'real-sa-id',
        role: RoleType.SUPER_ADMIN,
        isActive: true,
      });

      await expect(
        service.toggleStatus('real-sa-id', false, adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN executor cannot reset password of a SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'real-sa-id',
        role: RoleType.SUPER_ADMIN,
        username: 'superadmin',
      });

      await expect(
        service.resetPassword('real-sa-id', { newPassword: 'newPass123!' }, adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN executor cannot delete a SUPER_ADMIN user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'real-sa-id',
        role: RoleType.SUPER_ADMIN,
        deletedAt: null,
      });

      await expect(
        service.remove('real-sa-id', adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN executor cannot restore a deleted SUPER_ADMIN user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'real-sa-id',
        role: RoleType.SUPER_ADMIN,
        deletedAt: new Date(),
      });

      await expect(
        service.restore('real-sa-id', adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PBAC Permissions Management & ADMIN Filtering', () => {
    const adminExecutor = { id: 'admin-id', role: RoleType.ADMIN };
    const superAdminExecutor = { id: 'sa-id', role: RoleType.SUPER_ADMIN };

    it('getPermissionsCatalog returns all modules for SUPER_ADMIN', async () => {
      const result = await service.getPermissionsCatalog(superAdminExecutor);
      const moduleIds = result.modules.map((m) => m.id);
      expect(moduleIds).toContain('system_audit');
      expect(moduleIds).toContain('integrations');
      expect(moduleIds).toContain('backups');
    });

    it('getPermissionsCatalog hides system_audit, integrations, backups for ADMIN', async () => {
      const result = await service.getPermissionsCatalog(adminExecutor);
      const moduleIds = result.modules.map((m) => m.id);
      expect(moduleIds).not.toContain('system_audit');
      expect(moduleIds).not.toContain('integrations');
      expect(moduleIds).not.toContain('backups');
      expect(moduleIds).toContain('assets');
      expect(moduleIds).toContain('warehouse');
      expect(moduleIds).toContain('users');
    });

    it('getUserPermissions hides system modules and codes for ADMIN executor', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'staff-id',
        fullName: 'Test Staff',
        username: 'test_staff',
        role: RoleType.EMPLOYEE,
        permissions: ['page:assets', 'assets:read', 'page:system_audit', 'system_audit:read'],
        position: 'O‘qituvchi',
        department: { id: 'dep-1', name: 'Kafedra' },
      });

      const result = await service.getUserPermissions('staff-id', adminExecutor);
      const moduleIds = result.catalog.map((m) => m.id);
      expect(moduleIds).not.toContain('system_audit');
      expect(moduleIds).not.toContain('integrations');
      expect(moduleIds).not.toContain('backups');
      expect(result.permissions).not.toContain('page:system_audit');
      expect(result.permissions).not.toContain('system_audit:read');
      expect(result.permissions).toContain('page:assets');
      expect(result.permissions).toContain('assets:read');
    });

    it('getUserPermissions throws NotFoundException when ADMIN tries to view SUPER_ADMIN permissions', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'sa-target-id',
        role: RoleType.SUPER_ADMIN,
        deletedAt: null,
      });

      await expect(
        service.getUserPermissions('sa-target-id', adminExecutor),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateUserPermissions throws ForbiddenException when ADMIN tries to update SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'sa-target-id',
        fullName: 'Super Admin',
        username: 'superadmin',
        role: RoleType.SUPER_ADMIN,
        permissions: [],
        deletedAt: null,
      });

      await expect(
        service.updateUserPermissions('sa-target-id', { permissions: ['page:assets'] }, adminExecutor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updateUserPermissions strips super-admin-only permissions when ADMIN updates a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'staff-id',
        fullName: 'Test Staff',
        username: 'test_staff',
        role: RoleType.EMPLOYEE,
        permissions: [],
        deletedAt: null,
      });

      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'staff-id',
        fullName: 'Test Staff',
        username: 'test_staff',
        role: RoleType.EMPLOYEE,
        permissions: ['page:assets', 'assets:read'],
        position: 'Xodim',
        updatedAt: new Date(),
      });

      await service.updateUserPermissions(
        'staff-id',
        {
          permissions: [
            'page:assets',
            'assets:read',
            'page:system_audit',
            'system_audit:read',
            'page:backups',
            'backups:create',
          ],
        },
        adminExecutor,
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'staff-id' },
          data: {
            permissions: ['page:assets', 'assets:read'],
          },
        }),
      );
    });
  });
});
