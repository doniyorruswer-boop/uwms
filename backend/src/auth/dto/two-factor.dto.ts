import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorDto {
  @ApiProperty({ description: 'Base32 secret generated during setup step', example: 'JBSWY3DPEHPK3PXP' })
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiProperty({ description: '6-digit verification code from Google Authenticator', example: '123456' })
  @IsString()
  @Length(6, 6, { message: '2FA kodi 6 ta raqamdan iborat bo‘lishi kerak' })
  @Matches(/^\d{6}$/, { message: '2FA kodi faqat raqamlardan iborat bo‘lishi kerak' })
  code: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({ description: '6-digit verification code or recovery code', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Tasdiqlash kodi kiritilishi shart' })
  code: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: 'Foydalanuvchi joriy paroli' })
  @IsString()
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password: string;

  @ApiProperty({ description: '6-digit code or recovery code to confirm disable' })
  @IsString()
  @IsNotEmpty({ message: 'Tasdiqlash kodi kiritilishi shart' })
  code: string;
}
