import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobService', () => {
  let service: JobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobService, PrismaService],
    }).compile();

    service = module.get<JobService>(JobService);
    const prisma = module.get<PrismaService>(PrismaService);

    // Clean up
    await prisma.processingJob.deleteMany();
    await prisma.content.deleteMany();
    await prisma.group.deleteMany();
    await prisma.learner.deleteMany();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCallback', () => {
    it('persists sentences and deduplicated vocabulary', async () => {
      // Mock db setup
      const prisma = new PrismaService();
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

      await service.handleCallback('job-1', result);

      const savedContent = await prisma.content.findUnique({
        where: { id: content.id },
        include: { sentenceAnalyses: true, vocabularyItems: true }
      });

      expect(savedContent?.status).toBe('COMPLETED');
      expect(savedContent?.sentenceAnalyses.length).toBe(1);
      expect(savedContent?.vocabularyItems.length).toBe(1);
    });
  });
});
