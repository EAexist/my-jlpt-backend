import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatusService } from './job-status/job-status.service';

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  async handleCallback(jobId: string, result: any) {
    return await this.prisma.$transaction(async (tx) => {
      const job = await tx.processingJob.findUnique({
        where: { id: jobId },
        include: { content: true },
      });

      if (!job) {
        throw new BadRequestException('Job not found');
      }

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        return; // Already processed
      }

      // Persist results
      const contentId = job.contentId;
      await tx.sentenceAnalysis.createMany({
        data: result.chunks.map((chunk: any, index: number) => ({
          contentId,
          position: index,
          text: chunk.text,
          translation: '', // Placeholder
          level: 'N5',
        })),
      });

      await tx.vocabularyItem.createMany({
        data: result.vocabulary.map((vocab: any) => ({
          contentId,
          word: vocab.word,
          reading: vocab.reading,
          level: vocab.level || null,
          translation: vocab.translation || '',
        })),
        skipDuplicates: true,
      });

      if (result.grammarExamples && result.grammarExamples.length > 0) {
        await tx.grammarExample.createMany({
          data: result.grammarExamples.map((ex: any) => ({
            grammarPointId: ex.grammarPointId,
            japanese: ex.japanese,
            translation: ex.translation || '',
            position: ex.position || 1,
          })),
        });
      }

      // Update job status to COMPLETED
      const updatedJob = await tx.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentStep: 'COMPLETED',
        },
      });

      await tx.content.update({
        where: { id: contentId },
        data: { status: 'COMPLETED' },
      });

      this.jobStatusService.updateJobStatus(updatedJob);
    });
  }
}
