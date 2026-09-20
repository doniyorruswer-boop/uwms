import { Module } from '@nestjs/common';
import { WriteOffsService } from './write-offs.service';
import { WriteOffsController } from './write-offs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';

@Module({
  imports: [PrismaModule, CommonModule, DocumentStampsModule],
  controllers: [WriteOffsController],
  providers: [WriteOffsService],
  exports: [WriteOffsService],
})
export class WriteOffsModule {}
