import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartAuditDto {
  @ApiProperty({ description: 'Inventarizatsiya o‘tkazilayotgan xona ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Xona tanlanishi shart!' })
  roomId: string;
}

export class ScanCodeDto {
  @ApiProperty({ description: 'Xona ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Xona ID si kiritilishi shart!' })
  roomId: string;

  @ApiProperty({ example: 'UWMS:INV-2026-001:SN-LN-88123', description: 'Skaner qilingan QR-kod matni' })
  @IsString()
  @IsNotEmpty({ message: 'QR-kod bo‘sh bo‘lishi mumkin emas!' })
  qrCode: string;
}
