import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { JobStatusService } from './job-status/job-status.service';

@Module({
  imports: [PrismaModule],
  controllers: [JobController],
  providers: [JobService, JobStatusService],
  exports: [JobStatusService],
})
export class JobModule {}
