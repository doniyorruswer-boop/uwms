import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiProperty({ description: 'Qidiruv so‘zi (kamida 2 belgi)', minLength: 2 })
  @IsNotEmpty({ message: 'Qidiruv so‘zi bo‘sh bo‘lmasligi kerak' })
  @IsString()
  @MinLength(2, { message: 'Qidiruv uchun kamida 2 ta belgi kiriting' })
  q: string;

  @ApiPropertyOptional({ description: 'Natijalar maksimal soni (standart: 20)' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export type SearchResultType = 'ASSET' | 'ROOM' | 'USER' | 'REQUEST';

export class SearchResultItemDto {
  @ApiProperty({ enum: ['ASSET', 'ROOM', 'USER', 'REQUEST'] })
  type: SearchResultType;

  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  subtitle: string;

  @ApiProperty()
  href: string;

  @ApiPropertyOptional()
  badge?: string;
}
