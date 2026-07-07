import { Module } from '@nestjs/common';
import { NlpTaskService } from './nlp-task/nlp-task.service';

@Module({
  providers: [NlpTaskService],
  exports: [NlpTaskService],
})
export class NlpModule {}
