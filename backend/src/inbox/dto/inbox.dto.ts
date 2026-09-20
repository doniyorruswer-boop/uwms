import { ApiProperty } from '@nestjs/swagger';

export class InboxSummaryDto {
  @ApiProperty({ description: 'Jami kutilayotgan vazifalar soni' })
  totalPendingCount: number;

  @ApiProperty({ description: 'Kutilayotgan ko‘chirishlar (MOL/Ombor qabul qilishi kerak)' })
  pendingTransfersCount: number;

  @ApiProperty({ description: 'Kutilayotgan talabnomalar (Tasdiqlash/berish kutilmoqda)' })
  pendingRequestsCount: number;

  @ApiProperty({ description: 'Kutilayotgan komissiya ovozlari (OS-4 Spisanie)' })
  pendingWriteOffVotesCount: number;

  @ApiProperty({ description: 'Davom etayotgan inventarizatsiya tekshiruvlari' })
  openAuditsCount: number;

  @ApiProperty({ description: 'Kam qolgan ombor tovarlari ogohlantirishlari' })
  lowStockAlertsCount: number;

  @ApiProperty({ description: 'Limitdan oshgan talabnomalar' })
  overQuotaRequestsCount: number;

  @ApiProperty({ description: 'Kutilayotgan moddiy javobgarlik topshirish dalolatnomalari (OS-1)' })
  pendingHandoversCount?: number;
}

export class InboxResponseDto {
  @ApiProperty({ type: InboxSummaryDto })
  summary: InboxSummaryDto;

  @ApiProperty({ description: 'Kutilayotgan qabullar ro‘yxati' })
  pendingTransfers: any[];

  @ApiProperty({ description: 'Kutilayotgan talabnomalar ro‘yxati' })
  pendingRequests: any[];

  @ApiProperty({ description: 'Ovoz berish kutilayotgan spisanie dalolatnomalari' })
  pendingWriteOffVotes: any[];

  @ApiProperty({ description: 'Ochiq va davom etayotgan auditlar ro‘yxati' })
  openAudits: any[];

  @ApiProperty({ description: 'Kam qolgan ombor tovarlari ro‘yxati' })
  lowStockAlerts: any[];

  @ApiProperty({ description: 'Kvotadan oshgan va maxsus ruxsat so‘rayotgan talabnomalar' })
  overQuotaRequests: any[];

  @ApiProperty({ description: 'Kutilayotgan moddiy javobgarlik topshirish arizalari ro‘yxati' })
  pendingHandovers?: any[];
}
