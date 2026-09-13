import { Module, Global } from '@nestjs/common';
import { CodeGeneratorService } from './code-generator.service';

@Global()
@Module({
  providers: [CodeGeneratorService],
  exports: [CodeGeneratorService],
})
export class CommonModule {}
