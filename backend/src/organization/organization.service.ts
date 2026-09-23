import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAuditService: SystemAuditService,
  ) {}

  async getDepartmentTree() {
    const faculties = await this.prisma.department.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            rooms: {
              include: {
                responsibleUser: {
                  select: { id: true, fullName: true, username: true },
                },
              },
            },
            _count: {
              select: { rooms: true, users: true },
            },
          },
        },
        rooms: {
          include: {
            responsibleUser: {
              select: { id: true, fullName: true, username: true },
            },
          },
        },
        _count: {
          select: { rooms: true, users: true, children: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return faculties;
  }

  async getAllDepartments(showDeleted?: boolean) {
    const where: any = showDeleted ? { deletedAt: { not: null } } : { deletedAt: null };
    return this.prisma.department.findMany({
      where,
      include: {
        parent: {
          select: { id: true, name: true, type: true },
        },
        building: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { children: true, rooms: true, users: true },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  // ==================== BUILDINGS ====================

  async getBuildings(showDeleted?: boolean) {
    // Auto-link any rooms that have buildingId = null to their respective Building record
    const unlinkedRooms = await this.prisma.room.findMany({
      where: { buildingId: null },
      select: { id: true, building: true, floor: true },
    });
    if (unlinkedRooms.length > 0) {
      for (const r of unlinkedRooms) {
        const bName = r.building?.trim() || 'Bosh bino';
        const b = await this.prisma.building.upsert({
          where: { name: bName },
          update: {},
          create: {
            name: bName,
            code: bName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'BLD',
            floorsCount: Math.max(r.floor || 1, 4),
          },
        });
        await this.prisma.room.update({
          where: { id: r.id },
          data: { buildingId: b.id, building: b.name },
        });
      }
    }

    const where: any = showDeleted ? { deletedAt: { not: null } } : { deletedAt: null };
    return this.prisma.building.findMany({
      where,
      include: {
        commendant: {
          select: { id: true, fullName: true, phone: true, username: true, position: true },
        },
        departments: {
          where: { deletedAt: null },
          select: { id: true, name: true, type: true, code: true, parentId: true },
        },
        _count: {
          select: {
            rooms: { where: { deletedAt: null } },
            warehouses: { where: { deletedAt: null } },
            departments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getBuildingDetails(id: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        commendant: {
          select: { id: true, fullName: true, phone: true, username: true, position: true },
        },
        departments: {
          where: { deletedAt: null },
          include: {
            parent: { select: { id: true, name: true, type: true } },
            _count: { select: { rooms: true, users: true } },
          },
        },
        rooms: {
          where: { deletedAt: null },
          include: {
            department: { select: { id: true, name: true, type: true } },
            responsibleUser: { select: { id: true, fullName: true, phone: true } },
            _count: { select: { itemInstances: true } },
          },
          orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        },
        warehouses: {
          where: { deletedAt: null },
          include: {
            manager: { select: { id: true, fullName: true, phone: true } },
            _count: { select: { stocks: true } },
          },
        },
        _count: {
          select: {
            rooms: { where: { deletedAt: null } },
            warehouses: { where: { deletedAt: null } },
            departments: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!building) {
      throw new NotFoundException(`Bino (ID: ${id}) topilmadi`);
    }

    return building;
  }

  async createBuilding(dto: CreateBuildingDto, executorId: string) {
    const nameTrimmed = dto.name.trim();
    const existing = await this.prisma.building.findFirst({
      where: { name: { equals: nameTrimmed, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`'${nameTrimmed}' nomli bino allaqachon mavjud`);
    }

    if (dto.code && dto.code.trim().length > 0) {
      const codeTrimmed = dto.code.trim().toUpperCase();
      const codeConflict = await this.prisma.building.findUnique({
        where: { code: codeTrimmed },
      });
      if (codeConflict) {
        throw new ConflictException(`'${codeTrimmed}' kodli bino allaqachon mavjud`);
      }
    }

    if (dto.commendantId) {
      const commendant = await this.prisma.user.findUnique({
        where: { id: dto.commendantId },
      });
      if (!commendant) {
        throw new NotFoundException('Biriktirilayotgan komendant (foydalanuvchi) topilmadi');
      }
    }

    const building = await this.prisma.$transaction(async (tx) => {
      const b = await tx.building.create({
        data: {
          name: nameTrimmed,
          code: dto.code ? dto.code.trim().toUpperCase() : null,
          floorsCount: dto.floorsCount || 4,
          address: dto.address?.trim() || null,
          description: dto.description?.trim() || null,
          commendantId: dto.commendantId || null,
        },
        include: {
          commendant: {
            select: { id: true, fullName: true, phone: true },
          },
          departments: {
            where: { deletedAt: null },
            select: { id: true, name: true, type: true, code: true },
          },
        },
      });

      if (dto.departmentIds && dto.departmentIds.length > 0) {
        await tx.department.updateMany({
          where: { id: { in: dto.departmentIds } },
          data: { buildingId: b.id },
        });
      }

      return b;
    });

    await this.systemAuditService.log({
      action: 'BUILDING_CREATED',
      entity: 'Building',
      entityId: building.id,
      userId: executorId,
      details: {
        name: building.name,
        code: building.code,
        floorsCount: building.floorsCount,
        address: building.address,
        commendant: building.commendant?.fullName,
        departmentIds: dto.departmentIds,
      },
    });

    return building;
  }

  async updateBuilding(id: string, dto: UpdateBuildingDto, executorId: string) {
    const existing = await this.prisma.building.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bino topilmadi');
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const nameConflict = await this.prisma.building.findFirst({
        where: {
          id: { not: id },
          name: { equals: dto.name.trim(), mode: 'insensitive' },
        },
      });
      if (nameConflict) {
        throw new ConflictException(`'${dto.name.trim()}' nomli boshqa bino mavjud`);
      }
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeConflict = await this.prisma.building.findFirst({
        where: {
          id: { not: id },
          code: dto.code.trim().toUpperCase(),
        },
      });
      if (codeConflict) {
        throw new ConflictException(`'${dto.code.trim().toUpperCase()}' kodli boshqa bino mavjud`);
      }
    }

    if (dto.commendantId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.commendantId } });
      if (!user) {
        throw new NotFoundException('Tanlangan komendant topilmadi');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.departmentIds !== undefined) {
        await tx.department.updateMany({
          where: {
            buildingId: id,
            id: { notIn: dto.departmentIds },
          },
          data: { buildingId: null },
        });
        if (dto.departmentIds.length > 0) {
          await tx.department.updateMany({
            where: { id: { in: dto.departmentIds } },
            data: { buildingId: id },
          });
        }
      }

      const b = await tx.building.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          code: dto.code !== undefined ? (dto.code ? dto.code.trim().toUpperCase() : null) : undefined,
          floorsCount: dto.floorsCount !== undefined ? dto.floorsCount : undefined,
          address: dto.address !== undefined ? (dto.address ? dto.address.trim() : null) : undefined,
          description: dto.description !== undefined ? (dto.description ? dto.description.trim() : null) : undefined,
          commendantId: dto.commendantId !== undefined ? dto.commendantId : undefined,
        },
        include: {
          commendant: {
            select: { id: true, fullName: true, phone: true },
          },
          departments: {
            where: { deletedAt: null },
            select: { id: true, name: true, type: true, code: true },
          },
        },
      });

      if (dto.name && dto.name.trim() !== existing.name) {
        await tx.room.updateMany({
          where: { buildingId: id },
          data: { building: dto.name.trim() },
        });
      }

      return b;
    });

    await this.systemAuditService.log({
      action: 'BUILDING_UPDATED',
      entity: 'Building',
      entityId: id,
      userId: executorId,
      details: {
        changes: dto,
        targetName: updated.name,
      },
    });

    return updated;
  }

  async deleteBuilding(id: string, executorId: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rooms: { where: { deletedAt: null } },
            warehouses: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!building) {
      throw new NotFoundException('Bino topilmadi');
    }

    if (building._count.rooms > 0) {
      throw new BadRequestException(
        `Binoda ${building._count.rooms} ta auditoriya/xona mavjud! Avval xonalarni boshqa binoga ko‘chiring yoki o‘chiring`,
      );
    }

    if (building._count.warehouses > 0) {
      throw new BadRequestException(
        `Binoda ${building._count.warehouses} ta omborxona joylashgan! Avval omborlarni ko‘chiring`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.building.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.systemAuditService.log({
      action: 'SOFT_DELETE',
      entity: 'Building',
      entityId: id,
      userId: executorId,
      details: {
        deletedName: building.name,
        code: building.code,
      },
    });

    return {
      success: true,
      message: `'${building.name}' binosi muvaffaqiyatli o‘chirildi (Soft delete)`,
    };
  }

  async restoreBuilding(id: string, executorId: string) {
    const building = await this.prisma.building.findUnique({ where: { id } });
    if (!building) {
      throw new NotFoundException('Bino topilmadi');
    }
    if (!building.deletedAt) {
      throw new BadRequestException('Ushbu bino o‘chirilmagan!');
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      return tx.building.update({
        where: { id },
        data: { deletedAt: null },
      });
    });

    await this.systemAuditService.log({
      action: 'RESTORE',
      entity: 'Building',
      entityId: id,
      userId: executorId,
      details: {
        name: building.name,
        code: building.code,
      },
    });

    return restored;
  }

  // ==================== ROOMS ====================

  async getRooms(showDeleted?: boolean) {
    const where: any = showDeleted ? { deletedAt: { not: null } } : { deletedAt: null };
    const rooms = await this.prisma.room.findMany({
      where,
      include: {
        department: true,
        buildingRelation: true,
        responsibleUser: {
          select: { id: true, fullName: true, position: true, phone: true },
        },
        _count: {
          select: { itemInstances: true },
        },
      },
      orderBy: [{ building: 'asc' }, { number: 'asc' }],
    });

    return rooms.map((r) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      floor: r.floor,
      buildingId: r.buildingId,
      building: r.buildingRelation?.name || r.building,
      buildingCode: r.buildingRelation?.code,
      buildingFloorsCount: r.buildingRelation?.floorsCount || 4,
      departmentId: r.departmentId,
      departmentName: r.department?.name,
      responsibleUserId: r.responsibleUserId,
      responsibleUserName: r.responsibleUser?.fullName,
      responsibleUserPhone: r.responsibleUser?.phone,
      itemCount: r._count.itemInstances,
    }));
  }

  async getRoomDetails(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        department: true,
        buildingRelation: true,
        responsibleUser: true,
        itemInstances: {
          include: {
            item: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { itemInstances: true },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Xona (ID: ${id}) topilmadi`);
    }

    return room;
  }

  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      where: { deletedAt: null },
      include: {
        building: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, fullName: true, username: true, phone: true } },
        _count: { select: { stocks: true } },
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        departmentId: true,
        department: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // ==================== DEPARTMENT CRUD ====================

  async createDepartment(dto: CreateDepartmentDto, executorId: string) {
    // 1. Check unique code if provided
    if (dto.code && dto.code.trim().length > 0) {
      const existing = await this.prisma.department.findUnique({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (existing) {
        throw new ConflictException(`'${dto.code}' kodli bo‘lim allaqachon mavjud`);
      }
    }

    // 2. Check parent department if provided
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Yuqori turuvchi bo‘lim (ID: ${dto.parentId}) topilmadi`);
      }
    }

    // 3. Check building if provided
    if (dto.buildingId) {
      const bld = await this.prisma.building.findUnique({
        where: { id: dto.buildingId },
      });
      if (!bld) {
        throw new NotFoundException(`Tanlangan bino topilmadi`);
      }
    }

    // 4. Create department in transaction
    const department = await this.prisma.$transaction(async (tx) => {
      return tx.department.create({
        data: {
          name: dto.name.trim(),
          code: dto.code ? dto.code.trim().toUpperCase() : null,
          type: dto.type ? dto.type.trim().toUpperCase() : 'CHAIR',
          parentId: dto.parentId || null,
          buildingId: dto.buildingId || null,
        },
        include: {
          parent: true,
          building: true,
        },
      });
    });

    // 5. Audit Log
    await this.systemAuditService.log({
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: department.id,
      userId: executorId,
      details: {
        name: department.name,
        code: department.code,
        type: department.type,
        parent: department.parent?.name,
        building: department.building?.name,
      },
    });

    return department;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, executorId: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bo‘lim topilmadi`);
    }

    // 1. Check circular parent
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Bo‘lim o‘ziga-o‘zi yuqori bo‘lim bo‘la olmaydi');
      }
      const parent = await this.prisma.department.findUnique({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Tanlangan yuqori bo‘lim topilmadi`);
      }
    }

    // 2. Check code uniqueness
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeConflict = await this.prisma.department.findUnique({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (codeConflict) {
        throw new ConflictException(`'${dto.code}' kodli boshqa bo‘lim mavjud`);
      }
    }

    // 3. Check building if provided
    if (dto.buildingId) {
      const bld = await this.prisma.building.findUnique({ where: { id: dto.buildingId } });
      if (!bld) throw new NotFoundException(`Tanlangan bino topilmadi`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.department.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          code: dto.code !== undefined ? (dto.code ? dto.code.trim().toUpperCase() : null) : undefined,
          type: dto.type !== undefined ? dto.type.trim().toUpperCase() : undefined,
          parentId: dto.parentId !== undefined ? dto.parentId : undefined,
          buildingId: dto.buildingId !== undefined ? dto.buildingId : undefined,
        },
        include: {
          parent: true,
          building: true,
        },
      });
    });

    await this.systemAuditService.log({
      action: 'DEPARTMENT_UPDATED',
      entity: 'Department',
      entityId: id,
      userId: executorId,
      details: {
        changes: dto,
        targetName: updated.name,
      },
    });

    return updated;
  }

  async deleteDepartment(id: string, executorId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            rooms: true,
            users: true,
          },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException(`Bo‘lim topilmadi`);
    }

    // Safety checks
    if (dept._count.children > 0) {
      throw new BadRequestException(
        `Bo‘lim tarkibida ${dept._count.children} ta quyi kafedra/bo‘lim mavjud! Avval ularni o‘chiring yoki boshqa fakultetga ko‘chiring`,
      );
    }

    if (dept._count.rooms > 0) {
      throw new BadRequestException(
        `Bo‘limga ${dept._count.rooms} ta o‘quv xonasi/auditoriya biriktirilgan! Avval ularni boshqa bo‘limga ko‘chiring`,
      );
    }

    if (dept._count.users > 0) {
      throw new BadRequestException(
        `Bo‘limga ${dept._count.users} ta xodim biriktirilgan! Avval xodimlarni boshqa bo‘limga o‘tkazing`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.department.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.systemAuditService.log({
      action: 'SOFT_DELETE',
      entity: 'Department',
      entityId: id,
      userId: executorId,
      details: {
        deletedName: dept.name,
        code: dept.code,
      },
    });

    return {
      success: true,
      message: `'${dept.name}' bo‘limi muvaffaqiyatli o‘chirildi (Soft delete)`,
    };
  }

  async restoreDepartment(id: string, executorId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw new NotFoundException(`Bo‘lim topilmadi`);
    }
    if (!dept.deletedAt) {
      throw new BadRequestException(`Ushbu bo‘lim o‘chirilmagan!`);
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      return tx.department.update({
        where: { id },
        data: { deletedAt: null },
      });
    });

    await this.systemAuditService.log({
      action: 'RESTORE',
      entity: 'Department',
      entityId: id,
      userId: executorId,
      details: {
        name: dept.name,
        code: dept.code,
      },
    });

    return restored;
  }

  // ==================== ROOM CRUD ====================

  async createRoom(dto: CreateRoomDto, executorId: string) {
    let targetBuildingId: string | null = null;
    let targetBuildingName = 'Bosh bino';
    let maxFloors = 20;

    // 1. Resolve Building
    if (dto.buildingId) {
      const b = await this.prisma.building.findUnique({
        where: { id: dto.buildingId },
      });
      if (!b) {
        throw new NotFoundException('Biriktirilayotgan bino topilmadi');
      }
      targetBuildingId = b.id;
      targetBuildingName = b.name;
      maxFloors = b.floorsCount;
    } else if (dto.building && dto.building.trim().length > 0) {
      targetBuildingName = dto.building.trim();
      const b = await this.prisma.building.upsert({
        where: { name: targetBuildingName },
        update: {},
        create: {
          name: targetBuildingName,
          code: targetBuildingName.slice(0, 4).toUpperCase(),
          floorsCount: Math.max(dto.floor || 1, 4),
        },
      });
      targetBuildingId = b.id;
      maxFloors = b.floorsCount;
    }

    if (dto.floor > maxFloors) {
      throw new BadRequestException(
        `'${targetBuildingName}' binosi ${maxFloors} qavatdan iborat. ${dto.floor}-qavat kiritish mumkin emas!`,
      );
    }

    // 2. Check duplicate room in same building (for numbered rooms)
    const hasExplicitNumber = Boolean(dto.number && dto.number.trim().length > 0);
    const finalNumber = hasExplicitNumber
      ? dto.number!.trim()
      : `RS-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    if (hasExplicitNumber) {
      const existing = await this.prisma.room.findFirst({
        where: {
          number: finalNumber,
          buildingId: targetBuildingId,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ConflictException(
          `'${targetBuildingName}' binosida '${dto.number}'-xona allaqachon mavjud`,
        );
      }
    }

    // 3. Check department if provided
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Biriktirilayotgan bo‘lim yoki kafedra topilmadi`);
      }
    }

    // 4. Check responsible user if provided
    if (dto.responsibleUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.responsibleUserId },
      });
      if (!user) {
        throw new NotFoundException(`Mas’ul shaxs (MOL) foydalanuvchisi topilmadi`);
      }
    }

    const room = await this.prisma.$transaction(async (tx) => {
      return tx.room.create({
        data: {
          number: finalNumber,
          name: dto.name.trim(),
          floor: dto.floor,
          buildingId: targetBuildingId,
          building: targetBuildingName,
          departmentId: dto.departmentId || null,
          responsibleUserId: dto.responsibleUserId || null,
        },
        include: {
          department: true,
          buildingRelation: true,
          responsibleUser: {
            select: { id: true, fullName: true, username: true, phone: true },
          },
        },
      });
    });

    await this.systemAuditService.log({
      action: 'ROOM_CREATED',
      entity: 'Room',
      entityId: room.id,
      userId: executorId,
      details: {
        number: room.number,
        name: room.name,
        building: room.building,
        department: room.department?.name,
        responsibleUser: room.responsibleUser?.fullName,
      },
    });

    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto, executorId: string) {
    const existing = await this.prisma.room.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Xona topilmadi`);
    }

    let targetBuildingId = existing.buildingId;
    let targetBuildingName = existing.building;

    if (dto.buildingId !== undefined) {
      if (dto.buildingId) {
        const b = await this.prisma.building.findUnique({ where: { id: dto.buildingId } });
        if (!b) throw new NotFoundException('Tanlangan bino topilmadi');
        targetBuildingId = b.id;
        targetBuildingName = b.name;
      } else {
        targetBuildingId = null;
      }
    } else if (dto.building !== undefined) {
      targetBuildingName = dto.building.trim();
      const b = await this.prisma.building.findUnique({ where: { name: targetBuildingName } });
      if (b) targetBuildingId = b.id;
    }

    const hasExplicitUpdateNumber = dto.number !== undefined && dto.number.trim().length > 0;
    const targetNumber = dto.number !== undefined
      ? (hasExplicitUpdateNumber ? dto.number.trim() : (existing.number.startsWith('RS-') ? existing.number : `RS-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`))
      : existing.number;

    if (hasExplicitUpdateNumber && (targetNumber !== existing.number || targetBuildingId !== existing.buildingId)) {
      const conflict = await this.prisma.room.findFirst({
        where: {
          id: { not: id },
          number: targetNumber,
          buildingId: targetBuildingId,
          deletedAt: null,
        },
      });
      if (conflict) {
        throw new ConflictException(
          `'${targetBuildingName}' binosida '${targetNumber}'-xona allaqachon mavjud`,
        );
      }
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw new NotFoundException('Tanlangan bo‘lim topilmadi');
    }

    if (dto.responsibleUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.responsibleUserId } });
      if (!user) throw new NotFoundException('Tanlangan mas’ul shaxs (MOL) topilmadi');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.room.update({
        where: { id },
        data: {
          number: dto.number !== undefined ? dto.number.trim() : undefined,
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          floor: dto.floor !== undefined ? dto.floor : undefined,
          buildingId: dto.buildingId !== undefined ? dto.buildingId : targetBuildingId,
          building: targetBuildingName,
          departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
          responsibleUserId: dto.responsibleUserId !== undefined ? dto.responsibleUserId : undefined,
        },
        include: {
          department: true,
          buildingRelation: true,
          responsibleUser: {
            select: { id: true, fullName: true, username: true, phone: true },
          },
        },
      });
    });

    await this.systemAuditService.log({
      action: 'ROOM_UPDATED',
      entity: 'Room',
      entityId: id,
      userId: executorId,
      details: {
        changes: dto,
        targetRoom: `${updated.number} (${updated.building})`,
      },
    });

    return updated;
  }

  async deleteRoom(id: string, executorId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            itemInstances: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Xona topilmadi`);
    }

    if (room._count.itemInstances > 0) {
      throw new BadRequestException(
        `Xonada ${room._count.itemInstances} ta asosiy vosita (jihoz) mavjud! Avval ashyolarni boshqa xonaga ko‘chiring`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.systemAuditService.log({
      action: 'SOFT_DELETE',
      entity: 'Room',
      entityId: id,
      userId: executorId,
      details: {
        deletedRoom: `${room.number} (${room.name})`,
        building: room.building,
      },
    });

    const roomLabel = room.number && !room.number.startsWith('RS-')
      ? `${room.number}-xona (${room.name})`
      : room.name;

    return {
      success: true,
      message: `'${roomLabel}' muvaffaqiyatli o‘chirildi (Soft delete)`,
    };
  }

  async restoreRoom(id: string, executorId: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Xona topilmadi`);
    }
    if (!room.deletedAt) {
      throw new BadRequestException(`Ushbu xona o‘chirilmagan!`);
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      return tx.room.update({
        where: { id },
        data: { deletedAt: null },
      });
    });

    await this.systemAuditService.log({
      action: 'RESTORE',
      entity: 'Room',
      entityId: id,
      userId: executorId,
      details: {
        roomNumber: room.number,
        building: room.building,
      },
    });

    return restored;
  }
}
