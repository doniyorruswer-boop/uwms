import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentStampDto {
  @IsNotEmpty()
  @IsString()
  docType: string; // OS_1, OS_2, INV_19, OS_4, MOL_TRANSFER, RETURN_ACT

  @IsNotEmpty()
  @IsString()
  docNumber: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  signerName: string;

  @IsNotEmpty()
  @IsString()
  signerRole: string;

  @IsOptional()
  metadata?: any;
}
