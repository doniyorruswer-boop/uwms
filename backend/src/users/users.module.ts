import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemAuditModule } from '../system-audit/system-audit.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, SystemAuditModule, EventsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

