import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('Content Management (e2e)', () => {
  let app: INestApplication;

  const mockContent = {
    id: '111e8400-e29b-41d4-a716-446655440000',
    groupId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Content',
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        content: {
          findMany: vi.fn().mockResolvedValue([mockContent]),
          update: vi
            .fn()
            .mockImplementation((args: { data: { groupId: string } }) =>
              Promise.resolve({ ...mockContent, groupId: args.data.groupId }),
            ),
          delete: vi.fn().mockResolvedValue(mockContent),
        },
        $transaction: vi.fn(
          async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
            return await callback({
              processingJob: { deleteMany: vi.fn() },
              section: { deleteMany: vi.fn() },
              uploadedFile: { deleteMany: vi.fn() },
              content: { delete: vi.fn().mockResolvedValue(mockContent) },
            });
          },
        ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /groups/{groupId}/content', () => {
    it('should return paginated content by group', async () => {
      return request(app.getHttpServer())
        .get(
          '/groups/550e8400-e29b-41d4-a716-446655440000/content?page=1&limit=10',
        )
        .expect(200)
        .expect((res) => {
          const body = res.body as { id: string }[];
          expect(Array.isArray(body)).toBe(true);
          expect(body[0]?.id).toBe(mockContent.id);
        });
    });
  });

  describe('PATCH /content/{id}', () => {
    it('should update group of content', async () => {
      return request(app.getHttpServer())
        .patch(`/content/${mockContent.id}`)
        .send({ groupId: 'fa0e8400-e29b-41d4-a716-446655440000' })
        .expect(200)
        .expect((res) => {
          const body = res.body as { groupId: string };
          expect(body.groupId).toBe('fa0e8400-e29b-41d4-a716-446655440000');
        });
    });
  });

  describe('DELETE /content/{id}', () => {
    it('should delete content', async () => {
      return request(app.getHttpServer())
        .delete(`/content/${mockContent.id}`)
        .expect(204);
    });
  });
});
