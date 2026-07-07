import { Test, TestingModule } from '@nestjs/testing';
import { ContentIngestionService } from './content-ingestion.service';

describe('ContentIngestionService', () => {
  let service: ContentIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentIngestionService],
    }).compile();

    service = module.get<ContentIngestionService>(ContentIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
