import { IsNotEmpty, IsNumber, Min, IsOptional, IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReplenishStockDto {
  @ApiProperty({ example: 50, description: 'Omborga kirim qilinayotgan miqdor' })
  @IsNumber({}, { message: 'Miqdor son bo‘lishi shart!' })
  @Min(1, { message: 'Kirim miqdori kamida 1 bo‘lishi lozim!' })
  amount: number;

  @ApiProperty({ enum: ['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'], required: false })
  @IsOptional()
  @IsEnum(['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'], { message: 'Noto‘g‘ri moliyalashtirish manbasi!' })
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';
}

export class IngestStockItemDto {
  @ApiProperty({ description: 'Nomenklatura (Item) ID', required: false })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ description: 'Aktiv yoki mahsulot nomi', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Modeli', required: false })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({ description: 'Kategoriya nomi', required: false })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiProperty({ enum: ['FIXED_ASSET', 'CONSUMABLE'], required: false })
  @IsOptional()
  @IsString()
  type?: 'FIXED_ASSET' | 'CONSUMABLE';

  @ApiProperty({ description: 'O‘lchov birligi', required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: 'Kirim qilinayotgan soni' })
  @IsNumber({}, { message: 'Miqdor son bo‘lishi shart!' })
  @Min(1, { message: 'Kamida 1 dona kirim qilinishi lozim!' })
  quantity: number;

  @ApiProperty({ description: 'Xarid narxi (so‘m)', required: false })
  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @ApiProperty({ description: 'Seriya raqamlari (agar mavjud bo‘lsa)', required: false })
  @IsOptional()
  @IsArray()
  serialNumbers?: string[];
}


export class IngestStockDto {
  @ApiProperty({ description: 'Ta’minotchi korxona ID' })
  @IsNotEmpty({ message: 'Ta’minotchi tanlanishi shart!' })
  @IsString()
  supplierId: string;

  @ApiProperty({ description: 'Hisob-faktura raqami', required: false })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ description: 'Hisob-faktura sanasi', required: false })
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiProperty({ description: 'Umumiy faktura summasi', required: false })
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiProperty({ description: 'Qabul qiluvchi ombor ID', required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({ enum: ['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'], required: true })
  @IsNotEmpty({ message: 'Moliyalashtirish manbasi tanlanishi shart!' })
  @IsEnum(['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'], { message: 'Noto‘g‘ri moliyalashtirish manbasi!' })
  fundingSource: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';

  @ApiProperty({ description: 'Izoh yoki qo‘shimcha ma’lumot', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [IngestStockItemDto], description: 'Kirim qilinayotgan tovarlar ro‘yxati' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestStockItemDto)
  items: IngestStockItemDto[];
}

export class InterWarehouseTransferDto {
  @ApiProperty({ description: 'Chiqaruvchi omborxona ID si' })
  @IsNotEmpty({ message: 'Jo‘natuvchi ombor tanlanishi shart!' })
  @IsString()
  fromWarehouseId: string;

  @ApiProperty({ description: 'Qabul qiluvchi omborxona ID si' })
  @IsNotEmpty({ message: 'Qabul qiluvchi ombor tanlanishi shart!' })
  @IsString()
  toWarehouseId: string;

  @ApiProperty({ description: 'Mahsulot (Item) ID si' })
  @IsNotEmpty({ message: 'Mahsulot tanlanishi shart!' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 10, description: 'Ko‘chirilayotgan miqdor' })
  @IsNumber({}, { message: 'Miqdor son bo‘lishi shart!' })
  @Min(1, { message: 'Kamida 1 dona ko‘chirilishi lozim!' })
  quantity: number;

  @ApiProperty({ description: 'Izoh yoki sabab', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

