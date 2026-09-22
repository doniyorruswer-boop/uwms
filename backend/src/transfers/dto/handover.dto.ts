import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  HandoverType,
  HandoverStatus,
  HandoverItemActionType,
} from '@prisma/client';

export class HandoverItemActionInputDto {
  @ApiProperty({ description: 'Asosiy vosita (ItemInstance) ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Asosiy vosita ID si kiritilishi shart' })
  itemInstanceId: string;

  @ApiProperty({
    enum: HandoverItemActionType,
    description: 'Aktiv harakati turi (TRANSFER_TO_MOL, RETURN_TO_WAREHOUSE, SEND_TO_REPAIR, WRITE_OFF, SHORTAGE)',
  })
  @IsEnum(HandoverItemActionType, { message: 'Aktiv harakati turi noto‘g‘ri' })
  actionType: HandoverItemActionType;

  @ApiPropertyOptional({ description: 'Yangi qabul qiluvchi xodim ID si (agar TRANSFER_TO_MOL bo‘lsa)' })
  @IsString()
  @IsOptional()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'Qabul qiluvchi ombor ID si (agar RETURN_TO_WAREHOUSE bo‘lsa)' })
  @IsString()
  @IsOptional()
  targetWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Jihozning jismoniy holati (Soz / Siniq / Topilmadi va h.k.)' })
  @IsString()
  @IsOptional()
  conditionNote?: string;

  @ApiPropertyOptional({ description: 'Kamomad (SHORTAGE) aniqlanganda komissiya xulosasi yoki tushuntirish' })
  @IsString()
  @IsOptional()
  investigationNote?: string;
}

export class CreateResponsibilityHandoverDto {
  @ApiProperty({
    enum: HandoverType,
    description: 'Topshirish turi (FULL_TRANSFER, PARTIAL_TRANSFER, ROOM_TRANSFER, RETURN_TO_WAREHOUSE, FINAL_CLEARANCE)',
  })
  @IsEnum(HandoverType, { message: 'Topshirish turi noto‘g‘ri' })
  type: HandoverType;

  @ApiProperty({ description: 'Topshiruvchi mas’ul shaxs (Eski MOL) ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Topshiruvchi shaxs tanlanishi shart' })
  departingUserId: string;

  @ApiPropertyOptional({ description: 'Qabul qiluvchi yangi mas’ul shaxs (Yangi MOL) ID si' })
  @IsString()
  @IsOptional()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'Qabul qiluvchi ombor ID si (agar omborga qaytarilsa)' })
  @IsString()
  @IsOptional()
  targetWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Bino ID si' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Bino komendanti ID si' })
  @IsString()
  @IsOptional()
  commandantUserId?: string;

  @ApiPropertyOptional({ description: 'Moddiy hisobchi (Buxgalteriya vakili) ID si' })
  @IsString()
  @IsOptional()
  accountantUserId?: string;

  @ApiPropertyOptional({ description: 'Xona ID si (agar ROOM_TRANSFER bo‘lsa)' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Topshirish asosi / buyruq / izoh' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Qoralama (DRAFT) holatida saqlash' })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @ApiProperty({
    type: [HandoverItemActionInputDto],
    description: 'Topshirilayotgan ashyolar va ularning individual taqdiri',
  })
  @IsArray({ message: 'Ashyolar ro‘yxati massiv bo‘lishi kerak' })
  @ValidateNested({ each: true })
  @Type(() => HandoverItemActionInputDto)
  items: HandoverItemActionInputDto[];
}

export class SignHandoverDto {
  @ApiPropertyOptional({ description: 'Tasdiqlash PIN kodi yoki raqamli imzo kodi' })
  @IsString()
  @IsOptional()
  pin?: string;

  @ApiPropertyOptional({ description: 'Imzolovchi izohi' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectHandoverDto {
  @ApiProperty({ description: 'Rad etish sababi' })
  @IsString()
  @IsNotEmpty({ message: 'Rad etish sababi ko‘rsatilishi shart' })
  reason: string;
}

export class CancelHandoverDto {
  @ApiPropertyOptional({ description: 'Bekor qilish sababi' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class QueryHandoversDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: HandoverType })
  @IsOptional()
  @IsEnum(HandoverType)
  type?: HandoverType;

  @ApiPropertyOptional({ enum: HandoverStatus })
  @IsOptional()
  @IsEnum(HandoverStatus)
  status?: HandoverStatus;

  @ApiPropertyOptional({ description: 'Topshiruvchi xodim ID si' })
  @IsOptional()
  @IsString()
  departingUserId?: string;

  @ApiPropertyOptional({ description: 'Qabul qiluvchi xodim ID si' })
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'Bino ID si' })
  @IsOptional()
  @IsString()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Qidiruv so‘zi (dalolatnoma raqami yoki xodim ismi)' })
  @IsOptional()
  @IsString()
  search?: string;
}
