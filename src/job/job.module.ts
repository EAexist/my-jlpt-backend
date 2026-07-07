import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { JobStatusService } from './job-status/job-status.service';

@Module({
  controllers: [JobController],
  providers: [JobService, JobStatusService],
})
export class JobModule {}
