import { Module } from '@nestjs/common';
import { WriteOffsService } from './write-offs.service';
import { WriteOffsController } from './write-offs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [WriteOffsController],
  providers: [WriteOffsService],
  exports: [WriteOffsService],
})
export class WriteOffsModule {}
