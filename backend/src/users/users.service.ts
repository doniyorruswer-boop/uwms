import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RoleType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  PERMISSION_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
} from '../auth/constants/permissions.constants';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAuditService: SystemAuditService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async findAll(query: QueryUsersDto) {
    const { search, role, departmentId, isActive, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};

    if (query.showDeleted) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (role) {
      where.role = role;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { position: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          department: {
            select: { id: true, name: true, type: true, code: true },
          },
          _count: {
            select: {
              responsibleRooms: true,
              responsibleInstances: true,
            },
          },
        },
      }),
    ]);

    const sanitizedUsers = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });

    return {
      items: sanitizedUsers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        responsibleRooms: {
          select: { id: true, number: true, name: true, building: true, floor: true },
        },
        _count: {
          select: {
            responsibleRooms: true,
            responsibleInstances: true,
            submittedRequests: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`ID '${id}' ga ega foydalanuvchi topilmadi`);
    }

    const { password, ...rest } = user;
    return rest;
  }

  async getUserAssets(id: string) {
    await this.findById(id);

    const [rooms, assets] = await Promise.all([
      this.prisma.room.findMany({
        where: { responsibleUserId: id },
        include: {
          department: { select: { name: true } },
          _count: { select: { itemInstances: true } },
        },
      }),
      this.prisma.itemInstance.findMany({
        where: { responsibleUserId: id },
        include: {
          item: { select: { name: true, model: true, unit: true } },
          room: { select: { number: true, name: true, building: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      responsibleRooms: rooms,
      responsibleAssets: assets,
      totalAssetsCount: assets.length,
    };
  }

  async create(dto: CreateUserDto, executorId: string) {
    // 1. Check unique username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException(`'${dto.username}' loginli foydalanuvchi allaqachon mavjud`);
    }

    // 2. Check unique email if provided
    if (dto.email && dto.email.trim().length > 0) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email.trim() },
      });
      if (existingEmail) {
        throw new ConflictException(`'${dto.email}' elektron pochtali foydalanuvchi allaqachon mavjud`);
      }
    }

    // 3. Check department if provided
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Tanlangan bo‘lim/kafedra topilmadi`);
      }
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 5. Transaction
    const newUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: dto.fullName.trim(),
          username: dto.username.trim().toLowerCase(),
          password: hashedPassword,
          email: dto.email ? dto.email.trim().toLowerCase() : null,
          phone: dto.phone ? dto.phone.trim() : null,
          position: dto.position ? dto.position.trim() : null,
          role: dto.role,
          departmentId: dto.departmentId || null,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          mustChangePassword: true,
        },
        include: {
          department: true,
        },
      });

      return created;
    });

    // 6. Audit Log
    await this.systemAuditService.log({
      action: 'USER_CREATED',
      entity: 'User',
      entityId: newUser.id,
      userId: executorId,
      details: {
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        department: newUser.department?.name,
      },
    });

    const { password, ...sanitized } = newUser;
    return sanitized;
  }

  async update(id: string, dto: UpdateUserDto, executorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Foydalanuvchi topilmadi`);
    }

    // Check unique email if changed
    if (dto.email && dto.email.trim().toLowerCase() !== existing.email?.toLowerCase()) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (emailConflict) {
        throw new ConflictException(`'${dto.email}' elektron pochtali boshqa foydalanuvchi mavjud`);
      }
    }

    // Safety check: if changing role of SUPER_ADMIN
    if (existing.role === RoleType.SUPER_ADMIN && dto.role && dto.role !== RoleType.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: RoleType.SUPER_ADMIN, isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Tizimdagi yagona faol Super Admin rolini o‘zgartirib bo‘lmaydi');
      }
    }

    // Safety check: if deactivating user, ensure clearance eligibility
    if (dto.isActive === false && existing.isActive !== false) {
      const clearance = await this.checkUserClearanceEligibility(id);
      if (!clearance.canDeactivate) {
        throw new BadRequestException(
          `Xodimni nofaol holatga o‘tkazib bo‘lmaydi! Sabab: Zimmasida ${clearance.activeAssets} ta faol aktiv, ${clearance.pendingHandovers} ta kutilayotgan topshirish arizasi, ${clearance.openShortages} ta ochiq kamomad yoki ${clearance.responsibleRooms} ta xona mas’ulligi mavjud. Avval 'Moddiy Javobgarlikni Topshirish' jarayonini yakunlang.`
        );
      }
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName !== undefined ? dto.fullName.trim() : undefined,
          email: dto.email !== undefined ? (dto.email ? dto.email.trim().toLowerCase() : null) : undefined,
          phone: dto.phone !== undefined ? (dto.phone ? dto.phone.trim() : null) : undefined,
          position: dto.position !== undefined ? (dto.position ? dto.position.trim() : null) : undefined,
          role: dto.role !== undefined ? dto.role : undefined,
          departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
        include: {
          department: true,
        },
      });

      return updated;
    });

    await this.systemAuditService.log({
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: id,
      userId: executorId,
      details: {
        changes: dto,
        targetUser: updatedUser.username,
      },
    });

    if (this.eventsGateway && ((dto.role && dto.role !== existing.role) || (dto.isActive === false && existing.isActive !== false))) {
      this.eventsGateway.emitToUser(id, 'security:force_logout', {
        reason: 'Sizning tizimdagi rolingiz yoki hisobingiz administrator tomonidan o‘zgartirildi / bloklandi.',
      });
    }

    const { password, ...sanitized } = updatedUser;
    return sanitized;
  }

  async toggleStatus(id: string, isActive: boolean, executorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Foydalanuvchi topilmadi`);
    }

    // Safety check: cannot deactivate the last active super admin
    if (user.role === RoleType.SUPER_ADMIN && !isActive) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: RoleType.SUPER_ADMIN, isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException('Tizimdagi yagona faol Super Admin hisobini faolsizlantirib bo‘lmaydi');
      }
    }

    // Safety check: if deactivating user, ensure clearance eligibility
    if (!isActive) {
      const clearance = await this.checkUserClearanceEligibility(id);
      if (!clearance.canDeactivate) {
        throw new BadRequestException(
          `Xodimni nofaol holatga o‘tkazib bo‘lmaydi! Sabab: Zimmasida ${clearance.activeAssets} ta faol aktiv, ${clearance.pendingHandovers} ta kutilayotgan topshirish arizasi, ${clearance.openShortages} ta ochiq kamomad yoki ${clearance.responsibleRooms} ta xona mas’ulligi mavjud. Avval 'Moddiy Javobgarlikni Topshirish' jarayonini yakunlang.`
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: { department: true },
    });

    await this.systemAuditService.log({
      action: 'USER_STATUS_CHANGED',
      entity: 'User',
      entityId: id,
      userId: executorId,
      details: {
        username: user.username,
        newStatus: isActive ? 'ACTIVE' : 'INACTIVE',
      },
    });

    if (this.eventsGateway && !isActive) {
      this.eventsGateway.emitToUser(id, 'security:force_logout', {
        reason: 'Hisobingiz administrator tomonidan nofaol holatga o‘tkazildi.',
      });
    }

    const { password, ...sanitized } = updated;
    return sanitized;
  }

  async resetPassword(id: string, dto: ResetPasswordDto, executorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Foydalanuvchi topilmadi`);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        mustChangePassword: dto.mustChangePassword ?? false,
      },
    });

    await this.systemAuditService.log({
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: id,
      userId: executorId,
      details: {
        targetUsername: user.username,
      },
    });

    return {
      success: true,
      message: `'${user.fullName}' foydalanuvchisi paroli muvaffaqiyatli yangilandi`,
    };
  }

  async remove(id: string, executorId: string) {
    if (id === executorId) {
      throw new BadRequestException('Foydalanuvchi o‘z hisobini o‘chira olmaydi!');
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Foydalanuvchi (ID: ${id}) topilmadi`);
    }

    if (existing.deletedAt) {
      throw new BadRequestException('Ushbu foydalanuvchi allaqachon o‘chirilgan!');
    }

    // Safety check: cannot delete user with active assets or pending handovers
    const clearance = await this.checkUserClearanceEligibility(id);
    if (!clearance.canDeactivate) {
      throw new BadRequestException(
        `Xodimni o‘chirib bo‘lmaydi! Sabab: Zimmasida ${clearance.activeAssets} ta faol aktiv, ${clearance.pendingHandovers} ta kutilayotgan topshirish arizasi, ${clearance.openShortages} ta ochiq kamomad yoki ${clearance.responsibleRooms} ta xona mas’ulligi mavjud. Avval 'Moddiy Javobgarlikni Topshirish' jarayonini yakunlang.`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      return user;
    });

    await this.systemAuditService.log({
      userId: executorId,
      action: 'SOFT_DELETE',
      entity: 'User',
      entityId: id,
      details: {
        username: updated.username,
        fullName: updated.fullName,
        role: updated.role,
      },
    });

    const { password, ...rest } = updated;
    return rest;
  }

  async restore(id: string, executorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Foydalanuvchi (ID: ${id}) topilmadi`);
    }

    if (!existing.deletedAt) {
      throw new BadRequestException('Ushbu foydalanuvchi o‘chirilmagan!');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          deletedAt: null,
          isActive: true,
        },
      });

      return user;
    });

    await this.systemAuditService.log({
      userId: executorId,
      action: 'RESTORE',
      entity: 'User',
      entityId: id,
      details: {
        username: updated.username,
        fullName: updated.fullName,
        role: updated.role,
      },
    });

    const { password, ...rest } = updated;
    return rest;
  }

  /**
   * Xodimning moddiy javobgarlikdan ozodlik / aylanma varaqa (Clearance) holatini tekshirish
   */
  async checkUserClearanceEligibility(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    // 1. Faol asosiy vositalar (hisobdan chiqarilmaganlar)
    const activeAssets = await this.prisma.itemInstance.count({
      where: {
        responsibleUserId: userId,
        status: { notIn: ['WRITTEN_OFF'] },
      },
    });

    // 2. Kutilayotgan, hali yakunlanmagan topshirish arizalari (poyga holati himoyasi)
    const pendingHandovers = await this.prisma.responsibilityHandover.count({
      where: {
        departingUserId: userId,
        status: { in: ['DRAFT', 'PENDING_AUDIT', 'PENDING_SIGNATURES'] },
      },
    });

    // 3. Ochiq, xulosasi berilmagan kamomadlar (SHORTAGE)
    const openShortages = await this.prisma.handoverItemAction.count({
      where: {
        handover: { departingUserId: userId },
        actionType: 'SHORTAGE',
        investigationNote: null,
      },
    });

    // 4. Mas'ul qilib biriktirilgan auditoriya/xonalar
    const responsibleRooms = await this.prisma.room.count({
      where: {
        responsibleUserId: userId,
        deletedAt: null,
      },
    });

    const canDeactivate =
      activeAssets === 0 &&
      pendingHandovers === 0 &&
      openShortages === 0 &&
      responsibleRooms === 0;

    return {
      userId,
      fullName: user.fullName,
      canDeactivate,
      activeAssets,
      pendingHandovers,
      openShortages,
      responsibleRooms,
      statusSummary: canDeactivate
        ? 'Javobgarlikdan to‘liq ozod qilingan (Clearance Completed)'
        : 'Zimmasida moddiy majburiyatlar yoki kutilayotgan topshirishlar mavjud',
    };
  }

  /**
   * Tizimdagi barcha ruxsatlar katalogi va standart rol shablonlarini olish
   */
  async getPermissionsCatalog() {
    return {
      modules: PERMISSION_MODULES,
      defaultPresets: DEFAULT_ROLE_PERMISSIONS,
    };
  }

  /**
   * Bitta foydalanuvchining shaxsiy huquqlari va samarali huquqlarini olish
   */
  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        permissions: true,
        position: true,
        department: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Foydalanuvchi (ID: ${userId}) topilmadi!`);
    }

    const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    // Agar foydalanuvchining shaxsiy permissions massivi bo'sh bo'lsa, u rolining standart huquqlaridan foydalanadi
    const isCustom = user.permissions && user.permissions.length > 0;
    const effectivePermissions = isCustom ? user.permissions : defaultRolePerms;

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        position: user.position,
        departmentName: user.department?.name,
      },
      permissions: user.permissions || [],
      effectivePermissions,
      defaultRolePermissions: defaultRolePerms,
      isCustom,
      catalog: PERMISSION_MODULES,
    };
  }

  /**
   * Foydalanuvchi huquqlarini yangilash (Tranzaksiya + Audit jurnali)
   */
  async updateUserPermissions(
    userId: string,
    dto: UpdatePermissionsDto,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`Foydalanuvchi (ID: ${userId}) topilmadi!`);
    }

    // Xavfsizlik: SUPER_ADMIN o'zidan SUPER_ADMIN yoki asosiy boshqaruv huquqlarini xatolik bilan olib tashlamasligi uchun ogohlantirish
    const previousPermissionsCount = user.permissions.length;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          permissions: dto.permissions,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          permissions: true,
          position: true,
          updatedAt: true,
        },
      });

      await this.systemAuditService.log({
        userId: adminId,
        action: 'USER_PERMISSIONS_UPDATED',
        entity: 'User',
        entityId: userId,
        details: `Foydalanuvchi '${user.fullName}' (@${user.username}) ning tizim huquqlari yangilandi. Oldingi ruxsatlar soni: ${previousPermissionsCount}, Yangi ruxsatlar soni: ${dto.permissions.length}`,
        ipAddress: 'internal',
        userAgent: 'UWMS Core PBAC Module',
      });

      return updated;
    });

    this.logger.log(
      `Foydalanuvchi (${userId}) huquqlari yangilandi: ${dto.permissions.length} ta ruxsat berildi. Admin: ${adminId}`,
    );

    if (this.eventsGateway) {
      this.eventsGateway.emitToUser(userId, 'security:force_logout', {
        reason: 'Sizning tizim huquqlaringiz (PBAC) yangilandi. Xavfsizlik yuzasidan iltimos, tizimga qayta kiring.',
      });
    }

    return {
      success: true,
      message: 'Foydalanuvchi ruxsatlari muvaffaqiyatli saqlandi',
      user: updatedUser,
    };
  }
}

