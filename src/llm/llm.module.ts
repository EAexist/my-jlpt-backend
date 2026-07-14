import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GrammarExampleService } from './grammar-example/grammar-example.service';

@Module({
  imports: [PrismaModule],
  providers: [GrammarExampleService],
  exports: [GrammarExampleService],
})
// Gemini grammar-example generation boundary: START
// Provide GrammarExampleService to LlmModule
// Gemini grammar-example generation boundary: END
export class LlmModule {}
