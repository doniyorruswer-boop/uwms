import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';
import { SigningSessionsService } from './signing-sessions.service';
import { SigningSessionsController } from './signing-sessions.controller';

@Module({
  imports: [PrismaModule, DocumentStampsModule],
  providers: [SigningSessionsService],
  controllers: [SigningSessionsController],
  exports: [SigningSessionsService],
})
export class SigningSessionsModule {}
