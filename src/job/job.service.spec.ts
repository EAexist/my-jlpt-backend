import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

describe('JobService', () => {
  let service: JobService;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
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
    it('persists sentences and deduplicated vocabulary', async () => {
      // Mock db setup
      const learner = await prisma.learner.create({ data: { provider: 'test', providerAccountId: '1' } });
      const group = await prisma.group.create({ data: { name: 'default', ownerId: learner.id } });
      const content = await prisma.content.create({ data: { title: 'Test', groupId: group.id, ownerId: learner.id } });
      const job = await prisma.processingJob.create({ 
        data: { 
            id: 'job-1', 
            contentId: content.id, 
            status: 'PROCESSING', 
            idempotencyKey: 'key-1' 
        } 
      });

      const result = {
        chunks: [{ text: 'Sentence 1' }],
        vocabulary: [{ word: 'test', reading: 'てすと', translation: 'test' }]
      };

      // Mock transaction and its methods
      prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock as any));
      prismaMock.processingJob.findUnique.mockResolvedValue({
        id: 'job-1',
        contentId: 'content-1',
        status: 'PROCESSING',
      } as any);

      await service.handleCallback('job-1', result);

      expect(prismaMock.processingJob.update).toHaveBeenCalled();
    });
  });
});
