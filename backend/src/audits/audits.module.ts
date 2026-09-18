import { Module } from '@nestjs/common';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';

@Module({
  imports: [DocumentStampsModule],
  providers: [AuditsService],
  controllers: [AuditsController],
  exports: [AuditsService],
})
export class AuditsModule {}
