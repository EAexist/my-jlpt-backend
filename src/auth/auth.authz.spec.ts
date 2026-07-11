import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { vi } from 'vitest';

describe('Auth Authorization Tests', () => {
  let app: INestApplication;

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
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /auth/me', () => {
    it('should return 401 when Authorization header is missing', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should return 401 when token format is invalid (no Bearer)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidTokenStructure')
        .expect(401);
    });

    it('should return 401 when token is tampered/invalid', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);
    });

    it('should return 401 when token has wrong signature', async () => {
      const wrongSecret = new TextEncoder().encode('wrong-secret');
      const token = await new SignJWT({ id: 'uuid-1' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(wrongSecret);

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should return 200 when token is valid', async () => {
      const secret = new TextEncoder().encode('test-secret');
      const token = await new SignJWT({ id: 'uuid-1' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(secret);

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
