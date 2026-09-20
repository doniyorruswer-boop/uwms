import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateArchiveDto {
  @ApiProperty({ example: 'OS_2', description: 'Hujjat turi (OS_1, OS_2, OS_4, INV_19, MOL_TRANSFER, RETURN)' })
  @IsString()
  @IsNotEmpty()
  docType: string;

  @ApiProperty({ example: 'req-uuid-123', description: 'Bog‘langan obyekt ID si' })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiProperty({ example: 'OS2-2026-0042', description: 'Hujjat raqami' })
  @IsString()
  @IsNotEmpty()
  docNumber: string;

  @ApiProperty({ example: 'OS-2 Chiqim Yuk Xati', description: 'Hujjat sarlavhasi' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Hujjat rekvizitlari, buyumlar ro‘yxati, tomonlar' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Ixtiyoriy oldindan tayyorlangan HTML/kontent snapshot' })
  @IsOptional()
  @IsString()
  htmlContent?: string;
}

export class CancelArchiveDto {
  @ApiProperty({ example: 'Hujjat xatolik tufayli bekor qilindi', description: 'Bekor qilish sababi' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class QueryArchiveDto {
  @ApiPropertyOptional({ description: 'Entity ID bo‘yicha filter' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Hujjat turi bo‘yicha filter' })
  @IsOptional()
  @IsString()
  docType?: string;

  @ApiPropertyOptional({ description: 'Hujjat raqami bo‘yicha filter' })
  @IsOptional()
  @IsString()
  docNumber?: string;
}
