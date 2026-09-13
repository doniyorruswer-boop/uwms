import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType = NotificationType.INFO;

  @IsOptional()
  @IsString()
  link?: string;
}

export class QueryNotificationsDto {
  @IsOptional()
  @IsString()
  isRead?: string; // 'true' or 'false'
}
