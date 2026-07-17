import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigGlobalModule } from './config/config.module';
import { ContentModule } from './content/content.module';
import { GroupModule } from './group/group.module';
import { HealthModule } from './health/health.module';
import { JobModule } from './job/job.module';
import { NlpModule } from './nlp/nlp.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigGlobalModule,
    AuthModule,
    HealthModule,
    JobModule,
    ContentModule,
    PrismaModule,
    StorageModule,
    NlpModule,
    GroupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
