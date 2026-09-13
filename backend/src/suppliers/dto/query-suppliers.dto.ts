import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QuerySuppliersDto {
  @ApiPropertyOptional({ example: 'Texno' })
  @IsOptional()
  @IsString()
  search?: string;
}
