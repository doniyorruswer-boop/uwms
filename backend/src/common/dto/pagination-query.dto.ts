import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { BUSINESS_RULES } from '../constants';

/**
 * Standart Paginatsiya va Tartiblash DTO (Barcha so'rovlar uchun yagona baza)
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Sahifa raqami', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Sahifadagi elementlar soni', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BUSINESS_RULES.MAX_PAGE_LIMIT)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Qidiruv so‘zi (matn bo‘yicha)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Tartiblash ustuni', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Tartiblash yo‘nalishi', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
