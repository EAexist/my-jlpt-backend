import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { JobModule } from './job/job.module';
import { ContentModule } from './content/content.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { NlpModule } from './nlp/nlp.module';
import { LlmModule } from './llm/llm.module';
import { GroupModule } from './group/group.module';

@Module({
  imports: [AuthModule, HealthModule, JobModule, ContentModule, PrismaModule, StorageModule, NlpModule, LlmModule, GroupModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
