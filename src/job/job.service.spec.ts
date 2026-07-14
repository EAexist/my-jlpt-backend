import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobService', () => {
  let service: JobService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: vi.fn(),
      processingJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      sentenceAnalysis: { createMany: vi.fn() },
      vocabularyItem: { createMany: vi.fn() },
      grammarExample: { createMany: vi.fn() },
      content: { update: vi.fn() },
    };
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCallback', () => {
    it('persists sentences, deduplicates vocabulary, and persists grammar examples', async () => {
      const result = {
        chunks: [{ text: 'Sentence 1' }],
        vocabulary: [
          { word: 'test', reading: 'てすと', translation: 'test' },
          { word: 'test', reading: 'てすと', translation: 'test' } // Duplicate
        ],
        grammarExamples: [{ grammarPointId: 'gp-1', japanese: '...' }]
      };

      prismaMock.$transaction.mockImplementation((callback: any) => callback(prismaMock));
      prismaMock.processingJob.findUnique.mockResolvedValue({
        id: 'job-1',
        contentId: 'content-1',
        status: 'PROCESSING',
      } as any);

      await service.handleCallback('job-1', result);

      // Verify vocabulary items called with skipDuplicates: true
      expect(prismaMock.vocabularyItem.createMany).toHaveBeenCalledWith(expect.objectContaining({
        skipDuplicates: true
      }));

      // Verify grammar examples persistence
      expect(prismaMock.grammarExample.createMany).toHaveBeenCalled();
    });
  });
});
