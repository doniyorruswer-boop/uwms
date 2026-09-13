import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { QuotasModule } from '../quotas/quotas.module';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';

@Module({
  imports: [QuotasModule, DocumentStampsModule],
  providers: [RequestsService],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
