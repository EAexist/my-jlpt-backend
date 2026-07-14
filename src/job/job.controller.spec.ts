import { Test, TestingModule } from '@nestjs/testing';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobStatusService } from './job-status/job-status.service';
import { PrismaModule } from '../prisma/prisma.module';

describe('JobController', () => {
  let controller: JobController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [JobController],
      providers: [JobService, JobStatusService],
    }).compile();

    controller = module.get<JobController>(JobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
