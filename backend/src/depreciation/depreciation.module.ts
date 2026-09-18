import { Module } from '@nestjs/common';
import { DepreciationService } from './depreciation.service';
import { DepreciationController } from './depreciation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { SystemAuditModule } from '../system-audit/system-audit.module';

@Module({
  imports: [PrismaModule, CommonModule, SystemAuditModule],
  controllers: [DepreciationController],
  providers: [DepreciationService],
  exports: [DepreciationService],
})
export class DepreciationModule {}
