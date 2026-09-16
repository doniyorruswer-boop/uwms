import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepairStatus } from '@prisma/client';

export class CreateRepairDto {
  @ApiProperty({ description: 'Asosiy vosita ID raqami' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ description: 'Nosozlik tavsifi' })
  @IsString()
  @IsNotEmpty()
  issueDescription: string;

  @ApiPropertyOptional({ description: 'Servis markazi yoki ustaxona nomi' })
  @IsString()
  @IsOptional()
  serviceProvider?: string;

  @ApiPropertyOptional({ description: 'Taxminiy yoki kelishilgan ta’mirlash xarajati' })
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional({ description: 'Qo‘shimcha izoh' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRepairStatusDto {
  @ApiProperty({ enum: RepairStatus, description: 'Yangi holat: PENDING, IN_REPAIR, COMPLETED, UNREPAIRABLE' })
  @IsEnum(RepairStatus)
  @IsNotEmpty()
  status: RepairStatus;

  @ApiPropertyOptional({ description: 'Servis ko‘rsatuvchi korxona/shaxs' })
  @IsString()
  @IsOptional()
  serviceProvider?: string;

  @ApiPropertyOptional({ description: 'Ta’mirlash xarajati' })
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional({ description: 'Rasmiy ta’mirlash dalolatnomasi raqami' })
  @IsString()
  @IsOptional()
  actNumber?: string;

  @ApiPropertyOptional({ description: 'Xulosa yoki izoh' })
  @IsString()
  @IsOptional()
  notes?: string;
}
