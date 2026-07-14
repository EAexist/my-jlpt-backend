import { Injectable, BadRequestException } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class ContentIngestionService {
  constructor(private readonly storageService: StorageService) {}

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

  private async handleTextSubmission(text: string) {
    // Logic for raw text submission
    return { type: 'text', text };
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

    // Additional checks (mimeType, etc.) can be performed here

    return { type: 'file', objectKey, fileName, mimeType };
  }
}
