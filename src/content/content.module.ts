import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentIngestionService } from './content-ingestion/content-ingestion.service';
import { ContentManagementService } from './content-management/content-management.service';

@Module({
  controllers: [ContentController],
  providers: [
    ContentService,
    ContentIngestionService,
    ContentManagementService,
  ],
})
export class ContentModule {}
