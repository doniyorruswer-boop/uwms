import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetQuotaDto {
  @ApiProperty({ description: 'Kafedra ID si', example: 'uuid-department' })
  @IsNotEmpty({ message: 'Kafedra tanlanishi shart!' })
  @IsString()
  departmentId: string;

  @ApiProperty({ description: 'Mahsulot (Item) ID si', example: 'uuid-item' })
  @IsNotEmpty({ message: 'Mahsulot tanlanishi shart!' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'Oylik limit (miqdor)', example: 10 })
  @IsNotEmpty({ message: 'Oylik limit kiritilishi shart!' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit son bo\'lishi shart!' })
  @Min(1, { message: 'Limit kamida 1 bo\'lishi kerak!' })
  monthlyLimit: number;

  @ApiPropertyOptional({ description: 'Davr (YYYY-MM formatida, bo\'sh bo\'lsa joriy oy)', example: '2026-09' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ description: 'Qo\'shimcha izoh', example: 'Semestr uchun belgilangan limit' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateQuotaDto {
  @ApiPropertyOptional({ description: 'Yangilangan oylik limit', example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit son bo\'lishi shart!' })
  @Min(1, { message: 'Limit kamida 1 bo\'lishi kerak!' })
  monthlyLimit?: number;

  @ApiPropertyOptional({ description: 'Izoh', example: 'Rektorat maxsus ruxsati bilan oshirildi' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryQuotaDto {
  @ApiPropertyOptional({ description: 'Kafedra ID si bo\'yicha filtr' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Mahsulot ID si bo\'yicha filtr' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Davr bo\'yicha filtr (YYYY-MM)', example: '2026-09' })
  @IsOptional()
  @IsString()
  period?: string;
}

export class CheckQuotaDto {
  @ApiProperty({ description: 'Kafedra ID si', example: 'uuid-department' })
  @IsNotEmpty({ message: 'Kafedra ID si kiritilishi shart!' })
  @IsString()
  departmentId: string;

  @ApiProperty({ description: 'Mahsulot ID si', example: 'uuid-item' })
  @IsNotEmpty({ message: 'Mahsulot ID si kiritilishi shart!' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'So\'ralayotgan miqdor', example: 5 })
  @IsNotEmpty({ message: 'So\'ralayotgan miqdor kiritilishi shart!' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Miqdor son bo\'lishi shart!' })
  requestedQty: number;

  @ApiPropertyOptional({ description: 'Davr (YYYY-MM)', example: '2026-09' })
  @IsOptional()
  @IsString()
  period?: string;
}

