import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Joriy foydalanuvchining bildirishnomalari' })
  async getNotifications(@Request() req: any, @Query() query: QueryNotificationsDto) {
    const isRead = query.isRead !== undefined ? query.isRead === 'true' : undefined;
    return this.notificationsService.getUserNotifications(req.user.id, isRead);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Barcha bildirishnomalarni o‘qilgan deb belgilash' })
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Alohida bildirishnomani o‘qilgan deb belgilash' })
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }
}
