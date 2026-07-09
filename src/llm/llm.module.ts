import { Module } from '@nestjs/common';
import { GrammarExampleService } from './grammar-example/grammar-example.service';

@Module({
  providers: [GrammarExampleService],
  exports: [GrammarExampleService],
})
// Gemini grammar-example generation boundary: START
// Provide GrammarExampleService to LlmModule
// Gemini grammar-example generation boundary: END
export class LlmModule {}
