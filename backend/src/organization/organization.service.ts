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

  async getAllDepartments() {
    return this.prisma.department.findMany({
      include: {
        parent: {
          select: { id: true, name: true, type: true },
        },
        _count: {
          select: { children: true, rooms: true, users: true },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async getRooms() {
    const rooms = await this.prisma.room.findMany({
      include: {
        department: true,
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
      building: r.building,
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
      include: {
        _count: { select: { stocks: true } },
      },
      orderBy: { isMain: 'desc' },
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

    // 3. Create department in transaction
    const department = await this.prisma.$transaction(async (tx) => {
      return tx.department.create({
        data: {
          name: dto.name.trim(),
          code: dto.code ? dto.code.trim().toUpperCase() : null,
          type: dto.type ? dto.type.trim().toUpperCase() : 'CHAIR',
          parentId: dto.parentId || null,
        },
        include: {
          parent: true,
        },
      });
    });

    // 4. Audit Log
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

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.department.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          code: dto.code !== undefined ? (dto.code ? dto.code.trim().toUpperCase() : null) : undefined,
          type: dto.type !== undefined ? dto.type.trim().toUpperCase() : undefined,
          parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        },
        include: {
          parent: true,
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
      await tx.department.delete({ where: { id } });
    });

    await this.systemAuditService.log({
      action: 'DEPARTMENT_DELETED',
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
      message: `'${dept.name}' bo‘limi muvaffaqiyatli o‘chirildi`,
    };
  }

  // ==================== ROOM CRUD ====================

  async createRoom(dto: CreateRoomDto, executorId: string) {
    // 1. Check duplicate room in same building
    const existing = await this.prisma.room.findFirst({
      where: {
        number: dto.number.trim(),
        building: dto.building.trim(),
      },
    });

    if (existing) {
      throw new ConflictException(
        `'${dto.building}' binosida '${dto.number}'-xona allaqachon mavjud`,
      );
    }

    // 2. Check department if provided
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Biriktirilayotgan bo‘lim topilmadi`);
      }
    }

    // 3. Check responsible user if provided
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
          number: dto.number.trim(),
          name: dto.name.trim(),
          floor: dto.floor,
          building: dto.building.trim(),
          departmentId: dto.departmentId || null,
          responsibleUserId: dto.responsibleUserId || null,
        },
        include: {
          department: true,
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

    // Check conflict if number or building changed
    const targetNumber = dto.number !== undefined ? dto.number.trim() : existing.number;
    const targetBuilding = dto.building !== undefined ? dto.building.trim() : existing.building;

    if (targetNumber !== existing.number || targetBuilding !== existing.building) {
      const conflict = await this.prisma.room.findFirst({
        where: {
          id: { not: id },
          number: targetNumber,
          building: targetBuilding,
        },
      });
      if (conflict) {
        throw new ConflictException(
          `'${targetBuilding}' binosida '${targetNumber}'-xona allaqachon mavjud`,
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
          building: dto.building !== undefined ? dto.building.trim() : undefined,
          departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
          responsibleUserId: dto.responsibleUserId !== undefined ? dto.responsibleUserId : undefined,
        },
        include: {
          department: true,
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
      await tx.room.delete({ where: { id } });
    });

    await this.systemAuditService.log({
      action: 'ROOM_DELETED',
      entity: 'Room',
      entityId: id,
      userId: executorId,
      details: {
        deletedRoom: `${room.number} (${room.name})`,
        building: room.building,
      },
    });

    return {
      success: true,
      message: `'${room.number}-xona (${room.name})' muvaffaqiyatli o‘chirildi`,
    };
  }
}
