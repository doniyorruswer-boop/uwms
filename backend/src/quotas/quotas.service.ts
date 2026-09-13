import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SetQuotaDto, UpdateQuotaDto, QueryQuotaDto, CheckQuotaDto } from './quota.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class QuotasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAuditService: SystemAuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async findAll(query: QueryQuotaDto) {
    const { departmentId, itemId, period } = query;
    const where: any = {};

    if (departmentId) where.departmentId = departmentId;
    if (itemId) where.itemId = itemId;
    if (period) where.period = period;

    return this.prisma.departmentQuota.findMany({
      where,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        item: {
          select: { id: true, name: true, sku: true, unit: true, itemType: true },
        },
      },
    });
  }

  async setQuota(dto: SetQuotaDto, userId: string) {
    const period = dto.period || this.getCurrentPeriod();

    const quota = await this.prisma.departmentQuota.upsert({
      where: {
        departmentId_itemId_period: {
          departmentId: dto.departmentId,
          itemId: dto.itemId,
          period,
        },
      },
      update: {
        monthlyLimit: dto.monthlyLimit,
        notes: dto.notes,
      },
      create: {
        departmentId: dto.departmentId,
        itemId: dto.itemId,
        monthlyLimit: dto.monthlyLimit,
        period,
        usedQuantity: 0,
        notes: dto.notes,
      },
      include: {
        department: true,
        item: true,
      },
    });

    await this.systemAuditService.log({
      action: 'QUOTA_UPDATE',
      entity: 'DepartmentQuota',
      entityId: quota.id,
      details: {
        departmentName: quota.department.name,
        itemName: quota.item.name,
        monthlyLimit: dto.monthlyLimit,
        period,
      },
      userId,
    });

    return quota;
  }

  async updateQuota(id: string, dto: UpdateQuotaDto, userId: string) {
    const existing = await this.prisma.departmentQuota.findUnique({
      where: { id },
      include: { department: true, item: true },
    });

    if (!existing) {
      throw new BadRequestException('Bunday kvota yozuvi topilmadi.');
    }

    const updated = await this.prisma.departmentQuota.update({
      where: { id },
      data: {
        monthlyLimit: dto.monthlyLimit !== undefined ? dto.monthlyLimit : existing.monthlyLimit,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
      include: { department: true, item: true },
    });

    await this.systemAuditService.log({
      action: 'QUOTA_UPDATE',
      entity: 'DepartmentQuota',
      entityId: id,
      details: {
        oldLimit: existing.monthlyLimit,
        newLimit: updated.monthlyLimit,
        departmentName: existing.department.name,
        itemName: existing.item.name,
      },
      userId,
    });

    return updated;
  }

  async checkQuota(dto: CheckQuotaDto) {
    const period = dto.period || this.getCurrentPeriod();

    const quota = await this.prisma.departmentQuota.findUnique({
      where: {
        departmentId_itemId_period: {
          departmentId: dto.departmentId,
          itemId: dto.itemId,
          period,
        },
      },
      include: {
        department: true,
        item: true,
      },
    });

    if (!quota) {
      // Limit belgilanmagan
      return {
        hasLimit: false,
        isExceeded: false,
        monthlyLimit: null,
        usedQuantity: 0,
        remaining: null,
        requestedQty: dto.requestedQty,
        period,
      };
    }

    const remaining = Math.max(0, quota.monthlyLimit - quota.usedQuantity);
    const isExceeded = quota.usedQuantity + dto.requestedQty > quota.monthlyLimit;

    return {
      hasLimit: true,
      isExceeded,
      monthlyLimit: quota.monthlyLimit,
      usedQuantity: quota.usedQuantity,
      remaining,
      requestedQty: dto.requestedQty,
      period,
      quota,
    };
  }

  async recordUsage(
    departmentId: string,
    itemId: string,
    quantity: number,
    period?: string,
    tx?: any,
  ) {
    const prismaClient = tx || this.prisma;
    const targetPeriod = period || this.getCurrentPeriod();

    const quota = await prismaClient.departmentQuota.findUnique({
      where: {
        departmentId_itemId_period: {
          departmentId,
          itemId,
          period: targetPeriod,
        },
      },
    });

    if (quota) {
      await prismaClient.departmentQuota.update({
        where: { id: quota.id },
        data: {
          usedQuantity: {
            increment: quantity,
          },
        },
      });
    }
  }
}
