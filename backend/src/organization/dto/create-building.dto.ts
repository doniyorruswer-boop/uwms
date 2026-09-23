import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsUUID, IsArray } from 'class-validator';

export class CreateBuildingDto {
  @ApiProperty({
    description: 'Bino yoki korpusning to‘liq rasmiy nomi',
    example: '1-o‘quv binosi',
  })
  @IsString()
  @IsNotEmpty({ message: 'Bino nomi kiritilishi shart' })
  name: string;

  @ApiPropertyOptional({
    description: 'Bino unikal kodi yoki qisqartmasi',
    example: 'B1',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Bino qavatlari soni',
    example: 4,
    default: 4,
  })
  @IsOptional()
  @IsInt({ message: 'Qavatlar soni butun son bo‘lishi kerak' })
  @Min(1, { message: 'Qavatlar soni kamida 1 bo‘lishi kerak' })
  @Max(50, { message: 'Qavatlar soni 50 dan oshmasligi kerak' })
  floorsCount?: number;

  @ApiPropertyOptional({
    description: 'Bino joylashgan jismoniy manzil',
    example: 'Toshkent sh., Universitet ko‘chasi, 2-uy',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Bino haqida qo‘shimcha ma’lumot',
    example: 'Axborot texnologiyalari va dasturiy injiniring korpusi',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Bino komendanti (mas’ul shaxs) foydalanuvchi ID si',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'commendantId to‘g‘ri UUID bo‘lishi kerak' })
  commendantId?: string;

  @ApiPropertyOptional({
    description: 'Ushbu binoga biriktiriladigan fakultet yoki bo‘limlar ID lari',
    example: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'departmentIds massiv bo‘lishi kerak' })
  @IsUUID('4', { each: true, message: 'Har bir departmentId to‘g‘ri UUID bo‘lishi kerak' })
  departmentIds?: string[];
}
