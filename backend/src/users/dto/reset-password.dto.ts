import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches, IsOptional, IsBoolean } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'YangiParol2026!',
    description: 'Yangi xavfsiz parol (kamida 8 ta belgi, 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgi)',
  })
  @IsNotEmpty({ message: 'Yangi parol kiritilishi shart' })
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo‘lishi shart' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-])[A-Za-z\d@$!%*?&#^_-]{8,}$/, {
    message:
      'Parol kuchli bo‘lishi shart: kamida 8 ta belgi, 1 ta katta harf, 1 ta kichik harf, 1 ta raqam va 1 ta maxsus belgi (@$!%*?&#^_-)',
  })
  newPassword: string;

  @ApiPropertyOptional({
    description: 'Foydalanuvchi birinchi kirishda parolni o‘zgartirishi shartmi',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
