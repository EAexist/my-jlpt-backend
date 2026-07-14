import { Test, TestingModule } from '@nestjs/testing';
import { ContentController } from './content.controller';
import { ContentIngestionService } from './content-ingestion/content-ingestion.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContentController', () => {
  let controller: ContentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: ContentIngestionService, useValue: { handleSubmission: vi.fn() } },
        { provide: StorageService, useValue: { getSignedPutUrl: vi.fn() } },
        { provide: PrismaService, useValue: { content: { findUnique: vi.fn() } } },
      ],
    }).compile();

    controller = module.get<ContentController>(ContentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
