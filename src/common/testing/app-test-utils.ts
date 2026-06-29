import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

/**
 * Bootstraps a testing module with optional providers, imports, and controllers.
 * Adheres to NestJS unit testing guidelines.
 */
export async function createTestApp(
  moduleMetadata: any,
): Promise<{ app: INestApplication; moduleFixture: TestingModule }> {
  const moduleFixture: TestingModule =
    await Test.createTestingModule(moduleMetadata).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  await app.init();

  return { app, moduleFixture };
}
