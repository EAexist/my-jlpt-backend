import { Injectable } from '@nestjs/common';
import { Content as ContentEntity } from '../generated/prisma';
import {
  BaseContent,
  CompletedContent,
  FailedContent,
  ProcessingContent,
} from './content.schemas';

@Injectable()
export class ContentPresenter {
  mapToResponse(
    content: ContentEntity & {
      progress?: number;
      currentStep?: string;
    },
  ): BaseContent | ProcessingContent | FailedContent | CompletedContent {
    const base: BaseContent = {
      id: content.id,
      status: content.status as
        'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
      title: content.title,
      groupId: content.groupId,
      inputText: content.inputText || '',
      createdAt: content.createdAt.toISOString(),
    };

    if (content.status === 'FAILED') {
      return {
        ...base,
        status: 'FAILED',
        errorMessage: content.errorMessage || 'Unknown error',
      };
    }

    if (content.status === 'COMPLETED') {
      return {
        ...base,
        status: 'COMPLETED',
        overallLevel: this.mapLevel(content.overallLevel),
      };
    }

    return {
      ...base,
      status: content.status as 'PENDING' | 'PROCESSING',
      progress: content.progress || 0,
      currentStep: content.currentStep || '',
    };
  }

  private mapLevel(level: number | null): 'N1' | 'N2' | 'N3' | 'N4' | 'N5' {
    const levels: Record<number, 'N1' | 'N2' | 'N3' | 'N4' | 'N5'> = {
      1: 'N1',
      2: 'N2',
      3: 'N3',
      4: 'N4',
      5: 'N5',
    };
    return levels[level || 0] || 'N5';
  }
}
