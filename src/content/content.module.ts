import { Module } from '@nestjs/common';
import { NlpModule } from '../nlp/nlp.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobModule } from '../job/job.module';
import { ContentIngestionService } from './content-ingestion/content-ingestion.service';
import { ContentManagementService } from './content-management/content-management.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [PrismaModule, StorageModule, NlpModule, JobModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    ContentIngestionService,
    ContentManagementService,
  ],
  exports: [ContentService, ContentIngestionService, ContentManagementService],
})
export class ContentModule {}
