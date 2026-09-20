import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QuerySuppliersDto {
  @ApiPropertyOptional({ example: 'Texno' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'O‘chirilgan ta’minotchilarni ko‘rsatish' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  showDeleted?: boolean;
}
