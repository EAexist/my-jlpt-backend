import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { map, finalize, Observable } from 'rxjs';
import { IsString, IsNotEmpty } from 'class-validator';

class UploadUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContentIngestionService } from './content-ingestion/content-ingestion.service';
import { JobStatusService } from '../job/job-status/job-status.service';

@Controller('content')
export class ContentController {
  constructor(
    private readonly ingestionService: ContentIngestionService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  @Post('/upload-url')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async uploadUrl(@Body() body: UploadUrlDto) {
    if (!['application/pdf', 'text/plain'].includes(body.mimeType)) {
      throw new BadRequestException('Unsupported MIME type');
    }
    const objectKey = `uploads/${Date.now()}-${body.fileName}`;
    const url = await this.storageService.getSignedPutUrl(
      objectKey,
      body.mimeType,
    );
    return { url, objectKey, expiresAt: new Date(Date.now() + 15 * 60 * 1000) };
  }

  @Post()
  async create(@Body() body: any) {
    return await this.ingestionService.handleSubmission(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) {
      throw new BadRequestException('Content not found');
    }
    return content;
  }

  @Sse(':id/status')
  async getStatus(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: { processingJob: true },
    });

    if (!content || !content.processingJob) {
      throw new BadRequestException('Content or processing job not found');
    }

    return this.jobStatusService.getJobStatus(content.processingJob).pipe(
      map((job) => ({
        data: {
          status: job.status,
          progress: job.progress,
          currentStep: job.currentStep,
          errorMessage: job.errorMessage,
        },
      })),
      finalize(() =>
        console.log(
          `SSE client disconnected for job ${content.processingJob!.id}`,
        ),
      ),
    );
  }
}
