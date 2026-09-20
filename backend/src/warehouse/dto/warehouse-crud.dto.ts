import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({
    description: 'Omborxona nomi',
    example: 'IT Jihozlar Omborxonasi',
  })
  @IsString()
  @IsNotEmpty({ message: 'Omborxona nomi kiritilishi shart' })
  name: string;

  @ApiPropertyOptional({
    description: 'Omborxona unikal kodi',
    example: 'WH-IT',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Omborxona joylashgan bino ID si',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'buildingId to‘g‘ri UUID bo‘lishi kerak' })
  buildingId?: string;

  @ApiPropertyOptional({
    description: 'Omborning bino ichidagi aniq joylashuvi (xona, qavat)',
    example: '1-bino yerto‘la, 004-xona',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Ombor mudiri (mas’ul shaxs) foydalanuvchi ID si',
    example: 'b1ffcd88-8b1c-3df7-aa5c-5aa8ac270b22',
  })
  @IsOptional()
  @IsUUID('4', { message: 'managerId to‘g‘ri UUID bo‘lishi kerak' })
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Universitetning asosiy markaziy ombori ekanligi',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}
