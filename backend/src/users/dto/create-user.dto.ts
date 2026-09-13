import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail, IsEnum, IsBoolean, Matches } from 'class-validator';
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

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

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
