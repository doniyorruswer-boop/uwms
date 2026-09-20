import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum FundingSourceFilter {
  ALL = 'ALL',
  BYUDJET = 'BYUDJET',
  KONTRAKT_RIVOJLANTIRISH = 'KONTRAKT_RIVOJLANTIRISH',
  GRANT = 'GRANT',
}

export enum SubAccountFilter {
  ALL = 'ALL',
  ACC_010 = '010', // Bino va inshootlar
  ACC_013 = '013', // Mashina va asbob-uskunalar (Kompyuter, texnika, laboratoriya)
  ACC_015 = '015', // Transport vositalari
  ACC_016 = '016', // Boshqa asosiy vositalar (Mebel va ofis jihozlari)
  ACC_071 = '071', // O‘rnatiladigan asbob-uskunalar va moddiy sarf zaxiralari
  ACC_060 = '060', // Materiallar va xo‘jalik sarf tovarlari
  ACC_212 = '212', // Boshqa xo‘jalik va inventar jihozlari
}

export enum StateExportFormat {
  EXCEL = 'excel',
  EXCEL_3SHEET = 'EXCEL_3SHEET',
  UZASBO = 'uzasbo',
  UZASBO_XML = 'UZASBO_XML',
  ONE_C = '1c',
  ONE_C_XML = '1C_ENTERPRISE_XML',
}

export class ChiefAccountantReceiptsQueryDto {
  @ApiPropertyOptional({ description: 'Davr (YYYY-MM formati, masalan: 2026-09)' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ enum: FundingSourceFilter, description: 'Moliyalashtirish manbasi filtri' })
  @IsOptional()
  @IsString()
  fundingSource?: string;

  @ApiPropertyOptional({ enum: SubAccountFilter, description: 'Sub-hisob kodi filtri' })
  @IsOptional()
  @IsString()
  subAccountCode?: string;

  @ApiPropertyOptional({ description: 'Qidiruv so‘zi (tovar nomi, ta’minotchi, hujjat raqami)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sahifa raqami', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Sahifadagi yozuvlar soni', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class ChiefAccountantHandoverQueryDto {
  @ApiPropertyOptional({ description: 'Kafedra yoki bo‘lim ID si' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Moddiy javobgar shaxs (MOL) ID si' })
  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @ApiPropertyOptional({ description: 'Qidiruv (MOL ismi, kafedra nomi)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sahifa raqami', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Sahifadagi yozuvlar soni', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class ChiefAccountantExportDto {
  @ApiPropertyOptional({ description: 'Davr (YYYY-MM formati, masalan: 2026-09)' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ enum: StateExportFormat, description: 'Eksport formati: excel, uzasbo, 1c', default: 'excel' })
  @IsOptional()
  @IsEnum(StateExportFormat)
  format?: StateExportFormat = StateExportFormat.EXCEL;

  @ApiPropertyOptional({ enum: FundingSourceFilter, description: 'Moliyalashtirish manbasi filtri' })
  @IsOptional()
  @IsString()
  fundingSource?: string;

  @ApiPropertyOptional({ enum: SubAccountFilter, description: 'Sub-hisob kodi filtri' })
  @IsOptional()
  @IsString()
  subAccountCode?: string;
}
