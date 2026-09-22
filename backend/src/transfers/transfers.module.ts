import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';
import { DocumentArchivesModule } from '../document-archives/document-archives.module';
import { SigningSessionsModule } from '../signing-sessions/signing-sessions.module';
import { CodeGeneratorService } from '../common/code-generator.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DocumentStampsModule, DocumentArchivesModule, SigningSessionsModule, NotificationsModule],
  controllers: [TransfersController],
  providers: [TransfersService, CodeGeneratorService],
  exports: [TransfersService],
})
export class TransfersModule {}

