import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { JobModule } from './job/job.module';
import { ContentModule } from './content/content.module';

@Module({
  imports: [AuthModule, HealthModule, JobModule, ContentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
