import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private storage: Storage;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.storage = new Storage();
    this.bucket =
      this.configService.get<string>('GCS_BUCKET_NAME') ||
      'jlpt-study-material-bucket';
  }

  async getSignedPutUrl(objectKey: string, contentType: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucket);
    const file = bucket.file(objectKey);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    });

    return url;
  }

  async verifyObjectMetadata(objectKey: string, expectedMimeType: string) {
    const bucket = this.storage.bucket(this.bucket);
    const file = bucket.file(objectKey);

    const [metadata] = await file.getMetadata();
    
    if (metadata.contentType !== expectedMimeType) {
      throw new Error('MIME type mismatch');
    }

    if (metadata.size && parseInt(String(metadata.size), 10) > 10 * 1024 * 1024) {
      throw new Error('File exceeds 10MB limit');
    }

    return metadata;
  }
}
