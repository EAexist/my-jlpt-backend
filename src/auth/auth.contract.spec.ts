import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { SignJWT } from 'jose';
import { vi } from 'vitest';

describe('Auth Contract Tests', () => {
  let app: INestApplication;
  let authService: AuthService;

  const mockConfigService = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      return null;
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, ConfigModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    authService = moduleRef.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/sync', () => {
    it('should successfully sync a new learner', async () => {
      const syncData = {
        provider: 'google',
        providerAccountId: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      };

      vi.spyOn(authService, 'syncLearner').mockResolvedValue({
        id: 'uuid-1',
        ...syncData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .post('/auth/sync')
        .send(syncData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should return 200 when valid token is provided', async () => {
      const secret = new TextEncoder().encode('test-secret');
      const token = await new SignJWT({ id: 'uuid-1' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(secret);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toEqual('uuid-1');
    });
  });
});
