import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'OOO "Texno-Ta’minot Fayz"' })
  @IsNotEmpty({ message: 'Ta’minotchi korxona nomi kiritilishi shart' })
  @IsString()
  @MinLength(2, { message: 'Korxona nomi kamida 2 ta belgidan iborat bo‘lishi kerak' })
  name: string;

  @ApiPropertyOptional({ example: '305123456' })
  @IsOptional()
  @IsString()
  inn?: string;

  @ApiPropertyOptional({ example: 'SH-2026-042' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsString()
  contractDate?: string;

  @ApiPropertyOptional({ example: 'Karimov Anvar Saidovich' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@texno-fayz.uz' })
  @IsOptional()
  @IsEmail({}, { message: 'Elektron pochta formati noto‘g‘ri' })
  email?: string;

  @ApiPropertyOptional({ example: 'Universitet IT laboratoriyalari uchun kompyuter jihozlari yetkazib beruvchi' })
  @IsOptional()
  @IsString()
  notes?: string;
}
