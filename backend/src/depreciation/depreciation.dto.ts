import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RunDepreciationDto {
  @ApiProperty({
    example: '2026-09',
    description: 'Amortizatsiya hisoblanadigan davr (YYYY-MM formatida)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Davr (period) kiritilishi shart!' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Davr formati YYYY-MM ko‘rinishida bo‘lishi shart (masalan: 2026-09)!',
  })
  period: string;

  @ApiPropertyOptional({
    description: 'Faqat ma’lum kategoriyalar uchun hisoblash (ixtiyoriy)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Izoh yoki dalolatnoma asosi',
    example: '2026-yil sentabr oyi uchun rejali OTM oylik amortizatsiyasi',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Dry run (sinov rejimi - bazani o‘zgartirmasdan prognoz qaytaradi)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class PreviewDepreciationDto {
  @ApiProperty({
    example: '2026-09',
    description: 'Prognoz qilinadigan davr (YYYY-MM formatida)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Davr (period) kiritilishi shart!' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Davr formati YYYY-MM ko‘rinishida bo‘lishi shart (masalan: 2026-09)!',
  })
  period: string;

  @ApiPropertyOptional({
    description: 'Faqat ma’lum kategoriyalar bo‘yicha filtr',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}

export class DepreciationQueryDto {
  @ApiPropertyOptional({ example: '2026-09', description: 'Davr bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ description: 'Qidiruv (partiya raqami, izoh)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
