import { Module, Global } from '@nestjs/common';
import { CodeGeneratorService } from './code-generator.service';
import { SequenceService } from './services/sequence.service';

@Global()
@Module({
  providers: [CodeGeneratorService, SequenceService],
  exports: [CodeGeneratorService, SequenceService],
})
export class CommonModule {}

