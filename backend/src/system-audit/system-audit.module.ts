import { Module, Global } from '@nestjs/common';
import { SystemAuditService } from './system-audit.service';
import { SystemAuditController } from './system-audit.controller';

@Global()
@Module({
  controllers: [SystemAuditController],
  providers: [SystemAuditService],
  exports: [SystemAuditService],
})
export class SystemAuditModule {}
