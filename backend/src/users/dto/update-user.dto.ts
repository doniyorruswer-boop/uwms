import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEmail, IsEnum, IsBoolean, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Abdullayev Jasur Rustamovich' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'F.I.Sh. kamida 3 ta belgidan iborat bo\'lishi kerak' })
  fullName?: string;

  @ApiPropertyOptional({ example: 'abdullayev@univ.uz' })
  @IsOptional()
  @IsEmail({}, { message: 'Elektron pochta formati noto\'g\'ri' })
  email?: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'O‘zbekiston telefon raqami (+998XXXXXXXXX)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    let cleaned = value.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('998') && !cleaned.startsWith('+998')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  })
  @Matches(/^\+998[0-9]{9}$/, {
    message: 'Telefon raqami faqat O‘zbekiston shablonida bo‘lishi shart (masalan: +998 90 123 45 67 yoki +998901234567)',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'Kafedra mudiri' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ enum: RoleType })
  @IsOptional()
  @IsEnum(RoleType, { message: 'Noto\'g\'ri rol tanlandi' })
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

export class ToggleStatusDto {
  @ApiProperty({ example: true, description: 'Foydalanuvchi faollik holati (true = faol, false = nofaol)' })
  @IsNotEmpty({ message: 'isActive maydoni kiritilishi shart!' })
  @IsBoolean({ message: 'isActive boolean (true/false) bo\'lishi kerak!' })
  isActive: boolean;
}
