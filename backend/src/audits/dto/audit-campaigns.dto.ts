import { IsNotEmpty, IsString, IsArray, ArrayNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CampaignStatus } from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty({ example: '2026-yil 1-semestr umumiy inventarizatsiyasi', description: 'Kampaniya nomi' })
  @IsString()
  @IsNotEmpty({ message: 'Kampaniya nomi kiritilishi shart!' })
  title: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', description: 'Rejalashtirilgan boshlanish sanasi' })
  @IsNotEmpty({ message: 'Boshlanish sanasi ko‘rsatilishi shart!' })
  periodStart: string | Date;

  @ApiProperty({ example: '2026-09-30T23:59:59.000Z', description: 'Rejalashtirilgan tugash sanasi' })
  @IsNotEmpty({ message: 'Tugash sanasi ko‘rsatilishi shart!' })
  periodEnd: string | Date;

  @ApiProperty({ example: ['room-uuid-1', 'room-uuid-2'], description: 'Kampaniya qamroviga kiruvchi xonalar ID lari ro‘yxati' })
  @IsArray({ message: 'Xonalar ro‘yxat ko‘rinishida bo‘lishi kerak!' })
  @ArrayNotEmpty({ message: 'Kamida bitta xona tanlanishi shart!' })
  @IsString({ each: true })
  roomIds: string[];

  @ApiProperty({ example: 'Fizika va Axborot texnologiyalari fakultetlari xonalari', description: 'Qo‘shimcha izoh', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '№ 142-F', description: 'Rektor buyrug‘i raqami', required: false })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', description: 'Rektor buyrug‘i sanasi', required: false })
  @IsOptional()
  orderDate?: string | Date;

  @ApiProperty({ example: 'user-uuid-auditor', description: 'Tayinlangan mas’ul auditor ID si', required: false })
  @IsOptional()
  @IsString()
  assignedAuditorId?: string;
}

export class StartCampaignDto {
  @ApiProperty({ description: 'Raqamli imzo xeshi (QR-Pairing TouchID/FaceID)', required: false })
  @IsOptional()
  @IsString()
  signatureHash?: string;

  @ApiProperty({ description: 'Imzolovchi F.I.O.', required: false })
  @IsOptional()
  @IsString()
  signerName?: string;

  @ApiProperty({ description: 'Imzolovchi lavozimi / roli', required: false })
  @IsOptional()
  @IsString()
  signerRole?: string;

  @ApiProperty({ description: 'Rektorat tasdiqlash izohi', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryCampaignsDto {
  @ApiProperty({ required: false, description: 'Qidiruv so‘zi' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: CampaignStatus, required: false, description: 'Kampaniya holati' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

export class CompleteCampaignDto {
  @ApiProperty({ required: false, description: 'Auditor xulosasi va izohlari' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'Tekshirgan auditor / Komissiya Raisi F.I.O.' })
  @IsOptional()
  @IsString()
  signerName?: string;

  @ApiProperty({ required: false, description: 'Tekshirgan mas’ul lavozimi / roli' })
  @IsOptional()
  @IsString()
  signerRole?: string;

  @ApiProperty({ required: false, description: 'Elektron raqamli yoki chizilgan imzo ma’lumoti / xeshi' })
  @IsOptional()
  @IsString()
  signatureHash?: string;

  @ApiProperty({ required: false, description: 'Komissiya a’zolari ro‘yxati', type: [String] })
  @IsOptional()
  @IsArray()
  committeeMembers?: string[];
}

