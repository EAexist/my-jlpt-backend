import { Module } from '@nestjs/common';
import { GrammarExampleService } from './grammar-example/grammar-example.service';

@Module({
  providers: [GrammarExampleService]
})
export class LlmModule {}
