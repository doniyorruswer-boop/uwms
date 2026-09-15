import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HemisSyncDto {
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

