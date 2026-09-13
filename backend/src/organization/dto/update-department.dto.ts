import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, Matches } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({
    description: 'Fakultet, kafedra yoki bo‘lim nomi',
    example: 'Sun’iy Intellekt va Dasturiy Injiniring Kafedrasi',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Bo‘limning qisqa kodi',
    example: 'AI-SE',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Kod faqat katta lotin harflar, raqamlar va defisdan iborat bo‘lishi kerak' })
  code?: string;

  @ApiPropertyOptional({
    description: 'Bo‘lim turi: FACULTY, CHAIR, DIVISION, LAB',
    example: 'CHAIR',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Yuqori turuvchi fakultet ID si (bo‘shatish uchun null)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentId to‘g‘ri UUID bo‘lishi kerak' })
  parentId?: string | null;
}
