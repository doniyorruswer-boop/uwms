import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class RequestItemDto {
  @ApiPropertyOptional({ description: 'Ombor katalogidagi mavjud mahsulot ID si (agar mavjud bo‘lsa)' })
  @IsString()
  @IsOptional()
  itemId?: string;

  @ApiPropertyOptional({ example: 'A4 Formatli qog\'oz (SvetoCopy)', description: 'Mahsulot nomi' })
  @IsString()
  @IsOptional()
  itemName?: string;

  @ApiProperty({ example: 10, description: 'So\'ralayotgan miqdor' })
  @IsNumber()
  @Min(1, { message: 'Miqdor kamida 1 bo\'lishi kerak!' })
  quantity: number;

  @ApiPropertyOptional({ example: 'PACHKA', description: 'O\'lchov birligi' })
  @IsString()
  @IsOptional()
  unit?: string;
}

export class CreateRequestDto {
  @ApiProperty({ example: 'Kafedra o‘quv jarayoni va oraliq nazoratlar uchun', description: 'Talabnoma maqsadi' })
  @IsString()
  @IsNotEmpty({ message: 'Talabnoma maqsadi kiritilishi shart!' })
  purpose: string;

  @ApiPropertyOptional({ description: 'Kafedra / Bo‘lim ID si' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Aktivlar joylashadigan xona ID si (agar xona uchun bo‘lsa)' })
  @IsString()
  @IsOptional()
  targetRoomId?: string;

  @ApiPropertyOptional({ description: 'Texnik ko‘rik (Injener) talab etiladimi?' })
  @IsOptional()
  @IsBoolean()
  requiresTechnicalInspection?: boolean;

  @ApiPropertyOptional({ description: 'Mas’ul Texnik Injener ID si' })
  @IsOptional()
  @IsString()
  assignedEngineerId?: string;

  @ApiProperty({ type: [RequestItemDto], description: 'So‘ralayotgan mahsulotlar ro‘yxati' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items: RequestItemDto[];
}

export class SubmitTechnicalInspectionDto {
  @ApiProperty({ description: '1. Qadoq va tashqi jismoniy butunligi tekshirildi' })
  @IsBoolean()
  packagingIntegrity: boolean;

  @ApiProperty({ description: '2. Komplektatsiya va butlovchi qismlar to‘liq' })
  @IsBoolean()
  completeness: boolean;

  @ApiProperty({ description: '3. Elektr va yong‘in xavfsizligi (Power-ON) sinovi' })
  @IsBoolean()
  powerSafety: boolean;

  @ApiProperty({ description: '4. Zavod seriya raqami (S/N) va kafolat muvofiqligi' })
  @IsBoolean()
  serialNumberMatch: boolean;

  @ApiProperty({ description: '5. Texnik parametrlar va shartnoma talablari mosligi' })
  @IsBoolean()
  specsCompliance: boolean;

  @ApiPropertyOptional({ example: 'S/N: DL-992182 sinovdan o‘tdi, to‘liq soz holatda', description: 'Texnik xulosa va qo‘shimcha izohlar' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus, description: 'Yangi status' })
  @IsEnum(RequestStatus, { message: 'Noto‘g‘ri talabnoma holati!' })
  status: RequestStatus;

  @ApiPropertyOptional({ example: 'Ombordan berildi va qoldiqdan yechildi', description: 'Izoh / Sabab' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: '123456', description: 'Google Authenticator 6 xonali 2FA kodi' })
  @IsString()
  @IsOptional()
  totpCode?: string;
}

export class QueryRequestsDto {
  @ApiPropertyOptional({ description: 'Qidiruv (talabnoma raqami yoki maqsadi bo‘yicha)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RequestStatus, description: 'Talabnoma holati bo‘yicha filtr' })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Kafedra ID si bo‘yicha filtr' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Sahifa raqami (default: 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Sahifadagi yozuvlar soni (default: 20)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Saralash ustuni (createdAt, requestNumber, status)', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Saralash tartibi (asc, desc)', example: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class FinanceWorkflowDto {
  @ApiProperty({ description: 'Moliyalashtirish manbasi (BYUDJET, KONTRAKT_RIVOJLANTIRISH, GRANT)' })
  @IsNotEmpty({ message: 'Moliyalashtirish manbasi kiritilishi shart!' })
  @IsString()
  fundingSource: string;

  @ApiProperty({ example: '013', description: 'Sub-hisob kodi (masalan: 013, 060, 212)' })
  @IsNotEmpty({ message: 'Sub-hisob kodi kiritilishi shart!' })
  @IsString()
  subAccountCode: string;

  @ApiPropertyOptional({ example: 4500000, description: 'Ajratilgan smeta summasi' })
  @IsOptional()
  @IsNumber()
  allocatedAmount?: number;

  @ApiPropertyOptional({ example: '2026-yil smetasi bo‘yicha tasdiqlandi', description: 'Bosh hisobchi izohi' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class HandoverWorkflowDto {
  @ApiPropertyOptional({ description: 'Bino komendanti ID si' })
  @IsOptional()
  @IsString()
  commendantId?: string;

  @ApiPropertyOptional({ example: 'Bosh bino komendantiga topshirildi', description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class FulfillWorkflowDto {
  @ApiPropertyOptional({ description: 'Yakuniy joylashtiriladigan xona ID si' })
  @IsOptional()
  @IsString()
  targetRoomId?: string;

  @ApiPropertyOptional({ example: '304-laboratoriyaga joylashtirildi va qabul qilindi', description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AttachContractDto {
  @ApiProperty({ example: 'AUCTION', description: 'Xarid turi (AUCTION, ELECTRONIC_SHOP, NATIONAL_SHOP, TENDER, DIRECT_CONTRACT)' })
  @IsNotEmpty({ message: 'Xarid turi tanlanishi shart!' })
  @IsString()
  procurementType: string;

  @ApiProperty({ example: '1428579', description: 'Davlat xaridlari maxsus portali lot raqami' })
  @IsNotEmpty({ message: 'Lot raqami kiritilishi shart!' })
  @IsString()
  lotNumber: string;

  @ApiProperty({ example: 'SH-2026-089', description: 'Rasmiy shartnoma raqami' })
  @IsNotEmpty({ message: 'Shartnoma raqami kiritilishi shart!' })
  @IsString()
  contractNumber: string;

  @ApiProperty({ example: '2026-11-15', description: 'Shartnoma tuzilgan sana' })
  @IsNotEmpty({ message: 'Shartnoma sanasi kiritilishi shart!' })
  @IsString()
  contractDate: string;

  @ApiProperty({ example: 45000000, description: 'Shartnoma bo‘yicha yakuniy summa (so‘m)' })
  @IsNumber()
  @Min(0, { message: 'Summa 0 dan kam bo‘lishi mumkin emas!' })
  contractAmount: number;

  @ApiProperty({ example: 'OOO "Texno-Ta’minot Fayz"', description: 'G‘olib yetkazib beruvchi nomi' })
  @IsNotEmpty({ message: 'Yetkazib beruvchi korxona nomi kiritilishi shart!' })
  @IsString()
  supplierName: string;

  @ApiProperty({ example: '305123456', description: 'Yetkazib beruvchi STIR / INN raqami' })
  @IsNotEmpty({ message: 'Yetkazib beruvchi INN raqami kiritilishi shart!' })
  @IsString()
  supplierInn: string;

  @ApiPropertyOptional({ description: 'Yetkazib beruvchi ID si (agar tizimda mavjud bo‘lsa)' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'xarid.uzex.uz auksionida g‘olib aniqlandi va shartnoma imzolandi', description: 'Qo‘shimcha izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class WorkflowAdvanceDto {
  @ApiProperty({ enum: RequestStatus, description: 'Keyingi o‘tish statusi' })
  @IsEnum(RequestStatus)
  status: RequestStatus;

  @ApiPropertyOptional({ description: 'Izoh yoki sabab' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Moliyalashtirish manbasi' })
  @IsOptional()
  @IsString()
  fundingSource?: string;

  @ApiPropertyOptional({ description: 'Sub-hisob kodi' })
  @IsOptional()
  @IsString()
  subAccountCode?: string;

  @ApiPropertyOptional({ description: 'Ajratilgan summa' })
  @IsOptional()
  @IsNumber()
  allocatedAmount?: number;

  @ApiPropertyOptional({ description: 'Komendant ID si' })
  @IsOptional()
  @IsString()
  commendantId?: string;

  @ApiPropertyOptional({ description: 'Xona ID si' })
  @IsOptional()
  @IsString()
  targetRoomId?: string;

  @ApiPropertyOptional({ description: 'Xarid turi' })
  @IsOptional()
  @IsString()
  procurementType?: string;

  @ApiPropertyOptional({ description: 'Lot raqami' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Shartnoma raqami' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ description: 'Shartnoma sanasi' })
  @IsOptional()
  @IsString()
  contractDate?: string;

  @ApiPropertyOptional({ description: 'Shartnoma summasi' })
  @IsOptional()
  @IsNumber()
  contractAmount?: number;

  @ApiPropertyOptional({ description: 'Yetkazib beruvchi nomi' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Yetkazib beruvchi INN si' })
  @IsOptional()
  @IsString()
  supplierInn?: string;

  @ApiPropertyOptional({ description: 'Yetkazib beruvchi ID si' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: '123456', description: 'Google Authenticator 6 xonali 2FA kodi' })
  @IsOptional()
  @IsString()
  totpCode?: string;
}


