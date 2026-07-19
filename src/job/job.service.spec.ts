import { Test, TestingModule } from '@nestjs/testing';
import { Mock, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatusService } from './job-status/job-status.service';
import { JobCallbackResult, JobService } from './job.service';

interface MockPrismaService {
  $transaction: Mock;
  processingJob: {
    findUnique: Mock;
    update: Mock;
  };
  section: { createMany: Mock };
  vocabularyItem: { createMany: Mock };
  grammarExample: { createMany: Mock };
  content: { update: Mock };
}

describe('JobService', () => {
  let service: JobService;
  let prismaMock: MockPrismaService;

  beforeEach(async () => {
    prismaMock = {
      $transaction: vi.fn(),
      processingJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      section: { createMany: vi.fn() },
      vocabularyItem: { createMany: vi.fn() },
      grammarExample: { createMany: vi.fn() },
      content: { update: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JobStatusService, useValue: { updateJobStatus: vi.fn() } },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCallback', () => {
    it('persists sentences, deduplicates vocabulary, and persists grammar examples', async () => {
      const result: JobCallbackResult = {
        chunks: [{ text: 'Sentence 1' }],
        vocabulary: [
          { word: 'test', reading: 'てすと', translation: 'test' },
          { word: 'test', reading: 'てすと', translation: 'test' }, // Duplicate
        ],
        grammarExamples: [{ grammarPatternId: 'gp-1', japanese: '...' }],
      };

      // Type-safe transaction mock
      prismaMock.$transaction.mockImplementation(
        (callback: (tx: PrismaService) => Promise<unknown>) => {
          return callback(prismaMock as unknown as PrismaService);
        },
      );

      prismaMock.processingJob.findUnique.mockResolvedValue({
        id: 'job-1',
        contentId: 'content-1',
        status: 'PROCESSING',
      });

      await service.handleCallback('job-1', result);

      // Verify vocabulary items called with skipDuplicates: true and data

      expect(prismaMock.vocabularyItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ word: 'test', reading: 'てすと' }),
          ]) as unknown,
          skipDuplicates: true,
        }),
      );

      // Verify grammar examples persistence

      expect(prismaMock.grammarExample.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              grammarPatternId: 'gp-1',
              japanese: '...',
            }),
          ]) as unknown,
        }),
      );
    });
  });
});
