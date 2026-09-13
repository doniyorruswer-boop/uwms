import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsUUID } from 'class-validator';

export class UpdateRoomDto {
  @ApiPropertyOptional({
    description: 'Xona yoki auditoriya raqami',
    example: '304-A',
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({
    description: 'Xonaning to‘liq nomi yoki maqsadi',
    example: 'Katta Ilmiy Laboratoriya',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Xona joylashgan qavat',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  floor?: number;

  @ApiPropertyOptional({
    description: 'Bino nomi yoki korpusi',
    example: 'Bosh bino',
  })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({
    description: 'Biriktirilgan fakultet yoki kafedra ID si (bo‘shatish uchun null)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId to‘g‘ri UUID bo‘lishi kerak' })
  departmentId?: string | null;

  @ApiPropertyOptional({
    description: 'Xonaga mas’ul etib tayinlangan xodim (MOL) ID si (bo‘shatish uchun null)',
    example: 'b1ffcd88-8b1c-3df7-aa5c-5aa8ac270b22',
  })
  @IsOptional()
  @IsUUID('4', { message: 'responsibleUserId to‘g‘ri UUID bo‘lishi kerak' })
  responsibleUserId?: string | null;
}
