import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { StorageService } from '../../storage/storage.service';
import { ContentModule } from '../content.module';

describe('ContentIngestionController (Contract) - POST /content/upload-url', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ContentModule],
    })
      .overrideProvider(StorageService)
      .useValue({
        getSignedPutUrl: vi.fn().mockResolvedValue('https://mock-url.com'),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 400 for invalid Content-Type', async () => {
    return request(app.getHttpServer())
      .post('/content/upload-url')
      .send({ fileName: 'test.exe', mimeType: 'application/x-msdownload' })
      .expect(400);
  });

  it('should return 201 with signed URL for valid input', async () => {
    return request(app.getHttpServer())
      .post('/content/upload-url')
      .send({ fileName: 'test.pdf', mimeType: 'application/pdf' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('url');
        expect(res.body).toHaveProperty('objectKey');
        expect(res.body).toHaveProperty('expiresAt');
      });
  });
});
