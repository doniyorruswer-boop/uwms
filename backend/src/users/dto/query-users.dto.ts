import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RoleType } from '@prisma/client';

export class QueryUsersDto {
  @ApiPropertyOptional({ description: 'F.I.Sh., login, email yoki telefon bo‘yicha qidiruv' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RoleType })
  @IsOptional()
  @IsEnum(RoleType)
  role?: RoleType;

  @ApiPropertyOptional({ enum: RoleType, isArray: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      if (value.includes(',')) {
        return value.split(',').map((s) => s.trim());
      }
      return [value];
    }
    return [value];
  })
  roles?: RoleType[];

  @ApiPropertyOptional({ description: 'Fakultet yoki kafedra ID si' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Foydalanuvchi faollik holati' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: 'O‘chirilgan foydalanuvchilarni ko‘rsatish' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  showDeleted?: boolean;
}
