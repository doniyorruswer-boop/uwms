import { IsString, IsNotEmpty, IsOptional, MinLength, Matches, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ description: 'Foydalanuvchi login nomi', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: 'Login kiritilishi shart' })
  username: string;

  @ApiProperty({ description: 'Foydalanuvchi paroli', example: 'admin123' })
  @IsString()
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Amaldagi Refresh Token', example: 'eyJhbGciOiJIUzI1Ni...' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token kiritilishi shart' })
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Amaldagi eski parol' })
  @IsString()
  @IsNotEmpty({ message: 'Eski parol kiritilishi shart' })
  oldPassword: string;

  @ApiProperty({
    description: 'Yangi xavfsiz parol (kamida 8 belgi, katta-kichik harf, raqam va maxsus belgi)',
    example: 'Uzbekistan2026!',
  })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo‘lishi shart' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-])[A-Za-z\d@$!%*?&#^_-]{8,}$/, {
    message:
      'Parol kuchli bo‘lishi shart: kamida 8 ta belgi, 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgi (@$!%*?&#^_-)',
  })
  newPassword: string;
}

export class CreateUserSecurityDto {
  @ApiProperty({ description: 'To‘liq F.I.Sh.', example: 'Karimov Jasur' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'Foydalanuvchi logini', example: 'jkarimov' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({ description: 'Elektron pochta manzili' })
  @IsOptional()
  @IsEmail({}, { message: 'To‘g‘ri elektron pochta manzilini kiriting' })
  email?: string;

  @ApiProperty({
    description: 'Boshlang‘ich xavfsiz parol (kuchli murakkablik siyosati)',
    example: 'SecurePass2026!',
  })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo‘lishi shart' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-])[A-Za-z\d@$!%*?&#^_-]{8,}$/, {
    message:
      'Parol xavfsizlik talablariga mos kelmadi: kamida 8 belgi, 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgi',
  })
  password: string;

  @ApiProperty({ enum: RoleType, description: 'Foydalanuvchi roli' })
  @IsEnum(RoleType)
  role: RoleType;

  @ApiPropertyOptional({ description: 'Lavozimi' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Biriktirilgan kafedra/fakultet ID si' })
  @IsOptional()
  @IsString()
  departmentId?: string;
}
