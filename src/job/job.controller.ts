import { Body, Controller, Param, Post } from '@nestjs/common';
import { JobService } from './job.service';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('/internal/jobs/:jobId/callback')
  async callback(@Param('jobId') jobId: string, @Body() result: any) {
    return await this.jobService.handleCallback(jobId, result);
  }
}
