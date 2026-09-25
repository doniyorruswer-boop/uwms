import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail, IsEnum, IsBoolean, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'Abdullayev Jasur Rustamovich' })
  @IsNotEmpty({ message: 'F.I.Sh. kiritilishi shart' })
  @IsString()
  @MinLength(3, { message: 'F.I.Sh. kamida 3 ta belgidan iborat bo‘lishi kerak' })
  fullName: string;

  @ApiProperty({ example: 'j_abdullayev' })
  @IsNotEmpty({ message: 'Foydalanuvchi nomi (login) kiritilishi shart' })
  @IsString()
  @MinLength(3, { message: 'Login kamida 3 ta belgidan iborat bo‘lishi kerak' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'Login faqat lotin harflari, raqamlar va _ . - belgilaridan iborat bo‘lishi kerak' })
  username: string;

  @ApiProperty({ example: 'Parol123!' })
  @IsNotEmpty({ message: 'Boshlang‘ich parol kiritilishi shart' })
  @IsString()
  @MinLength(6, { message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak' })
  password: string;

  @ApiPropertyOptional({ example: 'abdullayev@univ.uz' })
  @IsOptional()
  @IsEmail({}, { message: 'Elektron pochta formati noto‘g‘ri' })
  email?: string;

  @ApiProperty({ example: '+998901234567', description: 'O‘zbekiston telefon raqami (+998XXXXXXXXX)' })
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi shart' })
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
  phone: string;

  @ApiPropertyOptional({ example: 'Kafedra mudiri' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({ enum: RoleType, default: RoleType.EMPLOYEE })
  @IsNotEmpty({ message: 'Foydalanuvchi roli tanlanishi shart' })
  @IsEnum(RoleType, { message: 'Noto‘g‘ri rol tanlandi' })
  role: RoleType;

  @ApiPropertyOptional({ example: 'uuid-department-id' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
