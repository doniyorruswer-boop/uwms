import { IsOptional, IsString } from 'class-validator';

export class HemisSyncDto {
  @IsOptional()
  @IsString()
  hemisApiUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class UzAsboExportQueryDto {
  @IsOptional()
  @IsString()
  period?: string; // YYYY-MM masalan "2026-09"

  @IsOptional()
  @IsString()
  type?: 'movements' | 'assets' | 'summary' = 'summary';

  @IsOptional()
  @IsString()
  format?: 'json' | 'xml' = 'json';
}
