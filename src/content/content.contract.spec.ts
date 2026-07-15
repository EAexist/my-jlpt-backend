import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { NlpTaskService } from '../nlp/nlp-task/nlp-task.service';

describe('Content (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        content: {
          findUnique: vi
            .fn()
            .mockImplementation(({ where }: { where: { id: string } }) =>
              Promise.resolve({
                id: where.id,
                inputText: 'Another test sentence.',
                status: 'PENDING',
              }),
            ),
          create: vi.fn(),
        },
        $transaction: vi.fn(
          async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
            return await callback({
              content: {
                create: vi.fn().mockImplementation((args: { data: any }) =>
                  Promise.resolve({
                    id: 'mock-id',
                    ...args.data,
                  }),
                ),
              },
              processingJob: {
                create: vi.fn().mockResolvedValue({ id: 'job-id' }),
              },
            });
          },
        ),
      })
      .overrideProvider(NlpTaskService)
      .useValue({
        dispatchNlpTask: vi.fn().mockResolvedValue({}),
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

  describe('POST /content', () => {
    it('should create content from text', () => {
      return request(app.getHttpServer())
        .post('/content')
        .send({ text: 'This is a test sentence.' })
        .expect(201)
        .expect((res) => {
          const body = res.body as {
            id: string;
            inputText: string;
            status: string;
          };
          expect(body).toHaveProperty('id');
          expect(body.inputText).toBe('This is a test sentence.');
          expect(body.status).toBe('PENDING');
        });
    });
  });

  describe('GET /content/{id}', () => {
    it('should return content details', async () => {
      const created = await request(app.getHttpServer())
        .post('/content')
        .send({ text: 'Another test sentence.' });

      const createdBody = created.body as { id: string };

      return request(app.getHttpServer())
        .get(`/content/${createdBody.id}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as { id: string; inputText: string };
          expect(body.id).toBe(createdBody.id);
          expect(body.inputText).toBe('Another test sentence.');
        });
    });
  });
});
