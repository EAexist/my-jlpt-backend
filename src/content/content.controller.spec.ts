import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContentIngestionService } from './content-ingestion/content-ingestion.service';
import { ContentController } from './content.controller';
import { ContentManagementService } from './content-management/content-management.service';
import { JobStatusService } from '../job/job-status/job-status.service';

describe('ContentController', () => {
  let controller: ContentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        {
          provide: ContentIngestionService,
          useValue: { handleSubmission: vi.fn() },
        },
        { provide: StorageService, useValue: { getSignedPutUrl: vi.fn() } },
        {
          provide: PrismaService,
          useValue: { content: { findUnique: vi.fn() } },
        },
        {
          provide: ContentManagementService,
          useValue: { moveContent: vi.fn(), deleteContent: vi.fn() },
        },
        { provide: JobStatusService, useValue: { updateJobStatus: vi.fn(), getJobStatus: vi.fn() } },
      ],
    }).compile();

    controller = module.get<ContentController>(ContentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
