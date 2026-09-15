import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class RequestItemDto {
  @ApiProperty({ description: 'Ombor katalogidagi mavjud mahsulot ID si (majburiy)' })
  @IsString()
  @IsNotEmpty({ message: 'Mahsulot ID si (itemId) kiritilishi shart! Katalogdan tanlang.' })
  itemId: string;

  @ApiPropertyOptional({ example: 'A4 Formatli qog\'oz (SvetoCopy)', description: 'Mahsulot nomi (ixtiyoriy, faqat ma\'lumot uchun)' })
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

