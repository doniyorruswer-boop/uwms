import { Module } from '@nestjs/common';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';
import { AuditCampaignsService } from './audit-campaigns.service';
import { AuditCampaignsController } from './audit-campaigns.controller';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DocumentStampsModule, NotificationsModule],
  providers: [AuditsService, AuditCampaignsService],
  controllers: [AuditCampaignsController, AuditsController],
  exports: [AuditsService, AuditCampaignsService],
})
export class AuditsModule {}

