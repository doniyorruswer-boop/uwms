import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { S3StorageService } from './s3-storage.service';

@Module({
  controllers: [BackupsController],
  providers: [BackupsService, S3StorageService],
  exports: [BackupsService, S3StorageService],
})
export class BackupsModule {}
