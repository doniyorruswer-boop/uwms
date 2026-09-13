import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'FAK-2026-0089' })
  @IsNotEmpty({ message: 'Hisob-faktura raqami kiritilishi shart' })
  @IsString()
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '2026-09-10' })
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiPropertyOptional({ example: 45000000 })
  @IsOptional()
  @IsNumber({}, { message: 'Hisob-faktura umumiy summasi son bo‘lishi kerak' })
  @Min(0, { message: 'Summa manfiy bo‘lishi mumkin emas' })
  totalAmount?: number;

  @ApiPropertyOptional({ example: '1-partiya kompyuter uskunalari uchun to‘lov fakturasi' })
  @IsOptional()
  @IsString()
  notes?: string;
}
