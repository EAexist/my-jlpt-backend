import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JobService } from './job.service';
import { JobCallbackAuthGuard } from './job-callback-auth.guard';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @UseGuards(JobCallbackAuthGuard)
  @Post('/internal/jobs/:jobId/callback')
  async callback(@Param('jobId') jobId: string, @Body() result: any) {
    return await this.jobService.handleCallback(jobId, result);
  }
}
