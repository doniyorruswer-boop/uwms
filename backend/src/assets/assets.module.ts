import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { DocumentStampsModule } from '../document-stamps/document-stamps.module';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [DocumentStampsModule, TransfersModule],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
