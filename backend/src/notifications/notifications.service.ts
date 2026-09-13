import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './notification.dto';
import { NotificationType, RoleType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type || NotificationType.INFO,
        link: dto.link || null,
      },
    });
  }

  async notifyRole(
    role: RoleType,
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
    link?: string,
  ) {
    try {
      const users = await this.prisma.user.findMany({
        where: { role, isActive: true },
        select: { id: true },
      });

      if (users.length === 0) return;

      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          title,
          message,
          type,
          link: link || null,
        })),
      });
    } catch (error) {
      this.logger.error(`Failed to notify role ${role}`, error);
    }
  }

  async getUserNotifications(userId: string, isRead?: boolean) {
    const where: any = { userId };
    if (typeof isRead === 'boolean') {
      where.isRead = isRead;
    }

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      unreadCount,
      items,
    };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
