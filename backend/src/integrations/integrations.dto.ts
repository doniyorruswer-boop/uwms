import { IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type HemisSyncMode = 'LIVE' | 'DEMO' | 'DEMO_STUB';

export type HemisStatusType =
  | 'CONNECTED'
  | 'DEMO'
  | 'DEMO_STUB'
  | 'CONFIGURED_BUT_STUB'
  | 'NOT_CONFIGURED'
  | 'CONNECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'ERROR';

export class HemisSyncDto {
  @ApiPropertyOptional({ description: 'Sinxronizatsiya rejimi', enum: ['LIVE', 'DEMO', 'DEMO_STUB'], default: 'LIVE' })
  @IsOptional()
  @IsIn(['LIVE', 'DEMO', 'DEMO_STUB'], { message: "mode faqat LIVE, DEMO yoki DEMO_STUB bo'lishi mumkin!" })
  mode?: HemisSyncMode;

  @ApiPropertyOptional({ description: 'Demo sinxronizatsiyani tasdiqlovchi bayroq', example: true })
  @IsOptional()
  @IsBoolean()
  forceDemo?: boolean;

  @ApiPropertyOptional({ description: 'HEMIS API URL manzili (ixtiyoriy, .env dan olish mumkin)', example: 'https://hemis.edu.uz/api/v1' })
  @IsOptional()
  @IsString()
  hemisApiUrl?: string;

  @ApiPropertyOptional({ description: 'HEMIS API kalit (ixtiyoriy, .env dan olish mumkin)' })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class HemisTestConnectionDto {
  @ApiPropertyOptional({ description: 'HEMIS API URL manzili (ixtiyoriy, .env dan olish mumkin)', example: 'https://hemis.edu.uz/api/v1' })
  @IsOptional()
  @IsString()
  hemisApiUrl?: string;

  @ApiPropertyOptional({ description: 'HEMIS API kalit (ixtiyoriy, .env dan olish mumkin)' })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class UzAsboExportQueryDto {
  @ApiPropertyOptional({ description: 'Eksport davri (YYYY-MM formatida)', example: '2026-09' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ description: 'Eksport turi', enum: ['movements', 'assets', 'summary'], default: 'summary' })
  @IsOptional()
  @IsIn(['movements', 'assets', 'summary'], { message: 'type faqat movements, assets yoki summary bo\'lishi mumkin!' })
  type?: 'movements' | 'assets' | 'summary';

  @ApiPropertyOptional({ description: 'Eksport formati', enum: ['json', 'xml'], default: 'json' })
  @IsOptional()
  @IsIn(['json', 'xml'], { message: 'format faqat json yoki xml bo\'lishi mumkin!' })
  format?: 'json' | 'xml';
}

