import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Content (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        content: {
            findUnique: vi.fn(),
            create: vi.fn(),
        }
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
          expect(res.body).toHaveProperty('id');
          expect(res.body.inputText).toBe('This is a test sentence.');
          expect(res.body.status).toBe('PENDING');
        });
    });
  });

  describe('GET /content/{id}', () => {
    it('should return content details', async () => {
      const created = await request(app.getHttpServer())
        .post('/content')
        .send({ text: 'Another test sentence.' });

      return request(app.getHttpServer())
        .get(`/content/${created.body.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(created.body.id);
          expect(res.body.inputText).toBe('Another test sentence.');
        });
    });
  });
});
