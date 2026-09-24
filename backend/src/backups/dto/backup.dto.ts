import { IsOptional, IsString, IsNotEmpty, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BackupType, BackupStatus } from '@prisma/client';

export class CreateBackupDto {
  @ApiPropertyOptional({ example: 'Haftalik reja bo‘yicha to‘liq zaxira nusxasi', description: 'Zaxira nusxasiga izoh' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: true, description: 'Nusxani S3/MinIO bulutli xotirasiga ham yuborish' })
  @IsBoolean()
  @IsOptional()
  uploadToS3?: boolean;
}

export class RestoreBackupDto {
  @ApiProperty({ example: 'TIKLASH', description: 'Tasdiqlash kalit so‘zi' })
  @IsString()
  @IsNotEmpty({ message: 'Tiklash uchun tasdiqlash kiritilishi shart!' })
  confirmation: string;
}

export class QueryBackupDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: BackupType })
  @IsEnum(BackupType)
  @IsOptional()
  backupType?: BackupType;

  @ApiPropertyOptional({ enum: BackupStatus })
  @IsEnum(BackupStatus)
  @IsOptional()
  status?: BackupStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
