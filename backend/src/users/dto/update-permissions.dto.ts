import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdatePermissionsDto {
  @ApiProperty({
    description: 'Foydalanuvchiga berilgan granular huquqlar (permission codes) ro‘yxati',
    example: ['page:assets', 'assets:read', 'assets:create', 'page:warehouse', 'warehouse:read'],
    type: [String],
  })
  @IsArray({ message: 'permissions massiv bo‘lishi kerak' })
  @IsString({ each: true, message: 'Har bir ruxsat kodi matn (string) bo‘lishi shart' })
  permissions: string[];
}
