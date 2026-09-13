import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetQuotaDto {
  @IsNotEmpty()
  @IsString()
  departmentId: string;

  @IsNotEmpty()
  @IsString()
  itemId: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  monthlyLimit: number;

  @IsOptional()
  @IsString()
  period?: string; // Format: "YYYY-MM", defaults to current month

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateQuotaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  monthlyLimit?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryQuotaDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  period?: string;
}

export class CheckQuotaDto {
  @IsNotEmpty()
  @IsString()
  departmentId: string;

  @IsNotEmpty()
  @IsString()
  itemId: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  requestedQty: number;

  @IsOptional()
  @IsString()
  period?: string;
}
