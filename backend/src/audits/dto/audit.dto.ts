import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class StartAuditDto {
  @ApiProperty({ description: 'Inventarizatsiya o‘tkazilayotgan xona ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Xona tanlanishi shart!' })
  roomId: string;

  @ApiProperty({ description: 'Bog‘langan kampaniya ID si (ixtiyoriy)', required: false })
  @IsOptional()
  @IsString()
  campaignId?: string;
}

export class ScanCodeDto {
  @ApiProperty({ description: 'Xona ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Xona ID si kiritilishi shart!' })
  roomId: string;

  @ApiProperty({ example: 'UWMS:INV-2026-001:SN-LN-88123', description: 'Skaner qilingan QR-kod matni' })
  @IsString()
  @IsNotEmpty({ message: 'QR-kod bo‘sh bo‘lishi mumkin emas!' })
  qrCode: string;

  @ApiProperty({ description: 'Bog‘langan kampaniya ID si (ixtiyoriy)', required: false })
  @IsOptional()
  @IsString()
  campaignId?: string;
}

export class BatchScanItemDto {
  @ApiProperty({ description: 'Xona ID si (ixtiyoriy, agar audit sessiyasi ko‘rsatilgan bo‘lsa)', required: false })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ example: 'UWMS:INV-2026-001:SN-LN-88123', description: 'Skaner qilingan QR-kod matni' })
  @IsString()
  @IsNotEmpty({ message: 'QR-kod bo‘sh bo‘lishi mumkin emas!' })
  qrCode: string;

  @ApiProperty({ description: 'Bog‘langan kampaniya ID si (ixtiyoriy)', required: false })
  @IsOptional()
  @IsString()
  campaignId?: string;
}

export class BatchScanDto {
  @ApiProperty({ type: [BatchScanItemDto], description: 'Oflayn navbatdan yuborilgan skanlar ro‘yxati' })
  @IsArray({ message: 'Skanlar ro‘yxati massiv bo‘lishi shart!' })
  @ValidateNested({ each: true })
  @Type(() => BatchScanItemDto)
  items: BatchScanItemDto[];
}

export class CompleteAuditDto {
  @ApiProperty({ example: 'Barcha jihozlar tekshirildi, kamomad bo‘yicha INV-19 shakllantirildi', description: 'Audit yakunlash bo‘yicha izoh', required: false })
  @IsString()
  notes?: string;
}

