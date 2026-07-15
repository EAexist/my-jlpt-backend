import { Test, TestingModule } from '@nestjs/testing';
import { NlpTaskService } from '../../nlp/nlp-task/nlp-task.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ContentIngestionService } from './content-ingestion.service';

describe('ContentIngestionService', () => {
  let service: ContentIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentIngestionService,
        { provide: StorageService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: NlpTaskService, useValue: {} },
      ],
    }).compile();

    service = module.get<ContentIngestionService>(ContentIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
