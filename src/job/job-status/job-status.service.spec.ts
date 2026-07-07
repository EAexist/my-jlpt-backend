import { Test, TestingModule } from '@nestjs/testing';
import { JobStatusService } from './job-status.service';

describe('JobStatusService', () => {
  let service: JobStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobStatusService],
    }).compile();

    service = module.get<JobStatusService>(JobStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
