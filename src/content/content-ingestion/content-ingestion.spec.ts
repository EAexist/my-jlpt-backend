import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NlpTaskService } from '../../nlp/nlp-task/nlp-task.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ContentIngestionService } from './content-ingestion.service';

describe('ContentIngestionService (Validation)', () => {
  let service: ContentIngestionService;
  let mockStorageService: any;
  let mockPrismaService: any;
  let mockNlpTaskService: any;

  beforeEach(async () => {
    mockStorageService = {
      storage: {
        bucket: () => ({
          file: () => ({
            getMetadata: vi
              .fn()
              .mockResolvedValue([
                { size: 5 * 1024 * 1024, type: 'text/plain' },
              ]),
          }),
        }),
      },
      bucket: 'test-bucket',
    };
    mockPrismaService = {
      content: { create: vi.fn().mockResolvedValue({ id: 'test-id' }) },
      processingJob: { create: vi.fn() },
      $transaction: vi.fn((callback) => callback(mockPrismaService)),
    };
    mockNlpTaskService = { dispatchNlpTask: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentIngestionService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NlpTaskService, useValue: mockNlpTaskService },
      ],
    }).compile();

    service = module.get<ContentIngestionService>(ContentIngestionService);
  });

  it('should reject when both text and objectKey are provided', async () => {
    // Call the original method which has validation check
    await expect(
      service.handleSubmission({ text: 'hi', objectKey: 'key' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject files exceeding 10MB', async () => {
    mockStorageService.getMetadata = vi
      .fn()
      .mockResolvedValue([{ size: 15 * 1024 * 1024 }]);
    // Use the actual logic, fix in Service if needed
    // Assuming file path structure for test: storage['storage'].bucket(...).file(...)
    mockStorageService['storage'] = {
      bucket: () => ({
        file: () => ({
          getMetadata: vi.fn().mockResolvedValue([{ size: 15 * 1024 * 1024 }]),
        }),
      }),
    };
    await expect(
      service.handleSubmission({ objectKey: 'test-key.txt' }),
    ).rejects.toThrow('File exceeds 10MB');
  });
});
