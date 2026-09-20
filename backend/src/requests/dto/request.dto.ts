import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsEnum } from 'class-validator';
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

  @ApiProperty({ type: [RequestItemDto], description: 'So‘ralayotgan mahsulotlar ro‘yxati' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items: RequestItemDto[];
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus, description: 'Yangi status' })
  @IsEnum(RequestStatus, { message: 'Noto‘g‘ri talabnoma holati!' })
  status: RequestStatus;

  @ApiPropertyOptional({ example: 'Ombordan berildi va qoldiqdan yechildi', description: 'Izoh / Sabab' })
  @IsString()
  @IsOptional()
  note?: string;
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
}


