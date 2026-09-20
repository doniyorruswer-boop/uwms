import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoteStatus } from '@prisma/client';

export class CommissionMemberInputDto {
  @ApiProperty({ description: 'Foydalanuvchi ID raqami' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Komissiyadagi lavozimi (masalan: Komissiya raisi, Bosh buxgalter, Yurist, Bosh mexanik)' })
  @IsString()
  @IsNotEmpty()
  roleName: string;
}

export class CreateWriteOffDto {
  @ApiProperty({ description: 'Asosiy vosita ID raqami' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ description: 'Hisobdan chiqarish sababi (jismoniy eskirish, ma’nan eskirish, to‘liq yaroqsiz)' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Texnik ekspertiza xulosasi raqami va tavsifi' })
  @IsString()
  @IsOptional()
  technicalConclusion?: string;

  @ApiPropertyOptional({ description: 'Komissiya a’zolari ro‘yxati', type: [CommissionMemberInputDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CommissionMemberInputDto)
  members?: CommissionMemberInputDto[];
}

export class VoteWriteOffDto {
  @ApiProperty({ enum: VoteStatus, description: 'Ovoz natijasi: APPROVED yoki REJECTED' })
  @IsEnum(VoteStatus)
  @IsNotEmpty()
  vote: VoteStatus;

  @ApiPropertyOptional({ description: 'Komissiya a’zosi izohi yoki xulosasi' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ description: 'Biometrik imzo heshi (SHA-256)' })
  @IsString()
  @IsOptional()
  signatureHash?: string;

  @ApiPropertyOptional({ description: 'Imzolovchi shaxs F.I.Sh.' })
  @IsString()
  @IsOptional()
  signerName?: string;

  @ApiPropertyOptional({ description: 'Imzolovchi lavozimi' })
  @IsString()
  @IsOptional()
  signerRole?: string;
}
