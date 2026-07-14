import { Injectable, BadRequestException } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NlpTaskService } from '../../nlp/nlp-task/nlp-task.service';

@Injectable()
export class ContentIngestionService {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly nlpTaskService: NlpTaskService,
  ) {}

  async handleSubmission(data: {
    text?: string;
    objectKey?: string;
    fileName?: string;
    mimeType?: string;
  }) {
    if (data.text) {
      return this.handleTextSubmission(data.text);
    } else if (data.objectKey) {
      return this.handleFileSubmission(data.objectKey, data.fileName, data.mimeType);
    } else {
      throw new BadRequestException('Either text or objectKey must be provided');
    }
  }

  private async createContent(data: {
    text?: string;
    objectKey?: string;
    fileName?: string;
    mimeType?: string;
  }) {
    return await this.prisma.$transaction(async (tx) => {
      const content = await tx.content.create({
        data: {
          ownerId: 'placeholder-learner-id', // TODO: get from auth
          groupId: 'placeholder-group-id', // TODO: get from request
          title: data.fileName || (data.text ? 'Text Content' : 'New Content'),
          inputText: data.text || '',
          inputFileObjectKey: data.objectKey || null,
          inputFileName: data.fileName || null,
          inputMimeType: data.mimeType || null,
          status: 'PENDING',
        },
      });

      await tx.processingJob.create({
        data: {
          contentId: content.id,
          status: 'PENDING',
          idempotencyKey: content.id,
        },
      });

      await this.nlpTaskService.dispatchNlpTask({
        contentId: content.id,
        ...data,
      });

      return content;
    });
  }

  private async handleTextSubmission(text: string) {
    return await this.createContent({ text });
  }

  private async handleFileSubmission(objectKey: string, fileName?: string, mimeType?: string) {
    // Verification logic
    const file = this.storageService['storage'].bucket(this.storageService['bucket']).file(objectKey);
    const [metadata] = await file.getMetadata();

    if (!metadata) {
      throw new BadRequestException('File not found');
    }

    if (metadata.size && parseInt(String(metadata.size), 10) > 10 * 1024 * 1024) {
      throw new BadRequestException('File exceeds 10MB');
    }

    return await this.createContent({ objectKey, fileName, mimeType });
  }
}
