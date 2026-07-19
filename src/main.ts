import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT') ?? 3000);
}
void bootstrap();
