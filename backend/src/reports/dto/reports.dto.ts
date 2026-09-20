import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FundingSource } from '@prisma/client';

export class FundingSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Tugash sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Kafedra yoki bo‘lim ID si' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: FundingSource, description: 'Moliyalashtirish manbasi' })
  @IsOptional()
  @IsEnum(FundingSource, { message: 'Noto‘g‘ri moliyalashtirish manbasi!' })
  fundingSource?: FundingSource;
}

export class FundingMovementsQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Tugash sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Kafedra yoki bo‘lim ID si' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: FundingSource, description: 'Moliyalashtirish manbasi' })
  @IsOptional()
  @IsEnum(FundingSource, { message: 'Noto‘g‘ri moliyalashtirish manbasi!' })
  fundingSource?: FundingSource;

  @ApiPropertyOptional({ description: 'Harakat turi (INCOMING, OUTGOING, va h.k.)' })
  @IsOptional()
  @IsString()
  movementType?: string;

  @ApiPropertyOptional({ default: 1, description: 'Sahifa raqami' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Har bir sahifadagi elementlar soni' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export class FundingExportQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Tugash sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Kafedra yoki bo‘lim ID si' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: FundingSource, description: 'Moliyalashtirish manbasi' })
  @IsOptional()
  @IsEnum(FundingSource, { message: 'Noto‘g‘ri moliyalashtirish manbasi!' })
  fundingSource?: FundingSource;

  @ApiPropertyOptional({ enum: ['assets', 'movements', 'summary'], default: 'assets', description: 'Hisobot predmeti' })
  @IsOptional()
  @IsString()
  type?: 'assets' | 'movements' | 'summary' = 'assets';

  @ApiPropertyOptional({ enum: ['xlsx', 'csv'], default: 'xlsx', description: 'Eksport formati' })
  @IsOptional()
  @IsString()
  format?: 'xlsx' | 'csv' = 'xlsx';
}
