import { Test, TestingModule } from '@nestjs/testing';
import { vi, expect } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentManagementService } from './content-management.service';

type MockPrisma = {
  content: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  processingJob: { deleteMany: ReturnType<typeof vi.fn> };
  section: { deleteMany: ReturnType<typeof vi.fn> };
  uploadedFile: { deleteMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('ContentManagementService', () => {
  let service: ContentManagementService;
  let mockPrisma: MockPrisma;

  beforeEach(async () => {
    mockPrisma = {
      content: {
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      processingJob: { deleteMany: vi.fn() },
      section: { deleteMany: vi.fn() },
      uploadedFile: { deleteMany: vi.fn() },
      $transaction: vi.fn(
        async (
          callback: (tx: MockPrisma) => Promise<unknown>,
        ): Promise<unknown> => callback(mockPrisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentManagementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContentManagementService>(ContentManagementService);
  });

  it('should find paginated content by group', async () => {
    mockPrisma.content.findMany.mockResolvedValue([]);
    await service.findPaginatedContentByGroup('group-1', {
      page: 1,
      limit: 10,
    });
    expect(mockPrisma.content.findMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should move content', async () => {
    await service.moveContent('content-1', 'group-2');
    expect(mockPrisma.content.update).toHaveBeenCalledWith({
      where: { id: 'content-1' },
      data: { groupId: 'group-2' },
    });
  });

  it('should delete content and related records', async () => {
    await service.deleteContent('content-1');
    expect(mockPrisma.processingJob.deleteMany).toHaveBeenCalledWith({
      where: { contentId: 'content-1' },
    });
    expect(mockPrisma.section.deleteMany).toHaveBeenCalledWith({
      where: { contentId: 'content-1' },
    });
    expect(mockPrisma.uploadedFile.deleteMany).toHaveBeenCalledWith({
      where: { contentId: 'content-1' },
    });
    expect(mockPrisma.content.delete).toHaveBeenCalledWith({
      where: { id: 'content-1' },
    });
  });
});
