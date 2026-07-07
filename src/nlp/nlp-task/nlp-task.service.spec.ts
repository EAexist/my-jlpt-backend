import { Test, TestingModule } from '@nestjs/testing';
import { NlpTaskService } from './nlp-task.service';

describe('NlpTaskService', () => {
  let service: NlpTaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NlpTaskService],
    }).compile();

    service = module.get<NlpTaskService>(NlpTaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
