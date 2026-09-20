import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUUID } from 'class-validator';

export class CreateRoomDto {
  @ApiPropertyOptional({
    description: 'Xona yoki auditoriya raqami (raqamsiz bo‘lsa bo‘sh qoldirilishi mumkin)',
    example: '304',
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({
    description: 'Xonaning to‘liq nomi yoki maqsadi',
    example: 'Kompyuter Laboratoriyasi (Dasturlash)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Xona nomi kiritilishi shart' })
  name: string;

  @ApiProperty({
    description: 'Xona joylashgan qavat',
    example: 3,
    default: 1,
  })
  @IsInt({ message: 'Qavat butun son bo‘lishi kerak' })
  @Min(1, { message: 'Qavat kamida 1 bo‘lishi kerak' })
  floor: number;

  @ApiPropertyOptional({
    description: 'Bino ID si (Building modeli bilan bog‘lanish)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'buildingId to‘g‘ri UUID bo‘lishi kerak' })
  buildingId?: string;

  @ApiPropertyOptional({
    description: 'Bino nomi yoki korpusi (agar buildingId ko‘rsatilmasa)',
    example: 'Bosh bino',
    default: 'Bosh bino',
  })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({
    description: 'Biriktirilgan fakultet yoki kafedra ID si',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId to‘g‘ri UUID bo‘lishi kerak' })
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Xonaga mas’ul etib tayinlangan xodim (MOL) ID si',
    example: 'b1ffcd88-8b1c-3df7-aa5c-5aa8ac270b22',
  })
  @IsOptional()
  @IsUUID('4', { message: 'responsibleUserId to‘g‘ri UUID bo‘lishi kerak' })
  responsibleUserId?: string;
}
