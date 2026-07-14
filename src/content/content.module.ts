import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NlpModule } from '../nlp/nlp.module';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentIngestionService } from './content-ingestion/content-ingestion.service';
import { ContentManagementService } from './content-management/content-management.service';

@Module({
  imports: [PrismaModule, StorageModule, NlpModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    ContentIngestionService,
    ContentManagementService,
  ],
})
export class ContentModule {}
