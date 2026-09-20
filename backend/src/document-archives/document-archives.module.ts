import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentArchivesService } from './document-archives.service';
import { DocumentArchivesController } from './document-archives.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentArchivesController],
  providers: [DocumentArchivesService],
  exports: [DocumentArchivesService],
})
export class DocumentArchivesModule {}
