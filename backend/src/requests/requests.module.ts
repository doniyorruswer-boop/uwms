import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { QuotasModule } from '../quotas/quotas.module';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
  imports: [QuotasModule, DocumentStampsModule, IdempotencyModule, WarehouseModule],
  providers: [RequestsService],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
