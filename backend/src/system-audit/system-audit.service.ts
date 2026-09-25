import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuerySystemAuditDto } from './system-audit.dto';
import { RequestContext } from '../common/context/request-context';

@Injectable()
export class SystemAuditService {
  private readonly logger = new Logger(SystemAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: string;
    entity: string;
    entityId?: string;
    details?: any;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      const detailsStr =
        typeof params.details === 'object'
          ? JSON.stringify(params.details)
          : params.details || null;

      const ipAddress = params.ipAddress || RequestContext.getClientIp() || null;
      const userAgent = params.userAgent || RequestContext.getUserAgent() || null;

      return await this.prisma.systemAuditLog.create({
        data: {
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          details: detailsStr,
          userId: params.userId || null,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write system audit log', error);
      // Audit log failures should not crash the main business transaction
      return null;
    }
  }

  async findAll(query: QuerySystemAuditDto) {
    const { action, entity, userId, search, startDate, endDate, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (action) {
      if (action === 'BIOMETRIC_SIGN') {
        where.action = { in: ['BIOMETRIC_SIGN', 'BIOMETRIC_SIGNED'] };
      } else {
        where.action = action;
      }
    }

    if (entity) {
      where.entity = entity;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.systemAuditLog.count({ where }),
      this.prisma.systemAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true,
              position: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items = logs.map((log) => {
      let ip = log.ipAddress;
      if (!ip && log.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed && typeof parsed === 'object' && parsed.ipAddress) {
            ip = parsed.ipAddress;
          }
        } catch {
          // ignore
        }
      }
      return {
        ...log,
        ipAddress: ip,
      };
    });

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
      items,
    };
  }
}
