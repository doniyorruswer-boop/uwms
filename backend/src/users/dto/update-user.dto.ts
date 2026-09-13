import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEmail, IsEnum, IsBoolean } from 'class-validator';
import { RoleType } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Abdullayev Jasur Rustamovich' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'F.I.Sh. kamida 3 ta belgidan iborat bo‘lishi kerak' })
  fullName?: string;

  @ApiPropertyOptional({ example: 'abdullayev@univ.uz' })
  @IsOptional()
  @IsEmail({}, { message: 'Elektron pochta formati noto‘g‘ri' })
  email?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Kafedra mudiri' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ enum: RoleType })
  @IsOptional()
  @IsEnum(RoleType, { message: 'Noto‘g‘ri rol tanlandi' })
  role?: RoleType;

  @ApiPropertyOptional({ example: 'uuid-department-id' })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
