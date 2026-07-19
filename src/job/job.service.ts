import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatusService } from './job-status/job-status.service';

export interface Chunk {
  text: string;
}

export interface Vocabulary {
  word: string;
  reading: string;
  level?: number;
  translation: string;
}

export interface GrammarExample {
  grammarPatternId: string;
  japanese: string;
  translation?: string;
  position?: number;
}

export interface JobCallbackResult {
  chunks: Chunk[];
  vocabulary: Vocabulary[];
  grammarExamples?: GrammarExample[];
}

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  async handleCallback(jobId: string, result: JobCallbackResult) {
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
      await tx.section.createMany({
        data: result.chunks.map((chunk, index) => ({
          contentId,
          position: index,
          text: chunk.text,
          translation: '', // Placeholder
          level: 5,
        })),
      });

      await tx.vocabularyItem.createMany({
        data: result.vocabulary.map((vocab) => ({
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
          data: result.grammarExamples.map((ex) => ({
            grammarPatternId: ex.grammarPatternId,
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
