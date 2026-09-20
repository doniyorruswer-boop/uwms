import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InitSigningSessionDto {
  @IsNotEmpty()
  @IsString()
  docNumber: string;

  @IsNotEmpty()
  @IsString()
  docType: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  departmentName?: string;

  @IsOptional()
  @IsString()
  roomName?: string;

  @IsNotEmpty()
  @IsString()
  itemSummary: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  targetSignerName?: string;

  @IsOptional()
  @IsString()
  targetSignerRole?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;
}

export class ConfirmBiometricSignDto {
  @IsOptional()
  @IsString()
  signerName?: string;

  @IsOptional()
  @IsString()
  signerRole?: string;

  @IsOptional()
  @IsString()
  biometricType?: string; // TOUCH_ID, FACE_ID, WEBAUTHN, WEBAUTHN_TOUCH_ID, WEBAUTHN_FACE_ID

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  credentialId?: string;

  @IsOptional()
  @IsString()
  clientDataJson?: string;

  @IsOptional()
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };
}

export class InitHandoverSigningSessionDto {
  @IsNotEmpty()
  @IsString()
  handoverId: string;

  @IsNotEmpty()
  @IsString()
  signatoryRole: 'DEPARTING' | 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT';
}
