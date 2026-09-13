import { Module } from '@nestjs/common';
import { DocumentStampsService } from './document-stamps.service';
import { DocumentStampsController } from './document-stamps.controller';

@Module({
  controllers: [DocumentStampsController],
  providers: [DocumentStampsService],
  exports: [DocumentStampsService],
})
export class DocumentStampsModule {}
