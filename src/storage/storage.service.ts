import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private storage: Storage;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.storage = new Storage();
    this.bucket = this.configService.get<string>('GCS_BUCKET_NAME') || 'jlpt-study-material-bucket';
  }

  async uploadFile(filename: string, buffer: Buffer): Promise<string> {
    const bucket = this.storage.bucket(this.bucket);
    const file = bucket.file(filename);

    await file.save(buffer, {
      resumable: false,
    });

    return `gs://${this.bucket}/${filename}`;
  }
}
