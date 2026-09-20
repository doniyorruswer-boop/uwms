import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';

@Module({
  imports: [IdempotencyModule, DocumentStampsModule],
  providers: [WarehouseService],
  controllers: [WarehouseController],
  exports: [WarehouseService],
})
export class WarehouseModule {}
