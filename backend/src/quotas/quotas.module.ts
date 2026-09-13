import { Module } from '@nestjs/common';
import { QuotasService } from './quotas.service';
import { QuotasController } from './quotas.controller';

@Module({
  controllers: [QuotasController],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
