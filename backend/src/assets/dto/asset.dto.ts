import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TransferStatus = ['ACCEPTED', 'REJECTED'] as const;
type TransferStatusType = typeof TransferStatus[number];


export class CreateAssetDto {
  @ApiProperty({ example: 'Lenovo ThinkCentre M70q', description: 'Asosiy vosita nomi' })
  @IsString()
  @IsNotEmpty({ message: 'Aktiv nomi kiritilishi shart!' })
  itemName: string;

  @ApiPropertyOptional({ example: 'M70q Gen 3', description: 'Modeli' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'Kompyuter va IT uskunalari', description: 'Kategoriya nomi' })
  @IsString()
  @IsOptional()
  categoryName?: string;

  @ApiProperty({ example: 'INV-2026-088', description: 'Noyob universitet inventar raqami' })
  @IsString()
  @IsNotEmpty({ message: 'Inventar raqam kiritilishi shart!' })
  inventoryNumber: string;

  @ApiPropertyOptional({ example: 'SN-LN-99238', description: 'Zavod seriya raqami' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 8500000, description: 'Boshlang‘ich balans qiymati (so‘m)' })
  @IsNumber({}, { message: 'Xarid narxi son bo‘lishi shart!' })
  @Min(0, { message: 'Narx 0 dan kichik bo‘lishi mumkin emas!' })
  @IsOptional()
  purchasePrice?: number;

  @ApiPropertyOptional({ description: 'Joylashtiriladigan xona ID si' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Ta’minotchi korxona ID si' })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ example: 24, description: 'Kafolat muddati (oylarda)' })
  @IsNumber()
  @IsOptional()
  warrantyMonths?: number;
}

export class TransferAssetDto {
  @ApiProperty({ description: 'Ko‘chirilayotgan maqsad xona ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Maqsad xona tanlanishi shart!' })
  toRoomId: string;

  @ApiPropertyOptional({ example: 'Kafedra kabinetiga taqsimlash', description: 'Ko‘chirish sababi / asosi' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class BatchTransferAssetDto {
  @ApiProperty({ type: [String], description: 'Ko‘chirilayotgan uskunalar ID lari massivi' })
  @IsArray({ message: 'assetIds massiv bo‘lishi shart!' })
  @IsNotEmpty({ message: 'Kamida bitta uskuna tanlanishi shart!' })
  @IsString({ each: true, message: 'Har bir uskuna ID si string bo‘lishi kerak!' })
  assetIds: string[];

  @ApiProperty({ description: 'Maqsad xona ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Maqsad xona tanlanishi shart!' })
  toRoomId: string;

  @ApiPropertyOptional({ description: 'Ko‘chirish sababi' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class WriteOffAssetDto {
  @ApiProperty({ example: 'Texnik komissiya xulosasiga binoan yaroqsiz', description: 'Hisobdan chiqarish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Hisobdan chiqarish sababi kiritilishi shart!' })
  reason: string;
}

export class RespondTransferDto {
  @ApiProperty({ example: 'ACCEPTED', enum: ['ACCEPTED', 'REJECTED'], description: 'Qabul qilish yoki rad etish' })
  @IsEnum(TransferStatus, { message: 'Holat faqat ACCEPTED yoki REJECTED bo‘lishi mumkin!' })
  status: TransferStatusType;

  @ApiPropertyOptional({ description: 'Izoh yoki sabab' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class ImportExcelAssetRowDto {
  @ApiProperty({ example: 'Lenovo ThinkCentre M70q' })
  @IsString()
  @IsNotEmpty({ message: 'Aktiv nomi kiritilishi shart!' })
  itemName: string;

  @ApiPropertyOptional({ example: 'M70q Gen 3' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'Kompyuter va IT uskunalari' })
  @IsString()
  @IsOptional()
  categoryName?: string;

  @ApiPropertyOptional({ example: 'INV-2026-00045' })
  @IsString()
  @IsOptional()
  inventoryNumber?: string;

  @ApiPropertyOptional({ example: 'SN-LN-99238' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 8500000 })
  @IsNumber()
  @IsOptional()
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 'BYUDJET', enum: ['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'] })
  @IsString()
  @IsOptional()
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';

  @ApiPropertyOptional({ example: '304', description: 'Xona raqami yoki ID si' })
  @IsString()
  @IsOptional()
  roomNumber?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsNumber()
  @IsOptional()
  warrantyMonths?: number;
}

export class ImportExcelAssetsDto {
  @ApiProperty({ type: [ImportExcelAssetRowDto] })
  @IsArray({ message: 'Qatorlar massiv bo‘lishi shart!' })
  @IsNotEmpty({ message: 'Import qilish uchun kamida bitta qator bo‘lishi shart!' })
  @ValidateNested({ each: true })
  @Type(() => ImportExcelAssetRowDto)
  rows: ImportExcelAssetRowDto[];
}

export class ReturnAssetDto {
  @ApiProperty({ description: 'Qaytarilayotgan asosiy vosita ID raqami' })
  @IsString()
  @IsNotEmpty({ message: 'Asosiy vosita tanlanishi shart!' })
  assetId: string;

  @ApiPropertyOptional({ description: 'Qabul qiluvchi ombor ID si (bo‘sh bo‘lsa asosiy ombor tanlanadi)' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiProperty({ example: 'Ortiqcha uskuna, laboratoriya yangilandi', description: 'Qaytarish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Qaytarish sababi ko‘rsatilishi shart!' })
  reason: string;

  @ApiPropertyOptional({ description: 'Qo‘shimcha izoh yoki ashyo holati' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class MassMolHandoffDto {
  @ApiProperty({ description: 'Hozirgi mas’ul shaxs (topshiruvchi) ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Topshiruvchi mas’ul shaxs tanlanishi shart!' })
  fromUserId: string;

  @ApiProperty({ description: 'Yangi mas’ul shaxs (qabul qiluvchi) ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Qabul qiluvchi yangi mas’ul shaxs tanlanishi shart!' })
  toUserId: string;

  @ApiPropertyOptional({ description: 'Muayyan xona ID si (agar faqat 1 xona topshirilayotgan bo‘lsa)' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ example: 'Kafedra mudiri o‘zgarishi munosabati bilan barcha moddiy ashyolarni topshirish', description: 'Yalpi topshirish asosi / buyruq raqami' })
  @IsString()
  @IsOptional()
  note?: string;
}



