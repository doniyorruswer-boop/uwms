import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class RequestItemDto {
  @ApiPropertyOptional({ description: 'Ombordagi mavjud mahsulot ID si' })
  @IsString()
  @IsOptional()
  itemId?: string;

  @ApiProperty({ example: 'A4 Formatli qog‘oz (SvetoCopy)', description: 'Mahsulot nomi' })
  @IsString()
  @IsNotEmpty({ message: 'Mahsulot nomi kiritilishi shart!' })
  itemName: string;

  @ApiProperty({ example: 10, description: 'So‘ralayotgan miqdor' })
  @IsNumber()
  @Min(1, { message: 'Miqdor kamida 1 bo‘lishi kerak!' })
  quantity: number;

  @ApiPropertyOptional({ example: 'PACHKA', description: 'O‘lchov birligi' })
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
