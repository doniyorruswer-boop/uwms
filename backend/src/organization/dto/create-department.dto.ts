import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Fakultet, kafedra yoki bo‘lim nomi',
    example: 'Raqamli Iqtisodiyot va IT Fakulteti',
  })
  @IsString({ message: 'Bo‘lim nomi matn bo‘lishi kerak' })
  @IsNotEmpty({ message: 'Bo‘lim nomi kiritilishi shart' })
  name: string;

  @ApiPropertyOptional({
    description: 'Bo‘limning qisqa kodi (unikal)',
    example: 'RI-IT',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Kod faqat katta lotin harflar, raqamlar va defisdan iborat bo‘lishi kerak' })
  code?: string;

  @ApiPropertyOptional({
    description: 'Bo‘lim turi: FACULTY, CHAIR, DIVISION, LAB',
    example: 'FACULTY',
    default: 'CHAIR',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Yuqori turuvchi fakultet yoki bosh bo‘lim ID si (ixtiyoriy)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentId to‘g‘ri UUID bo‘lishi kerak' })
  parentId?: string;
}
